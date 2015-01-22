/* jshint node:true, undef:true, unused:true */

var recast = require('recast');
var n = recast.types.namedTypes;
var b = recast.types.builders;
var reserved = require('reserved');
var realFS = require('fs');
var Path = require('path');

var proto = '__proto__';

function memo(object, property, getter) {
  Object.defineProperty(object, property, {
    get: function() {
      this[property] = getter.call(this);
      return this[property];
    },

    set: function(value) {
      Object.defineProperty(this, property, {
        value: value,
        configurable: true,
        writable: true
      });
    }
  });
}
exports.memo = memo;

function startsWith(string, substring) {
  return string.lastIndexOf(substring, 0) === 0;
}
exports.startsWith = startsWith;

function endsWith(string, substring) {
  var expected = string.length - substring.length;
  return string.indexOf(substring, expected) === expected;
}
exports.endsWith = endsWith;

function extend(subclass, superclass) {
  subclass[proto] = superclass;
  subclass.prototype = Object.create(superclass.prototype);
  subclass.prototype.constructor = subclass;
}
exports.extend = extend;

function sourcePosition(mod, node) {
  var loc = node && node.loc;
  if (loc) {
    return mod.relativePath + ':' + loc.start.line + ':' + (loc.start.column + 1);
  } else {
    return mod.relativePath;
  }
}
exports.sourcePosition = sourcePosition;

function IIFE() {
  var body = [];
  var args = Array.prototype.concat.apply(body, arguments);

  args.forEach(function(node) {
    if (n.Expression.check(node)) {
      node = b.expressionStatement(node);
    }
    if (n.Statement.check(node)) {
      body.push(node);
    }
  });

  return b.callExpression(
    b.memberExpression(
      b.functionExpression(null, [], b.blockStatement(body)),
      b.identifier("call"),
      false
    ),
    [b.thisExpression()]
  );
}
exports.IIFE = IIFE;

/**
 * Create a member express that is compatible with ES3. Which means
 * reserved words will be treated as computed props. E.g.:
 *
 *    foo["default"] // instead of `foo.default`
 *
 * while still supporting identifiers for non-reserved words:
 *
 *    foo.bar        // since bar is not reserved
 *
 * @param {Identifier} obj Identifier for the object reference
 * @param {Identifier|String} prop Identifier or string name for the member property
 * @return {b.memberExpression} AST for the member expression
 */
function compatMemberExpression(obj, prop) {
  var isIdentifier = n.Identifier.check(prop);
  var name = isIdentifier ? prop.name : prop;
  var computed = reserved.indexOf(name) >= 0;
  return b.memberExpression(
    obj,
    computed ? b.literal(name) : (isIdentifier ? prop : b.identifier(prop)),
    computed
  );
}

exports.compatMemberExpression = compatMemberExpression;

/**
 * Create a hierarchy of directories of it does not already exist.
 *
 * @param {string} path
 * @param {{fs: object=}} options
 */
function mkdirpSync(path, options) {
  var fs = options && options.fs || realFS;

  var ancestors = [];
  var ancestor = path;

  while (true) {
    var nextAncestor = Path.dirname(ancestor);
    if (nextAncestor === ancestor) { break; }
    ancestors.unshift(ancestor);
    ancestor = nextAncestor;
  }

  ancestors.forEach(function(dir) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir);
    }
  });
}
exports.mkdirpSync = mkdirpSync;
