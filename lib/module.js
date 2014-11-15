/* jshint node:true, undef:true, unused:true */

var assert = require('assert');
var fs = require('fs');
var Path = require('path');

var esprima = require('esprima-fb');
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
    /**
     * @type {string}
     * @name Module#path
     */
    path: {
      value: path,
      enumerable: true,
      writable: false
    },

    /**
     * @type {string}
     * @name Module#relativePath
     */
    relativePath: {
      value: relativePath,
      enumerable: true,
      writable: false
    },

    /**
     * @type {string}
     * @name Module#sourceFileName
     */
    sourceFileName: {
      value: Path.relative(container.basePath, path),
      enumerable: true,
      writable: false
    },

    /**
     * @type {Container}
     * @name Module#container
     */
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
 * @name Module#imports
 */
memo(Module.prototype, 'imports', /** @this Module */function() {
  var result = new ImportDeclarationList(this);
  result.readProgram(this.ast.program);
  return result;
});

/**
 * The list of exports declared by this module.
 *
 * @type {ExportDeclarationList}
 * @name Module#exports
 */
memo(Module.prototype, 'exports', /** @this Module */function() {
  var result = new ExportDeclarationList(this);
  result.readProgram(this.ast.program);
  return result;
});

/**
 * This module's scope.
 *
 * @type {Scope}
 * @name Module#scope
 */
memo(Module.prototype, 'scope', /** @this Module */function() {
  return new NodePath(this.ast).get('program').get('body').scope;
});

/**
 * This module's source code represented as an abstract syntax tree.
 *
 * @type {File}
 * @name Module#ast
 */
memo(Module.prototype, 'ast', /** @this Module */function() {
  return recast.parse(
    this.src, {
      esprima: esprima,
      sourceFileName: this.sourceFileName
    }
  );
});

/**
 * This module's source code.
 *
 * @type {String}
 * @name Module#src
 */
memo(Module.prototype, 'src', /** @this Module */function() {
  return fs.readFileSync(this.path).toString();
});

/**
 * A reference to the options from this module's container.
 *
 * @type {object}
 * @name Module#options
 */
memo(Module.prototype, 'options', /** @this Module */function() {
  return this.container.options;
});

/**
 * This module's relative name, like {#relativePath} but without the extension.
 * This may be modified by a Container if this Module is part of a Container.
 *
 * @type {string}
 * @name Module#name
 */
memo(Module.prototype, 'name', /** @this Module */function() {
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
 * @name Module#id
 */
memo(Module.prototype, 'id', /** @this Module */function() {
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
 * Generate a descriptive string suitable for debugging.
 *
 * @return {string}
 */
Module.prototype.inspect = function() {
  return '#<' + this.constructor.name + ' ' + this.relativePath + '>';
};

/**
 * @see Module#inspect
 */
Module.prototype.toString = Module.prototype.inspect;

module.exports = Module;
