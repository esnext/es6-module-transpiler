/* jshint node:true, undef:true, unused:true */

var recast = require('recast');
var types = recast.types;
var n = types.namedTypes;
var b = types.builders;

var utils = require('../utils');
var extend = utils.extend;

var VariableFormatterBase = require('./variable_formatter_base');

/**
 * The 'export-variable' setting for referencing exports aims to increase the
 * compressability of the generated source, especially by tools such as Google
 * Closure Compiler or UglifyJS. For example, given these modules:
 *
 *   // a.js
 *   import { b } from './b';
 *   console.log(b);
 *
 *   // b.js
 *   export var b = 3;
 *   export var b2 = 6;
 *
 * The final output will be a single file looking something like this:
 *
 *   (function() {
 *     var b$$b, b$$b2;
 *
 *     (function() {
 *       // b.js
 *       b$$b = 3;
 *       b$$b2 = 6;
 *     })();
 *
 *     (function() {
 *       // a.js
 *       console.log(b$$b);
 *     })();
 *   })();
 *
 * @constructor
 * @extends VariableFormatterBase
 */
function ExportVariableFormatter() {}
extend(ExportVariableFormatter, VariableFormatterBase);

/**
 * Returns an expression which globally references the export named by
 * `identifier` for the given module `mod`. For example:
 *
 *   // rsvp/defer.js, export default
 *   rsvp$defer$$default
 *
 *   // rsvp/utils.js, export function isFunction
 *   rsvp$utils$$isFunction
 *
 * @param {Module} mod
 * @param {ast-types.Identifier|string} identifier
 * @return {ast-types.Identifier}
 */
ExportVariableFormatter.prototype.reference = function(mod, identifier) {
  return b.identifier(
    mod.id + (n.Identifier.check(identifier) ? identifier.name : identifier)
  );
};

/**
 * Returns a declaration for the exports for the given module. In this case,
 * it will have one declarator per exported name, prefixed with the module's
 * id. For example:
 *
 *   // rsvp/defer.js, export default
 *   var rsvp$defer$$default;
 *
 *   // rsvp/utils.js, export function isFunction
 *   var rsvp$utils$$isFunction;
 *
 * @param {Array.<Module>} modules
 * @return {ast-types.VariableDeclaration}
 */
ExportVariableFormatter.prototype.variableDeclaration = function(modules) {
  var declarators = [];
  var self = this;

  modules.forEach(function(mod) {
    mod.exports.names.forEach(function(name) {
      declarators.push(
        b.variableDeclarator(self.reference(mod, name), null)
      );
    });
  });

  if (declarators.length > 0) {
    return b.variableDeclaration('var', declarators);
  } else {
    return b.emptyStatement();
  }
};

module.exports = ExportVariableFormatter;
