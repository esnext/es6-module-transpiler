/* jshint node:true, undef:true, unused:true */

var assert = require('assert');
var recast = require('recast');
var types = recast.types;
var n = types.namedTypes;

var ModuleBindingList = require('./module_binding_list');
var ModuleBindingDeclaration = require('./module_binding_declaration');
var ModuleBindingSpecifier = require('./module_binding_specifier');

var utils = require('./utils');
var memo = utils.memo;
var extend = utils.extend;
var sourcePosition = utils.sourcePosition;

/**
 * Represents a list of the imports for the given module.
 *
 * @constructor
 * @param {Module} mod
 * @extends ModuleBindingList
 */
function ImportDeclarationList(mod) {
  ModuleBindingList.call(this, mod);
}
extend(ImportDeclarationList, ModuleBindingList);

/**
 * @private
 * @param {AST.Node} node
 * @return {boolean}
 */
ImportDeclarationList.prototype.isMatchingBinding = function(node) {
  return n.ImportDeclaration.check(node);
};

/**
 * Gets an import declaration for the given `node`.
 *
 * @private
 * @param {AST.ImportDeclaration} node
 * @return {ImportDeclaration}
 */
ImportDeclarationList.prototype.declarationForNode = function(node) {
  return new ImportDeclaration(this.module, node);
};

/**
 * Contains information about an import declaration.
 *
 *   ```js
 *   import foo from 'math';
 *   import { sin, cos } from 'math';
 *   import * as bar from 'math';
 *   import foo, { sin, cos } from 'math';
 *   import foo, * as bar from 'math';
 *   ```
 *
 * @constructor
 * @abstract
 * @param {Module} mod
 * @param {AST.ImportDeclaration} node
 * @extends ModuleBindingDeclaration
 */
function ImportDeclaration(mod, node) {
  assert.ok(
    n.ImportDeclaration.check(node),
    'expected an import declaration, got ' + (node && node.type)
  );

  ModuleBindingDeclaration.call(this, mod, node);
}
extend(ImportDeclaration, ModuleBindingDeclaration);

/**
 * Contains a list of specifier name information for this import.
 *
 * @type {ImportSpecifier[]}
 * @name ImportDeclaration#specifiers
 */
memo(ImportDeclaration.prototype, 'specifiers', /** @this ImportDeclaration */function() {
  var self = this;
  return this.node.specifiers.map(function(s) {
    var specifier = new ImportSpecifier(self, s);
    if (n.ImportDefaultSpecifier.check(s)) {
      specifier.from = 'default';
    } else if (n.ImportNamespaceSpecifier.check(s)) {
      // TODO: implement import * as ...
      specifier.from = '*';
    } else {
      specifier = new ImportSpecifier(self, s);
    }
    return specifier;
  });
});

/**
 * Represents an import specifier. The "a" and "b as c" are both import
 * specifiers in the following import statement.
 *
 *   import { a, b as c } from "a";
 *
 * @constructor
 * @extends ModuleBindingSpecifier
 * @param {ImportDeclaration} declaration
 * @param {AST.ImportSpecifier} node
 */
function ImportSpecifier(declaration, node) {
  assert.ok(
    declaration instanceof ImportDeclaration,
    'expected an instance of ImportDeclaration'
  );
  ModuleBindingSpecifier.call(this, declaration, node);
}
extend(ImportSpecifier, ModuleBindingSpecifier);

/**
 * @type {ExportSpecifier}
 * @name ImportSpecifier#exportSpecifier
 */
memo(ImportSpecifier.prototype, 'exportSpecifier', /** @this ImportSpecifier */function() {
  var source = this.declaration.source;
  assert.ok(source, 'import specifiers must have a valid source');
  var exportSpecifier = source.exports.findSpecifierByName(this.from);
  assert.ok(
    exportSpecifier,
    'import `' + this.from + '` at ' +
    sourcePosition(this.module, this.node) +
    ' has no matching export in ' + source.relativePath
  );
  return exportSpecifier;
});

module.exports = ImportDeclarationList;
