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
 * @param {ast-types.ImportDeclaration|ast-types.ExportDeclaration} node
 */
function ModuleBindingDeclaration(mod, node) {
  assert.ok(
    n.ImportDeclaration.check(node) || n.ExportDeclaration.check(node),
    'expected an import or export declaration, got ' + (node && node.type)
  );

  Object.defineProperties(this, {
    node: {
      value: node,
      enumerable: false
    },

    module: {
      value: mod,
      enumerable: false
    }
  });
}

/**
 * Finds the specifier that creates the local binding given by `name`, if one
 * exists. Otherwise `null` is returned.
 *
 * @private
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
 * @private
 * @param {ast-types.Identifier} identifier
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

memo(ModuleBindingDeclaration.prototype, 'sourcePath', function() {
  return this.node.source && this.node.source.value;
});

/**
 * Gets a reference to the module referenced by this declaration.
 *
 * @type {Module}
 * @property source
 */
memo(ModuleBindingDeclaration.prototype, 'source', function() {
  return this.sourcePath ? this.module.getModule(this.sourcePath) : null;
});

/**
 * Gets the module scope.
 *
 * @type {ast-types.Scope}
 * @property scope
 */
memo(ModuleBindingDeclaration.prototype, 'moduleScope', function() {
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
 * @alias {#inspect}
 */
ModuleBindingDeclaration.prototype.toString = ModuleBindingDeclaration.prototype.inspect;

module.exports = ModuleBindingDeclaration;
