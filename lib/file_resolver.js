/* jshint node:true, undef:true, unused:true */

var assert = require('assert');
var Path = require('path');
var fs = require('fs');

var Module = require('./module');

/**
 * Provides resolution of absolute paths from module import sources.
 *
 * @constructor
 */
function FileResolver(paths) {
  assert.ok(
    paths && paths.length > 0,
    'missing required argument `paths`'
  );

  this.paths = paths.map(function(path) {
    return Path.resolve(path);
  });
}

/**
 * Resolves `importedPath` imported by the given module `fromModule` to a
 * module.
 *
 * @param {string} importedPath
 * @param {?Module} fromModule
 * @param {Container} container
 * @return {?Module}
 */
FileResolver.prototype.resolveModule = function(importedPath, fromModule, container) {
  var resolvedPath = this.resolvePath(importedPath, fromModule);
  if (resolvedPath) {
    var cachedModule = container.getCachedModule(resolvedPath);
    if (cachedModule) {
      return cachedModule;
    } else {
      if (!Path.extname(importedPath)) {
        importedPath += Path.extname(resolvedPath);
      }
      return new Module(resolvedPath, importedPath, container);
    }
  } else {
    return null;
  }
};

/**
 * Resolves `importedPath` against the importing module `fromModule`, if given,
 * within this resolver's paths.
 *
 * @private
 * @param {string} importedPath
 * @param {?Module} fromModule
 * @return {string}
 */
FileResolver.prototype.resolvePath = function(importedPath, fromModule) {
  var paths = this.paths;

  if (importedPath[0] === '.' && fromModule) {
    paths = [Path.dirname(fromModule.path)];
  }

  for (var i = 0, length = paths.length; i < length; i++) {
    var includePath = paths[i];
    var resolved = Path.resolve(includePath, importedPath);
    if (!~resolved.lastIndexOf('.')) {
      resolved += '.js';
    }
    
    if (fs.existsSync(resolved)) {
      return resolved;
    }

    // edge cases when a module may have dotted filename, i.e. jquery.min.js
    // and the module name is passed without the extension
    resolved += '.js';
    if (fs.existsSync(resolved)) {
      return resolved;
    }
  }

  return null;
};

module.exports = FileResolver;
