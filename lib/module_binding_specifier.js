/* jshint node:true, undef:true, unused:true */

var assert = require('assert');

var recast = require('recast');
var types = recast.types;
var n = types.namedTypes;

var utils = require('./utils');
var memo = utils.memo;
var sourcePosition = utils.sourcePosition;

/**
 */
function ModuleBindingSpecifier(declaration, node) {
  Object.defineProperties(this, {
    declaration: {
      value: declaration,
      enumerable: false
    },

    node: {
      value: node,
      enumerable: false
    }
  });
}

/**
 */
memo(ModuleBindingSpecifier.prototype, 'module', function() {
  return this.declaration.module;
});

/**
 */
memo(ModuleBindingSpecifier.prototype, 'moduleScope', function() {
  return this.declaration.moduleScope;
});

/**
 */
memo(ModuleBindingSpecifier.prototype, 'name', function() {
  return this.identifier.name;
});

/**
 */
memo(ModuleBindingSpecifier.prototype, 'from', function() {
  return this.node.id.name;
});

/**
 */
memo(ModuleBindingSpecifier.prototype, 'identifier', function() {
  return this.node.name || this.node.id;
});

/**
 */
memo(ModuleBindingSpecifier.prototype, 'exportSpecifier', function() {
  var source = this.declaration.source;
  if (source) {
    var exports = source.exports;
    return exports.findSpecifierByName(this.from);
  } else {
    return null;
  }
});

memo(ModuleBindingSpecifier.prototype, 'importSpecifier', function() {
  // This may be an export from this module, so find the declaration.
  var localExportDeclarationInfo = this.moduleDeclaration;

  if (localExportDeclarationInfo && n.ImportDeclaration.check(localExportDeclarationInfo.declaration)) {
    // It was imported then exported with two separate declarations.
    var exportModule = this.module;
    return exportModule.imports.findSpecifierByIdentifier(localExportDeclarationInfo.identifier);
  } else {
    return null;
  }
});

memo(ModuleBindingSpecifier.prototype, 'terminalExportSpecifier', function() {
  if (this.exportSpecifier) {
    // This is true for both imports and exports with a source, e.g.
    // `import { foo } from 'foo'` or `export { foo } from 'foo'`.
    return this.exportSpecifier.terminalExportSpecifier;
  }

  // This is an export from this module, so find the declaration.
  var importSpecifier = this.importSpecifier;
  if (importSpecifier) {
    var nextExportSpecifier = importSpecifier.exportSpecifier;
    assert.ok(
      nextExportSpecifier,
      'expected matching export in ' + importSpecifier.declaration.source.relativePath +
      ' for import of `' + importSpecifier.name + '` at ' +
      sourcePosition(this.module, this.moduleDeclaration.identifier)
    );
    return nextExportSpecifier.terminalExportSpecifier;
  } else {
    // It was declared in this module, so we are the terminal export specifier.
    return this;
  }
});

/**
 */
ModuleBindingSpecifier.prototype.inspect = function() {
  return '#<' + this.constructor.name +
    ' module=' + this.declaration.module.relativePath +
    ' name=' + this.name +
    ' from=' + this.from +
    '>';
};

ModuleBindingSpecifier.prototype.toString = ModuleBindingSpecifier.prototype.inspect;

module.exports = ModuleBindingSpecifier;
