var Formatter = require('../../lib/formatters/formatter');
var extend = require('../../lib/utils').extend;

/**
 * This basic formatter does not alter the AST at all, and only exists
 * help write unit tests for things that depend on formatters.
 *
 * @class
 * @extends Formatter
 */
function TestFormatter() {
  Formatter.call(this);
}
extend(TestFormatter, Formatter);

/**
 * @override
 */
TestFormatter.prototype.build = function(modules) {
  return modules.map(function(mod) {
    var ast = mod.ast;
    ast.filename = mod.relativePath;
    return ast;
  });
};
/**
 * @override
 */
TestFormatter.prototype.processExportDeclaration = function() {
  return null;
};

/**
 * @override
 */
TestFormatter.prototype.processExportReassignment = function() {
  return null;
};

/**
 * @override
 */
TestFormatter.prototype.processImportDeclaration = function() {
  return null;
};

/**
 * @override
 */
TestFormatter.prototype.processFunctionDeclaration = function() {
  return null;
};

/**
 * @override
 */
TestFormatter.prototype.processVariableDeclaration = function() {
  return null;
};

exports.TestFormatter = TestFormatter;