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
  switch (node.kind) {
    case 'default':
      return new DefaultImportDeclaration(this.module, node);

    case 'named':
      return new NamedImportDeclaration(this.module, node);

    case undefined:
      return new BareImportDeclaration(this.module, node);

    default:
      assert.ok(false, 'unexpected import kind at ' + sourcePosition(this.module, node) + ': ' + node.kind);
      break;
  }
};

/**
 * Contains information about an import declaration.
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
 * Represents a default import of the form
 *
 *   ```js
 *   import List from 'list';
 *   ```
 *
 * @constructor
 * @extends ImportDeclaration
 * @param {Module} mod
 * @param {AST.ImportDeclaration} node
 */
function DefaultImportDeclaration(mod, node) {
  assert.equal(node.kind, 'default');
  assert.ok(
    node.specifiers.length === 1 && node.specifiers[0],
    'expected exactly one specifier for a default import, got ' +
      node.specifiers.length
  );

  ImportDeclaration.call(this, mod, node);
}
extend(DefaultImportDeclaration, ImportDeclaration);

/**
 * Contains a list of specifier name information for this import.
 *
 * @type {ImportSpecifier[]}
 * @name DefaultImportDeclaration#specifiers
 */
memo(DefaultImportDeclaration.prototype, 'specifiers', /** @this DefaultImportDeclaration */function() {
  var specifier = new ImportSpecifier(this, this.node.specifiers[0]);
  specifier.from = 'default';
  assert.equal(specifier.from, 'default');
  return [specifier];
});

/**
 * Represents a named import of the form
 *
 *   ```js
 *   import { sin, cos } from 'math';
 *   ```
 *
 * @constructor
 * @extends ImportDeclaration
 * @param {Module} mod
 * @param {AST.ImportDeclaration} node
 */
function NamedImportDeclaration(mod, node) {
  assert.equal(node.kind, 'named');
  ImportDeclaration.call(this, mod, node);
}
extend(NamedImportDeclaration, ImportDeclaration);

/**
 * Contains a list of specifier name information for this import.
 *
 * @type {ImportSpecifier[]}
 * @name NamedImportDeclaration#specifiers
 */
memo(NamedImportDeclaration.prototype, 'specifiers', /** @this NamedImportDeclaration */function() {
  var self = this;
  return this.node.specifiers.map(function(specifier) {
    return new ImportSpecifier(self, specifier);
  });
});

/**
 * Represents an import with no bindings created in the local scope. These
 * imports are of the form `import 'path/to/module'` and are generally included
 * only for their side effects.
 *
 * @constructor
 * @extends ImportDeclaration
 * @param {Module} mod
 * @param {AST.ImportDeclaration} node
 */
function BareImportDeclaration(mod, node) {
  assert.ok(
    node.kind === undefined && node.specifiers.length === 0,
    'expected a bare import at ' + sourcePosition(mod, node) +
    ', got one with kind=' + node.kind + ' and ' +
    node.specifiers.length + ' specifier(s)'
  );
  ImportDeclaration.call(this, mod, node);
}
extend(BareImportDeclaration, ImportDeclaration);

/**
 * Returns an empty set of specifiers.
 *
 * @type {ImportSpecifier[]}
 * @name BareImportDeclaration#specifiers
 */
memo(BareImportDeclaration.prototype, 'specifiers', /** @this BareImportDeclaration */function() {
  return [];
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
