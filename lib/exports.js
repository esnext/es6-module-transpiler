/* jshint node:true, undef:true, unused:true */

var assert = require('assert');

var recast = require('recast');
var types = recast.types;
var n = types.namedTypes;

var ModuleBindingList = require('./module_binding_list');
var ModuleBindingDeclaration = require('./module_binding_declaration');
var ModuleBindingSpecifier = require('./module_binding_specifier');
var DeclarationInfo = require('./declaration_info');

var utils = require('./utils');
var memo = utils.memo;
var extend = utils.extend;
var sourcePosition = utils.sourcePosition;

/**
 * Represents a list of the exports for the given module.
 *
 * @constructor
 * @extends ModuleBindingList
 * @param {Module} mod
 */
function ExportDeclarationList(mod) {
  ModuleBindingList.call(this, mod);
}
extend(ExportDeclarationList, ModuleBindingList);

/**
 * @private
 * @param {AST.Declaration} node
 * @return {boolean}
 */
ExportDeclarationList.prototype.isMatchingBinding = function(node) {
  return n.ExportDeclaration.check(node);
};

/**
 * Gets an export declaration for the given `node`.
 *
 * @private
 * @param {AST.ExportDeclaration} node
 * @return {ExportDeclaration}
 */
ExportDeclarationList.prototype.declarationForNode = function(node) {
  if (node.default) {
    return new DefaultExportDeclaration(this.module, node);
  } else if (n.VariableDeclaration.check(node.declaration)) {
    return new VariableExportDeclaration(this.module, node);
  } else if (n.FunctionDeclaration.check(node.declaration)) {
    return new FunctionExportDeclaration(this.module, node);
  } else if (n.ClassDeclaration.check(node.declaration)) {
    return new ClassExportDeclaration(this.module, node);
  } else if (n.ExportBatchSpecifier.check(node.specifiers[0])) {
    throw new Error(
      '`export *` found at ' + sourcePosition(this.module, node) +
      ' is not supported, please use `export { … }` instead'
    );
  } else {
    return new NamedExportDeclaration(this.module, node);
  }
};

/**
 * @param {NodePath} referencePath
 * @return {?ExportSpecifier}
 */
ExportDeclarationList.prototype.findSpecifierForReference = function(referencePath) {
  if (n.ExportSpecifier.check(referencePath.parent.node) && referencePath.parent.parent.node.source) {
    // This is a direct export from another module, e.g. `export { foo } from 'foo'`.
    return /** @type {ExportSpecifier} */this.findSpecifierByIdentifier(referencePath.node);
  }

  var declaration = this.findDeclarationForReference(referencePath);

  if (!declaration) {
    return null;
  }

  var specifier = /** @type {ExportSpecifier} */this.findSpecifierByName(declaration.node.name);
  assert.ok(
    specifier,
    'no specifier found for `' + referencePath.node.name + '`! this should not happen!'
  );
  return specifier;
};

/**
 * Contains information about an export declaration.
 *
 * @constructor
 * @abstract
 * @extends ModuleBindingDeclaration
 * @param {Module} mod
 * @param {ExportDeclaration} node
 */
function ExportDeclaration(mod, node) {
  assert.ok(
    n.ExportDeclaration.check(node),
    'expected an export declaration, got ' + (node && node.type)
  );

  ModuleBindingDeclaration.call(this, mod, node);
}
extend(ExportDeclaration, ModuleBindingDeclaration);

/**
 * Returns a string description suitable for debugging.
 *
 * @return {string}
 */
ExportDeclaration.prototype.inspect = function() {
  return recast.print(this.node).code;
};

/**
 * @see ExportDeclaration#inspect
 */
ExportDeclaration.prototype.toString = ExportDeclaration.prototype.inspect;

/**
 * Represents an export declaration of the form:
 *
 *   export default foo;
 *
 * @constructor
 * @extends ExportDeclaration
 * @param {Module} mod
 * @param {AST.ExportDeclaration} node
 */
function DefaultExportDeclaration(mod, node) {
  ExportDeclaration.call(this, mod, node);
}
extend(DefaultExportDeclaration, ExportDeclaration);

/**
 * Contains a list of specifier name information for this export.
 *
 * @type {ExportSpecifier[]}
 * @name DefaultExportSpecifier#specifiers
 */
memo(DefaultExportDeclaration.prototype, 'specifiers', /** @this DefaultExportDeclaration */function() {
  var specifier = new DefaultExportSpecifier(this, this.node.declaration);
  return [specifier];
});

/**
 * Represents an export declaration of the form:
 *
 *   export { foo, bar };
 *
 * @constructor
 * @extends ExportDeclaration
 * @param {Module} mod
 * @param {AST.ExportDeclaration} node
 */
function NamedExportDeclaration(mod, node) {
  ExportDeclaration.call(this, mod, node);
}
extend(NamedExportDeclaration, ExportDeclaration);

/**
 * Contains a list of specifier name information for this export.
 *
 * @type {ExportSpecifier[]}
 * @name NamedExportDeclaration#specifiers
 */
memo(NamedExportDeclaration.prototype, 'specifiers', /** @this NamedExportDeclaration */function() {
  var self = this;
  return this.node.specifiers.map(function(specifier) {
    return new ExportSpecifier(self, specifier);
  });
});

