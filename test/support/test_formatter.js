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
  this.processedExportDeclarationCount = 0;
  this.processedExportReassignmentCount = 0;
  this.processedImportDeclarationCount = 0;
  this.processedFunctionDeclarationCount = 0;
  this.processedVariableDeclarationCount = 0;
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
  this.processedExportDeclarationCount++;
  return null;
};

/**
 * @override
 */
TestFormatter.prototype.processExportReassignment = function() {
  this.processedExportReassignmentCount++;
  return null;
};

/**
 * @override
 */
TestFormatter.prototype.processImportDeclaration = function() {
  this.processedImportDeclarationCount++;
  return null;
};

/**
 * @override
 */
TestFormatter.prototype.processFunctionDeclaration = function() {
  this.processedFunctionDeclarationCount++;
  return null;
};

/**
 * @override
 */
TestFormatter.prototype.processVariableDeclaration = function() {
  this.processedVariableDeclarationCount++;
  return null;
};

exports.TestFormatter = TestFormatter;