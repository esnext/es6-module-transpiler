/* jshint node:true, undef:true, unused:true */

var assert = require('assert');
var fs = require('fs');
var Path = require('path');

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

/**
 * Represents a JavaScript module at a particular location on disk.
 *
 * @param {string} path
 * @param {string} relativePath
 * @param {Container} container
 * @constructor
 */
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
  delete this.src;
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
 * @type {Scope}
 * @property scope
 */
memo(Module.prototype, 'scope', function() {
  return new NodePath(this.ast).get('program').get('body').scope;
});

/**
 * This module's source code represented as an abstract syntax tree.
 *
 * @type {File}
 * @property ast
 */
memo(Module.prototype, 'ast', function() {
  return recast.parse(
    this.src, {
      esprima: esprima,
      sourceFileName: Path.basename(this.path)
    }
  );
});

/**
 * This module's source code.
 *
 * @type {String}
 * @property src
 */
memo(Module.prototype, 'src', function() {
  return fs.readFileSync(this.path).toString();
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
 * Gets a reference to the original exported value corresponding to the local
 * binding created by this import with the name given by `identifier`.
 *
 * @param {NodePath} referencePath
 * @return {Expression}
 */
Module.prototype.getBindingReference = function(referencePath) {
  return this.imports.findImportForReference(referencePath);
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
