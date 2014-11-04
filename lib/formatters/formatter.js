/* jshint node:true, undef:true, unused:true */

var assert = require('assert');

var recast = require('recast');
var types = recast.types;
var n = types.namedTypes;
var b = types.builders;

var Replacement = require('../replacement');

/**
 * This class provides a base for any concrete formatter classes. Subclasses
 * of this class will be used by Rewriter to determine how to replace various
 * parts of an AST while walking it to achieve conversion from ES6 modules to
 * another format.
 *
 * @constructor
 * @abstract
 */
function Formatter() {}

/**
 * Convert a list of ordered modules into a list of files.
 *
 * @param {Module[]} modules Modules in execution order.
 * @return {File[]}
 */
Formatter.prototype.build = function(modules) {
  throw new Error('#build must be implemented in subclasses');
};

/**
 * Replaces default export declarations with something else. Subclasses will
 * generally return a statement that takes the declaration value and stashes
 * it somewhere appropriate for the transpiled format, e.g. creates a local
 * variable, assigns the value to something, or calls a function with it.
 *
 * Given an export statement like so:
 *
 *   ```js
 *   export default foo(bar);
 *   ```
 *
 * This method will be called with the module containing the statement and
 * the AST node corresponding to `foo(bar)`.
 *
 * @param {Module} mod
 * @param {Expression} declaration
 * @return {Statement}
 */
Formatter.prototype.defaultExport = function(mod, declaration) {
  throw new Error('#defaultExport must be implemented in subclasses');
};

/**
 * Resolves references to exported bindings. In the example below, if we refer
 * to `value` elsewhere in the module then that reference may need to be
 * rewritten. This method allows us to configure what it is rewritten to.
 *
 *   ```js
 *   // a.js
 *   export var value = 1;
 *   ```
 *
 * Subclasses should return null if the original reference should be left
 * intact.
 *
 * @param {Module} mod
 * @param {NodePath} referencePath
 * @return {?Expression}
 */
Formatter.prototype.exportedReference = function(mod, referencePath) {
  throw new Error('#exportedReference must be implemented in subclasses');
};

/**
 * Gets a reference to an imported binding. In this example, we will be called
 * with the NodePath for `value` in `console.log(value)`:
 *
 *   ```js
 *   // b.js
 *   import { value } from './a';
 *   console.log(value);
 *   ```
 *
 * If the given reference does not refer to an imported binding then no
 * rewriting is required and `null` should be returned.
 *
 * @param {Module} mod
 * @param {NodePath} referencePath
 * @return {?Expression}
 */
Formatter.prototype.importedReference = function(mod, referencePath) {
  throw new Error('#importedReference must be implemented in subclasses');
};

/**
 * Determines what the given reference should be rewritten to, if anything.
 * Subclasses should override this only if they wish to rename bindings not
 * associated with imports and exports.
 *
 * This is used by the bundle formatter, for example, to ensure that bindings
 * at module scope are rewritten with unique names to prevent collisions with
 * bindings from other modules.
 *
 * @param {Module} mod
 * @param {NodePath} referencePath
 * @return {?Node}
 */
Formatter.prototype.localReference = function(mod, referencePath) {
  return null;
};

/**
 * Process a function declaration found at the top level of the module.
 *
 * @param {Module} mod
 * @param {NodePath} nodePath
 * @return {?Node[]}
 */
Formatter.prototype.processFunctionDeclaration = function(mod, nodePath) {
  throw new Error('#processFunctionDeclaration must be implemented in subclasses');
};

/**
 * Process a class declaration found at the top level of the module.
 *
 * @param {Module} mod
 * @param {NodePath} nodePath
 * @return {?Node[]}
 */
Formatter.prototype.processClassDeclaration = function(mod, nodePath) {
  throw new Error('#processClassDeclaration must be implemented in subclasses');
};

/**
 * Process a variable declaration found at the top level of the module.
 *
 * @param {Module} mod
 * @param {NodePath} nodePath
 * @return {?Node[]}
 */
Formatter.prototype.processVariableDeclaration = function(mod, nodePath) {
  throw new Error('#processVariableDeclaration must be implemented in subclasses');
};

/**
 * Replaces non-default exports. These exports are of one of the following
 * forms:
 *
 *   ```js
 *   export var a = 1;
 *   export function a() {}
 *   export class a {}
 *   export { a };
 *   ```
 *
 * @param {Module} mod
 * @param {NodePath} nodePath
 * @return {?Replacement}
 */
Formatter.prototype.processExportDeclaration = function(mod, nodePath) {
  throw new Error('#processExportDeclaration must be implemented in subclasses');
};

/**
 * Process and optionally replace an update to an exported binding. This can
 * either be an assignment expression or an update expression, i.e.
 *
 *   ```js
 *   export var foo = 1;
 *   foo = 2;
 *   foo++;
 *   ```
 *
 * @param {Module} mod
 * @param {NodePath} nodePath
 * @return {?Replacement}
 */
Formatter.prototype.processExportReassignment = function(mod, nodePath) {
  throw new Error('#processExportReassignment must be implemented in subclasses');
};

/**
 * Optionally replace an import declaration. Subclasses should almost always
 * replace import declarations. It may be replaced with a dependency lookup, or
 * perhaps with nothing.
 *
 * @param {Module} mod
 * @param {NodePath} nodePath
 * @return {?Replacement}
 */
Formatter.prototype.processImportDeclaration = function(mod, nodePath) {
  throw new Error('#processImportDeclaration must be implemented in subclasses');
};

module.exports = Formatter;
