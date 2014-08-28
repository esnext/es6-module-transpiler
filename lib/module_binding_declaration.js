/* jshint node:true, undef:true, unused:true */

var assert = require('assert');

var recast = require('recast');
var types = recast.types;
var n = types.namedTypes;

var utils = require('./utils');
var memo = utils.memo;

/**
 * Contains information about a module binding declaration. This corresponds to
 * the shared functionality of `ExportDeclaration` and `ImportDeclaration` in
 * the ES6 spec.
 *
 * @constructor
 * @abstract
 * @param {Module} mod
 * @param {AST.ImportDeclaration|AST.ExportDeclaration} node
 */
function ModuleBindingDeclaration(mod, node) {
  assert.ok(
    n.ImportDeclaration.check(node) || n.ExportDeclaration.check(node),
    'expected an import or export declaration, got ' + (node && node.type)
  );

  Object.defineProperties(this, {
    /**
     * @name ModuleBindingDeclaration#node
     * @type {AST.ImportDeclaration|AST.ExportDeclaration}
     */
    node: {
      value: node
    },

    /**
     * @name ModuleBindingDeclaration#module
     * @type {Module}
     */
    module: {
      value: mod
    }
  });
}

/**
 * Finds the specifier that creates the local binding given by `name`, if one
 * exists. Otherwise `null` is returned.
 *
 * @param {string} name
 * @return {?ModuleBindingSpecifier}
 */
ModuleBindingDeclaration.prototype.findSpecifierByName = function(name) {
  var specifiers = this.specifiers;

  for (var i = 0, length = specifiers.length; i < length; i++) {
    var specifier = specifiers[i];
    if (specifier.name === name) {
      return specifier;
    }
  }

  return null;
};

/**
 * @param {AST.Identifier} identifier
 * @return {?ModuleBindingSpecifier}
 */
ModuleBindingDeclaration.prototype.findSpecifierByIdentifier = function(identifier) {
  for (var i = 0, length = this.specifiers.length; i < length; i++) {
    var specifier = this.specifiers[i];
    if (specifier.identifier === identifier) {
      return specifier;
    }
  }

  return null;
};

/**
 * Gets the raw path of the `from` part of the declaration, if present. For
 * example:
 *
 *   ```js
 *   import { map } from "array";
 *   ```
 *
 * The source path for the above declaration is "array".
 *
 * @type {?string}
 * @name ModuleBindingDeclaration#sourcePath
 */
memo(ModuleBindingDeclaration.prototype, 'sourcePath', /** @this ModuleBindingDeclaration */function() {
  return this.node.source ? this.node.source.value : null;
});

/**
 * Gets a reference to the module referenced by this declaration.
 *
 * @type {Module}
 * @name ModuleBindingDeclaration#source
 */
memo(ModuleBindingDeclaration.prototype, 'source', /** @this ModuleBindingDeclaration */function() {
  return this.sourcePath ? this.module.getModule(this.sourcePath) : null;
});

/**
 * Gets the containing module's scope.
 *
 * @type {Scope}
 * @name ModuleBindingDeclaration#moduleScope
 */
memo(ModuleBindingDeclaration.prototype, 'moduleScope', /** @this ModuleBindingDeclaration */function() {
  return this.module.scope;
});

/**
 * Generate a string representing this object to aid debugging.
 *
 * @return {string}
 */
ModuleBindingDeclaration.prototype.inspect = function() {
  return recast.print(this.node).code;
};

/**
 * @see ModuleBindingDeclaration#inspect
 */
ModuleBindingDeclaration.prototype.toString = ModuleBindingDeclaration.prototype.inspect;

module.exports = ModuleBindingDeclaration;
