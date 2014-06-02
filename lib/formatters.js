/* jshint node:true, undef:true, unused:true */

exports.DEFAULT = 'module-variable';
exports['module-variable'] = require('./formatters/module_variable_formatter');
exports['export-variable'] = require('./formatters/export_variable_formatter');
exports.commonjs = require('./formatters/commonjs_formatter');
