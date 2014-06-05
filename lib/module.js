/* jshint node:true, undef:true, unused:true */

var assert = require('assert');
var fs = require('fs');

var esprima = require('esprima');
var recast = require('recast');
var types = recast.types;
var n = types.namedTypes;
var b = types.builders;
var NodePath = recast.types.NodePath;

var ImportDeclarationList = require('./imports');
var ExportDeclarationList = require('./exports');
var utils = require('./utils');
var memo = utils.memo;
var endsWith = utils.endsWith;

function Module(path, relativePath, container) {
  Object.defineProperties(this, {
    path: {
      value: path,
      enumerable: true,
      writable: false
    },

    relativePath: {
      value: relativePath,
      enumerable: true,
      writable: false
    },

    container: {
      value: container,
      enumerable: true,
      writable: false
    }
  });
}

/**
 * Clears the cached data for this module.
 */
Module.prototype.reload = function() {
  delete this.ast;
  delete this.imports;
  delete this.exports;
  delete this.scope;
};

/**
 * The list of imports declared by this module.
 *
 * @type {ImportDeclarationList}
 * @property imports
 */
memo(Module.prototype, 'imports', function() {
  var result = new ImportDeclarationList(this);
  result.readProgram(this.ast.program);
  return result;
});

/**
 * The list of exports declared by this module.
 *
 * @type {ExportDeclarationList}
 * @property exports
 */
memo(Module.prototype, 'exports', function() {
  var result = new ExportDeclarationList(this);
  result.readProgram(this.ast.program);
  return result;
});

/**
 * This module's scope.
 *
 * @type {ast-types.Scope}
 * @property scope
 */
memo(Module.prototype, 'scope', function() {
  return new NodePath(this.ast).get('program').get('body').scope;
});

/**
 * This module's source code represented as an abstract syntax tree.
 *
 * @type {ast-types.File}
 * @property ast
 */
memo(Module.prototype, 'ast', function() {
  return recast.parse(
    fs.readFileSync(this.path).toString(),
    { esprima: esprima }
  );
});

/**
 * A reference to the options from this module's container.
 *
 * @type {object}
 * @property options
 */
memo(Module.prototype, 'options', function() {
  return this.container.options;
});

/**
 * This module's relative name, like {#relativePath} but without the extension.
 * This may be modified by a Container if this Module is part of a Container.
 *
 * @type {string}
 * @property name
 */
memo(Module.prototype, 'name', function() {
  var relativePath = this.relativePath;
  if (endsWith(relativePath, '.js')) {
    return relativePath.slice(0, -3);
  } else {
    return relativePath;
  }
});

/**
 * A string suitable for a JavaScript identifier named for this module.
 *
 * @type {string}
 * @property id
 */
memo(Module.prototype, 'id', function() {
  return this.name.replace(/[^\w$_]/g, '$') + '$$';
});

/**
 * Gets a Module by path relative to this module.
 *
 * @param {string} sourcePath
 * @return {Module}
 */
Module.prototype.getModule = function(sourcePath) {
  return this.container.getModule(sourcePath, this);
};

/**
 */
Module.prototype.getExportReference = function(identifier) {
  var name;
  if (n.Identifier.check(identifier)) {
    name = identifier.name;
  } else {
    name = identifier;
    identifier = null;
  }
  assert.equal(typeof name, 'string');

  // TODO: Use constant for 'compression'.
  if (this.options.optimize === 'compression') {
    return b.identifier(this.id + name);
  } else {
    return b.memberExpression(
      b.identifier(this.id),
      identifier || b.identifier(name),
      false
    );
  }
};

/**
 * Gets a reference to the original exported value corresponding to the local
 * binding created by this import with the name given by `identfier`.
 *
 * @param {ast-types.NodePath} referencePath
 * @return {ast-types.Expression}
 */
Module.prototype.getBindingReference = function(referencePath) {
  var imp = this.imports.findImportForReference(referencePath);
  return imp;
};

/**
 * Generate a descriptive string suitable for debugging.
 *
 * @return {string}
 */
Module.prototype.inspect = function() {
  return '#<' + this.constructor.name + ' ' + this.relativePath + '>';
};

/**
 * @alias {#inspect}
 */
Module.prototype.toString = Module.prototype.inspect;

module.exports = Module;