/**
 * Represents an export declaration of the form:
 *
 *   export var foo = 1;
 *
 * @constructor
 * @extends ExportDeclaration
 * @param {Module} mod
 * @param {AST.ExportDeclaration} node
 */
function VariableExportDeclaration(mod, node) {
  ExportDeclaration.call(this, mod, node);
}
extend(VariableExportDeclaration, ExportDeclaration);

/**
 * Gets the list of export specifiers for this declaration.
 *
 * @type {ExportSpecifier[]}
 * @name VariableExportDeclaration#specifiers
 */
memo(VariableExportDeclaration.prototype, 'specifiers', /** @this VariableExportDeclaration */function() {
  var self = this;
  return this.node.declaration.declarations.map(function(declarator) {
    return new ExportSpecifier(self, declarator);
  });
});

/**
 * Represents an export declaration of the form:
 *
 *   export class Foo {}
 *
 * @constructor
 * @extends ExportDeclaration
 * @param {Module} mod
 * @param {AST.ExportDeclaration} node
 */
function ClassExportDeclaration(mod, node) {
  ExportDeclaration.call(this, mod, node);
}
extend(ClassExportDeclaration, ExportDeclaration);

/**
 * Gets the list of export specifiers for this declaration.
 *
 * @type {ExportSpecifier[]}
 * @name ClassExportDeclaration#specifiers
 */
memo(ClassExportDeclaration.prototype, 'specifiers', /** @this ClassExportDeclaration */function() {
  return [new ExportSpecifier(this, this.node.declaration)];
});

/**
 * Represents an export declaration of the form:
 *
 *   export function foo() {}
 *
 * @constructor
 * @extends ExportDeclaration
 * @param {Module} mod
 * @param {AST.ExportDeclaration} node
 */
function FunctionExportDeclaration(mod, node) {
  ExportDeclaration.call(this, mod, node);
}
extend(FunctionExportDeclaration, ExportDeclaration);

/**
 * Gets the list of export specifiers for this declaration.
 *
 * @type {ExportSpecifier[]}
 * @name FunctionExportDeclaration#specifiers
 */
memo(FunctionExportDeclaration.prototype, 'specifiers', /** @this FunctionExportDeclaration */function() {
  return [new ExportSpecifier(this, this.node.declaration)];
});

/**
 * Represents an export specifier in an export declaration.
 *
 * @constructor
 * @extends ModuleBindingSpecifier
 * @param {ExportDeclaration} declaration
 * @param {AST.Node} node
 */
function ExportSpecifier(declaration, node) {
  ModuleBindingSpecifier.call(this, declaration, node);
}
extend(ExportSpecifier, ModuleBindingSpecifier);

/**
 * Contains the local declaration info for this export specifier. For example,
 * in this module:
 *
 *   var a = 1;
 *   export { a };
 *
 * The module declaration info for the `a` export specifier is the variable
 * declaration plus the `a` identifier in its first declarator.
 *
 * @type {?DeclarationInfo}
 * @name ExportSpecifier#moduleDeclaration
 */
memo(ExportSpecifier.prototype, 'moduleDeclaration', /** @this ExportSpecifier */function() {
  if (this.declaration.source) {
    // This is part of a direct export, e.g. `export { ... } from '...'`, so
    // there is no declaration as part of this module.
    return null;
  }

  var bindings = this.moduleScope.getBindings();
  var identifierPaths = bindings[this.from];
  assert.ok(
    identifierPaths && identifierPaths.length === 1,
    'expected exactly one declaration for export `' +
    this.from + '` at ' + sourcePosition(this.module, this.node) +
    ', found ' + (identifierPaths ? identifierPaths.length : 'none')
  );

  var identifierPath = identifierPaths[0];
  var declarationInfo = DeclarationInfo.forIdentifierPath(identifierPath);
  assert.ok(
    declarationInfo,
    'cannot detect declaration for `' +
    identifierPath.node.name + '`, found parent.type `' +
    identifierPath.parent.node.type + '`'
  );

  return declarationInfo;
});

/**
 * Represents an export specifier in a default export declaration.
 *
 * @constructor
 * @extends ExportSpecifier
 * @param {ExportDeclaration} declaration
 * @param {AST.Expression} node
 */
function DefaultExportSpecifier(declaration, node) {
  ExportSpecifier.call(this, declaration, node);
}
extend(DefaultExportSpecifier, ExportSpecifier);

/**
 * The node of a default export specifier is an expression, not a specifier.
 *
 * @type {AST.Expression}
 */
DefaultExportSpecifier.prototype.node = null;

/**
 * Default export specifier names are always "default".
 *
 * @type {string}
 * @name DefaultExportSpecifier#name
 * @default "default"
 */
DefaultExportSpecifier.prototype.name = 'default';

/**
 * Default export specifiers do not bind to a local identifier.
 *
 * @type {?Identifier}
 * @name DefaultExportSpecifier#identifier
 * @default null
 */
DefaultExportSpecifier.prototype.identifier = null;

/**
 * Default export specifiers do not have a local bound name.
 *
 * @type {?string}
 * @name DefaultExportSpecifier#from
 * @default null
 */
DefaultExportSpecifier.prototype.from = null;

/**
 * Default export specifiers do not have a local declaration.
 *
 * @type {?DeclarationInfo}
 * @name DefaultExportSpecifier#moduleDeclaration
 * @default null
 */
DefaultExportSpecifier.prototype.moduleDeclaration = null;

module.exports = ExportDeclarationList;
