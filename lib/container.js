/* jshint node:true, undef:true, unused:true */

var assert = require('assert');

var Rewriter = require('./rewriter');
var Writer = require('./writer');

/**
 * Represents a container of modules for the given options.
 *
 * @constructor
 * @param {{resolver: Resolver}} options
 */
function Container(options) {
  var formatter = options && options.formatter;
  if (typeof formatter === 'function') {
    formatter = new formatter();
  }

  assert.ok(
    formatter,
    'missing required option `formatter`'
  );
  assert.equal(
    typeof formatter.reference, 'function',
    'option `formatter` must have function `reference`'
  );
  assert.equal(
    typeof formatter.build, 'function',
    'option `formatter` must have function `build`'
  );

  var resolvers = options && options.resolvers;

  assert.ok(
    resolvers && resolvers.length > 0,
    'at least one resolver is required'
  );
  resolvers.forEach(function(resolver) {
    assert.equal(
      typeof resolver.resolveModule, 'function',
      '`resolver` must have `resolveModule` function: ' + resolver
    );
  });

  Object.defineProperties(this, {
    modules: {
      value: Object.create(null)
    },

    formatter: {
      value: formatter
    },

    resolvers: {
      value: resolvers
    },

    options: {
      value: options
    }
  });
}

/**
 * Gets a module by resolving `path`. If `path` is resolved to the same path
 * as a previous call, the same object will be returned.
 *
 * @param {string} importedPath
 * @param {?Module} fromModule
 * @return {Module}
 */
Container.prototype.getModule = function(importedPath, fromModule) {
  for (var i = 0, length = this.resolvers.length; i < length; i++) {
    var resolvedModule = this.resolvers[i].resolveModule(
      importedPath,
      fromModule,
      this
    );

    if (resolvedModule) {
      this.modules[resolvedModule.path] = resolvedModule;
      return resolvedModule;
    }
  }

  throw new Error(
    'missing module import' +
    (fromModule ? ' from ' + fromModule.relativePath : '') +
    ' for path: ' + importedPath
  );
};

/**
 * Get a cached module by a resolved path.
 *
 * @param {string} resolvedPath
 * @return {?Module}
 */
Container.prototype.getCachedModule = function(resolvedPath) {
  return this.modules[resolvedPath];
};

Container.prototype.write = function(target) {
  var files = this.convert();
  var writer = new Writer(target);
  writer.write(files);
};

Container.prototype.convert = function() {
  if (this.formatter.beforeConvert) {
    this.formatter.beforeConvert(this);
  }

  var modules = this.getModules();

  var rewriter = new Rewriter(this.formatter);
  rewriter.rewrite(modules);

  var formatter = this.formatter;
  return formatter.build(modules);
};

Container.prototype.findImportedModules = function() {
  var knownModules;
  var lastModuleCount = 0;

  while ((knownModules = this.getModules()).length !== lastModuleCount) {
    lastModuleCount = knownModules.length;
    for (var i = 0; i < lastModuleCount; i++) {
      // Force loading of imported modules.
      /* jshint expr:true */
      knownModules[i].imports.modules;
      /* jshint expr:false */
    }
  }
};

Container.prototype.getModules = function() {
  var modules = this.modules;
  return Object.keys(modules).map(function(key) {
    return modules[key];
  });
};

module.exports = Container;
