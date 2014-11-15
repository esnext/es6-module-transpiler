/* jshint node:true, undef:true, unused:true */

var assert = require('assert');
var Path = require('path');

var Rewriter = require('./rewriter');
var Writer = require('./writer');
var recast = require('recast');

/** @typedef {{resolveModule: function(string, Module, Container): Module}} */
var Resolver;

/**
 * Represents a container of modules for the given options.
 *
 * @constructor
 * @param {{resolvers: Resolver[], formatter: Formatter}} options
 */
function Container(options) {
  options = options || {};

  var formatter = options.formatter;
  if (typeof formatter === 'function') {
    formatter = new formatter();
  }

  assert.ok(
    formatter,
    'missing required option `formatter`'
  );

  var resolvers = options.resolvers;

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
    },

    basePath: {
      value: options.basePath || process.cwd()
    },

    sourceRoot: {
      value: options.sourceRoot || '/'
    }
  });
}

/**
 * Gets a module by resolving `path`. If `path` is resolved to the same path
 * as a previous call, the same object will be returned.
 *
 * @param {string} importedPath
 * @param {Module=} fromModule
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
      this.addModule(resolvedModule);
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
 * Adds a module to the internal cache and gives it a unique name.
 *
 * @private
 * @param {Module} mod
 */
Container.prototype.addModule = function(mod) {
  if (mod.path in this.modules) {
    return;
  }

  if (this._convertResult) {
    throw new Error(
      'container has already converted contained modules ' +
      'and cannot add new module: ' + mod.path
    );
  }

  // We have not seen this module before, so let's give it a unique name.
  var modules = this.getModules();
  var name = mod.name;
  var baseName = name;
  var counter = 0;
  var nameExists;

  while (true) {
    nameExists = modules.some(function(existingModule) {
      return existingModule.name === name;
    });

    if (!nameExists) {
      break;
    } else {
      counter++;
      name = baseName + counter;
    }
  }

  mod.name = name;
  delete mod.id;
  this.modules[mod.path] = mod;
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

/**
 * Writes the contents of this container to the given path.
 *
 * @param {string} target
 */
Container.prototype.write = function(target) {
  if (!this._convertResult) {
    this._convertResult = this.convert();
  }
  var files = this._convertResult;
  var writer = new Writer(target, {
    sourceRoot: this.sourceRoot,
    basePath: this.basePath
  });
  writer.write(files);
};

/**
 * Translate and return the contents of this container.
 *
 * @return {{filename: string, code: string, map: object}[]}
 */
Container.prototype.transform = function() {
  if (!this._convertResult) {
    this._convertResult = this.convert();
  }

  var files = this._convertResult;
  var codes = [];

  files.forEach(function(file) {
    var rendered = recast.print(file, {
      sourceMapName: Path.relative(this.basePath, file.filename),
      sourceRoot: this.sourceRoot
    });
    var code = rendered.code;
    var map = rendered.map;

    codes.push({
      filename: file.filename,
      code: code,
      map: map
    });
  }, this);

  return codes;
};

/**
 * Converts the contents of this container using the current formatter.
 *
 * @return {File[]}
 */
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

/**
 * Follows all imports/exports looking for new modules to add to this container.
 */
Container.prototype.findImportedModules = function() {
  var knownModules;
  var lastModuleCount = 0;

  while ((knownModules = this.getModules()).length !== lastModuleCount) {
    lastModuleCount = knownModules.length;
    for (var i = 0; i < lastModuleCount; i++) {
      // Force loading of imported modules.
      noop(knownModules[i].imports.modules);
    }
  }
};

/**
 * Gets the modules in this container in no particular order.
 *
 * @return {Module[]}
 */
Container.prototype.getModules = function() {
  var modules = this.modules;
  return Object.keys(modules).map(function(key) {
    return modules[key];
  });
};

/**
 * Does nothing. This is only here to make JSHint/other static analysis
 * tools happy about using getters for side effects.
 */
function noop() {}

module.exports = Container;
