var Module = require('../../lib/module');
var Path = require('path');

/**
 * This basic resolver just returns a module whose #src is set to an
 * empty string to prevent an attempt to read from the file system.
 *
 * @class
 * @param {Object.<string,string>=} sources
 */
function TestResolver(sources) {
  this.sources = sources || {};
}

/**
 * @param {string} path
 * @param {Module} mod
 * @param {Container} container
 * @returns {Module}
 */
TestResolver.prototype.resolveModule = function(path, mod, container) {
  if (mod) {
    path = Path.normalize(Path.join(mod.relativePath, '..', path));
  }

  var resolved = new Module(path, path, container);
  resolved.src = this.sources[path] || '';
  return resolved;
};

exports.TestResolver = TestResolver;
