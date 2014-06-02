/* jshint node:true, undef:true, unused:true */

var Container = require('./container');
var FileResolver = require('./file_resolver');

exports.FileResolver = FileResolver;
exports.Container = Container;

exports.makeContainer = function(options) {
  return new Container(options);
};
