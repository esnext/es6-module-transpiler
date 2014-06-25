/* jshint node:true, undef:true, unused:true */

exports.DEFAULT = 'bundle';
exports.bundle = require('./formatters/bundle_formatter');
exports.commonjs = require('./formatters/commonjs_formatter');
