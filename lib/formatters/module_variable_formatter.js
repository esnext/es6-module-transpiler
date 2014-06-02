/* jshint node:true, undef:true, unused:true */

var recast = require('recast');
var types = recast.types;
var n = types.namedTypes;
var b = types.builders;

var utils = require('../utils');
var extend = utils.extend;

var VariableFormatterBase = require('./variable_formatter_base');

/**
 * The 'module-variable' setting for referencing exports aims to reduce the
 * number of variables in the outermost IFFE scope. This avoids potentially
 * quadratic performance degradations as shown by
 * https://gist.github.com/joliss/9331281. For example, given these modules:
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
 *     var b$$ = {};
 *
 *     (function() {
 *       // b.js
 *       b$$.b = 3;
 *       b$$.b2 = 6;
 *     })();
 *
 *     (function() {
 *       // a.js
 *       console.log(b$$.b);
 *     })();
 *   })();
 *
 * @constructor
 * @extends VariableFormatterBase
 */
function ModuleVariableFormatter() {}
extend(ModuleVariableFormatter, VariableFormatterBase);

/**
 * Returns an expression which globally references the export named by
 * `identifier` for the given module `mod`. For example:
 *
 *    // rsvp/defer.js, export default
 *    rsvp$defer$$.default
 *
 *    // rsvp/utils.js, export function isFunction
 *    rsvp$utils$$.isFunction
 *
 * @param {Module} mod
 * @param {ast-types.Identifier} identifier
 * @return {ast-types.MemberExpression}
 */
ModuleVariableFormatter.prototype.reference = function(mod, identifier) {
  return b.memberExpression(
    b.identifier(mod.id),
    n.Identifier.check(identifier) ? identifier : b.identifier(identifier),
    false
  );
};

/**
 * Returns a declaration for the exports for the given modules. In this case,
 * this is always just the the module objects (e.g. `var rsvp$defer$$ = {};`).
 *
 * @param {Array.<Module>} modules
 * @return {ast-types.VariableDeclaration}
 */
ModuleVariableFormatter.prototype.variableDeclaration = function(modules) {
  var declarators = [];

  modules.forEach(function(mod) {
    if (mod.exports.names.length > 0) {
      declarators.push(
        b.variableDeclarator(b.identifier(mod.id), b.objectExpression([]))
      );
    }
  });

  if (declarators.length > 0) {
    return b.variableDeclaration('var', declarators);
  } else {
    return b.emptyStatement();
  }
};

module.exports = ModuleVariableFormatter;
