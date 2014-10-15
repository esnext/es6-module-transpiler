// Polyfill process.umask() since browserify doesn't add it (yet).
// Remove it once https://github.com/defunctzombie/node-process/pull/22 is
// merged and included in browserify.
process.umask = function() { return 0; };

require('./capture_stack_trace_polyfill');

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

