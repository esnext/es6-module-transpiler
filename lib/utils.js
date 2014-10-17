/* jshint node:true, undef:true, unused:true */

var recast = require('recast');
var esprima = require('esprima-fb');
var fs = require('fs');

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

function IFFE() {
  if (!IFFE.AST) {
    IFFE.AST = JSON.stringify(
      recast.parse('(function(){}).call(this)', { esprima: esprima })
    );
  }

  var result = JSON.parse(IFFE.AST);
  var expression = result.program.body[0].expression;
  var body = expression.callee.object.body.body;

  var args = Array.prototype.slice.call(arguments);
  args.forEach(function(arg) {
    if (Object.prototype.toString.call(arg) === '[object Array]') {
      body.push.apply(body, arg);
    } else {
      body.push(arg);
    }
  });

  return expression;
}
exports.IFFE = IFFE;

function mkdirpSync(path) {
  var parts = path.split('/');
  var dir = '';

  parts.forEach(function(part,i) {
    dir += (i>0?'/':'') + part;
    if (dir && !fs.existsSync(dir)) {
      fs.mkdirSync(dir);
    }
  });
}
exports.mkdirpSync = mkdirpSync;
