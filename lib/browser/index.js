var Container = require('../container');
var FileResolver = require('../file_resolver');
var formatters = require('../formatters');
var Module = require('../module');

exports.FileResolver = FileResolver;
exports.Container = Container;
exports.formatters = formatters;
exports.Module = Module;

// Export the fake filesystem so someone can get stuff in and out.
exports.fs = require('./fs');

// Polyfill process.umask() since browserify doesn't add it (yet).
// Remove it once https://github.com/defunctzombie/node-process/pull/22 is
// merged and included in browserify.
process.umask = function() { return 0; };

// Polyfill Error.captureStackTrace, which exists only in v8 (Chrome). This is
// used in depd, which is used by ast-types.
if (!Error.captureStackTrace) {
  Error.captureStackTrace = function(obj) {
    obj.stack = new Error().stack;
  };
}
