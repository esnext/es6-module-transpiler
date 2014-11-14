/* jshint node:true, undef:true, unused:true */

var assert = require('assert');

var recast = require('recast');
var types = recast.types;
var n = types.namedTypes;

var utils = require('./utils');
var memo = utils.memo;
var sourcePosition = utils.sourcePosition;

/**
 * A module binding specifier provides the shared functionality of
 * ImportSpecifiers and ExportSpecifiers in the ES6 spec.
 *
 * @constructor
 * @param {ModuleBindingDeclaration} declaration
 * @param {AST.NamedSpecifier} node
 */
function ModuleBindingSpecifier(declaration, node) {
  Object.defineProperties(this, {
    /**
     * @name ModuleBindingSpecifier#declaration
     * @type {ModuleBindingDeclaration}
     */
    declaration: {
      value: declaration
    },

    /**
     * @name ModuleBindingSpecifier#node
     * @type {AST.NamedSpecifier}
     */
    node: {
      value: node
    }
  });
}

/**
 * Gets the module this specifier is declared in.
 *
 * @type Module
 * @name ModuleBindingSpecifier#module
 */
memo(ModuleBindingSpecifier.prototype, 'module', /** @this ModuleBindingSpecifier */function() {
  return this.declaration.module;
});

/**
 * Gets the scope at the top level of the module.
 *
 * @type {Scope}
 * @name ModuleBindingSpecifier#moduleScope
 */
memo(ModuleBindingSpecifier.prototype, 'moduleScope', /** @this ModuleBindingSpecifier */function() {
  return this.declaration.moduleScope;
});

/**
 * Gets the name of this specifier. For import specifiers this is the name of
 * the binding this specifier will create locally, i.e. "foo" in both of these
 * import statements:
 *
 *   import { foo } from "util";
 *   import { bar as foo } from "util";
 *
 * In export specifiers it is the name of the exported declaration or the alias
 * given to an internal name, i.e. "foo" in both of these export statements:
 *
 *   export { bar as foo };
 *   export var foo = 1;
 *
 * @type {string}
 * @name ModuleBindingSpecifier#name
 */
memo(ModuleBindingSpecifier.prototype, 'name', /** @this ModuleBindingSpecifier */function() {
  return this.identifier.name;
});

/**
 * Gets the name of the identifier this specifier comes from as distinct from
 * `name`. This value will only be set if the local name and the
 * imported/exported name differ, i.e. it will be "foo" in these statements:
 *
 *   import { foo as bar } from "util";
 *   export { foo as bar };
 *
 * And it will be undefined in these statements:
 *
 *   import { foo } from "util";
 *   export { foo };
 *
 * @type {string}
 * @name ModuleBindingSpecifier#from
 */
memo(ModuleBindingSpecifier.prototype, 'from', /** @this ModuleBindingSpecifier */function() {
  return this.node.id.name;
});

/**
 * Gets the node that gives this specifier its name as it would be imported,
 * i.e. "foo" in these statements:
 *
 *   import { foo } from "utils";
 *   import { bar as foo } from "utils";
 *   export { foo };
 *   export { bar as foo };
 *
 * @type {AST.Identifier}
 * @name ModuleBindingSpecifier#identifier
 */
memo(ModuleBindingSpecifier.prototype, 'identifier', /** @this ModuleBindingSpecifier */function() {
  return this.node.name || this.node.id;
});

/**
 * Gets the export specifier corresponding to this specifier. This can be from
 * either an import or export declaration, since both can have a "from" part:
 *
 *   import { map } from "array";
 *   export { map } from "array";
 *
 * In both of the above examples, the export specifier of `map` would be part
 * of the export statement in the "array" module that exports it.
 *
 * @type {?ExportSpecifier}
 * @name ModuleBindingSpecifier#exportSpecifier
 */
memo(ModuleBindingSpecifier.prototype, 'exportSpecifier', /** @this ModuleBindingSpecifier */function() {
  var source = this.declaration.source;
  if (source) {
    var exports = source.exports;
    return exports.findSpecifierByName(this.from);
  } else {
    return null;
  }
});

/**
 * Gets the import specifier corresponding to this specifier. This should only
 * happen when exporting a binding that is imported in the same module, like so:
 *
 *   import { map } from "array";
 *   export { map };
 *
 * The `map` export specifier has the `map` import specifier as its
 * `importSpecifier` property value. The `map` import specifier has no
 * `importSpecifier` property value.
 *
 * @type {?ImportSpecifier}
 * @name ModuleBindingSpecifier#importSpecifier
 */
memo(ModuleBindingSpecifier.prototype, 'importSpecifier', /** @this ModuleBindingSpecifier */function() {
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

/**
 * Gets the original export value by following chains of export/import
 * statements. For example:
 *
 *   // a.js
 *   export var a = 1;
 *
 *   // b.js
 *   export { a } from "./a";
 *
 *   // c.js
 *   import { a } from "./b";
 *   export { a };
 *
 *   // d.js
 *   import { a } from "./c";
 *
 * The terminal export specifier for all of these specifiers is the export in
 * a.js, since all of them can be traced back to that one.
 *
 * @type {ExportSpecifier}
 * @name ModuleBindingSpecifier#terminalExportSpecifier
 */
memo(ModuleBindingSpecifier.prototype, 'terminalExportSpecifier', /** @this ModuleBindingSpecifier */function() {
  if (this.exportSpecifier) {
    // This is true for both imports and exports with a source, e.g.
    // `import { foo } from 'foo'` or `export { foo } from 'foo'`.
    return this.exportSpecifier.terminalExportSpecifier;
  }

  // This is an export from this module, so find the declaration.
  var importSpecifier = this.importSpecifier;
  if (importSpecifier) {
    if (n.ImportNamespaceSpecifier.check(importSpecifier.node)) {
      // Namespace imports create a local binding, so they are the terminal.
      return importSpecifier;
    }

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
 * @type {?DeclarationInfo}
 */
ModuleBindingSpecifier.prototype.moduleDeclaration = null;

/**
 * Gets a string representation of this module binding specifier suitable for
 * debugging.
 *
 * @return {string}
 */
ModuleBindingSpecifier.prototype.inspect = function() {
  return '#<' + this.constructor.name +
    ' module=' + this.declaration.module.relativePath +
    ' name=' + this.name +
    ' from=' + this.from +
    '>';
};

/**
 * @see ModuleBindingSpecifier#inspect
 */
ModuleBindingSpecifier.prototype.toString = ModuleBindingSpecifier.prototype.inspect;

module.exports = ModuleBindingSpecifier;
