!function(e){if("object"==typeof exports&&"undefined"!=typeof module)module.exports=e();else if("function"==typeof define&&define.amd)define([],e);else{var f;"undefined"!=typeof window?f=window:"undefined"!=typeof global?f=global:"undefined"!=typeof self&&(f=self),f.ModuleTranspiler=e()}}(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
var DEFAULT_STACK_TRACE_LIMIT = 10;

// Polyfill Error.captureStackTrace, which exists only in v8 (Chrome). This is
// used in depd, which is used by ast-types.
if (!Error.captureStackTrace) {
  /**
   * Adds a 'stack' property to the given object with stack info.
   *
   * @param obj
   * @returns {Error.stack|*}
   */
  Error.captureStackTrace = function(obj) {
    var stack = new Error().stack;
    var prepare = Error.prepareStackTrace;

    if (prepare) {
      stack = prepare(stack, parseStack(stack));
    }

    obj.stack = stack;
  };
}

if (typeof Error.stackTraceLimit === 'undefined') {
  Error.stackTraceLimit = DEFAULT_STACK_TRACE_LIMIT;
}

/**
 * Parse a formatted stack string into an array of call sites.
 *
 * @param {string} stack
 * @returns {Array.<CallSite>}
 */
function parseStack(stack) {
  return stack.split('\n').slice(0, Error.stackTraceLimit).map(CallSite.parse);
}

/**
 * Represents a call site in a stack trace.
 *
 * @param {string} fnName
 * @param {string} fileName
 * @param {number} lineNumber
 * @param {number} columnNumber
 * @param {boolean} isEval
 * @param {string} evalOrigin
 * @constructor
 */
function CallSite(fnName, fileName, lineNumber, columnNumber, isEval, evalOrigin) {
  this.getFunctionName = function() { return fnName; };
  this.getFileName = function() { return fileName; };
  this.getLineNumber = function() { return lineNumber; };
  this.getColumnNumber = function() { return columnNumber; };
  this.isEval = function() { return isEval; };
  this.getEvalOrigin = function() { return evalOrigin; };
}

/**
 * Parses a line in a formatted stack trace and returns call site info.
 *
 * @param {string} stackTraceLine
 * @returns {CallSite}
 */
CallSite.parse = function(stackTraceLine) {
  var fnNameAndLocation = stackTraceLine.split('@');
  var fnName = fnNameAndLocation[0];
  var location = fnNameAndLocation[1];

  var fileAndLineAndColumn = location ? location.split(':') : [];
  var fileName = fileAndLineAndColumn[0];
  var lineNumber = parseInt(fileAndLineAndColumn[1], 10);
  var columnNumber = parseInt(fileAndLineAndColumn[2], 10);

  return new CallSite(fnName, fileName, lineNumber, columnNumber, fnName === 'eval', '');
};

},{}],2:[function(require,module,exports){
var Fs = require('fake-fs');
var fs = new Fs();
fs.patch();
module.exports = fs;

},{"fake-fs":61}],3:[function(require,module,exports){
/* jshint node:true, undef:true, unused:true */

var assert = require('assert');

var Rewriter = require('./rewriter');
var Writer = require('./writer');

/** @typedef {{resolveModule: function(string, Module, Container): Module}} */
var Resolver;

/**
 * Represents a container of modules for the given options.
 *
 * @constructor
 * @param {{resolvers: Resolver[], formatter: Formatter}} options
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
  var writer = new Writer(target);
  writer.write(files);
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

},{"./rewriter":18,"./writer":21,"assert":49}],4:[function(require,module,exports){
/* jshint node:true, undef:true, unused:true */

var recast = require('recast');
var types = recast.types;
var n = types.namedTypes;

/**
 * Represents information about a declaration that creates a local binding
 * represented by `identifier`. For example, given that `declaration` is the
 * following variable declaration:
 *
 *   var a = 1;
 *
 * Then `identifier` references the `a` node in the variable declaration's
 * first declarator. Likewise, given that `declaration` is this function
 * declaration:
 *
 *   function add(a, b) {}
 *
 * Then `identifier` references the `add` node, the declaration's `id`.
 *
 * @constructor
 * @param {Node} declaration
 * @param {Identifier} identifier
 */
function DeclarationInfo(declaration, identifier) {
  /**
   * @type {Node}
   * @name DeclarationInfo#declaration
   */
  this.declaration = declaration;
  /**
   * @type {Identifier}
   * @name DeclarationInfo#identifier
   */
  this.identifier = identifier;
}

/**
 * Get the declaration info for the given identifier path, if the identifier is
 * actually part of a declaration.
 *
 * @param {NodePath} identifierPath
 * @return {?DeclarationInfo}
 */
DeclarationInfo.forIdentifierPath = function(identifierPath) {
  if (n.VariableDeclarator.check(identifierPath.parent.node)) {
    return new DeclarationInfo(
      identifierPath.parent.parent.node,
      identifierPath.node
    );
  } else if (n.ClassDeclaration.check(identifierPath.parent.node)) {
    return new DeclarationInfo(
      identifierPath.parent.node,
      identifierPath.node
    );
  } else if (n.FunctionDeclaration.check(identifierPath.parent.node)) {
    return new DeclarationInfo(
      identifierPath.parent.node,
      identifierPath.node
    );
  } else if (n.ImportSpecifier.check(identifierPath.parent.node)) {
    return new DeclarationInfo(
      identifierPath.parent.parent.node,
      identifierPath.node
    );
  } else if (n.ImportNamespaceSpecifier.check(identifierPath.parent.node)) {
    return new DeclarationInfo(
      identifierPath.parent.parent.node,
      identifierPath.node
    );
  } else if (n.ImportDefaultSpecifier.check(identifierPath.parent.node)) {
    return new DeclarationInfo(
      identifierPath.parent.parent.node,
      identifierPath.node
    );
  } else {
    return null;
  }
};

module.exports = DeclarationInfo;

},{"recast":74}],5:[function(require,module,exports){
/* jshint node:true, undef:true, unused:true */

var assert = require('assert');

var recast = require('recast');
var types = recast.types;
var n = types.namedTypes;

var ModuleBindingList = require('./module_binding_list');
var ModuleBindingDeclaration = require('./module_binding_declaration');
var ModuleBindingSpecifier = require('./module_binding_specifier');
var DeclarationInfo = require('./declaration_info');

var utils = require('./utils');
var memo = utils.memo;
var extend = utils.extend;
var sourcePosition = utils.sourcePosition;

/**
 * Represents a list of the exports for the given module.
 *
 * @constructor
 * @extends ModuleBindingList
 * @param {Module} mod
 */
function ExportDeclarationList(mod) {
  ModuleBindingList.call(this, mod);
}
extend(ExportDeclarationList, ModuleBindingList);

/**
 * @private
 * @param {AST.Declaration} node
 * @return {boolean}
 */
ExportDeclarationList.prototype.isMatchingBinding = function(node) {
  return n.ExportDeclaration.check(node);
};

/**
 * Gets an export declaration for the given `node`.
 *
 * @private
 * @param {AST.ExportDeclaration} node
 * @return {ExportDeclaration}
 */
ExportDeclarationList.prototype.declarationForNode = function(node) {
  if (node.default) {
    return new DefaultExportDeclaration(this.module, node);
  } else if (n.VariableDeclaration.check(node.declaration)) {
    return new VariableExportDeclaration(this.module, node);
  } else if (n.FunctionDeclaration.check(node.declaration)) {
    return new FunctionExportDeclaration(this.module, node);
  } else if (n.ExportBatchSpecifier.check(node.specifiers[0])) {
    throw new Error(
      '`export *` found at ' + sourcePosition(this.module, node) +
      ' is not supported, please use `export { … }` instead'
    );
  } else {
    return new NamedExportDeclaration(this.module, node);
  }
};

/**
 * @param {NodePath} referencePath
 * @return {?ExportSpecifier}
 */
ExportDeclarationList.prototype.findSpecifierForReference = function(referencePath) {
  if (n.ExportSpecifier.check(referencePath.parent.node) && referencePath.parent.parent.node.source) {
    // This is a direct export from another module, e.g. `export { foo } from 'foo'`.
    return /** @type {ExportSpecifier} */this.findSpecifierByIdentifier(referencePath.node);
  }

  var declaration = this.findDeclarationForReference(referencePath);

  if (!declaration) {
    return null;
  }

  var specifier = /** @type {ExportSpecifier} */this.findSpecifierByName(declaration.node.name);
  assert.ok(
    specifier,
    'no specifier found for `' + referencePath.node.name + '`! this should not happen!'
  );
  return specifier;
};

/**
 * Contains information about an export declaration.
 *
 * @constructor
 * @abstract
 * @extends ModuleBindingDeclaration
 * @param {Module} mod
 * @param {ExportDeclaration} node
 */
function ExportDeclaration(mod, node) {
  assert.ok(
    n.ExportDeclaration.check(node),
    'expected an export declaration, got ' + (node && node.type)
  );

  ModuleBindingDeclaration.call(this, mod, node);
}
extend(ExportDeclaration, ModuleBindingDeclaration);

/**
 * Returns a string description suitable for debugging.
 *
 * @return {string}
 */
ExportDeclaration.prototype.inspect = function() {
  return recast.print(this.node).code;
};

/**
 * @see ExportDeclaration#inspect
 */
ExportDeclaration.prototype.toString = ExportDeclaration.prototype.inspect;

/**
 * Represents an export declaration of the form:
 *
 *   export default foo;
 *
 * @constructor
 * @extends ExportDeclaration
 * @param {Module} mod
 * @param {AST.ExportDeclaration} node
 */
function DefaultExportDeclaration(mod, node) {
  ExportDeclaration.call(this, mod, node);
}
extend(DefaultExportDeclaration, ExportDeclaration);

/**
 * Contains a list of specifier name information for this export.
 *
 * @type {ExportSpecifier[]}
 * @name DefaultExportSpecifier#specifiers
 */
memo(DefaultExportDeclaration.prototype, 'specifiers', /** @this DefaultExportDeclaration */function() {
  var specifier = new DefaultExportSpecifier(this, this.node.declaration);
  return [specifier];
});

/**
 * Represents an export declaration of the form:
 *
 *   export { foo, bar };
 *
 * @constructor
 * @extends ExportDeclaration
 * @param {Module} mod
 * @param {AST.ExportDeclaration} node
 */
function NamedExportDeclaration(mod, node) {
  ExportDeclaration.call(this, mod, node);
}
extend(NamedExportDeclaration, ExportDeclaration);

/**
 * Contains a list of specifier name information for this export.
 *
 * @type {ExportSpecifier[]}
 * @name NamedExportDeclaration#specifiers
 */
memo(NamedExportDeclaration.prototype, 'specifiers', /** @this NamedExportDeclaration */function() {
  var self = this;
  return this.node.specifiers.map(function(specifier) {
    return new ExportSpecifier(self, specifier);
  });
});

/**
 * Represents an export declaration of the form:
 *
 *   export var foo = 1;
 *
 * @constructor
 * @extends ExportDeclaration
 * @param {Module} mod
 * @param {AST.ExportDeclaration} node
 */
function VariableExportDeclaration(mod, node) {
  ExportDeclaration.call(this, mod, node);
}
extend(VariableExportDeclaration, ExportDeclaration);

/**
 * Gets the list of export specifiers for this declaration.
 *
 * @type {ExportSpecifier[]}
 * @name VariableExportDeclaration#specifiers
 */
memo(VariableExportDeclaration.prototype, 'specifiers', /** @this VariableExportDeclaration */function() {
  var self = this;
  return this.node.declaration.declarations.map(function(declarator) {
    return new ExportSpecifier(self, declarator);
  });
});

/**
 * Represents an export declaration of the form:
 *
 *   export function foo() {}
 *
 * @constructor
 * @extends ExportDeclaration
 * @param {Module} mod
 * @param {AST.ExportDeclaration} node
 */
function FunctionExportDeclaration(mod, node) {
  ExportDeclaration.call(this, mod, node);
}
extend(FunctionExportDeclaration, ExportDeclaration);

/**
 * Gets the list of export specifiers for this declaration.
 *
 * @type {ExportSpecifier[]}
 * @name FunctionExportDeclaration#specifiers
 */
memo(FunctionExportDeclaration.prototype, 'specifiers', /** @this FunctionExportDeclaration */function() {
  return [new ExportSpecifier(this, this.node.declaration)];
});

/**
 * Represents an export specifier in an export declaration.
 *
 * @constructor
 * @extends ModuleBindingSpecifier
 * @param {ExportDeclaration} declaration
 * @param {AST.Node} node
 */
function ExportSpecifier(declaration, node) {
  ModuleBindingSpecifier.call(this, declaration, node);
}
extend(ExportSpecifier, ModuleBindingSpecifier);

/**
 * Contains the local declaration info for this export specifier. For example,
 * in this module:
 *
 *   var a = 1;
 *   export { a };
 *
 * The module declaration info for the `a` export specifier is the variable
 * declaration plus the `a` identifier in its first declarator.
 *
 * @type {?DeclarationInfo}
 * @name ExportSpecifier#moduleDeclaration
 */
memo(ExportSpecifier.prototype, 'moduleDeclaration', /** @this ExportSpecifier */function() {
  if (this.declaration.source) {
    // This is part of a direct export, e.g. `export { ... } from '...'`, so
    // there is no declaration as part of this module.
    return null;
  }

  var bindings = this.moduleScope.getBindings();
  var identifierPaths = bindings[this.from];
  assert.ok(
    identifierPaths && identifierPaths.length === 1,
    'expected exactly one declaration for export `' +
    this.from + '` at ' + sourcePosition(this.module, this.node) +
    ', found ' + (identifierPaths ? identifierPaths.length : 'none')
  );

  var identifierPath = identifierPaths[0];
  var declarationInfo = DeclarationInfo.forIdentifierPath(identifierPath);
  assert.ok(
    declarationInfo,
    'cannot detect declaration for `' +
    identifierPath.node.name + '`, found parent.type `' +
    identifierPath.parent.node.type + '`'
  );

  return declarationInfo;
});

/**
 * Represents an export specifier in a default export declaration.
 *
 * @constructor
 * @extends ExportSpecifier
 * @param {ExportDeclaration} declaration
 * @param {AST.Expression} node
 */
function DefaultExportSpecifier(declaration, node) {
  ExportSpecifier.call(this, declaration, node);
}
extend(DefaultExportSpecifier, ExportSpecifier);

/**
 * The node of a default export specifier is an expression, not a specifier.
 *
 * @type {AST.Expression}
 */
DefaultExportSpecifier.prototype.node = null;

/**
 * Default export specifier names are always "default".
 *
 * @type {string}
 * @name DefaultExportSpecifier#name
 * @default "default"
 */
DefaultExportSpecifier.prototype.name = 'default';

/**
 * Default export specifiers do not bind to a local identifier.
 *
 * @type {?Identifier}
 * @name DefaultExportSpecifier#identifier
 * @default null
 */
DefaultExportSpecifier.prototype.identifier = null;

/**
 * Default export specifiers do not have a local bound name.
 *
 * @type {?string}
 * @name DefaultExportSpecifier#from
 * @default null
 */
DefaultExportSpecifier.prototype.from = null;

/**
 * Default export specifiers do not have a local declaration.
 *
 * @type {?DeclarationInfo}
 * @name DefaultExportSpecifier#moduleDeclaration
 * @default null
 */
DefaultExportSpecifier.prototype.moduleDeclaration = null;

module.exports = ExportDeclarationList;

},{"./declaration_info":4,"./module_binding_declaration":14,"./module_binding_list":15,"./module_binding_specifier":16,"./utils":20,"assert":49,"recast":74}],6:[function(require,module,exports){
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
    if (resolved.slice(-3).toLowerCase() !== '.js') {
      resolved += '.js';
    }
    if (fs.existsSync(resolved)) {
      return resolved;
    }
  }

  return null;
};

module.exports = FileResolver;

},{"./module":13,"assert":49,"fs":2,"path":56}],7:[function(require,module,exports){
/* jshint node:true, undef:true, unused:true */

exports.DEFAULT = 'bundle';
exports.bundle = require('./formatters/bundle_formatter');
exports.commonjs = require('./formatters/commonjs_formatter');

},{"./formatters/bundle_formatter":8,"./formatters/commonjs_formatter":9}],8:[function(require,module,exports){
/* jshint node:true, undef:true, unused:true */

var recast = require('recast');
var types = recast.types;
var b = types.builders;
var n = types.namedTypes;

var Replacement = require('../replacement');
var utils = require('../utils');
var IFFE = utils.IFFE;
var extend = utils.extend;
var sort = require('../sorting').sort;
var Formatter = require('./formatter');


/**
 * The 'bundle' formatter aims to increase the compressibility of the generated
 * source, especially by tools such as Google Closure Compiler or UglifyJS.
 * For example, given these modules:
 *
 *   ```js
 *   // a.js
 *   import { b } from './b';
 *   console.log(b);
 *
 *   // b.js
 *   export var b = 3;
 *   export var b2 = 6;
 *   ```
 *
 * The final output will be a single file looking something like this:
 *
 *   ```js
 *   (function() {
 *     "use strict";
 *     // b.js
 *     var b$$b = 3;
 *     var b$$b2 = 6;
 *
 *     // a.js
 *     console.log(b$$b);
 *   }).call(this);
 *   ```
 *
 * @constructor
 */
function BundleFormatter() {
  Formatter.call(this);
}
extend(BundleFormatter, Formatter);

/**
 * This hook is called by the container before it converts its modules. We use
 * it to ensure all of the imports are included because we need to know about
 * them at compile time.
 *
 * @param {Container} container
 */
BundleFormatter.prototype.beforeConvert = function(container) {
  container.findImportedModules();
};

/**
 * @override
 */
BundleFormatter.prototype.build = function(modules) {
  modules = sort(modules);
  return [b.file(b.program([b.expressionStatement(IFFE(
    b.expressionStatement(b.literal('use strict')),
      modules.length === 1 ?
      modules[0].ast.program.body :
      modules.reduce(function(statements, mod) {
        return statements.concat(mod.ast.program.body);
      }, [])
  ))]))];
};

/**
 * @override
 *
 *   ```js
 *   export default <FunctionDeclaration|ClassDeclaration>
 *   // or
 *   export default <declaration|expression>;
 *   ```
 */
BundleFormatter.prototype.defaultExport = function(mod, declaration) {
  if (n.FunctionDeclaration.check(declaration) ||
      n.ClassDeclaration.check(declaration)) {
    // export default function foo () {}
    // -> becomes:
    // function <moduleName>foo () {}
    // var <moduleName>default = <moduleName>foo;
    var renamedDeclaration = Object.create(declaration);
    renamedDeclaration.id = this.reference(mod, declaration.id);
    return [
      renamedDeclaration,
      b.variableDeclaration(
        'var',
        [b.variableDeclarator(
          this.reference(mod, 'default'),
          this.reference(mod, declaration.id)
        )]
      )
    ];
  }
  return b.variableDeclaration(
    'var',
    [b.variableDeclarator(
      this.reference(mod, 'default'),
      declaration
    )]
  );
};

/**
 * Get a reference to the original exported value referenced in `mod` at
 * `referencePath`. If the given reference path does not correspond to an
 * export, we do not need to rewrite the reference. For example, since `value`
 * is not exported it does not need to be rewritten:
 *
 *   ```js
 *   // a.js
 *   var value = 99;
 *   console.log(value);
 *   ```
 *
 * If `value` was exported then we would need to rewrite it:
 *
 *   ```js
 *   // a.js
 *   export var value = 3;
 *   console.log(value);
 *   ```
 *
 * In this case we re-write both `value` references to something like
 * `a$$value`. The tricky part happens when we re-export an imported binding:
 *
 *   ```js
 *   // a.js
 *   export var value = 11;
 *
 *   // b.js
 *   import { value } from './a';
 *   export { value };
 *
 *   // c.js
 *   import { value } from './b';
 *   console.log(value);
 *   ```
 *
 * The `value` reference in a.js will be rewritten as something like `a$$value`
 * as expected. The `value` reference in c.js will not be rewritten as
 * `b$$value` despite the fact that it is imported from b.js. This is because
 * we must follow the binding through to its import from a.js. Thus, our
 * `value` references will both be rewritten to `a$$value` to ensure they
 * match.
 *
 * @override
 */
BundleFormatter.prototype.exportedReference = function(mod, referencePath) {
  var specifier = mod.exports.findSpecifierForReference(referencePath);
  if (specifier) {
    specifier = specifier.terminalExportSpecifier;
    return this.reference(specifier.module, specifier.name);
  } else {
    return null;
  }
};

/**
 * Get a reference to the original exported value referenced in `mod` at
 * `referencePath`. This is very similar to BundleFormatter#exportedReference
 * in its approach.
 *
 * @override
 */
BundleFormatter.prototype.importedReference = function(mod, referencePath) {
  var specifier = mod.imports.findSpecifierForReference(referencePath);
  if (specifier) {
    specifier = specifier.terminalExportSpecifier;
    return this.reference(specifier.module, specifier.name);
  } else {
    return null;
  }
};

/**
 * If the given reference has a local declaration at the top-level then we must
 * rewrite that reference to have a module-scoped name.
 *
 * @param {Module} mod
 * @param {NodePath} referencePath
 * @return {?Node}
 */
BundleFormatter.prototype.localReference = function(mod, referencePath) {
  var scope = referencePath.scope.lookup(referencePath.node.name);
  if (scope && scope.isGlobal) {
    return this.reference(mod, referencePath.node);
  } else {
    return null;
  }
};

/**
 * Replaces non-default exports. Exported bindings do not need to be
 * replaced with actual statements since they only control how local references
 * are renamed within the module.
 *
 * @override
 */
BundleFormatter.prototype.processExportDeclaration = function(mod, nodePath) {
  var node = nodePath.node;
  if (n.FunctionDeclaration.check(node.declaration)) {
    return Replacement.swaps(
      // drop `export`
      nodePath, node.declaration
    ).and(
      // transform the function
      this.processFunctionDeclaration(mod, nodePath.get('declaration'))
    );
  } else if (n.VariableDeclaration.check(node.declaration)) {
    return Replacement.swaps(
      // drop `export`
      nodePath, node.declaration
    ).and(
      // transform the variables
      this.processVariableDeclaration(mod, nodePath.get('declaration'))
    );
  } else if (node.declaration) {
    throw new Error(
        'unexpected export style, found a declaration of type: ' +
        node.declaration.type
    );
  } else {
    /**
     * This node looks like this:
     *
     *   ```js
     *   export { foo, bar };
     *   ```
     *
     * Which means that it has no value in the generated code as its only
     * function is to control how imports are rewritten.
     */
    return Replacement.removes(nodePath);
  }
};

/**
 * Since named export reassignment is just a local variable, we can ignore it.
 * e.g.
 *
 *   ```js
 *   export var foo = 1;
 *   foo = 2;
 *   ```
 *
 * @override
 */
BundleFormatter.prototype.processExportReassignment = function(mod, nodePath) {
  return null;
};

/**
 * Rename the top-level function declaration to a unique name.
 *
 *   ```js
 *   function foo() {}
 *   ```
 *
 * Becomes e.g.
 *
 *   ```js
 *   function mod$$foo() {}
 *   ```
 *
 * @override
 */
BundleFormatter.prototype.processFunctionDeclaration = function(mod, nodePath) {
  return Replacement.swaps(
    nodePath.get('id'),
    this.reference(mod, nodePath.node.id)
  );
};

/**
 * Since import declarations only control how we rewrite references we can just
 * remove them -- they don't turn into any actual statements.
 *
 * @override
 */
BundleFormatter.prototype.processImportDeclaration = function(mod, nodePath) {
  return Replacement.removes(nodePath);
};

/**
 * Process a variable declaration found at the top level of the module. We need
 * to ensure that exported variables are rewritten appropriately, so we may
 * need to rewrite some or all of this variable declaration. For example:
 *
 *   ```js
 *   var a = 1, b, c = 3;
 *   ...
 *   export { a, b };
 *   ```
 *
 * We turn those being exported into assignments as needed, e.g.
 *
 *   ```js
 *   var c = 3;
 *   mod$$a = 1;
 *   ```
 *
 * @override
 */
BundleFormatter.prototype.processVariableDeclaration = function(mod, nodePath) {
  var self = this;
  return Replacement.map(
    nodePath.get('declarations'),
    function(declaratorPath) {
      return Replacement.swaps(
        declaratorPath.get('id'),
        self.reference(mod, declaratorPath.get('id').node)
      );
    }
  );
};

/**
 * Returns an expression which globally references the export named by
 * `identifier` for the given module `mod`. For example:
 *
 *   ```js
 *   // rsvp/defer.js, export default
 *   rsvp$defer$$default
 *
 *   // rsvp/utils.js, export function isFunction
 *   rsvp$utils$$isFunction
 *   ```
 *
 * @param {Module} mod
 * @param {Identifier|string} identifier
 * @return {Identifier}
 * @private
 */
BundleFormatter.prototype.reference = function(mod, identifier) {
  return b.identifier(
    mod.id + (n.Identifier.check(identifier) ? identifier.name : identifier)
  );
};

module.exports = BundleFormatter;

},{"../replacement":17,"../sorting":19,"../utils":20,"./formatter":10,"recast":74}],9:[function(require,module,exports){
/* jshint node:true, undef:true, unused:true */

var assert = require('assert');
var recast = require('recast');
var types = recast.types;
var n = types.namedTypes;
var b = types.builders;
var util = require('ast-util');

var extend = require('../utils').extend;
var Replacement = require('../replacement');
var Formatter = require('./formatter');
var sourcePosition = require('../utils').sourcePosition;

/**
 * The 'commonjs' setting for referencing exports aims to produce code that can
 * be used in environments using the CommonJS module system, such as Node.js.
 *
 * @constructor
 */
function CommonJSFormatter() {
  Formatter.call(this);
}
extend(CommonJSFormatter, Formatter);

/**
 * Convert a list of ordered modules into a list of files.
 *
 * @param {Module[]} modules Modules in execution order.
 * @return {File[]}
 */
CommonJSFormatter.prototype.build = function(modules) {
  var self = this;
  return modules.map(function(mod) {
    var body = mod.ast.program.body;
    body.unshift(
      b.expressionStatement(b.literal('use strict')),
      self.buildEarlyExports(mod),
      self.buildRequires(mod)
    );
    body.push(
      self.buildLateExports(mod)
    );
    mod.ast.filename = mod.relativePath;
    return mod.ast;
  });
};

/**
 * Process all export bindings which may be exported before any module code is
 * actually run, i.e. function declarations.
 *
 * @param {Module} mod
 * @returns {AST.Statement}
 * @private
 */
CommonJSFormatter.prototype.buildEarlyExports = function(mod) {
  var self = this;
  var assignments = [];
  var exportObject = b.identifier('exports');

  this.forEachExportBinding(mod, function(specifier, name) {
    if (!n.FunctionDeclaration.check(specifier.declaration.node.declaration)) {
      // Only function declarations are handled as early exports.
      return;
    }

    assignments.push(b.assignmentExpression(
      '=',
      b.memberExpression(
        exportObject,
        b.identifier(name),
        false
      ),
      b.identifier(specifier.from)
    ));
  });

  return b.expressionStatement(
    b.sequenceExpression(assignments)
  );
};

/**
 * Process all export bindings which were not exported at the beginning of the
 * module, i.e. everything except function declarations.
 *
 * @param {Module} mod
 * @returns {AST.Statement}
 * @private
 */
CommonJSFormatter.prototype.buildLateExports = function(mod) {
  var self = this;
  var assignments = [];
  var exportObject = b.identifier('exports');

  this.forEachExportBinding(mod, function(specifier, name) {
    if (n.FunctionDeclaration.check(specifier.declaration.node.declaration)) {
      // Function declarations are handled as early exports.
      return;
    }

    var from =
      specifier.importSpecifier ?
        self.reference(
          specifier.importSpecifier.declaration.source,
          specifier.importSpecifier.from
        ) :
        specifier.declaration.source ?
          self.reference(
            specifier.declaration.source,
            specifier.name
          ) :
          b.identifier(specifier.from);

    assignments.push(b.assignmentExpression(
      '=',
      b.memberExpression(
        exportObject,
        b.identifier(name),
        false
      ),
      from
    ));
  });

  return b.expressionStatement(
    b.sequenceExpression(assignments)
  );
};

/**
 * Iterates over each exported binding and calls `iterator` with its specifier.
 *
 * @param {Module} mod
 * @param {function(ModuleBindingSpecifier, string)} iterator
 * @private
 */
CommonJSFormatter.prototype.forEachExportBinding = function(mod, iterator) {
  mod.exports.names.forEach(function(name) {
    var specifier = mod.exports.findSpecifierByName(name);

    assert.ok(
      specifier,
        'no export specifier found for export name `' +
        name + '` from ' + mod.relativePath
    );

    if (!specifier.from) {
      // Default exports are handled elsewhere.
      return;
    }

    iterator(specifier, name);
  });
};

/**
 * Build a series of requires based on the imports (and exports with sources)
 * in the given module.
 *
 * @private
 * @param {Module} mod
 * @return {AST.VariableDeclaration|AST.EmptyStatement}
 */
CommonJSFormatter.prototype.buildRequires = function(mod) {
  var declarators = [];
  var requiredModules = [];

  [mod.imports, mod.exports].forEach(function(declarations) {
    declarations.modules.forEach(function(sourceModule) {
      if (requiredModules.indexOf(sourceModule) >= 0) {
        return;
      }
      requiredModules.push(sourceModule);

      var matchingDeclaration;
      declarations.declarations.some(function(declaration) {
        if (declaration.source === sourceModule) {
          matchingDeclaration = declaration;
          return true;
        }
      });

      assert.ok(
        matchingDeclaration,
          'no matching declaration for source module: ' + sourceModule.relativePath
      );

      // `(import|export) { ... } from 'math'` -> `math$$ = require('math')`
      declarators.push(b.variableDeclarator(
        b.identifier(sourceModule.id),
        b.callExpression(
          b.identifier('require'),
          [b.literal(matchingDeclaration.sourcePath)]
        )
      ));
    });
  });

  if (declarators.length > 0) {
    return b.variableDeclaration('var', declarators);
  } else {
    return b.emptyStatement();
  }
};

/**
 * @override
 *
 *   ```js
 *   export default <FunctionDeclaration|ClassDeclaration>
 *   // or
 *   export default <declaration|expression>;
 *   ```
 */
CommonJSFormatter.prototype.defaultExport = function(mod, declaration) {
  if (n.FunctionDeclaration.check(declaration) ||
      n.ClassDeclaration.check(declaration)) {
    // export default function foo () {}
    // -> becomes:
    // function foo () {}
    // export.default = foo;
    return [
      declaration,
      b.expressionStatement(b.assignmentExpression(
        '=',
        b.memberExpression(
          b.identifier('exports'),
          b.literal('default'),
          true
        ),
        declaration.id
      ))
    ];
  }
  return b.expressionStatement(b.assignmentExpression(
    '=',
    b.memberExpression(
      b.identifier('exports'),
      b.literal('default'),
      true
    ),
    declaration
  ));
};

/**
 * Gets a reference to the default export of this module.
 *
 * @param {Module} mod
 * @return {AST.Node}
 * @private
 */
CommonJSFormatter.prototype.defaultExportReference = function(mod) {
  return b.identifier(mod.id + 'default');
};

/**
 * Because exported references are captured via a closure as part of a getter
 * on the `exports` object, there's no need to rewrite local references to
 * exported values. For example, `value` in this example can stay as is:
 *
 *   // a.js
 *   export var value = 1;
 *
 * @override
 */
CommonJSFormatter.prototype.exportedReference = function(mod, referencePath) {
  return null;
};

/**
 * Gets a reference to an imported binding by getting the value from the
 * required module on demand. For example, this module:
 *
 *   // b.js
 *   import { value } from './a';
 *   console.log(value);
 *
 * Would be rewritten to look something like this:
 *
 *   var a$$ = require('./a');
 *   console.log(a$$.value):
 *
 * If the given reference does not refer to an imported binding then no
 * rewriting is required and `null` will be returned.
 *
 * @override
 */
CommonJSFormatter.prototype.importedReference = function(mod, referencePath) {
  var specifier = mod.imports.findSpecifierForReference(referencePath);

  if (specifier) {
    return this.reference(
      specifier.declaration.source,
      specifier.from
    );
  } else {
    return null;
  }
};

/**
 * We do not need to rewrite references to local declarations.
 *
 * @override
 */
CommonJSFormatter.prototype.localReference = function(mod, referencePath) {
  return null;
};

/**
 * Replaces non-default exports. For declarations we simply remove the `export`
 * keyword. For export declarations that just specify bindings, e.g.
 *
 *   export { a, b };
 *
 * we remove them entirely since they'll be handled when we define properties on
 * the `exports` object.
 *
 * @override
 */
CommonJSFormatter.prototype.processExportDeclaration = function(mod, nodePath) {
  var node = nodePath.node;

  if (n.FunctionDeclaration.check(node.declaration)) {
    return Replacement.swaps(nodePath, node.declaration);
  } else if (n.VariableDeclaration.check(node.declaration)) {
    return Replacement.swaps(nodePath, node.declaration);
  } else if (n.ClassDeclaration.check(node.declaration)) {
    return Replacement.swaps(nodePath, node.declaration);
  } else if (node.declaration) {
    throw new Error('unexpected export style, found a declaration of type: ' + node.declaration.type);
  } else {
    return Replacement.removes(nodePath);
  }
};

/**
 * We explicitly disallow reassignment because we cannot propagate changes to
 * importing modules as we would in ES5, e.g. these are both disallowed:
 *
 * export var foo = 1;
 * foo = 2;
 *
 * export var bar = 1;
 * bar++;
 *
 * @override
 */
CommonJSFormatter.prototype.processExportReassignment = function(mod, nodePath) {
  var node = nodePath.node;
  var exportName;

  if (n.AssignmentExpression.check(node)) {
    exportName = node.left.name;
  } else if (n.UpdateExpression.check(node)) {
    exportName = node.argument.name;
  } else {
    throw new Error('unexpected export reassignment type: ' + node.type);
  }


  if (n.UpdateExpression.check(node) && !node.prefix) {
    /**
     * The result of `a++` is the value of `a` before it is incremented, so we
     * can't just use the result as the new value for `exports.a`. The question
     * is whether we need to preserve the result of `a++` or not. In this case,
     * we do:
     *
     *   ```js
     *   foo(a++);
     *   ```
     *
     * But in this case we don't, since the result is ignored:
     *
     *   ```js
     *   a++;
     *   ```
     */

    if (n.ExpressionStatement.check(nodePath.parent.node)) {
      // The result is ignored here, so `a++` can become `a++, exports.a = a`.
      return Replacement.swaps(
        nodePath,
        b.sequenceExpression([
          node,
          b.assignmentExpression(
            '=',
            b.memberExpression(
              b.identifier('exports'),
              b.identifier(exportName),
              false
            ),
            b.identifier(exportName)
          )
        ])
      );
    } else {
      // The result is used here, so we need a temporary variable to store it.
      var result = util.injectVariable(nodePath.scope, util.uniqueIdentifier(nodePath.scope));

      return Replacement.swaps(
        nodePath,
        b.sequenceExpression([
          b.assignmentExpression(
            '=',
            result,
            node
          ),
          b.assignmentExpression(
            '=',
            b.memberExpression(
              b.identifier('exports'),
              b.identifier(exportName),
              false
            ),
            b.identifier(exportName)
          ),
          result
        ])
      );
    }
  }

  /**
   * We can use the result of the update/assignment as-is in this case, e.g.
   *
   *   ```js
   *   foo(++a);
   *   b = 9;
   *   ```
   *
   * Can become:
   *
   *   ```js
   *   foo(exports.a = ++a);
   *   exports.b = b = 9;
   *   ```
   */
  return Replacement.swaps(
    nodePath,
    b.assignmentExpression(
      '=',
      b.memberExpression(
        b.identifier('exports'),
        b.identifier(exportName),
        false
      ),
      node
    )
  );
};

/**
 * Process a variable declaration found at the top level of the module. Since
 * we do not need to rewrite exported functions, we can leave function
 * declarations alone.
 *
 * @override
 */
CommonJSFormatter.prototype.processFunctionDeclaration = function(mod, nodePath) {
  return null;
};

/**
 * Since import declarations only control how we rewrite references we can just
 * remove them -- they don't turn into any actual statements.
 *
 * @override
 */
CommonJSFormatter.prototype.processImportDeclaration = function(mod, nodePath) {
  return Replacement.removes(nodePath);
};

/**
 * Process a variable declaration found at the top level of the module. Since
 * we do not need to rewrite exported variables, we can leave variable
 * declarations alone.
 *
 * @override
 */
CommonJSFormatter.prototype.processVariableDeclaration = function(mod, nodePath) {
  return null;
};

/**
 * Returns an expression which globally references the export named by
 * `identifier` for the given module `mod`. For example:
 *
 *    // rsvp/defer.js, export default
 *    rsvp$defer$$.default
 *
 *    // rsvp/utils.js, export function isFunction
 *    rsvp$utils$$.isFunction
 *
 * @param {Module} mod
 * @param {Identifier} identifier
 * @return {MemberExpression}
 * @private
 */
CommonJSFormatter.prototype.reference = function(mod, identifier) {
  return b.memberExpression(
    b.identifier(mod.id),
    n.Identifier.check(identifier) ? identifier : b.identifier(identifier),
    false
  );
};

module.exports = CommonJSFormatter;

},{"../replacement":17,"../utils":20,"./formatter":10,"assert":49,"ast-util":46,"recast":74}],10:[function(require,module,exports){
/* jshint node:true, undef:true, unused:true */

var assert = require('assert');

var recast = require('recast');
var types = recast.types;
var n = types.namedTypes;
var b = types.builders;

var Replacement = require('../replacement');

/**
 * This class provides a base for any concrete formatter classes. Subclasses
 * of this class will be used by Rewriter to determine how to replace various
 * parts of an AST while walking it to achieve conversion from ES6 modules to
 * another format.
 *
 * @constructor
 * @abstract
 */
function Formatter() {}

/**
 * Convert a list of ordered modules into a list of files.
 *
 * @param {Module[]} modules Modules in execution order.
 * @return {File[]}
 */
Formatter.prototype.build = function(modules) {
  throw new Error('#build must be implemented in subclasses');
};

/**
 * Replaces default export declarations with something else. Subclasses will
 * generally return a statement that takes the declaration value and stashes
 * it somewhere appropriate for the transpiled format, e.g. creates a local
 * variable, assigns the value to something, or calls a function with it.
 *
 * Given an export statement like so:
 *
 *   ```js
 *   export default foo(bar);
 *   ```
 *
 * This method will be called with the module containing the statement and
 * the AST node corresponding to `foo(bar)`.
 *
 * @param {Module} mod
 * @param {Expression} declaration
 * @return {Statement}
 */
Formatter.prototype.defaultExport = function(mod, declaration) {
  throw new Error('#defaultExport must be implemented in subclasses');
};

/**
 * Resolves references to exported bindings. In the example below, if we refer
 * to `value` elsewhere in the module then that reference may need to be
 * rewritten. This method allows us to configure what it is rewritten to.
 *
 *   ```js
 *   // a.js
 *   export var value = 1;
 *   ```
 *
 * Subclasses should return null if the original reference should be left
 * intact.
 *
 * @param {Module} mod
 * @param {NodePath} referencePath
 * @return {?Expression}
 */
Formatter.prototype.exportedReference = function(mod, referencePath) {
  throw new Error('#exportedReference must be implemented in subclasses');
};

/**
 * Gets a reference to an imported binding. In this example, we will be called
 * with the NodePath for `value` in `console.log(value)`:
 *
 *   ```js
 *   // b.js
 *   import { value } from './a';
 *   console.log(value);
 *   ```
 *
 * If the given reference does not refer to an imported binding then no
 * rewriting is required and `null` should be returned.
 *
 * @param {Module} mod
 * @param {NodePath} referencePath
 * @return {?Expression}
 */
Formatter.prototype.importedReference = function(mod, referencePath) {
  throw new Error('#importedReference must be implemented in subclasses');
};

/**
 * Determines what the given reference should be rewritten to, if anything.
 * Subclasses should override this only if they wish to rename bindings not
 * associated with imports and exports.
 *
 * This is used by the bundle formatter, for example, to ensure that bindings
 * at module scope are rewritten with unique names to prevent collisions with
 * bindings from other modules.
 *
 * @param {Module} mod
 * @param {NodePath} referencePath
 * @return {?Node}
 */
Formatter.prototype.localReference = function(mod, referencePath) {
  return null;
};

/**
 * Process a variable declaration found at the top level of the module.
 *
 * @param {Module} mod
 * @param {NodePath} nodePath
 * @return {?Node[]}
 */
Formatter.prototype.processFunctionDeclaration = function(mod, nodePath) {
  throw new Error('#processFunctionDeclaration must be implemented in subclasses');
};

/**
 * Process a variable declaration found at the top level of the module.
 *
 * @param {Module} mod
 * @param {NodePath} nodePath
 * @return {?Node[]}
 */
Formatter.prototype.processVariableDeclaration = function(mod, nodePath) {
  throw new Error('#processVariableDeclaration must be implemented in subclasses');
};

/**
 * Replaces non-default exports. These exports are of one of the following
 * forms:
 *
 *   ```js
 *   export var a = 1;
 *   export function a() {}
 *   export class a {}
 *   export { a };
 *   ```
 *
 * @param {Module} mod
 * @param {NodePath} nodePath
 * @return {?Replacement}
 */
Formatter.prototype.processExportDeclaration = function(mod, nodePath) {
  throw new Error('#processExportDeclaration must be implemented in subclasses');
};

/**
 * Process and optionally replace an update to an exported binding. This can
 * either be an assignment expression or an update expression, i.e.
 *
 *   ```js
 *   export var foo = 1;
 *   foo = 2;
 *   foo++;
 *   ```
 *
 * @param {Module} mod
 * @param {NodePath} nodePath
 * @return {?Replacement}
 */
Formatter.prototype.processExportReassignment = function(mod, nodePath) {
  throw new Error('#processExportReassignment must be implemented in subclasses');
};

/**
 * Optionally replace an import declaration. Subclasses should almost always
 * replace import declarations. It may be replaced with a dependency lookup, or
 * perhaps with nothing.
 *
 * @param {Module} mod
 * @param {NodePath} nodePath
 * @return {?Replacement}
 */
Formatter.prototype.processImportDeclaration = function(mod, nodePath) {
  throw new Error('#processImportDeclaration must be implemented in subclasses');
};

module.exports = Formatter;

},{"../replacement":17,"assert":49,"recast":74}],11:[function(require,module,exports){
/* jshint node:true, undef:true, unused:true */

var assert = require('assert');
var recast = require('recast');
var types = recast.types;
var n = types.namedTypes;

var ModuleBindingList = require('./module_binding_list');
var ModuleBindingDeclaration = require('./module_binding_declaration');
var ModuleBindingSpecifier = require('./module_binding_specifier');

var utils = require('./utils');
var memo = utils.memo;
var extend = utils.extend;
var sourcePosition = utils.sourcePosition;

/**
 * Represents a list of the imports for the given module.
 *
 * @constructor
 * @param {Module} mod
 * @extends ModuleBindingList
 */
function ImportDeclarationList(mod) {
  ModuleBindingList.call(this, mod);
}
extend(ImportDeclarationList, ModuleBindingList);

/**
 * @private
 * @param {AST.Node} node
 * @return {boolean}
 */
ImportDeclarationList.prototype.isMatchingBinding = function(node) {
  return n.ImportDeclaration.check(node);
};

/**
 * Gets an import declaration for the given `node`.
 *
 * @private
 * @param {AST.ImportDeclaration} node
 * @return {ImportDeclaration}
 */
ImportDeclarationList.prototype.declarationForNode = function(node) {
  return new ImportDeclaration(this.module, node);
};

/**
 * Contains information about an import declaration.
 *
 *   ```js
 *   import foo from 'math';
 *   import { sin, cos } from 'math';
 *   import * as bar from 'math';
 *   import foo, { sin, cos } from 'math';
 *   import foo, * as bar from 'math';
 *   ```
 *
 * @constructor
 * @abstract
 * @param {Module} mod
 * @param {AST.ImportDeclaration} node
 * @extends ModuleBindingDeclaration
 */
function ImportDeclaration(mod, node) {
  assert.ok(
    n.ImportDeclaration.check(node),
    'expected an import declaration, got ' + (node && node.type)
  );

  ModuleBindingDeclaration.call(this, mod, node);
}
extend(ImportDeclaration, ModuleBindingDeclaration);

/**
 * Contains a list of specifier name information for this import.
 *
 * @type {ImportSpecifier[]}
 * @name ImportDeclaration#specifiers
 */
memo(ImportDeclaration.prototype, 'specifiers', /** @this ImportDeclaration */function() {
  var self = this;
  return this.node.specifiers.map(function(s) {
    var specifier = new ImportSpecifier(self, s);
    if (n.ImportDefaultSpecifier.check(s)) {
      specifier.from = 'default';
    } else if (n.ImportNamespaceSpecifier.check(s)) {
      // TODO: implement import * as ...
      specifier.from = '*';
    } else {
      specifier = new ImportSpecifier(self, s);
    }
    return specifier;
  });
});

/**
 * Represents an import specifier. The "a" and "b as c" are both import
 * specifiers in the following import statement.
 *
 *   import { a, b as c } from "a";
 *
 * @constructor
 * @extends ModuleBindingSpecifier
 * @param {ImportDeclaration} declaration
 * @param {AST.ImportSpecifier} node
 */
function ImportSpecifier(declaration, node) {
  assert.ok(
    declaration instanceof ImportDeclaration,
    'expected an instance of ImportDeclaration'
  );
  ModuleBindingSpecifier.call(this, declaration, node);
}
extend(ImportSpecifier, ModuleBindingSpecifier);

/**
 * @type {ExportSpecifier}
 * @name ImportSpecifier#exportSpecifier
 */
memo(ImportSpecifier.prototype, 'exportSpecifier', /** @this ImportSpecifier */function() {
  var source = this.declaration.source;
  assert.ok(source, 'import specifiers must have a valid source');
  var exportSpecifier = source.exports.findSpecifierByName(this.from);
  assert.ok(
    exportSpecifier,
    'import `' + this.from + '` at ' +
    sourcePosition(this.module, this.node) +
    ' has no matching export in ' + source.relativePath
  );
  return exportSpecifier;
});

module.exports = ImportDeclarationList;

},{"./module_binding_declaration":14,"./module_binding_list":15,"./module_binding_specifier":16,"./utils":20,"assert":49,"recast":74}],12:[function(require,module,exports){
(function (process){
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


}).call(this,require('_process'))
},{"../container":3,"../file_resolver":6,"../formatters":7,"../module":13,"./capture_stack_trace_polyfill":1,"./fs":2,"_process":57}],13:[function(require,module,exports){
/* jshint node:true, undef:true, unused:true */

var assert = require('assert');
var fs = require('fs');
var Path = require('path');

var esprima = require('esprima-fb');
var recast = require('recast');
var types = recast.types;
var n = types.namedTypes;
var b = types.builders;
var NodePath = recast.types.NodePath;

var ImportDeclarationList = require('./imports');
var ExportDeclarationList = require('./exports');
var utils = require('./utils');
var memo = utils.memo;
var endsWith = utils.endsWith;

/**
 * Represents a JavaScript module at a particular location on disk.
 *
 * @param {string} path
 * @param {string} relativePath
 * @param {Container} container
 * @constructor
 */
function Module(path, relativePath, container) {
  Object.defineProperties(this, {
    /**
     * @type {string}
     * @name Module#path
     */
    path: {
      value: path,
      enumerable: true,
      writable: false
    },

    /**
     * @type {string}
     * @name Module#relativePath
     */
    relativePath: {
      value: relativePath,
      enumerable: true,
      writable: false
    },

    /**
     * @type {Container}
     * @name Module#container
     */
    container: {
      value: container,
      enumerable: true,
      writable: false
    }
  });
}

/**
 * Clears the cached data for this module.
 */
Module.prototype.reload = function() {
  delete this.src;
  delete this.ast;
  delete this.imports;
  delete this.exports;
  delete this.scope;
};

/**
 * The list of imports declared by this module.
 *
 * @type {ImportDeclarationList}
 * @name Module#imports
 */
memo(Module.prototype, 'imports', /** @this Module */function() {
  var result = new ImportDeclarationList(this);
  result.readProgram(this.ast.program);
  return result;
});

/**
 * The list of exports declared by this module.
 *
 * @type {ExportDeclarationList}
 * @name Module#exports
 */
memo(Module.prototype, 'exports', /** @this Module */function() {
  var result = new ExportDeclarationList(this);
  result.readProgram(this.ast.program);
  return result;
});

/**
 * This module's scope.
 *
 * @type {Scope}
 * @name Module#scope
 */
memo(Module.prototype, 'scope', /** @this Module */function() {
  return new NodePath(this.ast).get('program').get('body').scope;
});

/**
 * This module's source code represented as an abstract syntax tree.
 *
 * @type {File}
 * @name Module#ast
 */
memo(Module.prototype, 'ast', /** @this Module */function() {
  return recast.parse(
    this.src, {
      esprima: esprima,
      sourceFileName: Path.basename(this.path)
    }
  );
});

/**
 * This module's source code.
 *
 * @type {String}
 * @name Module#src
 */
memo(Module.prototype, 'src', /** @this Module */function() {
  return fs.readFileSync(this.path).toString();
});

/**
 * A reference to the options from this module's container.
 *
 * @type {object}
 * @name Module#options
 */
memo(Module.prototype, 'options', /** @this Module */function() {
  return this.container.options;
});

/**
 * This module's relative name, like {#relativePath} but without the extension.
 * This may be modified by a Container if this Module is part of a Container.
 *
 * @type {string}
 * @name Module#name
 */
memo(Module.prototype, 'name', /** @this Module */function() {
  var relativePath = this.relativePath;
  if (endsWith(relativePath, '.js')) {
    return relativePath.slice(0, -3);
  } else {
    return relativePath;
  }
});

/**
 * A string suitable for a JavaScript identifier named for this module.
 *
 * @type {string}
 * @name Module#id
 */
memo(Module.prototype, 'id', /** @this Module */function() {
  return this.name.replace(/[^\w$_]/g, '$') + '$$';
});

/**
 * Gets a Module by path relative to this module.
 *
 * @param {string} sourcePath
 * @return {Module}
 */
Module.prototype.getModule = function(sourcePath) {
  return this.container.getModule(sourcePath, this);
};

/**
 * Generate a descriptive string suitable for debugging.
 *
 * @return {string}
 */
Module.prototype.inspect = function() {
  return '#<' + this.constructor.name + ' ' + this.relativePath + '>';
};

/**
 * @see Module#inspect
 */
Module.prototype.toString = Module.prototype.inspect;

module.exports = Module;

},{"./exports":5,"./imports":11,"./utils":20,"assert":49,"esprima-fb":60,"fs":2,"path":56,"recast":74}],14:[function(require,module,exports){
/* jshint node:true, undef:true, unused:true */

var assert = require('assert');

var recast = require('recast');
var types = recast.types;
var n = types.namedTypes;

var utils = require('./utils');
var memo = utils.memo;

/**
 * Contains information about a module binding declaration. This corresponds to
 * the shared functionality of `ExportDeclaration` and `ImportDeclaration` in
 * the ES6 spec.
 *
 * @constructor
 * @abstract
 * @param {Module} mod
 * @param {AST.ImportDeclaration|AST.ExportDeclaration} node
 */
function ModuleBindingDeclaration(mod, node) {
  assert.ok(
    n.ImportDeclaration.check(node) || n.ExportDeclaration.check(node),
    'expected an import or export declaration, got ' + (node && node.type)
  );

  Object.defineProperties(this, {
    /**
     * @name ModuleBindingDeclaration#node
     * @type {AST.ImportDeclaration|AST.ExportDeclaration}
     */
    node: {
      value: node
    },

    /**
     * @name ModuleBindingDeclaration#module
     * @type {Module}
     */
    module: {
      value: mod
    }
  });
}

/**
 * Finds the specifier that creates the local binding given by `name`, if one
 * exists. Otherwise `null` is returned.
 *
 * @param {string} name
 * @return {?ModuleBindingSpecifier}
 */
ModuleBindingDeclaration.prototype.findSpecifierByName = function(name) {
  var specifiers = this.specifiers;

  for (var i = 0, length = specifiers.length; i < length; i++) {
    var specifier = specifiers[i];
    if (specifier.name === name) {
      return specifier;
    }
  }

  return null;
};

/**
 * @param {AST.Identifier} identifier
 * @return {?ModuleBindingSpecifier}
 */
ModuleBindingDeclaration.prototype.findSpecifierByIdentifier = function(identifier) {
  for (var i = 0, length = this.specifiers.length; i < length; i++) {
    var specifier = this.specifiers[i];
    if (specifier.identifier === identifier) {
      return specifier;
    }
  }

  return null;
};

/**
 * Gets the raw path of the `from` part of the declaration, if present. For
 * example:
 *
 *   ```js
 *   import { map } from "array";
 *   ```
 *
 * The source path for the above declaration is "array".
 *
 * @type {?string}
 * @name ModuleBindingDeclaration#sourcePath
 */
memo(ModuleBindingDeclaration.prototype, 'sourcePath', /** @this ModuleBindingDeclaration */function() {
  return this.node.source ? this.node.source.value : null;
});

/**
 * Gets a reference to the module referenced by this declaration.
 *
 * @type {Module}
 * @name ModuleBindingDeclaration#source
 */
memo(ModuleBindingDeclaration.prototype, 'source', /** @this ModuleBindingDeclaration */function() {
  return this.sourcePath ? this.module.getModule(this.sourcePath) : null;
});

/**
 * Gets the containing module's scope.
 *
 * @type {Scope}
 * @name ModuleBindingDeclaration#moduleScope
 */
memo(ModuleBindingDeclaration.prototype, 'moduleScope', /** @this ModuleBindingDeclaration */function() {
  return this.module.scope;
});

/**
 * Generate a string representing this object to aid debugging.
 *
 * @return {string}
 */
ModuleBindingDeclaration.prototype.inspect = function() {
  return recast.print(this.node).code;
};

/**
 * @see ModuleBindingDeclaration#inspect
 */
ModuleBindingDeclaration.prototype.toString = ModuleBindingDeclaration.prototype.inspect;

module.exports = ModuleBindingDeclaration;

},{"./utils":20,"assert":49,"recast":74}],15:[function(require,module,exports){
/* jshint node:true, undef:true, unused:true */

var assert = require('assert');

var utils = require('./utils');
var memo = utils.memo;
var sourcePosition = utils.sourcePosition;

/**
 * Represents a list of bindings for the given module. This corresponds to the
 * shared functionality from `ExportsList` and `ImportsList` from the ES6 spec.
 *
 * @abstract
 * @constructor
 * @param {Module} mod
 */
function ModuleBindingList(mod) {
  Object.defineProperties(this, {
    /**
     * @name ModuleBindingList#_nodes
     * @type {AST.ImportDeclaration[]|AST.ExportDeclaration[]}
     * @private
     */
    _nodes: {
      value: []
    },

    /**
     * @name ModuleBindingList#module
     * @type {Module}
     */
    module: {
      value: mod
    }
  });
}

/**
 * Add all the binding declarations from the given scope body. Generally this
 * should be the Program node's `body` property, an array of statements.
 *
 * @param {AST.Program} program
 */
ModuleBindingList.prototype.readProgram = function(program) {
  var body = program.body;
  for (var i = 0; i < body.length; i++) {
    if (this.isMatchingBinding(body[i])) {
      this.addDeclaration(body[i]);
    }
  }
};

/**
 * Adds a declaration to the list.
 *
 * @private
 * @param {AST.ImportDeclaration|AST.ExportDeclaration} node
 */
ModuleBindingList.prototype.addDeclaration = function(node) {
  assert.ok(
    this.isMatchingBinding(node),
    'expected node to be an declaration, but got ' +
    (node && node.type)
  );
  this._nodes.push(node);

  // reset the cache
  delete this.declarations;
  delete this.specifiers;
  delete this.modules;
};

/**
 * Gets the associated module's scope.
 *
 * @type {Scope}
 * @name ModuleBindingList#moduleScope
 */
memo(ModuleBindingList.prototype, 'moduleScope', /** @this ModuleBindingList */function() {
  return this.module.scope;
});

/**
 * Gets all the modules referenced by the declarations in this list.
 *
 * @type {Module[]}
 * @name ModuleBindingList#modules
 */
memo(ModuleBindingList.prototype, 'modules', /** @this ModuleBindingList */function() {
  var modules = [];

  this.declarations.forEach(function(declaration) {
    if (declaration.source && modules.indexOf(declaration.source) < 0) {
      modules.push(declaration.source);
    }
  });

  return modules;
});

/**
 * Finds the specifier that creates the local binding given by `name`, if one
 * exists. Otherwise `null` is returned.
 *
 * @private
 * @param {string} name
 * @return {?ModuleBindingSpecifier}
 */
ModuleBindingList.prototype.findSpecifierByName = function(name) {
  for (var i = 0, length = this.declarations.length; i < length; i++) {
    var specifier = this.declarations[i].findSpecifierByName(name);
    if (specifier) { return specifier; }
  }

  return null;
};

/**
 * Finds the specifier whose identifier is the given identifier, if one exists.
 * Otherwise `null` is returned.
 *
 * @private
 * @param {AST.Identifier} identifier
 * @return {?ModuleBindingSpecifier}
 */
ModuleBindingList.prototype.findSpecifierByIdentifier = function(identifier) {
  for (var i = 0, length = this.declarations.length; i < length; i++) {
    var specifier = this.declarations[i].findSpecifierByIdentifier(identifier);
    if (specifier && specifier.identifier === identifier) {
      return specifier;
    }
  }

  return null;
};

/**
 * @param {NodePath} referencePath
 * @return {?ModuleBindingSpecifier}
 */
ModuleBindingList.prototype.findSpecifierForReference = function(referencePath) {
  var declaration = this.findDeclarationForReference(referencePath);

  if (!declaration) {
    return null;
  }

  var specifier = this.findSpecifierByIdentifier(declaration.node);
  assert.ok(
    specifier,
    'no specifier found for `' + referencePath.node.name + '`! this should not happen!'
  );
  return specifier;
};

/**
 * @private
 */
ModuleBindingList.prototype.findDeclarationForReference = function(referencePath) {
  // Check names to avoid traversing scopes for all references.
  if (this.names.indexOf(referencePath.node.name) < 0) {
    return null;
  }

  var node = referencePath.node;
  var declaringScope = referencePath.scope.lookup(node.name);
  assert.ok(
    declaringScope,
    '`' + node.name + '` at ' + sourcePosition(this.module, node) +
    ' cannot be bound if it is not declared'
  );

  // Bindings are at the top level, so if this isn't then it's shadowing.
  if (!declaringScope.isGlobal) {
    return null;
  }

  var declarations = declaringScope.getBindings()[node.name];
  if (!declarations || declarations.length !== 1) {
    throw new SyntaxError(
      'expected one declaration for `' + node.name +
      '`, at ' + sourcePosition(this.module, node) +
      ' but found ' + (declarations ? declarations.length : 'none')
    );
  }

  return declarations[0];
};

/**
 * Generate a string representing this object to aid debugging.
 *
 * @return {string}
 */
ModuleBindingList.prototype.inspect = function() {
  var result = '#<' + this.constructor.name;

  result += ' module=' + this.module.relativePath;

  if (this.declarations.length > 0) {
    result += ' declarations=' + this.declarations.map(function(imp) {
      return imp.inspect();
    }).join(', ');
  }

  result += '>';
  return result;
};

/**
 * @see ModuleBindingList#inspect
 */
ModuleBindingList.prototype.toString = ModuleBindingList.prototype.inspect;

/**
 * Contains a list of declarations.
 *
 * @type {(ImportDeclaration[]|ExportDeclaration[])}
 * @name ModuleBindingList#declarations
 */
memo(ModuleBindingList.prototype, 'declarations', /** @this ModuleBindingList */function() {
  var self = this;

  return this._nodes.map(function(child) {
    return self.declarationForNode(child);
  });
});

/**
 * Contains a combined list of names for all the declarations contained in this
 * list.
 *
 * @type {string[]}
 * @name ModuleBindingList#names
 */
memo(ModuleBindingList.prototype, 'names', /** @this ModuleBindingList */function() {
  return this.declarations.reduce(function(names, decl) {
    return names.concat(decl.specifiers.map(function(specifier) {
      return specifier.name;
    }));
  }, []);
});

module.exports = ModuleBindingList;

},{"./utils":20,"assert":49}],16:[function(require,module,exports){
/* jshint node:true, undef:true, unused:true */

var assert = require('assert');

var recast = require('recast');
var types = recast.types;
var n = types.namedTypes;

var utils = require('./utils');
var memo = utils.memo;
var sourcePosition = utils.sourcePosition;

/**
 * A module binding specifier provides the shared functionality of
 * ImportSpecifiers and ExportSpecifiers in the ES6 spec.
 *
 * @constructor
 * @param {ModuleBindingDeclaration} declaration
 * @param {AST.NamedSpecifier} node
 */
function ModuleBindingSpecifier(declaration, node) {
  Object.defineProperties(this, {
    /**
     * @name ModuleBindingSpecifier#declaration
     * @type {ModuleBindingDeclaration}
     */
    declaration: {
      value: declaration
    },

    /**
     * @name ModuleBindingSpecifier#node
     * @type {AST.NamedSpecifier}
     */
    node: {
      value: node
    }
  });
}

/**
 * Gets the module this specifier is declared in.
 *
 * @type Module
 * @name ModuleBindingSpecifier#module
 */
memo(ModuleBindingSpecifier.prototype, 'module', /** @this ModuleBindingSpecifier */function() {
  return this.declaration.module;
});

/**
 * Gets the scope at the top level of the module.
 *
 * @type {Scope}
 * @name ModuleBindingSpecifier#moduleScope
 */
memo(ModuleBindingSpecifier.prototype, 'moduleScope', /** @this ModuleBindingSpecifier */function() {
  return this.declaration.moduleScope;
});

/**
 * Gets the name of this specifier. For import specifiers this is the name of
 * the binding this specifier will create locally, i.e. "foo" in both of these
 * import statements:
 *
 *   import { foo } from "util";
 *   import { bar as foo } from "util";
 *
 * In export specifiers it is the name of the exported declaration or the alias
 * given to an internal name, i.e. "foo" in both of these export statements:
 *
 *   export { bar as foo };
 *   export var foo = 1;
 *
 * @type {string}
 * @name ModuleBindingSpecifier#name
 */
memo(ModuleBindingSpecifier.prototype, 'name', /** @this ModuleBindingSpecifier */function() {
  return this.identifier.name;
});

/**
 * Gets the name of the identifier this specifier comes from as distinct from
 * `name`. This value will only be set if the local name and the
 * imported/exported name differ, i.e. it will be "foo" in these statements:
 *
 *   import { foo as bar } from "util";
 *   export { foo as bar };
 *
 * And it will be undefined in these statements:
 *
 *   import { foo } from "util";
 *   export { foo };
 *
 * @type {string}
 * @name ModuleBindingSpecifier#from
 */
memo(ModuleBindingSpecifier.prototype, 'from', /** @this ModuleBindingSpecifier */function() {
  return this.node.id.name;
});

/**
 * Gets the node that gives this specifier its name as it would be imported,
 * i.e. "foo" in these statements:
 *
 *   import { foo } from "utils";
 *   import { bar as foo } from "utils";
 *   export { foo };
 *   export { bar as foo };
 *
 * @type {AST.Identifier}
 * @name ModuleBindingSpecifier#identifier
 */
memo(ModuleBindingSpecifier.prototype, 'identifier', /** @this ModuleBindingSpecifier */function() {
  return this.node.name || this.node.id;
});

/**
 * Gets the export specifier corresponding to this specifier. This can be from
 * either an import or export declaration, since both can have a "from" part:
 *
 *   import { map } from "array";
 *   export { map } from "array";
 *
 * In both of the above examples, the export specifier of `map` would be part
 * of the export statement in the "array" module that exports it.
 *
 * @type {?ExportSpecifier}
 * @name ModuleBindingSpecifier#exportSpecifier
 */
memo(ModuleBindingSpecifier.prototype, 'exportSpecifier', /** @this ModuleBindingSpecifier */function() {
  var source = this.declaration.source;
  if (source) {
    var exports = source.exports;
    return exports.findSpecifierByName(this.from);
  } else {
    return null;
  }
});

/**
 * Gets the import specifier corresponding to this specifier. This should only
 * happen when exporting a binding that is imported in the same module, like so:
 *
 *   import { map } from "array";
 *   export { map };
 *
 * The `map` export specifier has the `map` import specifier as its
 * `importSpecifier` property value. The `map` import specifier has no
 * `importSpecifier` property value.
 *
 * @type {?ImportSpecifier}
 * @name ModuleBindingSpecifier#importSpecifier
 */
memo(ModuleBindingSpecifier.prototype, 'importSpecifier', /** @this ModuleBindingSpecifier */function() {
  // This may be an export from this module, so find the declaration.
  var localExportDeclarationInfo = this.moduleDeclaration;

  if (localExportDeclarationInfo && n.ImportDeclaration.check(localExportDeclarationInfo.declaration)) {
    // It was imported then exported with two separate declarations.
    var exportModule = this.module;
    return exportModule.imports.findSpecifierByIdentifier(localExportDeclarationInfo.identifier);
  } else {
    return null;
  }
});

/**
 * Gets the original export value by following chains of export/import
 * statements. For example:
 *
 *   // a.js
 *   export var a = 1;
 *
 *   // b.js
 *   export { a } from "./a";
 *
 *   // c.js
 *   import { a } from "./b";
 *   export { a };
 *
 *   // d.js
 *   import { a } from "./c";
 *
 * The terminal export specifier for all of these specifiers is the export in
 * a.js, since all of them can be traced back to that one.
 *
 * @type {ExportSpecifier}
 * @name ModuleBindingSpecifier#terminalExportSpecifier
 */
memo(ModuleBindingSpecifier.prototype, 'terminalExportSpecifier', /** @this ModuleBindingSpecifier */function() {
  if (this.exportSpecifier) {
    // This is true for both imports and exports with a source, e.g.
    // `import { foo } from 'foo'` or `export { foo } from 'foo'`.
    return this.exportSpecifier.terminalExportSpecifier;
  }

  // This is an export from this module, so find the declaration.
  var importSpecifier = this.importSpecifier;
  if (importSpecifier) {
    var nextExportSpecifier = importSpecifier.exportSpecifier;
    assert.ok(
      nextExportSpecifier,
      'expected matching export in ' + importSpecifier.declaration.source.relativePath +
      ' for import of `' + importSpecifier.name + '` at ' +
      sourcePosition(this.module, this.moduleDeclaration.identifier)
    );
    return nextExportSpecifier.terminalExportSpecifier;
  } else {
    // It was declared in this module, so we are the terminal export specifier.
    return this;
  }
});

/**
 * @type {?DeclarationInfo}
 */
ModuleBindingSpecifier.prototype.moduleDeclaration = null;

/**
 * Gets a string representation of this module binding specifier suitable for
 * debugging.
 *
 * @return {string}
 */
ModuleBindingSpecifier.prototype.inspect = function() {
  return '#<' + this.constructor.name +
    ' module=' + this.declaration.module.relativePath +
    ' name=' + this.name +
    ' from=' + this.from +
    '>';
};

/**
 * @see ModuleBindingSpecifier#inspect
 */
ModuleBindingSpecifier.prototype.toString = ModuleBindingSpecifier.prototype.inspect;

module.exports = ModuleBindingSpecifier;

},{"./utils":20,"assert":49,"recast":74}],17:[function(require,module,exports){
/* jshint node:true, undef:true, unused:true */

var recast = require('recast');

/** @typedef [NodePath, AST.Node[]] */
var ReplacementPair;

/**
 * Represents a replacement of a node path with zero or more nodes.
 *
 * @constructor
 * @param {NodePath=} nodePath
 * @param {AST.Node[]=} nodes
 */
function Replacement(nodePath, nodes) {
  /**
   * @private
   * @type {ReplacementPair[]}
   */
  this.queue = [];
  if (nodePath && nodes) {
    this.queue.push([nodePath, nodes]);
  }
}

/**
 * Performs the replacement.
 */
Replacement.prototype.replace = function() {
  for (var i = 0, length = this.queue.length; i < length; i++) {
    var item = this.queue[i];
    item[0].replace.apply(item[0], item[1]);
  }
};

/**
 * Incorporates the replacements from the given Replacement into this one.
 *
 * @param {Replacement} anotherReplacement
 */
Replacement.prototype.and = function(anotherReplacement) {
  this.queue.push.apply(this.queue, anotherReplacement.queue);
  return this;
};

/**
 * Constructs a Replacement that, when run, will remove the node from the AST.
 *
 * @param {NodePath} nodePath
 * @return {Replacement}
 */
Replacement.removes = function(nodePath) {
  return new Replacement(nodePath, []);
};

/**
 * Constructs a Replacement that, when run, will insert the given nodes after
 * the one in nodePath.
 *
 * @param {NodePath} nodePath
 * @param {AST.Node[]} nodes
 * @return {Replacement}
 */
Replacement.adds = function(nodePath, nodes) {
  return new Replacement(nodePath, [nodePath.node].concat(nodes));
};

/**
 * Constructs a Replacement that, when run, swaps the node in nodePath with the
 * given node or nodes.
 *
 * @param {NodePath} nodePath
 * @param {AST.Node|AST.Node[]} nodes
 */
Replacement.swaps = function(nodePath, nodes) {
  if (!Array.isArray(nodes)) {
    nodes = [nodes];
  }
  return new Replacement(nodePath, nodes);
};

Replacement.map = function(nodePaths, callback) {
  var result = new Replacement();

  nodePaths.each(function(nodePath) {
    var replacement = callback(nodePath);
    if (replacement) {
      result.and(replacement);
    }
  });

  return result;
};

module.exports = Replacement;

},{"recast":74}],18:[function(require,module,exports){
/* jshint node:true, undef:true, unused:true */

var assert = require('assert');
var recast = require('recast');
var types = recast.types;
var n = types.namedTypes;
var b = types.builders;
var astUtil = require('ast-util');

var utils = require('./utils');
var extend = utils.extend;
var sourcePosition = utils.sourcePosition;
var Replacement = require('./replacement');

/**
 * Replaces references to local bindings created by `mod`'s imports
 * with references to the original value in the source module.
 *
 * @constructor
 * @param {Formatter} formatter
 * @extends types.PathVisitor
 */
function Rewriter(formatter) {
  types.PathVisitor.call(this);

  Object.defineProperties(this, {
    formatter: {
      value: formatter
    }
  });
}
extend(Rewriter, types.PathVisitor);

/**
 * Rewrites references to all imported and exported bindings according to the
 * rules from this rewriter's formatter. For example, this module:
 *
 *   ```js
 *   import { sin, cos } from './math';
 *   import fib from './math/fib';
 *
 *   assert.equal(sin(0), 0);
 *   assert.equal(cos(0), 1);
 *   assert.equal(fib(1), 1);
 *   ```
 *
 * has its references to the imported bindings `sin`, `cos`, and `fib`
 * rewritten to reference the source module:
 *
 *   ```js
 *   assert.equal(math$$.sin(0), 0);
 *   assert.equal(math$$.cos(0), 1);
 *   assert.equal(math$fib$$.fib(1), 1);
 *   ```
 *
 * @param {Module[]} modules
 */
Rewriter.prototype.rewrite = function(modules) {
  var replacements = [];

  // FIXME: This is just here to ensure that all imports and exports know where
  // they came from. We need this because after we re-write the declarations
  // will not be there anymore and we'll need to ensure they're cached up front.
  modules.forEach(function(mod) {
    [mod.exports, mod.imports].forEach(function(declarations) {
      declarations.declarations.forEach(function(declaration) {
        declaration.specifiers.forEach(function(specifier) {
          return specifier.importSpecifier;
        });
      });
    });
  });

  this.replacements = replacements;
  for (var i = 0, length = modules.length; i < length; i++) {
    var mod = modules[i];
    if (mod.exports.declarations.length > 0 || mod.imports.declarations.length > 0) {
      this.currentModule = mod;
      types.visit(mod.ast.program, this);
    } else {
      types.visit(mod.ast.program, new DeclarationLinterVisitor(mod));
    }
  }
  this.currentModule = null;
  this.replacements = null;

  replacements.forEach(function(replacement) {
    if (replacement.replace) {
      replacement.replace();
    } else {
      var path = replacement.shift();
      path.replace.apply(path, replacement);
    }
  });
};

/**
 * Process all identifiers looking for references to variables in scope.
 *
 * @param {NodePath} nodePath
 * @return {boolean}
 * @private
 */
Rewriter.prototype.visitIdentifier = function(nodePath) {
  if (astUtil.isReference(nodePath)) {
    var exportReference = this.getExportReferenceForReference(this.currentModule, nodePath);
    if (exportReference) {
      this.replacements.push(Replacement.swaps(nodePath, exportReference));
    }
  }

  return false;
};

/**
 * Process all variable declarations looking for top-level exported variables.
 *
 * @param {NodePath} nodePath
 * @private
 */
Rewriter.prototype.visitVariableDeclaration = function(nodePath) {
  if (nodePath.scope.isGlobal) {
    var replacement = this.formatter.processVariableDeclaration(this.currentModule, nodePath);
    if (replacement) {
      this.replacements.push(replacement);
    }
  }

  this.traverse(nodePath);
};

/**
 * We need to ensure that the LHS of this assignment is not an imported binding.
 * If it is, we throw a "compile"-time error since this is not allowed by the
 * spec (see section 12.14.1, Assignment Operators / Static Semantics: Early
 * Errors).
 *
 * @param {NodePath} nodePath
 * @private
 */
Rewriter.prototype.visitAssignmentExpression = function(nodePath) {
  this.assertImportIsNotReassigned(this.currentModule, nodePath.get('left'));
  if (this.currentModule.exports.findDeclarationForReference(nodePath.get('left'))) {
    var replacement = this.formatter.processExportReassignment(this.currentModule, nodePath);
    if (replacement) {
      this.replacements.push(replacement);
    }
  }

  this.traverse(nodePath);
};

/**
 * Process all top-level function declarations in case they need to be processed.
 *
 * @param {NodePath} nodePath
 * @private
 */
Rewriter.prototype.visitFunctionDeclaration = function(nodePath) {
  if (n.Program.check(nodePath.parent.node)) {
    var replacement = this.formatter.processFunctionDeclaration(this.currentModule, nodePath);
    if (replacement) {
      this.replacements.push(replacement);
    }
  }

  this.traverse(nodePath);
};

/**
 * Look for all export declarations so we can rewrite them.
 *
 * @param {NodePath} nodePath
 * @private
 */
Rewriter.prototype.visitExportDeclaration = function(nodePath) {
  assertStatementIsTopLevel(this.currentModule, nodePath);

  var replacement;
  if (nodePath.node.default) {
    /**
     * Default exports do not create bindings, so we can safely turn these
     * into expressions that do something with the exported value.
     *
     * Make sure that the exported value is replaced if it is a reference
     * to an imported binding. For example:
     *
     *   import { foo } from './foo';
     *   export default foo;
     *
     * Might become:
     *
     *   mod$$.default = foo$$.foo;
     */
    var declaration = nodePath.node.declaration;
    var declarationPath = nodePath.get('declaration');
    if (astUtil.isReference(declarationPath)) {
      var exportReference = this.getExportReferenceForReference(this.currentModule, declarationPath);
      if (exportReference) {
        declaration = exportReference;
      }
    }
    replacement = Replacement.swaps(nodePath, this.formatter.defaultExport(this.currentModule, declaration));
  } else {
    replacement = this.formatter.processExportDeclaration(this.currentModule, nodePath);
  }

  if (replacement) {
    this.replacements.push(replacement);
  }

  this.traverse(nodePath);
};

/**
 * Process import declarations so they can be rewritten.
 *
 * @param {NodePath} nodePath
 * @private
 */
Rewriter.prototype.visitImportDeclaration = function(nodePath) {
  assertStatementIsTopLevel(this.currentModule, nodePath);
  var replacement = this.formatter.processImportDeclaration(this.currentModule, nodePath);
  if (replacement) {
    this.replacements.push(replacement);
  }

  this.traverse(nodePath);
};

/**
 * Process update expressions (e.g. `a++`) so we can re-write modifications to
 * exported variables.
 *
 * @param {NodePath} nodePath
 * @private
 */
Rewriter.prototype.visitUpdateExpression = function(nodePath) {
  this.assertImportIsNotReassigned(this.currentModule, nodePath.get('argument'));
  if (this.currentModule.exports.findDeclarationForReference(nodePath.get('argument'))) {
    var replacement = this.formatter.processExportReassignment(this.currentModule, nodePath);
    if (replacement) {
      this.replacements.push(replacement);
    }
  }

  this.traverse(nodePath);
};

/**
 * We need to ensure that reference updates (i.e. `ref =`, `ref++`) are not
 * allowed for imported bindings. If it is, we throw a "compile"-time error
 * since this is not allowed by the spec (see section 12.14.1, Assignment
 * Operators / Static Semantics: Early Errors).
 *
 * @private
 * @param {Module} mod
 * @param {Identifier} identifierPath
 */
Rewriter.prototype.assertImportIsNotReassigned = function(mod, identifierPath) {
  if (!n.Identifier.check(identifierPath.node) || !mod.imports.findDeclarationForReference(identifierPath)) {
    return;
  }

  var identifier = identifierPath.node;
  var name = identifier.name;
  var declarationScope = identifierPath.scope.lookup(name);
  if (declarationScope && declarationScope.isGlobal) {
    var declarationPaths = declarationScope.getBindings()[name];
    assert.ok(
      declarationPaths.length === 1,
      'expected exactly one declaration for `' + name +
      '`, found ' + declarationPaths.length
    );
    var declarationPath = declarationPaths[0];
    if (n.ImportSpecifier.check(declarationPath.parent.node) ||
        n.ImportDefaultSpecifier.check(declarationPath.parent.node) ||
        n.ImportNamespaceSpecifier.check(declarationPath.parent.node)) {
      throw new SyntaxError(
        'Cannot reassign imported binding `' + name +
        '` at ' + sourcePosition(mod, identifier)
      );
    }
  }
};

/**
 * @private
 */
Rewriter.prototype.getExportReferenceForReference = function(mod, referencePath) {
  if (n.ExportSpecifier.check(referencePath.parent.node) && !referencePath.parent.node.default) {
    // Do not rewrite non-default export specifiers.
    return null;
  }

  /**
   * We need to replace references to variables that are imported or
   * exported with the correct export expression. The export expression
   * should be named for the original export for a variable.
   *
   * That is, imports must be followed to their export. If that exported
   * value came from an import then repeat the process until you find a
   * declaration of the exported value.
   */
  var exportSpecifier = mod.exports.findSpecifierByName(referencePath.node.name);
  if (exportSpecifier && exportSpecifier.declaration.source && exportSpecifier.node !== referencePath.parent.node) {
    // This is a direct export from another module, e.g. `export { foo } from
    // 'foo'`. There are no local bindings created by this, so there is no
    // associated export for this reference and no need to rewrite it.
    return null;
  }

  return this.formatter.exportedReference(mod, referencePath) ||
    this.formatter.importedReference(mod, referencePath) ||
    this.formatter.localReference(mod, referencePath);
};

/**
 * Traverses ASTs only checking for invalid import/export declaration semantics.
 *
 * @constructor
 * @extends types.PathVisitor
 * @param {Module} mod
 * @private
 */
function DeclarationLinterVisitor(mod) {
  this.module = mod;
  types.PathVisitor.call(this);
}
extend(DeclarationLinterVisitor, types.PathVisitor);

/**
 * Checks that the import declaration is at the top level.
 *
 * @param {NodePath} nodePath
 */
DeclarationLinterVisitor.prototype.visitImportDeclaration = function(nodePath) {
  assertStatementIsTopLevel(this.module, nodePath);
};

/**
 * Checks that the export declaration is at the top level.
 *
 * @param {NodePath} nodePath
 */
DeclarationLinterVisitor.prototype.visitExportDeclaration = function(nodePath) {
  assertStatementIsTopLevel(this.module, nodePath);
};

/**
 * We need to ensure that all imports/exports are only at the top level. Esprima
 * should perhaps take care of this for us, but it does not.
 *
 * @param {Module} mod
 * @param {NodePath} nodePath
 * @private
 */
function assertStatementIsTopLevel(mod, nodePath) {
  if (!nodePath.scope.isGlobal) {
    throw new SyntaxError(
      'Unexpected non-top level ' + nodePath.node.type +
      ' found at ' + sourcePosition(mod, nodePath.node)
    );
  }
}

module.exports = Rewriter;

},{"./replacement":17,"./utils":20,"assert":49,"ast-util":46,"recast":74}],19:[function(require,module,exports){
/**
 * Determines the execution order of the given modules. This function resolves
 * cycles by preserving the order in which the modules are visited.
 *
 * @param {Module[]} modules
 * @return {Module[]}
 */
function sort(modules) {
  var result = [];
  var state = {};

  modules.forEach(function(mod) {
    visit(mod, result, state);
  });

  return result;
}
exports.sort = sort;

/**
 * Visits the given module, adding it to `result` after visiting all of the
 * modules it imports, recursively. The `state` argument is private and maps
 * module ids to the current visit state.
 *
 * @private
 * @param {Module} mod
 * @param {Module[]} result
 * @param {Object.<string,string>} state
 */
function visit(mod, result, state) {
  if (state[mod.id] === 'added') {
    // already in the list, ignore it
    return;
  }
  if (state[mod.id] === 'seen') {
    // cycle found, just ignore it
    return;
  }
  state[mod.id] = 'seen';
  mod.imports.modules.forEach(function(mod) {
    visit(mod, result, state);
  });
  state[mod.id] = 'added';
  result.push(mod);
}

},{}],20:[function(require,module,exports){
/* jshint node:true, undef:true, unused:true */

var recast = require('recast');
var esprima = require('esprima-fb');
var fs = require('fs');

var proto = '__proto__';

function memo(object, property, getter) {
  Object.defineProperty(object, property, {
    get: function() {
      this[property] = getter.call(this);
      return this[property];
    },

    set: function(value) {
      Object.defineProperty(this, property, {
        value: value,
        configurable: true,
        writable: true
      });
    }
  });
}
exports.memo = memo;

function startsWith(string, substring) {
  return string.lastIndexOf(substring, 0) === 0;
}
exports.startsWith = startsWith;

function endsWith(string, substring) {
  var expected = string.length - substring.length;
  return string.indexOf(substring, expected) === expected;
}
exports.endsWith = endsWith;

function extend(subclass, superclass) {
  subclass[proto] = superclass;
  subclass.prototype = Object.create(superclass.prototype);
  subclass.prototype.constructor = subclass;
}
exports.extend = extend;

function sourcePosition(mod, node) {
  var loc = node && node.loc;
  if (loc) {
    return mod.relativePath + ':' + loc.start.line + ':' + (loc.start.column + 1);
  } else {
    return mod.relativePath;
  }
}
exports.sourcePosition = sourcePosition;

function IFFE() {
  if (!IFFE.AST) {
    IFFE.AST = JSON.stringify(
      recast.parse('(function(){}).call(this)', { esprima: esprima })
    );
  }

  var result = JSON.parse(IFFE.AST);
  var expression = result.program.body[0].expression;
  var body = expression.callee.object.body.body;

  var args = Array.prototype.slice.call(arguments);
  args.forEach(function(arg) {
    if (Object.prototype.toString.call(arg) === '[object Array]') {
      body.push.apply(body, arg);
    } else {
      body.push(arg);
    }
  });

  return expression;
}
exports.IFFE = IFFE;

function mkdirpSync(path) {
  var parts = path.split('/');
  var dir = '';

  parts.forEach(function(part) {
    dir += '/' + part;
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir);
    }
  });
}
exports.mkdirpSync = mkdirpSync;

},{"esprima-fb":60,"fs":2,"recast":74}],21:[function(require,module,exports){
/* jshint node:true, undef:true, unused:true */

var assert = require('assert');
var recast = require('recast');
var fs = require('fs');
var Path = require('path');
var mkdirpSync = require('./utils').mkdirpSync;

function Writer(target) {
  this.target = target;
}

Writer.prototype.write = function(files) {
  var target = this.target;

  switch (files.length) {
    case 0:
      throw new Error('expected at least one file to write, got zero');

    case 1:
      // We got a single file, so `target` should refer to either a file or a
      // directory, but only if the file has a name.
      var isDirectory = false;
      try {
        isDirectory = fs.statSync(target).isDirectory();
      } catch (ex) {}

      assert.ok(
        !isDirectory || files[0].filename,
        'unable to determine filename for output to directory: ' + target
      );
      this.writeFile(
        files[0],
        isDirectory ? Path.resolve(target, files[0].filename) : target
      );
      break;

    default:
      // We got multiple files to output, so `target` should be a directory or
      // not exist (so we can create it).
      var self = this;
      files.forEach(function(file) {
        self.writeFile(file, Path.resolve(target, file.filename));
      });
      break;
  }
};

Writer.prototype.writeFile = function(file, filename) {
  var sourceMapFilename = filename + '.map';

  var rendered = recast.print(file, {
    sourceMapName: Path.basename(filename)
  });

  var code = rendered.code;
  assert.ok(filename, 'missing filename for file: ' + code);

  mkdirpSync(Path.dirname(filename));

  if (rendered.map) {
    code += '\n\n//# sourceMappingURL=' + Path.basename(sourceMapFilename);

    fs.writeFileSync(
      sourceMapFilename,
      JSON.stringify(rendered.map),
      'utf8'
    );
  }

  fs.writeFileSync(filename, code, 'utf8');
};

module.exports = Writer;

},{"./utils":20,"assert":49,"fs":2,"path":56,"recast":74}],22:[function(require,module,exports){
(function (process,__filename){
/** vim: et:ts=4:sw=4:sts=4
 * @license amdefine 0.1.0 Copyright (c) 2011, The Dojo Foundation All Rights Reserved.
 * Available via the MIT or new BSD license.
 * see: http://github.com/jrburke/amdefine for details
 */

/*jslint node: true */
/*global module, process */
'use strict';

/**
 * Creates a define for node.
 * @param {Object} module the "module" object that is defined by Node for the
 * current module.
 * @param {Function} [requireFn]. Node's require function for the current module.
 * It only needs to be passed in Node versions before 0.5, when module.require
 * did not exist.
 * @returns {Function} a define function that is usable for the current node
 * module.
 */
function amdefine(module, requireFn) {
    'use strict';
    var defineCache = {},
        loaderCache = {},
        alreadyCalled = false,
        path = require('path'),
        makeRequire, stringRequire;

    /**
     * Trims the . and .. from an array of path segments.
     * It will keep a leading path segment if a .. will become
     * the first path segment, to help with module name lookups,
     * which act like paths, but can be remapped. But the end result,
     * all paths that use this function should look normalized.
     * NOTE: this method MODIFIES the input array.
     * @param {Array} ary the array of path segments.
     */
    function trimDots(ary) {
        var i, part;
        for (i = 0; ary[i]; i+= 1) {
            part = ary[i];
            if (part === '.') {
                ary.splice(i, 1);
                i -= 1;
            } else if (part === '..') {
                if (i === 1 && (ary[2] === '..' || ary[0] === '..')) {
                    //End of the line. Keep at least one non-dot
                    //path segment at the front so it can be mapped
                    //correctly to disk. Otherwise, there is likely
                    //no path mapping for a path starting with '..'.
                    //This can still fail, but catches the most reasonable
                    //uses of ..
                    break;
                } else if (i > 0) {
                    ary.splice(i - 1, 2);
                    i -= 2;
                }
            }
        }
    }

    function normalize(name, baseName) {
        var baseParts;

        //Adjust any relative paths.
        if (name && name.charAt(0) === '.') {
            //If have a base name, try to normalize against it,
            //otherwise, assume it is a top-level require that will
            //be relative to baseUrl in the end.
            if (baseName) {
                baseParts = baseName.split('/');
                baseParts = baseParts.slice(0, baseParts.length - 1);
                baseParts = baseParts.concat(name.split('/'));
                trimDots(baseParts);
                name = baseParts.join('/');
            }
        }

        return name;
    }

    /**
     * Create the normalize() function passed to a loader plugin's
     * normalize method.
     */
    function makeNormalize(relName) {
        return function (name) {
            return normalize(name, relName);
        };
    }

    function makeLoad(id) {
        function load(value) {
            loaderCache[id] = value;
        }

        load.fromText = function (id, text) {
            //This one is difficult because the text can/probably uses
            //define, and any relative paths and requires should be relative
            //to that id was it would be found on disk. But this would require
            //bootstrapping a module/require fairly deeply from node core.
            //Not sure how best to go about that yet.
            throw new Error('amdefine does not implement load.fromText');
        };

        return load;
    }

    makeRequire = function (systemRequire, exports, module, relId) {
        function amdRequire(deps, callback) {
            if (typeof deps === 'string') {
                //Synchronous, single module require('')
                return stringRequire(systemRequire, exports, module, deps, relId);
            } else {
                //Array of dependencies with a callback.

                //Convert the dependencies to modules.
                deps = deps.map(function (depName) {
                    return stringRequire(systemRequire, exports, module, depName, relId);
                });

                //Wait for next tick to call back the require call.
                process.nextTick(function () {
                    callback.apply(null, deps);
                });
            }
        }

        amdRequire.toUrl = function (filePath) {
            if (filePath.indexOf('.') === 0) {
                return normalize(filePath, path.dirname(module.filename));
            } else {
                return filePath;
            }
        };

        return amdRequire;
    };

    //Favor explicit value, passed in if the module wants to support Node 0.4.
    requireFn = requireFn || function req() {
        return module.require.apply(module, arguments);
    };

    function runFactory(id, deps, factory) {
        var r, e, m, result;

        if (id) {
            e = loaderCache[id] = {};
            m = {
                id: id,
                uri: __filename,
                exports: e
            };
            r = makeRequire(requireFn, e, m, id);
        } else {
            //Only support one define call per file
            if (alreadyCalled) {
                throw new Error('amdefine with no module ID cannot be called more than once per file.');
            }
            alreadyCalled = true;

            //Use the real variables from node
            //Use module.exports for exports, since
            //the exports in here is amdefine exports.
            e = module.exports;
            m = module;
            r = makeRequire(requireFn, e, m, module.id);
        }

        //If there are dependencies, they are strings, so need
        //to convert them to dependency values.
        if (deps) {
            deps = deps.map(function (depName) {
                return r(depName);
            });
        }

        //Call the factory with the right dependencies.
        if (typeof factory === 'function') {
            result = factory.apply(m.exports, deps);
        } else {
            result = factory;
        }

        if (result !== undefined) {
            m.exports = result;
            if (id) {
                loaderCache[id] = m.exports;
            }
        }
    }

    stringRequire = function (systemRequire, exports, module, id, relId) {
        //Split the ID by a ! so that
        var index = id.indexOf('!'),
            originalId = id,
            prefix, plugin;

        if (index === -1) {
            id = normalize(id, relId);

            //Straight module lookup. If it is one of the special dependencies,
            //deal with it, otherwise, delegate to node.
            if (id === 'require') {
                return makeRequire(systemRequire, exports, module, relId);
            } else if (id === 'exports') {
                return exports;
            } else if (id === 'module') {
                return module;
            } else if (loaderCache.hasOwnProperty(id)) {
                return loaderCache[id];
            } else if (defineCache[id]) {
                runFactory.apply(null, defineCache[id]);
                return loaderCache[id];
            } else {
                if(systemRequire) {
                    return systemRequire(originalId);
                } else {
                    throw new Error('No module with ID: ' + id);
                }
            }
        } else {
            //There is a plugin in play.
            prefix = id.substring(0, index);
            id = id.substring(index + 1, id.length);

            plugin = stringRequire(systemRequire, exports, module, prefix, relId);

            if (plugin.normalize) {
                id = plugin.normalize(id, makeNormalize(relId));
            } else {
                //Normalize the ID normally.
                id = normalize(id, relId);
            }

            if (loaderCache[id]) {
                return loaderCache[id];
            } else {
                plugin.load(id, makeRequire(systemRequire, exports, module, relId), makeLoad(id), {});

                return loaderCache[id];
            }
        }
    };

    //Create a define function specific to the module asking for amdefine.
    function define(id, deps, factory) {
        if (Array.isArray(id)) {
            factory = deps;
            deps = id;
            id = undefined;
        } else if (typeof id !== 'string') {
            factory = id;
            id = deps = undefined;
        }

        if (deps && !Array.isArray(deps)) {
            factory = deps;
            deps = undefined;
        }

        if (!deps) {
            deps = ['require', 'exports', 'module'];
        }

        //Set up properties for this module. If an ID, then use
        //internal cache. If no ID, then use the external variables
        //for this node module.
        if (id) {
            //Put the module in deep freeze until there is a
            //require call for it.
            defineCache[id] = [id, deps, factory];
        } else {
            runFactory(id, deps, factory);
        }
    }

    //define.require, which has access to all the values in the
    //cache. Useful for AMD modules that all have IDs in the file,
    //but need to finally export a value to node based on one of those
    //IDs.
    define.require = function (id) {
        if (loaderCache[id]) {
            return loaderCache[id];
        }

        if (defineCache[id]) {
            runFactory.apply(null, defineCache[id]);
            return loaderCache[id];
        }
    };

    define.amd = {};

    return define;
}

module.exports = amdefine;

}).call(this,require('_process'),"/node_modules/amdefine/amdefine.js")
},{"_process":57,"path":56}],23:[function(require,module,exports){
var types = require("../lib/types");
var Type = types.Type;
var def = Type.def;
var or = Type.or;
var builtin = types.builtInTypes;
var isString = builtin.string;
var isNumber = builtin.number;
var isBoolean = builtin.boolean;
var isRegExp = builtin.RegExp;
var shared = require("../lib/shared");
var defaults = shared.defaults;
var geq = shared.geq;

def("Node")
    .field("type", isString)
    .field("loc", or(
        def("SourceLocation"),
        null
    ), defaults["null"], true);

def("SourceLocation")
    .build("start", "end", "source")
    .field("start", def("Position"))
    .field("end", def("Position"))
    .field("source", or(isString, null), defaults["null"]);

def("Position")
    .build("line", "column")
    .field("line", geq(1))
    .field("column", geq(0));

def("Program")
    .bases("Node")
    .build("body")
    .field("body", [def("Statement")]);

def("Function")
    .bases("Node")
    .field("id", or(def("Identifier"), null), defaults["null"])
    .field("params", [def("Pattern")])
    .field("body", or(def("BlockStatement"), def("Expression")));

def("Statement").bases("Node");

// The empty .build() here means that an EmptyStatement can be constructed
// (i.e. it's not abstract) but that it needs no arguments.
def("EmptyStatement").bases("Statement").build();

def("BlockStatement")
    .bases("Statement")
    .build("body")
    .field("body", [def("Statement")]);

// TODO Figure out how to silently coerce Expressions to
// ExpressionStatements where a Statement was expected.
def("ExpressionStatement")
    .bases("Statement")
    .build("expression")
    .field("expression", def("Expression"));

def("IfStatement")
    .bases("Statement")
    .build("test", "consequent", "alternate")
    .field("test", def("Expression"))
    .field("consequent", def("Statement"))
    .field("alternate", or(def("Statement"), null), defaults["null"]);

def("LabeledStatement")
    .bases("Statement")
    .build("label", "body")
    .field("label", def("Identifier"))
    .field("body", def("Statement"));

def("BreakStatement")
    .bases("Statement")
    .build("label")
    .field("label", or(def("Identifier"), null), defaults["null"]);

def("ContinueStatement")
    .bases("Statement")
    .build("label")
    .field("label", or(def("Identifier"), null), defaults["null"]);

def("WithStatement")
    .bases("Statement")
    .build("object", "body")
    .field("object", def("Expression"))
    .field("body", def("Statement"));

def("SwitchStatement")
    .bases("Statement")
    .build("discriminant", "cases", "lexical")
    .field("discriminant", def("Expression"))
    .field("cases", [def("SwitchCase")])
    .field("lexical", isBoolean, defaults["false"]);

def("ReturnStatement")
    .bases("Statement")
    .build("argument")
    .field("argument", or(def("Expression"), null));

def("ThrowStatement")
    .bases("Statement")
    .build("argument")
    .field("argument", def("Expression"));

def("TryStatement")
    .bases("Statement")
    .build("block", "handler", "finalizer")
    .field("block", def("BlockStatement"))
    .field("handler", or(def("CatchClause"), null), function() {
        return this.handlers && this.handlers[0] || null;
    })
    .field("handlers", [def("CatchClause")], function() {
        return this.handler ? [this.handler] : [];
    }, true) // Indicates this field is hidden from eachField iteration.
    .field("guardedHandlers", [def("CatchClause")], defaults.emptyArray)
    .field("finalizer", or(def("BlockStatement"), null), defaults["null"]);

def("CatchClause")
    .bases("Node")
    .build("param", "guard", "body")
    .field("param", def("Pattern"))
    .field("guard", or(def("Expression"), null), defaults["null"])
    .field("body", def("BlockStatement"));

def("WhileStatement")
    .bases("Statement")
    .build("test", "body")
    .field("test", def("Expression"))
    .field("body", def("Statement"));

def("DoWhileStatement")
    .bases("Statement")
    .build("body", "test")
    .field("body", def("Statement"))
    .field("test", def("Expression"));

def("ForStatement")
    .bases("Statement")
    .build("init", "test", "update", "body")
    .field("init", or(
        def("VariableDeclaration"),
        def("Expression"),
        null))
    .field("test", or(def("Expression"), null))
    .field("update", or(def("Expression"), null))
    .field("body", def("Statement"));

def("ForInStatement")
    .bases("Statement")
    .build("left", "right", "body", "each")
    .field("left", or(
        def("VariableDeclaration"),
        def("Expression")))
    .field("right", def("Expression"))
    .field("body", def("Statement"))
    .field("each", isBoolean);

def("DebuggerStatement").bases("Statement").build();

def("Declaration").bases("Statement");

def("FunctionDeclaration")
    .bases("Function", "Declaration")
    .build("id", "params", "body")
    .field("id", def("Identifier"));

def("FunctionExpression")
    .bases("Function", "Expression")
    .build("id", "params", "body");

def("VariableDeclaration")
    .bases("Declaration")
    .build("kind", "declarations")
    .field("kind", or("var", "let", "const"))
    .field("declarations", [or(
        def("VariableDeclarator"),
        def("Identifier") // TODO Esprima deviation.
    )]);

def("VariableDeclarator")
    .bases("Node")
    .build("id", "init")
    .field("id", def("Pattern"))
    .field("init", or(def("Expression"), null));

// TODO Are all Expressions really Patterns?
def("Expression").bases("Node", "Pattern");

def("ThisExpression").bases("Expression").build();

def("ArrayExpression")
    .bases("Expression")
    .build("elements")
    .field("elements", [or(def("Expression"), null)]);

def("ObjectExpression")
    .bases("Expression")
    .build("properties")
    .field("properties", [def("Property")]);

// TODO Not in the Mozilla Parser API, but used by Esprima.
def("Property")
    .bases("Node") // Want to be able to visit Property Nodes.
    .build("kind", "key", "value")
    .field("kind", or("init", "get", "set"))
    .field("key", or(def("Literal"), def("Identifier")))
    .field("value", def("Expression"));

def("SequenceExpression")
    .bases("Expression")
    .build("expressions")
    .field("expressions", [def("Expression")]);

var UnaryOperator = or(
    "-", "+", "!", "~",
    "typeof", "void", "delete");

def("UnaryExpression")
    .bases("Expression")
    .build("operator", "argument", "prefix")
    .field("operator", UnaryOperator)
    .field("argument", def("Expression"))
    // TODO Esprima doesn't bother with this field, presumably because
    // it's always true for unary operators.
    .field("prefix", isBoolean, defaults["true"]);

var BinaryOperator = or(
    "==", "!=", "===", "!==",
    "<", "<=", ">", ">=",
    "<<", ">>", ">>>",
    "+", "-", "*", "/", "%",
    "&", // TODO Missing from the Parser API.
    "|", "^", "in",
    "instanceof", "..");

def("BinaryExpression")
    .bases("Expression")
    .build("operator", "left", "right")
    .field("operator", BinaryOperator)
    .field("left", def("Expression"))
    .field("right", def("Expression"));

var AssignmentOperator = or(
    "=", "+=", "-=", "*=", "/=", "%=",
    "<<=", ">>=", ">>>=",
    "|=", "^=", "&=");

def("AssignmentExpression")
    .bases("Expression")
    .build("operator", "left", "right")
    .field("operator", AssignmentOperator)
    .field("left", def("Pattern"))
    .field("right", def("Expression"));

var UpdateOperator = or("++", "--");

def("UpdateExpression")
    .bases("Expression")
    .build("operator", "argument", "prefix")
    .field("operator", UpdateOperator)
    .field("argument", def("Expression"))
    .field("prefix", isBoolean);

var LogicalOperator = or("||", "&&");

def("LogicalExpression")
    .bases("Expression")
    .build("operator", "left", "right")
    .field("operator", LogicalOperator)
    .field("left", def("Expression"))
    .field("right", def("Expression"));

def("ConditionalExpression")
    .bases("Expression")
    .build("test", "consequent", "alternate")
    .field("test", def("Expression"))
    .field("consequent", def("Expression"))
    .field("alternate", def("Expression"));

def("NewExpression")
    .bases("Expression")
    .build("callee", "arguments")
    .field("callee", def("Expression"))
    // The Mozilla Parser API gives this type as [or(def("Expression"),
    // null)], but null values don't really make sense at the call site.
    // TODO Report this nonsense.
    .field("arguments", [def("Expression")]);

def("CallExpression")
    .bases("Expression")
    .build("callee", "arguments")
    .field("callee", def("Expression"))
    // See comment for NewExpression above.
    .field("arguments", [def("Expression")]);

def("MemberExpression")
    .bases("Expression")
    .build("object", "property", "computed")
    .field("object", def("Expression"))
    .field("property", or(def("Identifier"), def("Expression")))
    .field("computed", isBoolean);

def("Pattern").bases("Node");

def("ObjectPattern")
    .bases("Pattern")
    .build("properties")
    // TODO File a bug to get PropertyPattern added to the interfaces API.
    .field("properties", [def("PropertyPattern")]);

def("PropertyPattern")
    .bases("Pattern")
    .build("key", "pattern")
    .field("key", or(def("Literal"), def("Identifier")))
    .field("pattern", def("Pattern"));

def("ArrayPattern")
    .bases("Pattern")
    .build("elements")
    .field("elements", [or(def("Pattern"), null)]);

def("SwitchCase")
    .bases("Node")
    .build("test", "consequent")
    .field("test", or(def("Expression"), null))
    .field("consequent", [def("Statement")]);

def("Identifier")
    // But aren't Expressions and Patterns already Nodes? TODO Report this.
    .bases("Node", "Expression", "Pattern")
    .build("name")
    .field("name", isString);

def("Literal")
    // But aren't Expressions already Nodes? TODO Report this.
    .bases("Node", "Expression")
    .build("value")
    .field("value", or(
        isString,
        isBoolean,
        null, // isNull would also work here.
        isNumber,
        isRegExp
    ));

},{"../lib/shared":34,"../lib/types":36}],24:[function(require,module,exports){
require("./core");
var types = require("../lib/types");
var def = types.Type.def;
var or = types.Type.or;
var builtin = types.builtInTypes;
var isString = builtin.string;
var isBoolean = builtin.boolean;

// Note that none of these types are buildable because the Mozilla Parser
// API doesn't specify any builder functions, and nobody uses E4X anymore.

def("XMLDefaultDeclaration")
    .bases("Declaration")
    .field("namespace", def("Expression"));

def("XMLAnyName").bases("Expression");

def("XMLQualifiedIdentifier")
    .bases("Expression")
    .field("left", or(def("Identifier"), def("XMLAnyName")))
    .field("right", or(def("Identifier"), def("Expression")))
    .field("computed", isBoolean);

def("XMLFunctionQualifiedIdentifier")
    .bases("Expression")
    .field("right", or(def("Identifier"), def("Expression")))
    .field("computed", isBoolean);

def("XMLAttributeSelector")
    .bases("Expression")
    .field("attribute", def("Expression"));

def("XMLFilterExpression")
    .bases("Expression")
    .field("left", def("Expression"))
    .field("right", def("Expression"));

def("XMLElement")
    .bases("XML", "Expression")
    .field("contents", [def("XML")]);

def("XMLList")
    .bases("XML", "Expression")
    .field("contents", [def("XML")]);

def("XML").bases("Node");

def("XMLEscape")
    .bases("XML")
    .field("expression", def("Expression"));

def("XMLText")
    .bases("XML")
    .field("text", isString);

def("XMLStartTag")
    .bases("XML")
    .field("contents", [def("XML")]);

def("XMLEndTag")
    .bases("XML")
    .field("contents", [def("XML")]);

def("XMLPointTag")
    .bases("XML")
    .field("contents", [def("XML")]);

def("XMLName")
    .bases("XML")
    .field("contents", or(isString, [def("XML")]));

def("XMLAttribute")
    .bases("XML")
    .field("value", isString);

def("XMLCdata")
    .bases("XML")
    .field("contents", isString);

def("XMLComment")
    .bases("XML")
    .field("contents", isString);

def("XMLProcessingInstruction")
    .bases("XML")
    .field("target", isString)
    .field("contents", or(isString, null));

},{"../lib/types":36,"./core":23}],25:[function(require,module,exports){
require("./core");
var types = require("../lib/types");
var def = types.Type.def;
var or = types.Type.or;
var builtin = types.builtInTypes;
var isBoolean = builtin.boolean;
var isObject = builtin.object;
var isString = builtin.string;
var defaults = require("../lib/shared").defaults;

def("Function")
    .field("generator", isBoolean, defaults["false"])
    .field("expression", isBoolean, defaults["false"])
    .field("defaults", [or(def("Expression"), null)], defaults.emptyArray)
    // TODO This could be represented as a SpreadElementPattern in .params.
    .field("rest", or(def("Identifier"), null), defaults["null"]);

def("FunctionDeclaration")
    .build("id", "params", "body", "generator", "expression");

def("FunctionExpression")
    .build("id", "params", "body", "generator", "expression");

// TODO The Parser API calls this ArrowExpression, but Esprima uses
// ArrowFunctionExpression.
def("ArrowFunctionExpression")
    .bases("Function", "Expression")
    .build("params", "body", "expression")
    // The forced null value here is compatible with the overridden
    // definition of the "id" field in the Function interface.
    .field("id", null, defaults["null"])
    // The current spec forbids arrow generators, so I have taken the
    // liberty of enforcing that. TODO Report this.
    .field("generator", false);

def("YieldExpression")
    .bases("Expression")
    .build("argument", "delegate")
    .field("argument", or(def("Expression"), null))
    .field("delegate", isBoolean, defaults["false"]);

def("GeneratorExpression")
    .bases("Expression")
    .build("body", "blocks", "filter")
    .field("body", def("Expression"))
    .field("blocks", [def("ComprehensionBlock")])
    .field("filter", or(def("Expression"), null));

def("ComprehensionExpression")
    .bases("Expression")
    .build("body", "blocks", "filter")
    .field("body", def("Expression"))
    .field("blocks", [def("ComprehensionBlock")])
    .field("filter", or(def("Expression"), null));

def("ComprehensionBlock")
    .bases("Node")
    .build("left", "right", "each")
    .field("left", def("Pattern"))
    .field("right", def("Expression"))
    .field("each", isBoolean);

def("ModuleSpecifier")
    .bases("Literal")
    .build("value")
    .field("value", isString);

def("Property")
    // Esprima extensions not mentioned in the Mozilla Parser API:
    .field("method", isBoolean, defaults["false"])
    .field("shorthand", isBoolean, defaults["false"])
    .field("computed", isBoolean, defaults["false"]);

def("MethodDefinition")
    .bases("Declaration")
    .build("kind", "key", "value")
    .field("kind", or("init", "get", "set", ""))
    .field("key", or(def("Literal"), def("Identifier")))
    .field("value", def("Function"));

def("SpreadElement")
    .bases("Node")
    .build("argument")
    .field("argument", def("Expression"));

def("ArrayExpression")
    .field("elements", [or(def("Expression"), def("SpreadElement"), null)]);

def("NewExpression")
    .field("arguments", [or(def("Expression"), def("SpreadElement"))]);

def("CallExpression")
    .field("arguments", [or(def("Expression"), def("SpreadElement"))]);

def("SpreadElementPattern")
    .bases("Pattern")
    .build("argument")
    .field("argument", def("Pattern"));

var ClassBodyElement = or(
    def("MethodDefinition"),
    def("VariableDeclarator"),
    def("ClassPropertyDefinition"),
    def("ClassProperty")
);

def("ClassProperty")
  .bases("Declaration")
  .build("id")
  .field("id", def("Identifier"));

def("ClassPropertyDefinition") // static property
    .bases("Declaration")
    .build("definition")
    // Yes, Virginia, circular definitions are permitted.
    .field("definition", ClassBodyElement);

def("ClassBody")
    .bases("Declaration")
    .build("body")
    .field("body", [ClassBodyElement]);

def("ClassDeclaration")
    .bases("Declaration")
    .build("id", "body", "superClass")
    .field("id", def("Identifier"))
    .field("body", def("ClassBody"))
    .field("superClass", or(def("Expression"), null), defaults["null"]);

def("ClassExpression")
    .bases("Expression")
    .build("id", "body", "superClass")
    .field("id", or(def("Identifier"), null), defaults["null"])
    .field("body", def("ClassBody"))
    .field("superClass", or(def("Expression"), null), defaults["null"]);

// Specifier and NamedSpecifier are abstract non-standard types that I
// introduced for definitional convenience.
def("Specifier").bases("Node");
def("NamedSpecifier")
    .bases("Specifier")
    // Note: this abstract type is intentionally not buildable.
    .field("id", def("Identifier"))
    .field("name", or(def("Identifier"), null), defaults["null"]);

// Like NamedSpecifier, except type:"ExportSpecifier" and buildable.
// export {<id [as name]>} [from ...];
def("ExportSpecifier")
    .bases("NamedSpecifier")
    .build("id", "name");

// export <*> from ...;
def("ExportBatchSpecifier")
    .bases("Specifier")
    .build();

// Like NamedSpecifier, except type:"ImportSpecifier" and buildable.
// import {<id [as name]>} from ...;
def("ImportSpecifier")
    .bases("NamedSpecifier")
    .build("id", "name");

// import <* as id> from ...;
def("ImportNamespaceSpecifier")
    .bases("Specifier")
    .build("id")
    .field("id", def("Identifier"));

// import <id> from ...;
def("ImportDefaultSpecifier")
    .bases("Specifier")
    .build("id")
    .field("id", def("Identifier"));

def("ExportDeclaration")
    .bases("Declaration")
    .build("default", "declaration", "specifiers", "source")
    .field("default", isBoolean)
    .field("declaration", or(
        def("Declaration"),
        def("Expression"), // Implies default.
        null
    ))
    .field("specifiers", [or(
        def("ExportSpecifier"),
        def("ExportBatchSpecifier")
    )], defaults.emptyArray)
    .field("source", or(def("ModuleSpecifier"), null), defaults["null"]);

def("ImportDeclaration")
    .bases("Declaration")
    .build("specifiers", "source")
    .field("specifiers", [or(
        def("ImportSpecifier"),
        def("ImportNamespaceSpecifier"),
        def("ImportDefaultSpecifier")
    )], defaults.emptyArray)
    .field("source", def("ModuleSpecifier"));

def("TaggedTemplateExpression")
    .bases("Expression")
    .field("tag", def("Expression"))
    .field("quasi", def("TemplateLiteral"));

def("TemplateLiteral")
    .bases("Expression")
    .build("quasis", "expressions")
    .field("quasis", [def("TemplateElement")])
    .field("expressions", [def("Expression")]);

def("TemplateElement")
    .bases("Node")
    .build("value", "tail")
    .field("value", {"cooked": isString, "raw": isString})
    .field("tail", isBoolean);

},{"../lib/shared":34,"../lib/types":36,"./core":23}],26:[function(require,module,exports){
require("./core");
var types = require("../lib/types");
var def = types.Type.def;
var or = types.Type.or;
var builtin = types.builtInTypes;
var isBoolean = builtin.boolean;
var defaults = require("../lib/shared").defaults;

def("Function")
    .field("async", isBoolean, defaults["false"]);

def("SpreadProperty")
    .bases("Node")
    .build("argument")
    .field("argument", def("Expression"));

def("ObjectExpression")
    .field("properties", [or(def("Property"), def("SpreadProperty"))]);

def("SpreadPropertyPattern")
    .bases("Pattern")
    .build("argument")
    .field("argument", def("Pattern"));

def("ObjectPattern")
    .field("properties", [or(
        def("PropertyPattern"),
        def("SpreadPropertyPattern")
    )]);

def("AwaitExpression")
    .bases("Expression")
    .build("argument", "all")
    .field("argument", or(def("Expression"), null))
    .field("all", isBoolean, defaults["false"]);

},{"../lib/shared":34,"../lib/types":36,"./core":23}],27:[function(require,module,exports){
require("./core");
var types = require("../lib/types");
var def = types.Type.def;
var or = types.Type.or;
var builtin = types.builtInTypes;
var isString = builtin.string;
var isBoolean = builtin.boolean;
var defaults = require("../lib/shared").defaults;

def("XJSAttribute")
    .bases("Node")
    .build("name", "value")
    .field("name", or(def("XJSIdentifier"), def("XJSNamespacedName")))
    .field("value", or(
        def("Literal"), // attr="value"
        def("XJSExpressionContainer"), // attr={value}
        null // attr= or just attr
    ), defaults["null"]);

def("XJSIdentifier")
    .bases("Node")
    .build("name")
    .field("name", isString);

def("XJSNamespacedName")
    .bases("Node")
    .build("namespace", "name")
    .field("namespace", def("XJSIdentifier"))
    .field("name", def("XJSIdentifier"));

def("XJSMemberExpression")
    .bases("MemberExpression")
    .build("object", "property")
    .field("object", or(def("XJSIdentifier"), def("XJSMemberExpression")))
    .field("property", def("XJSIdentifier"))
    .field("computed", isBoolean, defaults.false);

var XJSElementName = or(
    def("XJSIdentifier"),
    def("XJSNamespacedName"),
    def("XJSMemberExpression")
);

def("XJSSpreadAttribute")
    .bases("Node")
    .build("argument")
    .field("argument", def("Expression"));

var XJSAttributes = [or(
    def("XJSAttribute"),
    def("XJSSpreadAttribute")
)];

def("XJSExpressionContainer")
    .bases("Expression")
    .build("expression")
    .field("expression", def("Expression"));

def("XJSElement")
    .bases("Expression")
    .build("openingElement", "closingElement", "children")
    .field("openingElement", def("XJSOpeningElement"))
    .field("closingElement", or(def("XJSClosingElement"), null), defaults["null"])
    .field("children", [or(
        def("XJSElement"),
        def("XJSExpressionContainer"),
        def("XJSText"),
        def("Literal") // TODO Esprima should return XJSText instead.
    )], defaults.emptyArray)
    .field("name", XJSElementName, function() {
        // Little-known fact: the `this` object inside a default function
        // is none other than the partially-built object itself, and any
        // fields initialized directly from builder function arguments
        // (like openingElement, closingElement, and children) are
        // guaranteed to be available.
        return this.openingElement.name;
    })
    .field("selfClosing", isBoolean, function() {
        return this.openingElement.selfClosing;
    })
    .field("attributes", XJSAttributes, function() {
        return this.openingElement.attributes;
    });

def("XJSOpeningElement")
    .bases("Node") // TODO Does this make sense? Can't really be an XJSElement.
    .build("name", "attributes", "selfClosing")
    .field("name", XJSElementName)
    .field("attributes", XJSAttributes, defaults.emptyArray)
    .field("selfClosing", isBoolean, defaults["false"]);

def("XJSClosingElement")
    .bases("Node") // TODO Same concern.
    .build("name")
    .field("name", XJSElementName);

def("XJSText")
    .bases("Literal")
    .build("value")
    .field("value", isString);

def("XJSEmptyExpression").bases("Expression").build();

def("TypeAnnotatedIdentifier")
    .bases("Pattern")
    .build("annotation", "identifier")
    .field("annotation", def("TypeAnnotation"))
    .field("identifier", def("Identifier"));

def("TypeAnnotation")
    .bases("Pattern")
    .build("annotatedType", "templateTypes", "paramTypes", "returnType", 
           "unionType", "nullable")
    .field("annotatedType", def("Identifier"))
    .field("templateTypes", or([def("TypeAnnotation")], null))
    .field("paramTypes", or([def("TypeAnnotation")], null))
    .field("returnType", or(def("TypeAnnotation"), null))
    .field("unionType", or(def("TypeAnnotation"), null))
    .field("nullable", isBoolean);

},{"../lib/shared":34,"../lib/types":36,"./core":23}],28:[function(require,module,exports){
require("./core");
var types = require("../lib/types");
var def = types.Type.def;
var or = types.Type.or;
var geq = require("../lib/shared").geq;

def("ForOfStatement")
    .bases("Statement")
    .build("left", "right", "body")
    .field("left", or(
        def("VariableDeclaration"),
        def("Expression")))
    .field("right", def("Expression"))
    .field("body", def("Statement"));

def("LetStatement")
    .bases("Statement")
    .build("head", "body")
    // TODO Deviating from the spec by reusing VariableDeclarator here.
    .field("head", [def("VariableDeclarator")])
    .field("body", def("Statement"));

def("LetExpression")
    .bases("Expression")
    .build("head", "body")
    // TODO Deviating from the spec by reusing VariableDeclarator here.
    .field("head", [def("VariableDeclarator")])
    .field("body", def("Expression"));

def("GraphExpression")
    .bases("Expression")
    .build("index", "expression")
    .field("index", geq(0))
    .field("expression", def("Literal"));

def("GraphIndexExpression")
    .bases("Expression")
    .build("index")
    .field("index", geq(0));

},{"../lib/shared":34,"../lib/types":36,"./core":23}],29:[function(require,module,exports){
var assert = require("assert");
var types = require("../main");
var getFieldNames = types.getFieldNames;
var getFieldValue = types.getFieldValue;
var isArray = types.builtInTypes.array;
var isObject = types.builtInTypes.object;
var isDate = types.builtInTypes.Date;
var isRegExp = types.builtInTypes.RegExp;
var hasOwn = Object.prototype.hasOwnProperty;

function astNodesAreEquivalent(a, b, problemPath) {
    if (isArray.check(problemPath)) {
        problemPath.length = 0;
    } else {
        problemPath = null;
    }

    return areEquivalent(a, b, problemPath);
}

astNodesAreEquivalent.assert = function(a, b) {
    var problemPath = [];
    if (!astNodesAreEquivalent(a, b, problemPath)) {
        if (problemPath.length === 0) {
            assert.strictEqual(a, b);
        } else {
            assert.ok(
                false,
                "Nodes differ in the following path: " +
                    problemPath.map(subscriptForProperty).join("")
            );
        }
    }
};

function subscriptForProperty(property) {
    if (/[_$a-z][_$a-z0-9]*/i.test(property)) {
        return "." + property;
    }
    return "[" + JSON.stringify(property) + "]";
}

function areEquivalent(a, b, problemPath) {
    if (a === b) {
        return true;
    }

    if (isArray.check(a)) {
        return arraysAreEquivalent(a, b, problemPath);
    }

    if (isObject.check(a)) {
        return objectsAreEquivalent(a, b, problemPath);
    }

    if (isDate.check(a)) {
        return isDate.check(b) && (+a === +b);
    }

    if (isRegExp.check(a)) {
        return isRegExp.check(b) && (
            a.source === b.source &&
            a.global === b.global &&
            a.multiline === b.multiline &&
            a.ignoreCase === b.ignoreCase
        );
    }

    return a == b;
}

function arraysAreEquivalent(a, b, problemPath) {
    isArray.assert(a);
    var aLength = a.length;

    if (!isArray.check(b) || b.length !== aLength) {
        if (problemPath) {
            problemPath.push("length");
        }
        return false;
    }

    for (var i = 0; i < aLength; ++i) {
        if (problemPath) {
            problemPath.push(i);
        }

        if (i in a !== i in b) {
            return false;
        }

        if (!areEquivalent(a[i], b[i], problemPath)) {
            return false;
        }

        if (problemPath) {
            assert.strictEqual(problemPath.pop(), i);
        }
    }

    return true;
}

function objectsAreEquivalent(a, b, problemPath) {
    isObject.assert(a);
    if (!isObject.check(b)) {
        return false;
    }

    // Fast path for a common property of AST nodes.
    if (a.type !== b.type) {
        if (problemPath) {
            problemPath.push("type");
        }
        return false;
    }

    var aNames = getFieldNames(a);
    var aNameCount = aNames.length;

    var bNames = getFieldNames(b);
    var bNameCount = bNames.length;

    if (aNameCount === bNameCount) {
        for (var i = 0; i < aNameCount; ++i) {
            var name = aNames[i];
            var aChild = getFieldValue(a, name);
            var bChild = getFieldValue(b, name);

            if (problemPath) {
                problemPath.push(name);
            }

            if (!areEquivalent(aChild, bChild, problemPath)) {
                return false;
            }

            if (problemPath) {
                assert.strictEqual(problemPath.pop(), name);
            }
        }

        return true;
    }

    if (!problemPath) {
        return false;
    }

    // Since aNameCount !== bNameCount, we need to find some name that's
    // missing in aNames but present in bNames, or vice-versa.

    var seenNames = Object.create(null);

    for (i = 0; i < aNameCount; ++i) {
        seenNames[aNames[i]] = true;
    }

    for (i = 0; i < bNameCount; ++i) {
        name = bNames[i];

        if (!hasOwn.call(seenNames, name)) {
            problemPath.push(name);
            return false;
        }

        delete seenNames[name];
    }

    for (name in seenNames) {
        problemPath.push(name);
        break;
    }

    return false;
}

module.exports = astNodesAreEquivalent;

},{"../main":37,"assert":49}],30:[function(require,module,exports){
var assert = require("assert");
var types = require("./types");
var n = types.namedTypes;
var isNumber = types.builtInTypes.number;
var isArray = types.builtInTypes.array;
var Path = require("./path");
var Scope = require("./scope");

function NodePath(value, parentPath, name) {
    assert.ok(this instanceof NodePath);
    Path.call(this, value, parentPath, name);
}

require("util").inherits(NodePath, Path);
var NPp = NodePath.prototype;

Object.defineProperties(NPp, {
    node: {
        get: function() {
            Object.defineProperty(this, "node", {
                configurable: true, // Enable deletion.
                value: this._computeNode()
            });

            return this.node;
        }
    },

    parent: {
        get: function() {
            Object.defineProperty(this, "parent", {
                configurable: true, // Enable deletion.
                value: this._computeParent()
            });

            return this.parent;
        }
    },

    scope: {
        get: function() {
            Object.defineProperty(this, "scope", {
                configurable: true, // Enable deletion.
                value: this._computeScope()
            });

            return this.scope;
        }
    }
});

NPp.replace = function() {
    delete this.node;
    delete this.parent;
    delete this.scope;
    return Path.prototype.replace.apply(this, arguments);
};

// The value of the first ancestor Path whose value is a Node.
NPp._computeNode = function() {
    var value = this.value;
    if (n.Node.check(value)) {
        return value;
    }

    var pp = this.parentPath;
    return pp && pp.node || null;
};

// The first ancestor Path whose value is a Node distinct from this.node.
NPp._computeParent = function() {
    var value = this.value;
    var pp = this.parentPath;

    if (!n.Node.check(value)) {
        while (pp && !n.Node.check(pp.value)) {
            pp = pp.parentPath;
        }

        if (pp) {
            pp = pp.parentPath;
        }
    }

    while (pp && !n.Node.check(pp.value)) {
        pp = pp.parentPath;
    }

    return pp || null;
};

// The closest enclosing scope that governs this node.
NPp._computeScope = function() {
    var value = this.value;
    var pp = this.parentPath;
    var scope = pp && pp.scope;

    if (n.Node.check(value) &&
        Scope.isEstablishedBy(value)) {
        scope = new Scope(this, scope);
    }

    return scope || null;
};

NPp.getValueProperty = function(name) {
    return types.getFieldValue(this.value, name);
};

/**
 * Determine whether this.node needs to be wrapped in parentheses in order
 * for a parser to reproduce the same local AST structure.
 *
 * For instance, in the expression `(1 + 2) * 3`, the BinaryExpression
 * whose operator is "+" needs parentheses, because `1 + 2 * 3` would
 * parse differently.
 *
 * If assumeExpressionContext === true, we don't worry about edge cases
 * like an anonymous FunctionExpression appearing lexically first in its
 * enclosing statement and thus needing parentheses to avoid being parsed
 * as a FunctionDeclaration with a missing name.
 */
NPp.needsParens = function(assumeExpressionContext) {
    if (!this.parent)
        return false;

    var node = this.node;

    // If this NodePath object is not the direct owner of this.node, then
    // we do not need parentheses here, though the direct owner might need
    // parentheses.
    if (node !== this.value)
        return false;

    var parent = this.parent.node;

    assert.notStrictEqual(node, parent);

    if (!n.Expression.check(node))
        return false;

    if (isUnaryLike(node))
        return n.MemberExpression.check(parent)
            && this.name === "object"
            && parent.object === node;

    if (isBinary(node)) {
        if (n.CallExpression.check(parent) &&
            this.name === "callee") {
            assert.strictEqual(parent.callee, node);
            return true;
        }

        if (isUnaryLike(parent))
            return true;

        if (n.MemberExpression.check(parent) &&
            this.name === "object") {
            assert.strictEqual(parent.object, node);
            return true;
        }

        if (isBinary(parent)) {
            var po = parent.operator;
            var pp = PRECEDENCE[po];
            var no = node.operator;
            var np = PRECEDENCE[no];

            if (pp > np) {
                return true;
            }

            if (pp === np && this.name === "right") {
                assert.strictEqual(parent.right, node);
                return true;
            }
        }
    }

    if (n.SequenceExpression.check(node)) {
        if (n.ForStatement.check(parent)) {
            // Although parentheses wouldn't hurt around sequence
            // expressions in the head of for loops, traditional style
            // dictates that e.g. i++, j++ should not be wrapped with
            // parentheses.
            return false;
        }

        if (n.ExpressionStatement.check(parent) &&
            this.name === "expression") {
            return false;
        }

        // Otherwise err on the side of overparenthesization, adding
        // explicit exceptions above if this proves overzealous.
        return true;
    }

    if (n.YieldExpression.check(node))
        return isBinary(parent)
            || n.CallExpression.check(parent)
            || n.MemberExpression.check(parent)
            || n.NewExpression.check(parent)
            || n.ConditionalExpression.check(parent)
            || isUnaryLike(parent)
            || n.YieldExpression.check(parent);

    if (n.NewExpression.check(parent) &&
        this.name === "callee") {
        assert.strictEqual(parent.callee, node);
        return containsCallExpression(node);
    }

    if (n.Literal.check(node) &&
        isNumber.check(node.value) &&
        n.MemberExpression.check(parent) &&
        this.name === "object") {
        assert.strictEqual(parent.object, node);
        return true;
    }

    if (n.AssignmentExpression.check(node) ||
        n.ConditionalExpression.check(node)) {
        if (isUnaryLike(parent))
            return true;

        if (isBinary(parent))
            return true;

        if (n.CallExpression.check(parent) &&
            this.name === "callee") {
            assert.strictEqual(parent.callee, node);
            return true;
        }

        if (n.ConditionalExpression.check(parent) &&
            this.name === "test") {
            assert.strictEqual(parent.test, node);
            return true;
        }

        if (n.MemberExpression.check(parent) &&
            this.name === "object") {
            assert.strictEqual(parent.object, node);
            return true;
        }
    }

    if (assumeExpressionContext !== true &&
        !this.canBeFirstInStatement() &&
        this.firstInStatement())
        return true;

    return false;
};

function isBinary(node) {
    return n.BinaryExpression.check(node)
        || n.LogicalExpression.check(node);
}

function isUnaryLike(node) {
    return n.UnaryExpression.check(node)
        // I considered making SpreadElement and SpreadProperty subtypes
        // of UnaryExpression, but they're not really Expression nodes.
        || (n.SpreadElement && n.SpreadElement.check(node))
        || (n.SpreadProperty && n.SpreadProperty.check(node));
}

var PRECEDENCE = {};
[["||"],
 ["&&"],
 ["|"],
 ["^"],
 ["&"],
 ["==", "===", "!=", "!=="],
 ["<", ">", "<=", ">=", "in", "instanceof"],
 [">>", "<<", ">>>"],
 ["+", "-"],
 ["*", "/", "%"]
].forEach(function(tier, i) {
    tier.forEach(function(op) {
        PRECEDENCE[op] = i;
    });
});

function containsCallExpression(node) {
    if (n.CallExpression.check(node)) {
        return true;
    }

    if (isArray.check(node)) {
        return node.some(containsCallExpression);
    }

    if (n.Node.check(node)) {
        return types.someField(node, function(name, child) {
            return containsCallExpression(child);
        });
    }

    return false;
}

NPp.canBeFirstInStatement = function() {
    var node = this.node;
    return !n.FunctionExpression.check(node)
        && !n.ObjectExpression.check(node);
};

NPp.firstInStatement = function() {
    return firstInStatement(this);
};

function firstInStatement(path) {
    for (var node, parent; path.parent; path = path.parent) {
        node = path.node;
        parent = path.parent.node;

        if (n.BlockStatement.check(parent) &&
            path.parent.name === "body" &&
            path.name === 0) {
            assert.strictEqual(parent.body[0], node);
            return true;
        }

        if (n.ExpressionStatement.check(parent) &&
            path.name === "expression") {
            assert.strictEqual(parent.expression, node);
            return true;
        }

        if (n.SequenceExpression.check(parent) &&
            path.parent.name === "expressions" &&
            path.name === 0) {
            assert.strictEqual(parent.expressions[0], node);
            continue;
        }

        if (n.CallExpression.check(parent) &&
            path.name === "callee") {
            assert.strictEqual(parent.callee, node);
            continue;
        }

        if (n.MemberExpression.check(parent) &&
            path.name === "object") {
            assert.strictEqual(parent.object, node);
            continue;
        }

        if (n.ConditionalExpression.check(parent) &&
            path.name === "test") {
            assert.strictEqual(parent.test, node);
            continue;
        }

        if (isBinary(parent) &&
            path.name === "left") {
            assert.strictEqual(parent.left, node);
            continue;
        }

        if (n.UnaryExpression.check(parent) &&
            !parent.prefix &&
            path.name === "argument") {
            assert.strictEqual(parent.argument, node);
            continue;
        }

        return false;
    }

    return true;
}

module.exports = NodePath;

},{"./path":32,"./scope":33,"./types":36,"assert":49,"util":59}],31:[function(require,module,exports){
var assert = require("assert");
var types = require("./types");
var NodePath = require("./node-path");
var Node = types.namedTypes.Node;
var isArray = types.builtInTypes.array;
var isObject = types.builtInTypes.object;
var isFunction = types.builtInTypes.function;
var hasOwn = Object.prototype.hasOwnProperty;
var undefined;

function PathVisitor() {
    assert.ok(this instanceof PathVisitor);
    this._reusableContextStack = [];
    this._methodNameTable = computeMethodNameTable(this);
    this.Context = makeContextConstructor(this);
}

function computeMethodNameTable(visitor) {
    var typeNames = Object.create(null);

    for (var methodName in visitor) {
        if (/^visit[A-Z]/.test(methodName)) {
            typeNames[methodName.slice("visit".length)] = true;
        }
    }

    var supertypeTable = types.computeSupertypeLookupTable(typeNames);
    var methodNameTable = Object.create(null);

    for (var typeName in supertypeTable) {
        if (hasOwn.call(supertypeTable, typeName)) {
            methodName = "visit" + supertypeTable[typeName];
            if (isFunction.check(visitor[methodName])) {
                methodNameTable[typeName] = methodName;
            }
        }
    }

    return methodNameTable;
}

PathVisitor.fromMethodsObject = function fromMethodsObject(methods) {
    if (methods instanceof PathVisitor) {
        return methods;
    }

    if (!isObject.check(methods)) {
        // An empty visitor?
        return new PathVisitor;
    }

    function Visitor() {
        assert.ok(this instanceof Visitor);
        PathVisitor.call(this);
    }

    var Vp = Visitor.prototype = Object.create(PVp);
    Vp.constructor = Visitor;

    extend(Vp, methods);
    extend(Visitor, PathVisitor);

    isFunction.assert(Visitor.fromMethodsObject);
    isFunction.assert(Visitor.visit);

    return new Visitor;
};

function extend(target, source) {
    for (var property in source) {
        if (hasOwn.call(source, property)) {
            target[property] = source[property];
        }
    }

    return target;
}

PathVisitor.visit = function visit(node, methods) {
    var visitor = PathVisitor.fromMethodsObject(methods);

    if (node instanceof NodePath) {
        visitor.visit(node);
        return node.value;
    }

    var rootPath = new NodePath({ root: node });
    visitor.visit(rootPath.get("root"));
    return rootPath.value.root;
};

var PVp = PathVisitor.prototype;

PVp.visit = function(path) {
    if (this instanceof this.Context) {
        // If we somehow end up calling context.visit, then we need to
        // re-invoke the .visit method against context.visitor.
        return this.visitor.visit(path);
    }

    assert.ok(path instanceof NodePath);
    var value = path.value;

    var methodName = Node.check(value) && this._methodNameTable[value.type];
    if (methodName) {
        var context = this.acquireContext(path);
        try {
            context.invokeVisitorMethod(methodName);
        } finally {
            this.releaseContext(context);
        }

    } else {
        // If there was no visitor method to call, visit the children of
        // this node generically.
        visitChildren(path, this);
    }
};

function visitChildren(path, visitor) {
    assert.ok(path instanceof NodePath);
    assert.ok(visitor instanceof PathVisitor);

    var value = path.value;

    if (isArray.check(value)) {
        path.each(visitor.visit, visitor);
    } else if (!isObject.check(value)) {
        // No children to visit.
    } else {
        var name, names = types.getFieldNames(value);
        for (var i = 0, len = names.length; i < len; ++i) {
            if (!hasOwn.call(value, name = names[i])) {
                value[name] = types.getFieldValue(value, name);
            }
            visitor.visit(path.get(name));
        }
    }
}

PVp.acquireContext = function(path) {
    if (this._reusableContextStack.length === 0) {
        return new this.Context(path);
    }
    return this._reusableContextStack.pop().reset(path);
};

PVp.releaseContext = function(context) {
    assert.ok(context instanceof this.Context);
    this._reusableContextStack.push(context);
    context.currentPath = null;
};

function makeContextConstructor(visitor) {
    function Context(path) {
        assert.ok(this instanceof Context);
        assert.ok(this instanceof PathVisitor);
        assert.ok(path instanceof NodePath);

        Object.defineProperty(this, "visitor", {
            value: visitor,
            writable: false,
            enumerable: true,
            configurable: false
        });

        this.currentPath = path;
        this.needToCallTraverse = true;

        Object.seal(this);
    }

    assert.ok(visitor instanceof PathVisitor);

    // Note that the visitor object is the prototype of Context.prototype,
    // so all visitor methods are inherited by context objects.
    var Cp = Context.prototype = Object.create(visitor);

    Cp.constructor = Context;
    extend(Cp, sharedContextProtoMethods);

    return Context;
}

// Every PathVisitor has a different this.Context constructor and
// this.Context.prototype object, but those prototypes can all use the
// same reset, invokeVisitorMethod, and traverse function objects.
var sharedContextProtoMethods = Object.create(null);

sharedContextProtoMethods.reset =
function reset(path) {
    assert.ok(this instanceof this.Context);
    assert.ok(path instanceof NodePath);

    this.currentPath = path;
    this.needToCallTraverse = true;

    return this;
};

sharedContextProtoMethods.invokeVisitorMethod =
function invokeVisitorMethod(methodName) {
    assert.ok(this instanceof this.Context);
    assert.ok(this.currentPath instanceof NodePath);

    var result = this.visitor[methodName].call(this, this.currentPath);

    if (result === false) {
        // Visitor methods return false to indicate that they have handled
        // their own traversal needs, and we should not complain if
        // this.needToCallTraverse is still true.
        this.needToCallTraverse = false;

    } else if (result !== undefined) {
        // Any other non-undefined value returned from the visitor method
        // is interpreted as a replacement value.
        this.currentPath = this.currentPath.replace(result)[0];

        if (this.needToCallTraverse) {
            // If this.traverse still hasn't been called, visit the
            // children of the replacement node.
            this.traverse(this.currentPath);
        }
    }

    assert.strictEqual(
        this.needToCallTraverse, false,
        "Must either call this.traverse or return false in " + methodName
    );
};

sharedContextProtoMethods.traverse =
function traverse(path, newVisitor) {
    assert.ok(this instanceof this.Context);
    assert.ok(path instanceof NodePath);
    assert.ok(this.currentPath instanceof NodePath);

    this.needToCallTraverse = false;

    visitChildren(path, PathVisitor.fromMethodsObject(
        newVisitor || this.visitor
    ));
};

module.exports = PathVisitor;

},{"./node-path":30,"./types":36,"assert":49}],32:[function(require,module,exports){
var assert = require("assert");
var Op = Object.prototype;
var hasOwn = Op.hasOwnProperty;
var types = require("./types");
var isArray = types.builtInTypes.array;
var isNumber = types.builtInTypes.number;
var Ap = Array.prototype;
var slice = Ap.slice;
var map = Ap.map;

function Path(value, parentPath, name) {
    assert.ok(this instanceof Path);

    if (parentPath) {
        assert.ok(parentPath instanceof Path);
    } else {
        parentPath = null;
        name = null;
    }

    // The value encapsulated by this Path, generally equal to
    // parentPath.value[name] if we have a parentPath.
    this.value = value;

    // The immediate parent Path of this Path.
    this.parentPath = parentPath;

    // The name of the property of parentPath.value through which this
    // Path's value was reached.
    this.name = name;

    // Calling path.get("child") multiple times always returns the same
    // child Path object, for both performance and consistency reasons.
    this.__childCache = null;
}

var Pp = Path.prototype;

function getChildCache(path) {
    // Lazily create the child cache. This also cheapens cache
    // invalidation, since you can just reset path.__childCache to null.
    return path.__childCache || (path.__childCache = Object.create(null));
}

function getChildPath(path, name) {
    var cache = getChildCache(path);
    var actualChildValue = path.getValueProperty(name);
    var childPath = cache[name];
    if (!hasOwn.call(cache, name) ||
        // Ensure consistency between cache and reality.
        childPath.value !== actualChildValue) {
        childPath = cache[name] = new path.constructor(
            actualChildValue, path, name
        );
    }
    return childPath;
}

// This method is designed to be overridden by subclasses that need to
// handle missing properties, etc.
Pp.getValueProperty = function getValueProperty(name) {
    return this.value[name];
};

Pp.get = function get(name) {
    var path = this;
    var names = arguments;
    var count = names.length;

    for (var i = 0; i < count; ++i) {
        path = getChildPath(path, names[i]);
    }

    return path;
};

Pp.each = function each(callback, context) {
    var childPaths = [];
    var len = this.value.length;
    var i = 0;

    // Collect all the original child paths before invoking the callback.
    for (var i = 0; i < len; ++i) {
        if (hasOwn.call(this.value, i)) {
            childPaths[i] = this.get(i);
        }
    }

    // Invoke the callback on just the original child paths, regardless of
    // any modifications made to the array by the callback. I chose these
    // semantics over cleverly invoking the callback on new elements because
    // this way is much easier to reason about.
    context = context || this;
    for (i = 0; i < len; ++i) {
        if (hasOwn.call(childPaths, i)) {
            callback.call(context, childPaths[i]);
        }
    }
};

Pp.map = function map(callback, context) {
    var result = [];

    this.each(function(childPath) {
        result.push(callback.call(this, childPath));
    }, context);

    return result;
};

Pp.filter = function filter(callback, context) {
    var result = [];

    this.each(function(childPath) {
        if (callback.call(this, childPath)) {
            result.push(childPath);
        }
    }, context);

    return result;
};

function emptyMoves() {}
function getMoves(path, offset, start, end) {
    isArray.assert(path.value);

    if (offset === 0) {
        return emptyMoves;
    }

    var length = path.value.length;
    if (length < 1) {
        return emptyMoves;
    }

    var argc = arguments.length;
    if (argc === 2) {
        start = 0;
        end = length;
    } else if (argc === 3) {
        start = Math.max(start, 0);
        end = length;
    } else {
        start = Math.max(start, 0);
        end = Math.min(end, length);
    }

    isNumber.assert(start);
    isNumber.assert(end);

    var moves = Object.create(null);
    var cache = getChildCache(path);

    for (var i = start; i < end; ++i) {
        if (hasOwn.call(path.value, i)) {
            var childPath = path.get(i);
            assert.strictEqual(childPath.name, i);
            var newIndex = i + offset;
            childPath.name = newIndex;
            moves[newIndex] = childPath;
            delete cache[i];
        }
    }

    delete cache.length;

    return function() {
        for (var newIndex in moves) {
            var childPath = moves[newIndex];
            assert.strictEqual(childPath.name, +newIndex);
            cache[newIndex] = childPath;
            path.value[newIndex] = childPath.value;
        }
    };
}

Pp.shift = function shift() {
    var move = getMoves(this, -1);
    var result = this.value.shift();
    move();
    return result;
};

Pp.unshift = function unshift(node) {
    var move = getMoves(this, arguments.length);
    var result = this.value.unshift.apply(this.value, arguments);
    move();
    return result;
};

Pp.push = function push(node) {
    isArray.assert(this.value);
    delete getChildCache(this).length
    return this.value.push.apply(this.value, arguments);
};

Pp.pop = function pop() {
    isArray.assert(this.value);
    var cache = getChildCache(this);
    delete cache[this.value.length - 1];
    delete cache.length;
    return this.value.pop();
};

Pp.insertAt = function insertAt(index, node) {
    var argc = arguments.length;
    var move = getMoves(this, argc - 1, index);
    if (move === emptyMoves) {
        return this;
    }

    index = Math.max(index, 0);

    for (var i = 1; i < argc; ++i) {
        this.value[index + i - 1] = arguments[i];
    }

    move();

    return this;
};

Pp.insertBefore = function insertBefore(node) {
    var pp = this.parentPath;
    var argc = arguments.length;
    var insertAtArgs = [this.name];
    for (var i = 0; i < argc; ++i) {
        insertAtArgs.push(arguments[i]);
    }
    return pp.insertAt.apply(pp, insertAtArgs);
};

Pp.insertAfter = function insertAfter(node) {
    var pp = this.parentPath;
    var argc = arguments.length;
    var insertAtArgs = [this.name + 1];
    for (var i = 0; i < argc; ++i) {
        insertAtArgs.push(arguments[i]);
    }
    return pp.insertAt.apply(pp, insertAtArgs);
};

function repairRelationshipWithParent(path) {
    assert.ok(path instanceof Path);

    var pp = path.parentPath;
    if (!pp) {
        // Orphan paths have no relationship to repair.
        return path;
    }

    var parentValue = pp.value;
    var parentCache = getChildCache(pp);

    // Make sure parentCache[path.name] is populated.
    if (parentValue[path.name] === path.value) {
        parentCache[path.name] = path;
    } else if (isArray.check(parentValue)) {
        // Something caused path.name to become out of date, so attempt to
        // recover by searching for path.value in parentValue.
        var i = parentValue.indexOf(path.value);
        if (i >= 0) {
            parentCache[path.name = i] = path;
        }
    } else {
        // If path.value disagrees with parentValue[path.name], and
        // path.name is not an array index, let path.value become the new
        // parentValue[path.name] and update parentCache accordingly.
        parentValue[path.name] = path.value;
        parentCache[path.name] = path;
    }

    assert.strictEqual(parentValue[path.name], path.value);
    assert.strictEqual(path.parentPath.get(path.name), path);

    return path;
}

Pp.replace = function replace(replacement) {
    var results = [];
    var parentValue = this.parentPath.value;
    var parentCache = getChildCache(this.parentPath);
    var count = arguments.length;

    repairRelationshipWithParent(this);

    if (isArray.check(parentValue)) {
        var originalLength = parentValue.length;
        var move = getMoves(this.parentPath, count - 1, this.name + 1);

        var spliceArgs = [this.name, 1];
        for (var i = 0; i < count; ++i) {
            spliceArgs.push(arguments[i]);
        }

        var splicedOut = parentValue.splice.apply(parentValue, spliceArgs);

        assert.strictEqual(splicedOut[0], this.value);
        assert.strictEqual(
            parentValue.length,
            originalLength - 1 + count
        );

        move();

        if (count === 0) {
            delete this.value;
            delete parentCache[this.name];
            this.__childCache = null;

        } else {
            assert.strictEqual(parentValue[this.name], replacement);

            if (this.value !== replacement) {
                this.value = replacement;
                this.__childCache = null;
            }

            for (i = 0; i < count; ++i) {
                results.push(this.parentPath.get(this.name + i));
            }

            assert.strictEqual(results[0], this);
        }

    } else if (count === 1) {
        if (this.value !== replacement) {
            this.__childCache = null;
        }
        this.value = parentValue[this.name] = replacement;
        results.push(this);

    } else if (count === 0) {
        delete parentValue[this.name];
        delete this.value;
        this.__childCache = null;

        // Leave this path cached as parentCache[this.name], even though
        // it no longer has a value defined.

    } else {
        assert.ok(false, "Could not replace path");
    }

    return results;
};

module.exports = Path;

},{"./types":36,"assert":49}],33:[function(require,module,exports){
var assert = require("assert");
var types = require("./types");
var Type = types.Type;
var namedTypes = types.namedTypes;
var Node = namedTypes.Node;
var isArray = types.builtInTypes.array;
var hasOwn = Object.prototype.hasOwnProperty;
var b = types.builders;

function Scope(path, parentScope) {
    assert.ok(this instanceof Scope);
    assert.ok(path instanceof require("./node-path"));
    ScopeType.assert(path.value);

    var depth;

    if (parentScope) {
        assert.ok(parentScope instanceof Scope);
        depth = parentScope.depth + 1;
    } else {
        parentScope = null;
        depth = 0;
    }

    Object.defineProperties(this, {
        path: { value: path },
        node: { value: path.value },
        isGlobal: { value: !parentScope, enumerable: true },
        depth: { value: depth },
        parent: { value: parentScope },
        bindings: { value: {} }
    });
}

var scopeTypes = [
    // Program nodes introduce global scopes.
    namedTypes.Program,

    // Function is the supertype of FunctionExpression,
    // FunctionDeclaration, ArrowExpression, etc.
    namedTypes.Function,

    // In case you didn't know, the caught parameter shadows any variable
    // of the same name in an outer scope.
    namedTypes.CatchClause
];

var ScopeType = Type.or.apply(Type, scopeTypes);

Scope.isEstablishedBy = function(node) {
    return ScopeType.check(node);
};

var Sp = Scope.prototype;

// Will be overridden after an instance lazily calls scanScope.
Sp.didScan = false;

Sp.declares = function(name) {
    this.scan();
    return hasOwn.call(this.bindings, name);
};

Sp.declareTemporary = function(prefix) {
    if (prefix) {
        assert.ok(/^[a-z$_]/i.test(prefix), prefix);
    } else {
        prefix = "t$";
    }

    // Include this.depth in the name to make sure the name does not
    // collide with any variables in nested/enclosing scopes.
    prefix += this.depth.toString(36) + "$";

    this.scan();

    var index = 0;
    while (this.declares(prefix + index)) {
        ++index;
    }

    var name = prefix + index;
    return this.bindings[name] = types.builders.identifier(name);
};

Sp.injectTemporary = function(identifier, init) {
    identifier || (identifier = this.declareTemporary());

    var bodyPath = this.path.get("body");
    if (namedTypes.BlockStatement.check(bodyPath.value)) {
        bodyPath = bodyPath.get("body");
    }

    bodyPath.unshift(
        b.variableDeclaration(
            "var",
            [b.variableDeclarator(identifier, init || null)]
        )
    );

    return identifier;
};

Sp.scan = function(force) {
    if (force || !this.didScan) {
        for (var name in this.bindings) {
            // Empty out this.bindings, just in cases.
            delete this.bindings[name];
        }
        scanScope(this.path, this.bindings);
        this.didScan = true;
    }
};

Sp.getBindings = function () {
    this.scan();
    return this.bindings;
};

function scanScope(path, bindings) {
    var node = path.value;
    ScopeType.assert(node);

    if (namedTypes.CatchClause.check(node)) {
        // A catch clause establishes a new scope but the only variable
        // bound in that scope is the catch parameter. Any other
        // declarations create bindings in the outer scope.
        addPattern(path.get("param"), bindings);

    } else {
        recursiveScanScope(path, bindings);
    }
}

function recursiveScanScope(path, bindings) {
    var node = path.value;

    if (path.parent &&
        namedTypes.FunctionExpression.check(path.parent.node) &&
        path.parent.node.id) {
        addPattern(path.parent.get("id"), bindings);
    }

    if (!node) {
        // None of the remaining cases matter if node is falsy.

    } else if (isArray.check(node)) {
        path.each(function(childPath) {
            recursiveScanChild(childPath, bindings);
        });

    } else if (namedTypes.Function.check(node)) {
        path.get("params").each(function(paramPath) {
            addPattern(paramPath, bindings);
        });

        recursiveScanChild(path.get("body"), bindings);

    } else if (namedTypes.VariableDeclarator.check(node)) {
        addPattern(path.get("id"), bindings);
        recursiveScanChild(path.get("init"), bindings);

    } else if (node.type === "ImportSpecifier" ||
               node.type === "ImportNamespaceSpecifier" ||
               node.type === "ImportDefaultSpecifier") {
        addPattern(
            node.name ? path.get("name") : path.get("id"),
            bindings
        );

    } else if (Node.check(node)) {
        types.eachField(node, function(name, child) {
            var childPath = path.get(name);
            assert.strictEqual(childPath.value, child);
            recursiveScanChild(childPath, bindings);
        });
    }
}

function recursiveScanChild(path, bindings) {
    var node = path.value;

    if (!node) {
        // None of the remaining cases matter if node is falsy.

    } else if (namedTypes.FunctionDeclaration.check(node)) {
        addPattern(path.get("id"), bindings);

    } else if (namedTypes.ClassDeclaration &&
               namedTypes.ClassDeclaration.check(node)) {
        addPattern(path.get("id"), bindings);

    } else if (Scope.isEstablishedBy(node)) {
        if (namedTypes.CatchClause.check(node)) {
            var catchParamName = node.param.name;
            var hadBinding = hasOwn.call(bindings, catchParamName);

            // Any declarations that occur inside the catch body that do
            // not have the same name as the catch parameter should count
            // as bindings in the outer scope.
            recursiveScanScope(path.get("body"), bindings);

            // If a new binding matching the catch parameter name was
            // created while scanning the catch body, ignore it because it
            // actually refers to the catch parameter and not the outer
            // scope that we're currently scanning.
            if (!hadBinding) {
                delete bindings[catchParamName];
            }
        }

    } else {
        recursiveScanScope(path, bindings);
    }
}

function addPattern(patternPath, bindings) {
    var pattern = patternPath.value;
    namedTypes.Pattern.assert(pattern);

    if (namedTypes.Identifier.check(pattern)) {
        if (hasOwn.call(bindings, pattern.name)) {
            bindings[pattern.name].push(patternPath);
        } else {
            bindings[pattern.name] = [patternPath];
        }

    } else if (namedTypes.SpreadElement &&
               namedTypes.SpreadElement.check(pattern)) {
        addPattern(patternPath.get("argument"), bindings);
    }
}

Sp.lookup = function(name) {
    for (var scope = this; scope; scope = scope.parent)
        if (scope.declares(name))
            break;
    return scope;
};

Sp.getGlobalScope = function() {
    var scope = this;
    while (!scope.isGlobal)
        scope = scope.parent;
    return scope;
};

module.exports = Scope;

},{"./node-path":30,"./types":36,"assert":49}],34:[function(require,module,exports){
var types = require("../lib/types");
var Type = types.Type;
var builtin = types.builtInTypes;
var isNumber = builtin.number;

// An example of constructing a new type with arbitrary constraints from
// an existing type.
exports.geq = function(than) {
    return new Type(function(value) {
        return isNumber.check(value) && value >= than;
    }, isNumber + " >= " + than);
};

// Default value-returning functions that may optionally be passed as a
// third argument to Def.prototype.field.
exports.defaults = {
    // Functions were used because (among other reasons) that's the most
    // elegant way to allow for the emptyArray one always to give a new
    // array instance.
    "null": function() { return null },
    "emptyArray": function() { return [] },
    "false": function() { return false },
    "true": function() { return true },
    "undefined": function() {}
};

var naiveIsPrimitive = Type.or(
    builtin.string,
    builtin.number,
    builtin.boolean,
    builtin.null,
    builtin.undefined
);

exports.isPrimitive = new Type(function(value) {
    if (value === null)
        return true;
    var type = typeof value;
    return !(type === "object" ||
             type === "function");
}, naiveIsPrimitive.toString());

},{"../lib/types":36}],35:[function(require,module,exports){
var visit = require("./path-visitor").visit;
var deprecate = require("depd")('require("ast-types").traverse');

function traverseWithFullPathInfo(node, callback) {
    return visit(node, {
        visitNode: function(path) {
            if (callback.call(path, path.value) !== false) {
                this.traverse(path);
            }

            return false;
        }
    });
}

var deprecatedWrapper = deprecate.function(
    traverseWithFullPathInfo,
    'Please use require("ast-types").visit instead of .traverse for ' +
        'syntax tree manipulation'
);

deprecatedWrapper.fast = deprecatedWrapper;
module.exports = deprecatedWrapper;

},{"./path-visitor":31,"depd":38}],36:[function(require,module,exports){
var assert = require("assert");
var Ap = Array.prototype;
var slice = Ap.slice;
var map = Ap.map;
var each = Ap.forEach;
var Op = Object.prototype;
var objToStr = Op.toString;
var funObjStr = objToStr.call(function(){});
var strObjStr = objToStr.call("");
var hasOwn = Op.hasOwnProperty;

// A type is an object with a .check method that takes a value and returns
// true or false according to whether the value matches the type.

function Type(check, name) {
    var self = this;
    assert.ok(self instanceof Type, self);

    // Unfortunately we can't elegantly reuse isFunction and isString,
    // here, because this code is executed while defining those types.
    assert.strictEqual(objToStr.call(check), funObjStr,
                       check + " is not a function");

    // The `name` parameter can be either a function or a string.
    var nameObjStr = objToStr.call(name);
    assert.ok(nameObjStr === funObjStr ||
              nameObjStr === strObjStr,
              name + " is neither a function nor a string");

    Object.defineProperties(self, {
        name: { value: name },
        check: {
            value: function(value, deep) {
                var result = check.call(self, value, deep);
                if (!result && deep && objToStr.call(deep) === funObjStr)
                    deep(self, value);
                return result;
            }
        }
    });
}

var Tp = Type.prototype;

// Throughout this file we use Object.defineProperty to prevent
// redefinition of exported properties.
exports.Type = Type;

// Like .check, except that failure triggers an AssertionError.
Tp.assert = function(value, deep) {
    if (!this.check(value, deep)) {
        var str = shallowStringify(value);
        assert.ok(false, str + " does not match type " + this);
        return false;
    }
    return true;
};

function shallowStringify(value) {
    if (isObject.check(value))
        return "{" + Object.keys(value).map(function(key) {
            return key + ": " + value[key];
        }).join(", ") + "}";

    if (isArray.check(value))
        return "[" + value.map(shallowStringify).join(", ") + "]";

    return JSON.stringify(value);
}

Tp.toString = function() {
    var name = this.name;

    if (isString.check(name))
        return name;

    if (isFunction.check(name))
        return name.call(this) + "";

    return name + " type";
};

var builtInTypes = {};
exports.builtInTypes = builtInTypes;

function defBuiltInType(example, name) {
    var objStr = objToStr.call(example);

    Object.defineProperty(builtInTypes, name, {
        enumerable: true,
        value: new Type(function(value) {
            return objToStr.call(value) === objStr;
        }, name)
    });

    return builtInTypes[name];
}

// These types check the underlying [[Class]] attribute of the given
// value, rather than using the problematic typeof operator. Note however
// that no subtyping is considered; so, for instance, isObject.check
// returns false for [], /./, new Date, and null.
var isString = defBuiltInType("", "string");
var isFunction = defBuiltInType(function(){}, "function");
var isArray = defBuiltInType([], "array");
var isObject = defBuiltInType({}, "object");
var isRegExp = defBuiltInType(/./, "RegExp");
var isDate = defBuiltInType(new Date, "Date");
var isNumber = defBuiltInType(3, "number");
var isBoolean = defBuiltInType(true, "boolean");
var isNull = defBuiltInType(null, "null");
var isUndefined = defBuiltInType(void 0, "undefined");

// There are a number of idiomatic ways of expressing types, so this
// function serves to coerce them all to actual Type objects. Note that
// providing the name argument is not necessary in most cases.
function toType(from, name) {
    // The toType function should of course be idempotent.
    if (from instanceof Type)
        return from;

    // The Def type is used as a helper for constructing compound
    // interface types for AST nodes.
    if (from instanceof Def)
        return from.type;

    // Support [ElemType] syntax.
    if (isArray.check(from))
        return Type.fromArray(from);

    // Support { someField: FieldType, ... } syntax.
    if (isObject.check(from))
        return Type.fromObject(from);

    // If isFunction.check(from), assume that from is a binary predicate
    // function we can use to define the type.
    if (isFunction.check(from))
        return new Type(from, name);

    // As a last resort, toType returns a type that matches any value that
    // is === from. This is primarily useful for literal values like
    // toType(null), but it has the additional advantage of allowing
    // toType to be a total function.
    return new Type(function(value) {
        return value === from;
    }, isUndefined.check(name) ? function() {
        return from + "";
    } : name);
}

// Returns a type that matches the given value iff any of type1, type2,
// etc. match the value.
Type.or = function(/* type1, type2, ... */) {
    var types = [];
    var len = arguments.length;
    for (var i = 0; i < len; ++i)
        types.push(toType(arguments[i]));

    return new Type(function(value, deep) {
        for (var i = 0; i < len; ++i)
            if (types[i].check(value, deep))
                return true;
        return false;
    }, function() {
        return types.join(" | ");
    });
};

Type.fromArray = function(arr) {
    assert.ok(isArray.check(arr));
    assert.strictEqual(
        arr.length, 1,
        "only one element type is permitted for typed arrays");
    return toType(arr[0]).arrayOf();
};

Tp.arrayOf = function() {
    var elemType = this;
    return new Type(function(value, deep) {
        return isArray.check(value) && value.every(function(elem) {
            return elemType.check(elem, deep);
        });
    }, function() {
        return "[" + elemType + "]";
    });
};

Type.fromObject = function(obj) {
    var fields = Object.keys(obj).map(function(name) {
        return new Field(name, obj[name]);
    });

    return new Type(function(value, deep) {
        return isObject.check(value) && fields.every(function(field) {
            return field.type.check(value[field.name], deep);
        });
    }, function() {
        return "{ " + fields.join(", ") + " }";
    });
};

function Field(name, type, defaultFn, hidden) {
    var self = this;

    assert.ok(self instanceof Field);
    isString.assert(name);

    type = toType(type);

    var properties = {
        name: { value: name },
        type: { value: type },
        hidden: { value: !!hidden }
    };

    if (isFunction.check(defaultFn)) {
        properties.defaultFn = { value: defaultFn };
    }

    Object.defineProperties(self, properties);
}

var Fp = Field.prototype;

Fp.toString = function() {
    return JSON.stringify(this.name) + ": " + this.type;
};

Fp.getValue = function(obj) {
    var value = obj[this.name];

    if (!isUndefined.check(value))
        return value;

    if (this.defaultFn)
        value = this.defaultFn.call(obj);

    return value;
};

// Define a type whose name is registered in a namespace (the defCache) so
// that future definitions will return the same type given the same name.
// In particular, this system allows for circular and forward definitions.
// The Def object d returned from Type.def may be used to configure the
// type d.type by calling methods such as d.bases, d.build, and d.field.
Type.def = function(typeName) {
    isString.assert(typeName);
    return hasOwn.call(defCache, typeName)
        ? defCache[typeName]
        : defCache[typeName] = new Def(typeName);
};

// In order to return the same Def instance every time Type.def is called
// with a particular name, those instances need to be stored in a cache.
var defCache = Object.create(null);

function Def(typeName) {
    var self = this;
    assert.ok(self instanceof Def);

    Object.defineProperties(self, {
        typeName: { value: typeName },
        baseNames: { value: [] },
        ownFields: { value: Object.create(null) },

        // These two are populated during finalization.
        allSupertypes: { value: Object.create(null) }, // Includes own typeName.
        supertypeList: { value: [] }, // Linear inheritance hierarchy.
        allFields: { value: Object.create(null) }, // Includes inherited fields.
        fieldNames: { value: [] }, // Non-hidden keys of allFields.

        type: {
            value: new Type(function(value, deep) {
                return self.check(value, deep);
            }, typeName)
        }
    });
}

Def.fromValue = function(value) {
    if (value && typeof value === "object") {
        var type = value.type;
        if (typeof type === "string" &&
            hasOwn.call(defCache, type)) {
            var d = defCache[type];
            if (d.finalized) {
                return d;
            }
        }
    }

    return null;
};

var Dp = Def.prototype;

Dp.isSupertypeOf = function(that) {
    if (that instanceof Def) {
        assert.strictEqual(this.finalized, true);
        assert.strictEqual(that.finalized, true);
        return hasOwn.call(that.allSupertypes, this.typeName);
    } else {
        assert.ok(false, that + " is not a Def");
    }
};

// Note that the list returned by this function is a copy of the internal
// supertypeList, *without* the typeName itself as the first element.
exports.getSupertypeNames = function(typeName) {
    assert.ok(hasOwn.call(defCache, typeName));
    var d = defCache[typeName];
    assert.strictEqual(d.finalized, true);
    return d.supertypeList.slice(1);
};

// Returns an object mapping from every known type in the defCache to the
// most specific supertype whose name is an own property of the candidates
// object.
exports.computeSupertypeLookupTable = function(candidates) {
    var table = {};

    for (var typeName in defCache) {
        if (hasOwn.call(defCache, typeName)) {
            var d = defCache[typeName];
            assert.strictEqual(d.finalized, true);
            for (var i = 0; i < d.supertypeList.length; ++i) {
                var superTypeName = d.supertypeList[i];
                if (hasOwn.call(candidates, superTypeName)) {
                    table[typeName] = superTypeName;
                    break;
                }
            }
        }
    }

    return table;
};

Dp.checkAllFields = function(value, deep) {
    var allFields = this.allFields;
    assert.strictEqual(this.finalized, true);

    function checkFieldByName(name) {
        var field = allFields[name];
        var type = field.type;
        var child = field.getValue(value);
        return type.check(child, deep);
    }

    return isObject.check(value)
        && Object.keys(allFields).every(checkFieldByName);
};

Dp.check = function(value, deep) {
    assert.strictEqual(
        this.finalized, true,
        "prematurely checking unfinalized type " + this.typeName);

    // A Def type can only match an object value.
    if (!isObject.check(value))
        return false;

    var vDef = Def.fromValue(value);
    if (!vDef) {
        // If we couldn't infer the Def associated with the given value,
        // and we expected it to be a SourceLocation or a Position, it was
        // probably just missing a "type" field (because Esprima does not
        // assign a type property to such nodes). Be optimistic and let
        // this.checkAllFields make the final decision.
        if (this.typeName === "SourceLocation" ||
            this.typeName === "Position") {
            return this.checkAllFields(value, deep);
        }

        // Calling this.checkAllFields for any other type of node is both
        // bad for performance and way too forgiving.
        return false;
    }

    // If checking deeply and vDef === this, then we only need to call
    // checkAllFields once. Calling checkAllFields is too strict when deep
    // is false, because then we only care about this.isSupertypeOf(vDef).
    if (deep && vDef === this)
        return this.checkAllFields(value, deep);

    // In most cases we rely exclusively on isSupertypeOf to make O(1)
    // subtyping determinations. This suffices in most situations outside
    // of unit tests, since interface conformance is checked whenever new
    // instances are created using builder functions.
    if (!this.isSupertypeOf(vDef))
        return false;

    // The exception is when deep is true; then, we recursively check all
    // fields.
    if (!deep)
        return true;

    // Use the more specific Def (vDef) to perform the deep check, but
    // shallow-check fields defined by the less specific Def (this).
    return vDef.checkAllFields(value, deep)
        && this.checkAllFields(value, false);
};

Dp.bases = function() {
    var bases = this.baseNames;

    assert.strictEqual(this.finalized, false);

    each.call(arguments, function(baseName) {
        isString.assert(baseName);

        // This indexOf lookup may be O(n), but the typical number of base
        // names is very small, and indexOf is a native Array method.
        if (bases.indexOf(baseName) < 0)
            bases.push(baseName);
    });

    return this; // For chaining.
};

// False by default until .build(...) is called on an instance.
Object.defineProperty(Dp, "buildable", { value: false });

var builders = {};
exports.builders = builders;

// This object is used as prototype for any node created by a builder.
var nodePrototype = {};

// Call this function to define a new method to be shared by all AST
// nodes. The replaced method (if any) is returned for easy wrapping.
exports.defineMethod = function(name, func) {
    var old = nodePrototype[name];

    // Pass undefined as func to delete nodePrototype[name].
    if (isUndefined.check(func)) {
        delete nodePrototype[name];

    } else {
        isFunction.assert(func);

        Object.defineProperty(nodePrototype, name, {
            enumerable: true, // For discoverability.
            configurable: true, // For delete proto[name].
            value: func
        });
    }

    return old;
};

// Calling the .build method of a Def simultaneously marks the type as
// buildable (by defining builders[getBuilderName(typeName)]) and
// specifies the order of arguments that should be passed to the builder
// function to create an instance of the type.
Dp.build = function(/* param1, param2, ... */) {
    var self = this;

    // Calling Def.prototype.build multiple times has the effect of merely
    // redefining this property.
    Object.defineProperty(self, "buildParams", {
        value: slice.call(arguments),
        writable: false,
        enumerable: false,
        configurable: true
    });

    assert.strictEqual(self.finalized, false);
    isString.arrayOf().assert(self.buildParams);

    if (self.buildable) {
        // If this Def is already buildable, update self.buildParams and
        // continue using the old builder function.
        return self;
    }

    // Every buildable type will have its "type" field filled in
    // automatically. This includes types that are not subtypes of Node,
    // like SourceLocation, but that seems harmless (TODO?).
    self.field("type", self.typeName, function() { return self.typeName });

    // Override Dp.buildable for this Def instance.
    Object.defineProperty(self, "buildable", { value: true });

    Object.defineProperty(builders, getBuilderName(self.typeName), {
        enumerable: true,

        value: function() {
            var args = arguments;
            var argc = args.length;
            var built = Object.create(nodePrototype);

            assert.ok(
                self.finalized,
                "attempting to instantiate unfinalized type " + self.typeName);

            function add(param, i) {
                if (hasOwn.call(built, param))
                    return;

                var all = self.allFields;
                assert.ok(hasOwn.call(all, param), param);

                var field = all[param];
                var type = field.type;
                var value;

                if (isNumber.check(i) && i < argc) {
                    value = args[i];
                } else if (field.defaultFn) {
                    // Expose the partially-built object to the default
                    // function as its `this` object.
                    value = field.defaultFn.call(built);
                } else {
                    var message = "no value or default function given for field " +
                        JSON.stringify(param) + " of " + self.typeName + "(" +
                            self.buildParams.map(function(name) {
                                return all[name];
                            }).join(", ") + ")";
                    assert.ok(false, message);
                }

                assert.ok(
                    type.check(value),
                    shallowStringify(value) +
                        " does not match field " + field +
                        " of type " + self.typeName);

                // TODO Could attach getters and setters here to enforce
                // dynamic type safety.
                built[param] = value;
            }

            self.buildParams.forEach(function(param, i) {
                add(param, i);
            });

            Object.keys(self.allFields).forEach(function(param) {
                add(param); // Use the default value.
            });

            // Make sure that the "type" field was filled automatically.
            assert.strictEqual(built.type, self.typeName);

            return built;
        }
    });

    return self; // For chaining.
};

function getBuilderName(typeName) {
    return typeName.replace(/^[A-Z]+/, function(upperCasePrefix) {
        var len = upperCasePrefix.length;
        switch (len) {
        case 0: return "";
        // If there's only one initial capital letter, just lower-case it.
        case 1: return upperCasePrefix.toLowerCase();
        default:
            // If there's more than one initial capital letter, lower-case
            // all but the last one, so that XMLDefaultDeclaration (for
            // example) becomes xmlDefaultDeclaration.
            return upperCasePrefix.slice(
                0, len - 1).toLowerCase() +
                upperCasePrefix.charAt(len - 1);
        }
    });
}

// The reason fields are specified using .field(...) instead of an object
// literal syntax is somewhat subtle: the object literal syntax would
// support only one key and one value, but with .field(...) we can pass
// any number of arguments to specify the field.
Dp.field = function(name, type, defaultFn, hidden) {
    assert.strictEqual(this.finalized, false);
    this.ownFields[name] = new Field(name, type, defaultFn, hidden);
    return this; // For chaining.
};

var namedTypes = {};
exports.namedTypes = namedTypes;

// Like Object.keys, but aware of what fields each AST type should have.
function getFieldNames(object) {
    var d = Def.fromValue(object);
    if (d) {
        return d.fieldNames.slice(0);
    }

    assert.strictEqual(
        "type" in object, false,
        "did not recognize object of type " +
            JSON.stringify(object.type)
    );

    return Object.keys(object);
}
exports.getFieldNames = getFieldNames;

// Get the value of an object property, taking object.type and default
// functions into account.
function getFieldValue(object, fieldName) {
    var d = Def.fromValue(object);
    if (d) {
        var field = d.allFields[fieldName];
        if (field) {
            return field.getValue(object);
        }
    }

    return object[fieldName];
}
exports.getFieldValue = getFieldValue;

// Iterate over all defined fields of an object, including those missing
// or undefined, passing each field name and effective value (as returned
// by getFieldValue) to the callback. If the object has no corresponding
// Def, the callback will never be called.
exports.eachField = function(object, callback, context) {
    getFieldNames(object).forEach(function(name) {
        callback.call(this, name, getFieldValue(object, name));
    }, context);
};

// Similar to eachField, except that iteration stops as soon as the
// callback returns a truthy value. Like Array.prototype.some, the final
// result is either true or false to indicates whether the callback
// returned true for any element or not.
exports.someField = function(object, callback, context) {
    return getFieldNames(object).some(function(name) {
        return callback.call(this, name, getFieldValue(object, name));
    }, context);
};

// This property will be overridden as true by individual Def instances
// when they are finalized.
Object.defineProperty(Dp, "finalized", { value: false });

Dp.finalize = function() {
    // It's not an error to finalize a type more than once, but only the
    // first call to .finalize does anything.
    if (!this.finalized) {
        var allFields = this.allFields;
        var allSupertypes = this.allSupertypes;

        this.baseNames.forEach(function(name) {
            var def = defCache[name];
            def.finalize();
            extend(allFields, def.allFields);
            extend(allSupertypes, def.allSupertypes);
        });

        // TODO Warn if fields are overridden with incompatible types.
        extend(allFields, this.ownFields);
        allSupertypes[this.typeName] = this;

        this.fieldNames.length = 0;
        for (var fieldName in allFields) {
            if (hasOwn.call(allFields, fieldName) &&
                !allFields[fieldName].hidden) {
                this.fieldNames.push(fieldName);
            }
        }

        // Types are exported only once they have been finalized.
        Object.defineProperty(namedTypes, this.typeName, {
            enumerable: true,
            value: this.type
        });

        Object.defineProperty(this, "finalized", { value: true });

        // A linearization of the inheritance hierarchy.
        populateSupertypeList(this.typeName, this.supertypeList);
    }
};

function populateSupertypeList(typeName, list) {
    list.length = 0;
    list.push(typeName);

    var lastSeen = Object.create(null);

    for (var pos = 0; pos < list.length; ++pos) {
        typeName = list[pos];
        var d = defCache[typeName];
        assert.strictEqual(d.finalized, true);

        // If we saw typeName earlier in the breadth-first traversal,
        // delete the last-seen occurrence.
        if (hasOwn.call(lastSeen, typeName)) {
            delete list[lastSeen[typeName]];
        }

        // Record the new index of the last-seen occurrence of typeName.
        lastSeen[typeName] = pos;

        // Enqueue the base names of this type.
        list.push.apply(list, d.baseNames);
    }

    // Compaction loop to remove array holes.
    for (var to = 0, from = to, len = list.length; from < len; ++from) {
        if (hasOwn.call(list, from)) {
            list[to++] = list[from];
        }
    }

    list.length = to;
}

function extend(into, from) {
    Object.keys(from).forEach(function(name) {
        into[name] = from[name];
    });

    return into;
};

exports.finalize = function() {
    Object.keys(defCache).forEach(function(name) {
        defCache[name].finalize();
    });
};

},{"assert":49}],37:[function(require,module,exports){
var types = require("./lib/types");

// This core module of AST types captures ES5 as it is parsed today by
// git://github.com/ariya/esprima.git#master.
require("./def/core");

// Feel free to add to or remove from this list of extension modules to
// configure the precise type hierarchy that you need.
require("./def/es6");
require("./def/es7");
require("./def/mozilla");
require("./def/e4x");
require("./def/fb-harmony");

types.finalize();

exports.Type = types.Type;
exports.builtInTypes = types.builtInTypes;
exports.namedTypes = types.namedTypes;
exports.builders = types.builders;
exports.defineMethod = types.defineMethod;
exports.getFieldNames = types.getFieldNames;
exports.getFieldValue = types.getFieldValue;
exports.eachField = types.eachField;
exports.someField = types.someField;
exports.getSupertypeNames = types.getSupertypeNames;
exports.astNodesAreEquivalent = require("./lib/equiv");
exports.traverse = require("./lib/traverse");
exports.finalize = types.finalize;
exports.NodePath = require("./lib/node-path");
exports.PathVisitor = require("./lib/path-visitor");
exports.visit = exports.PathVisitor.visit;

},{"./def/core":23,"./def/e4x":24,"./def/es6":25,"./def/es7":26,"./def/fb-harmony":27,"./def/mozilla":28,"./lib/equiv":29,"./lib/node-path":30,"./lib/path-visitor":31,"./lib/traverse":35,"./lib/types":36}],38:[function(require,module,exports){
(function (process){
/*!
 * depd
 * Copyright(c) 2014 Douglas Christopher Wilson
 * MIT Licensed
 */

/**
 * Module dependencies.
 */

var callSiteToString = require('./lib/compat').callSiteToString
var EventEmitter = require('events').EventEmitter
var relative = require('path').relative

/**
 * Module exports.
 */

module.exports = depd

/**
 * Get the path to base files on.
 */

var basePath = process.cwd()

/**
 * Get listener count on event emitter.
 */

/*istanbul ignore next*/
var eventListenerCount = EventEmitter.listenerCount
  || function (emitter, type) { return emitter.listeners(type).length }

/**
 * Determine if namespace is contained in the string.
 */

function containsNamespace(str, namespace) {
  var val = str.split(/[ ,]+/)

  namespace = String(namespace).toLowerCase()

  for (var i = 0 ; i < val.length; i++) {
    if (!(str = val[i])) continue;

    // namespace contained
    if (str === '*' || str.toLowerCase() === namespace) {
      return true
    }
  }

  return false
}

/**
 * Convert a data descriptor to accessor descriptor.
 */

function convertDataDescriptorToAccessor(obj, prop, message) {
  var descriptor = Object.getOwnPropertyDescriptor(obj, prop)
  var value = descriptor.value

  descriptor.get = function getter() { return value }

  if (descriptor.writable) {
    descriptor.set = function setter(val) { return value = val }
  }

  delete descriptor.value
  delete descriptor.writable

  Object.defineProperty(obj, prop, descriptor)

  return descriptor
}

/**
 * Create arguments string to keep arity.
 */

function createArgumentsString(arity) {
  var str = ''

  for (var i = 0; i < arity; i++) {
    str += ', arg' + i
  }

  return str.substr(2)
}

/**
 * Create stack string from stack.
 */

function createStackString(stack) {
  var str = this.name + ': ' + this.namespace

  if (this.message) {
    str += ' deprecated ' + this.message
  }

  for (var i = 0; i < stack.length; i++) {
    str += '\n    at ' + callSiteToString(stack[i])
  }

  return str
}

/**
 * Create deprecate for namespace in caller.
 */

function depd(namespace) {
  if (!namespace) {
    throw new TypeError('argument namespace is required')
  }

  var stack = getStack()
  var site = callSiteLocation(stack[1])
  var file = site[0]

  function deprecate(message) {
    // call to self as log
    log.call(deprecate, message)
  }

  deprecate._file = file
  deprecate._ignored = isignored(namespace)
  deprecate._namespace = namespace
  deprecate._traced = istraced(namespace)
  deprecate._warned = Object.create(null)

  deprecate.function = wrapfunction
  deprecate.property = wrapproperty

  return deprecate
}

/**
 * Determine if namespace is ignored.
 */

function isignored(namespace) {
  /* istanbul ignore next: tested in a child processs */
  if (process.noDeprecation) {
    // --no-deprecation support
    return true
  }

  var str = process.env.NO_DEPRECATION || ''

  // namespace ignored
  return containsNamespace(str, namespace)
}

/**
 * Determine if namespace is traced.
 */

function istraced(namespace) {
  /* istanbul ignore next: tested in a child processs */
  if (process.traceDeprecation) {
    // --trace-deprecation support
    return true
  }

  var str = process.env.TRACE_DEPRECATION || ''

  // namespace traced
  return containsNamespace(str, namespace)
}

/**
 * Display deprecation message.
 */

function log(message, site) {
  var haslisteners = eventListenerCount(process, 'deprecation') !== 0

  // abort early if no destination
  if (!haslisteners && this._ignored) {
    return
  }

  var caller
  var callFile
  var callSite
  var i = 0
  var seen = false
  var stack = getStack()
  var file = this._file

  if (site) {
    // provided site
    callSite = callSiteLocation(stack[1])
    callSite.name = site.name
    file = callSite[0]
  } else {
    // get call site
    i = 2
    site = callSiteLocation(stack[i])
    callSite = site
  }

  // get caller of deprecated thing in relation to file
  for (; i < stack.length; i++) {
    caller = callSiteLocation(stack[i])
    callFile = caller[0]

    if (callFile === file) {
      seen = true
    } else if (callFile === this._file) {
      file = this._file
    } else if (seen) {
      break
    }
  }

  var key = caller
    ? site.join(':') + '__' + caller.join(':')
    : undefined

  if (key !== undefined && key in this._warned) {
    // already warned
    return
  }

  this._warned[key] = true

  // generate automatic message from call site
  if (!message) {
    message = callSite === site || !callSite.name
      ? defaultMessage(site)
      : defaultMessage(callSite)
  }

  // emit deprecation if listeners exist
  if (haslisteners) {
    var err = DeprecationError(this._namespace, message, stack.slice(i))
    process.emit('deprecation', err)
    return
  }

  // format and write message
  var format = process.stderr.isTTY
    ? formatColor
    : formatPlain
  var msg = format.call(this, message, caller, stack.slice(i))
  process.stderr.write(msg + '\n', 'utf8')

  return
}

/**
 * Get call site location as array.
 */

function callSiteLocation(callSite) {
  var file = callSite.getFileName() || '<anonymous>'
  var line = callSite.getLineNumber()
  var colm = callSite.getColumnNumber()

  if (callSite.isEval()) {
    file = callSite.getEvalOrigin() + ', ' + file
  }

  var site = [file, line, colm]

  site.callSite = callSite
  site.name = callSite.getFunctionName()

  return site
}

/**
 * Generate a default message from the site.
 */

function defaultMessage(site) {
  var callSite = site.callSite
  var funcName = site.name
  var typeName = callSite.getTypeName()

  // make useful anonymous name
  if (!funcName) {
    funcName = '<anonymous@' + formatLocation(site) + '>'
  }

  // make useful type name
  if (typeName === 'Function') {
    typeName = callSite.getThis().name || typeName
  }

  return callSite.getMethodName()
    ? typeName + '.' + funcName
    : funcName
}

/**
 * Format deprecation message without color.
 */

function formatPlain(msg, caller, stack) {
  var timestamp = new Date().toUTCString()

  var formatted = timestamp
    + ' ' + this._namespace
    + ' deprecated ' + msg

  // add stack trace
  if (this._traced) {
    for (var i = 0; i < stack.length; i++) {
      formatted += '\n    at ' + callSiteToString(stack[i])
    }

    return formatted
  }

  if (caller) {
    formatted += ' at ' + formatLocation(caller)
  }

  return formatted
}

/**
 * Format deprecation message with color.
 */

function formatColor(msg, caller, stack) {
  var formatted = '\x1b[36;1m' + this._namespace + '\x1b[22;39m' // bold cyan
    + ' \x1b[33;1mdeprecated\x1b[22;39m' // bold yellow
    + ' \x1b[0m' + msg + '\x1b[39m' // reset

  // add stack trace
  if (this._traced) {
    for (var i = 0; i < stack.length; i++) {
      formatted += '\n    \x1b[36mat ' + callSiteToString(stack[i]) + '\x1b[39m' // cyan
    }

    return formatted
  }

  if (caller) {
    formatted += ' \x1b[36m' + formatLocation(caller) + '\x1b[39m' // cyan
  }

  return formatted
}

/**
 * Format call site location.
 */

function formatLocation(callSite) {
  return relative(basePath, callSite[0])
    + ':' + callSite[1]
    + ':' + callSite[2]
}

/**
 * Get the stack as array of call sites.
 */

function getStack() {
  var limit = Error.stackTraceLimit
  var obj = {}
  var prep = Error.prepareStackTrace

  Error.prepareStackTrace = prepareObjectStackTrace
  Error.stackTraceLimit = Math.max(10, limit)

  // capture the stack
  Error.captureStackTrace(obj)

  // slice this function off the top
  var stack = obj.stack.slice(1)

  Error.prepareStackTrace = prep
  Error.stackTraceLimit = limit

  return stack
}

/**
 * Capture call site stack from v8.
 */

function prepareObjectStackTrace(obj, stack) {
  return stack
}

/**
 * Return a wrapped function in a deprecation message.
 */

function wrapfunction(fn, message) {
  if (typeof fn !== 'function') {
    throw new TypeError('argument fn must be a function')
  }

  var args = createArgumentsString(fn.length)
  var deprecate = this
  var stack = getStack()
  var site = callSiteLocation(stack[1])

  site.name = fn.name

  var deprecatedfn = eval('(function (' + args + ') {\n'
    + '"use strict"\n'
    + 'log.call(deprecate, message, site)\n'
    + 'return fn.apply(this, arguments)\n'
    + '})')

  return deprecatedfn
}

/**
 * Wrap property in a deprecation message.
 */

function wrapproperty(obj, prop, message) {
  if (!obj || (typeof obj !== 'object' && typeof obj !== 'function')) {
    throw new TypeError('argument obj must be object')
  }

  var descriptor = Object.getOwnPropertyDescriptor(obj, prop)

  if (!descriptor) {
    throw new TypeError('must call property on owner object')
  }

  if (!descriptor.configurable) {
    throw new TypeError('property must be configurable')
  }

  var deprecate = this
  var stack = getStack()
  var site = callSiteLocation(stack[1])

  // set site name
  site.name = prop

  // convert data descriptor
  if ('value' in descriptor) {
    descriptor = convertDataDescriptorToAccessor(obj, prop, message)
  }

  var get = descriptor.get
  var set = descriptor.set

  // wrap getter
  if (typeof get === 'function') {
    descriptor.get = function getter() {
      log.call(deprecate, message, site)
      return get.apply(this, arguments)
    }
  }

  // wrap setter
  if (typeof set === 'function') {
    descriptor.set = function setter() {
      log.call(deprecate, message, site)
      return set.apply(this, arguments)
    }
  }

  Object.defineProperty(obj, prop, descriptor)
}

/**
 * Create DeprecationError for deprecation
 */

function DeprecationError(namespace, message, stack) {
  var error = new Error()
  var stackString

  Object.defineProperty(error, 'constructor', {
    value: DeprecationError
  })

  Object.defineProperty(error, 'message', {
    configurable: true,
    enumerable: false,
    value: message,
    writable: true
  })

  Object.defineProperty(error, 'name', {
    enumerable: false,
    configurable: true,
    value: 'DeprecationError',
    writable: true
  })

  Object.defineProperty(error, 'namespace', {
    configurable: true,
    enumerable: false,
    value: namespace,
    writable: true
  })

  Object.defineProperty(error, 'stack', {
    configurable: true,
    enumerable: false,
    get: function () {
      if (stackString !== undefined) {
        return stackString
      }

      // prepare stack trace
      return stackString = createStackString.call(this, stack)
    },
    set: function setter(val) {
      stackString = val
    }
  })

  return error
}

}).call(this,require('_process'))
},{"./lib/compat":41,"_process":57,"events":54,"path":56}],39:[function(require,module,exports){
(function (Buffer){
/*!
 * depd
 * Copyright(c) 2014 Douglas Christopher Wilson
 * MIT Licensed
 */

/**
 * Module exports.
 */

module.exports = bufferConcat

/**
 * Concatenate an array of Buffers.
 */

function bufferConcat(bufs) {
  var length = 0

  for (var i = 0, len = bufs.length; i < len; i++) {
    length += bufs[i].length
  }

  var buf = new Buffer(length)
  var pos = 0

  for (var i = 0, len = bufs.length; i < len; i++) {
    bufs[i].copy(buf, pos)
    pos += bufs[i].length
  }

  return buf
}

}).call(this,require("buffer").Buffer)
},{"buffer":50}],40:[function(require,module,exports){
/*!
 * depd
 * Copyright(c) 2014 Douglas Christopher Wilson
 * MIT Licensed
 */

/**
 * Module exports.
 */

module.exports = callSiteToString

/**
 * Format a CallSite file location to a string.
 */

function callSiteFileLocation(callSite) {
  var fileName
  var fileLocation = ''

  if (callSite.isNative()) {
    fileLocation = 'native'
  } else if (callSite.isEval()) {
    fileName = callSite.getScriptNameOrSourceURL()
    if (!fileName) {
      fileLocation = callSite.getEvalOrigin()
    }
  } else {
    fileName = callSite.getFileName()
  }

  if (fileName) {
    fileLocation += fileName

    var lineNumber = callSite.getLineNumber()
    if (lineNumber != null) {
      fileLocation += ':' + lineNumber

      var columnNumber = callSite.getColumnNumber()
      if (columnNumber) {
        fileLocation += ':' + columnNumber
      }
    }
  }

  return fileLocation || 'unknown source'
}

/**
 * Format a CallSite to a string.
 */

function callSiteToString(callSite) {
  var addSuffix = true
  var fileLocation = callSiteFileLocation(callSite)
  var functionName = callSite.getFunctionName()
  var isConstructor = callSite.isConstructor()
  var isMethodCall = !(callSite.isToplevel() || isConstructor)
  var line = ''

  if (isMethodCall) {
    var methodName = callSite.getMethodName()
    var typeName = getConstructorName(callSite)

    if (functionName) {
      if (typeName && functionName.indexOf(typeName) !== 0) {
        line += typeName + '.'
      }

      line += functionName

      if (methodName && functionName.lastIndexOf('.' + methodName) !== functionName.length - methodName.length - 1) {
        line += ' [as ' + methodName + ']'
      }
    } else {
      line += typeName + '.' + (methodName || '<anonymous>')
    }
  } else if (isConstructor) {
    line += 'new ' + (functionName || '<anonymous>')
  } else if (functionName) {
    line += functionName
  } else {
    addSuffix = false
    line += fileLocation
  }

  if (addSuffix) {
    line += ' (' + fileLocation + ')'
  }

  return line
}

/**
 * Get constructor name of reviver.
 */

function getConstructorName(obj) {
  var receiver = obj.receiver
  return (receiver.constructor && receiver.constructor.name) || null
}

},{}],41:[function(require,module,exports){
(function (Buffer){
/*!
 * depd
 * Copyright(c) 2014 Douglas Christopher Wilson
 * MIT Licensed
 */

/**
 * Module exports.
 */

lazyProperty(module.exports, 'bufferConcat', function bufferConcat() {
  return Buffer.concat || require('./buffer-concat')
})

lazyProperty(module.exports, 'callSiteToString', function callSiteToString() {
  var limit = Error.stackTraceLimit
  var obj = {}
  var prep = Error.prepareStackTrace

  function prepareObjectStackTrace(obj, stack) {
    return stack
  }

  Error.prepareStackTrace = prepareObjectStackTrace
  Error.stackTraceLimit = 2

  // capture the stack
  Error.captureStackTrace(obj)

  // slice the stack
  var stack = obj.stack.slice()

  Error.prepareStackTrace = prep
  Error.stackTraceLimit = limit

  return stack[0].toString ? toString : require('./callsite-tostring')
})

/**
 * Define a lazy property.
 */

function lazyProperty(obj, prop, getter) {
  function get() {
    var val = getter()

    Object.defineProperty(obj, prop, {
      configurable: true,
      enumerable: true,
      value: val
    })

    return val
  }

  Object.defineProperty(obj, prop, {
    configurable: true,
    enumerable: true,
    get: get
  })
}

/**
 * Call toString() on the obj
 */

function toString(obj) {
  return obj.toString()
}

}).call(this,require("buffer").Buffer)
},{"./buffer-concat":39,"./callsite-tostring":40,"buffer":50}],42:[function(require,module,exports){
var b = require('ast-types').builders;
module.exports = function(scope) {
  return b.functionExpression(
  b.identifier('get'),
  [
    b.identifier('object'),
    b.identifier('property'),
    b.identifier('receiver')
  ],
  b.blockStatement([
    b.variableDeclaration(
      'var',
      [
        b.variableDeclarator(
          b.identifier('desc'),
          b.callExpression(
            b.memberExpression(
              b.identifier('Object'),
              b.identifier('getOwnPropertyDescriptor'),
              false
            ),
            [
              b.identifier('object'),
              b.identifier('property')
            ]
          )
        )
      ]
    ),
    b.ifStatement(
      b.binaryExpression(
        '===',
        b.identifier('desc'),
        b.unaryExpression(
          'void',
          b.literal(0),
          true
        )
      ),
      b.blockStatement([
        b.variableDeclaration(
          'var',
          [
            b.variableDeclarator(
              b.identifier('parent'),
              b.callExpression(
                b.memberExpression(
                  b.identifier('Object'),
                  b.identifier('getPrototypeOf'),
                  false
                ),
                [b.identifier('object')]
              )
            )
          ]
        ),
        b.ifStatement(
          b.binaryExpression(
            '===',
            b.identifier('parent'),
            b.literal(null)
          ),
          b.blockStatement([
            b.returnStatement(
              b.unaryExpression(
                'void',
                b.literal(0),
                true
              )
            )
          ]),
          b.blockStatement([
            b.returnStatement(
              b.callExpression(
                b.identifier('get'),
                [
                  b.identifier('parent'),
                  b.identifier('property'),
                  b.identifier('receiver')
                ]
              )
            )
          ])
        )
      ]),
      b.ifStatement(
        b.logicalExpression(
          '&&',
          b.binaryExpression(
            'in',
            b.literal('value'),
            b.identifier('desc')
          ),
          b.binaryExpression(
            'in',
            b.literal('writable'),
            b.identifier('desc')
          )
        ),
        b.blockStatement([
          b.returnStatement(
            b.memberExpression(
              b.identifier('desc'),
              b.identifier('value'),
              false
            )
          )
        ]),
        b.blockStatement([
          b.variableDeclaration(
            'var',
            [
              b.variableDeclarator(
                b.identifier('getter'),
                b.memberExpression(
                  b.identifier('desc'),
                  b.identifier('get'),
                  false
                )
              )
            ]
          ),
          b.ifStatement(
            b.binaryExpression(
              '===',
              b.identifier('getter'),
              b.unaryExpression(
                'void',
                b.literal(0),
                true
              )
            ),
            b.blockStatement([
              b.returnStatement(
                b.unaryExpression(
                  'void',
                  b.literal(0),
                  true
                )
              )
            ]),
            null
          ),
          b.returnStatement(
            b.callExpression(
              b.memberExpression(
                b.identifier('getter'),
                b.identifier('call'),
                false
              ),
              [b.identifier('receiver')]
            )
          )
        ])
      )
    )
  ]),
  false,
  false
)};

},{"ast-types":37}],43:[function(require,module,exports){
var b = require('ast-types').builders;
module.exports = function(scope) {
  return b.functionExpression(
  null,
  [b.identifier('array')],
  b.blockStatement([
    b.variableDeclaration(
      'var',
      [
        b.variableDeclarator(
          b.identifier('index'),
          b.literal(0)
        )
      ]
    ),
    b.returnStatement(
      b.objectExpression([
        b.property(
          'init',
          b.identifier('next'),
          b.functionExpression(
            null,
            [],
            b.blockStatement([
              b.ifStatement(
                b.binaryExpression(
                  '<',
                  b.identifier('index'),
                  b.memberExpression(
                    b.identifier('array'),
                    b.identifier('length'),
                    false
                  )
                ),
                b.blockStatement([
                  b.returnStatement(
                    b.objectExpression([
                      b.property(
                        'init',
                        b.identifier('done'),
                        b.literal(false)
                      ),
                      b.property(
                        'init',
                        b.identifier('value'),
                        b.memberExpression(
                          b.identifier('array'),
                          b.updateExpression(
                            '++',
                            b.identifier('index'),
                            false
                          ),
                          true
                        )
                      )
                    ])
                  )
                ]),
                b.blockStatement([
                  b.returnStatement(
                    b.objectExpression([
                      b.property(
                        'init',
                        b.identifier('done'),
                        b.literal(true)
                      ),
                      b.property(
                        'init',
                        b.identifier('value'),
                        b.unaryExpression(
                          'void',
                          b.literal(0),
                          true
                        )
                      )
                    ])
                  )
                ])
              )
            ]),
            false,
            false
          )
        )
      ])
    )
  ]),
  false,
  false
)};

},{"ast-types":37}],44:[function(require,module,exports){
var b = require('ast-types').builders;
module.exports = function(scope) {
  var getArrayIterator = require('..').getArrayIterator;

  return b.functionExpression(
  null,
  [b.identifier('iterable')],
  b.blockStatement([
    b.variableDeclaration(
      'var',
      [
        b.variableDeclarator(
          b.identifier('sym'),
          b.logicalExpression(
            '||',
            b.logicalExpression(
              '&&',
              b.binaryExpression(
                '===',
                b.unaryExpression(
                  'typeof',
                  b.identifier('Symbol'),
                  true
                ),
                b.literal('function')
              ),
              b.memberExpression(
                b.identifier('Symbol'),
                b.identifier('iterator'),
                false
              )
            ),
            b.literal('@@iterator')
          )
        )
      ]
    ),
    b.ifStatement(
      b.binaryExpression(
        '===',
        b.unaryExpression(
          'typeof',
          b.memberExpression(
            b.identifier('iterable'),
            b.identifier('sym'),
            true
          ),
          true
        ),
        b.literal('function')
      ),
      b.blockStatement([
        b.returnStatement(
          b.callExpression(
            b.memberExpression(
              b.identifier('iterable'),
              b.identifier('sym'),
              true
            ),
            []
          )
        )
      ]),
      b.ifStatement(
        b.logicalExpression(
          '||',
          b.binaryExpression(
            '===',
            b.unaryExpression(
              'typeof',
              b.identifier('iterable'),
              true
            ),
            b.literal('object')
          ),
          b.binaryExpression(
            '===',
            b.unaryExpression(
              'typeof',
              b.identifier('iterable'),
              true
            ),
            b.literal('function')
          )
        ),
        b.blockStatement([
          b.returnStatement(
            b.callExpression(
              getArrayIterator(scope),
              [b.identifier('iterable')]
            )
          )
        ]),
        b.blockStatement([
          b.throwStatement(
            b.newExpression(
              b.identifier('TypeError'),
              []
            )
          )
        ])
      )
    )
  ]),
  false,
  false
)};

},{"..":46,"ast-types":37}],45:[function(require,module,exports){
var b = require('ast-types').builders;
module.exports = function(scope) {
  return b.functionExpression(
  null,
  [
    b.identifier('iterator'),
    b.identifier('index'),
    b.identifier('begin'),
    b.identifier('len')
  ],
  b.blockStatement([
    b.ifStatement(
      b.binaryExpression(
        '>',
        b.identifier('index'),
        b.identifier('begin')
      ),
      b.blockStatement([
        b.throwStatement(
          b.newExpression(
            b.identifier('RangeError'),
            []
          )
        )
      ]),
      null
    ),
    b.ifStatement(
      b.binaryExpression(
        '===',
        b.unaryExpression(
          'typeof',
          b.identifier('len'),
          true
        ),
        b.literal('undefined')
      ),
      b.blockStatement([
        b.expressionStatement(
          b.assignmentExpression(
            '=',
            b.identifier('len'),
            b.identifier('Infinity')
          )
        )
      ]),
      null
    ),
    b.variableDeclaration(
      'var',
      [
        b.variableDeclarator(
          b.identifier('range'),
          b.arrayExpression([])
        ),
        b.variableDeclarator(
          b.identifier('end'),
          b.binaryExpression(
            '+',
            b.identifier('begin'),
            b.identifier('len')
          )
        )
      ]
    ),
    b.whileStatement(
      b.binaryExpression(
        '<',
        b.identifier('index'),
        b.identifier('end')
      ),
      b.blockStatement([
        b.variableDeclaration(
          'var',
          [
            b.variableDeclarator(
              b.identifier('next'),
              b.callExpression(
                b.memberExpression(
                  b.identifier('iterator'),
                  b.identifier('next'),
                  false
                ),
                []
              )
            )
          ]
        ),
        b.ifStatement(
          b.memberExpression(
            b.identifier('next'),
            b.identifier('done'),
            false
          ),
          b.blockStatement([b.breakStatement()]),
          null
        ),
        b.ifStatement(
          b.binaryExpression(
            '>=',
            b.identifier('index'),
            b.identifier('begin')
          ),
          b.blockStatement([
            b.expressionStatement(
              b.callExpression(
                b.memberExpression(
                  b.identifier('range'),
                  b.identifier('push'),
                  false
                ),
                [
                  b.memberExpression(
                    b.identifier('next'),
                    b.identifier('value'),
                    false
                  )
                ]
              )
            )
          ]),
          null
        ),
        b.expressionStatement(
          b.updateExpression(
            '++',
            b.identifier('index'),
            false
          )
        )
      ])
    ),
    b.returnStatement(
      b.objectExpression([
        b.property(
          'init',
          b.identifier('range'),
          b.identifier('range')
        ),
        b.property(
          'init',
          b.identifier('index'),
          b.identifier('index')
        )
      ])
    )
  ]),
  false,
  false
)};

},{"ast-types":37}],46:[function(require,module,exports){
/* jshint node:true, undef:true, unused:true */

var types = require('ast-types');
var b = types.builders;
var n = types.namedTypes;
var NodePath = types.NodePath;

var getSecret = require('private').makeAccessor();
var hasOwnProp = Object.prototype.hasOwnProperty;

var assert = require('assert');

/**
 * Re-export ast-types for ease of our users.
 */
exports.types = types;

/**
 * Export the Replacement helper for anything that needs to delay replacement.
 */
exports.Replacement = require('./replacement');

/**
 * Returns a call to `Array.prototype.slice` with `node` as the context and
 * `begin` and `end` as the arguments to `slice`.
 *
 * @param {Scope} scope
 * @param {Expression} node
 * @param {Expression|number=} begin
 * @param {Expression|number=} end
 * @return {CallExpression}
 */
function callArraySlice(scope, node, begin, end) {
  if (typeof begin === 'number') {
    begin = b.literal(begin);
  }

  if (typeof end === 'number') {
    end = b.literal(end);
  }

  var args = [];
  if (begin) { args.push(begin); }
  if (end) { args.push(end); }

  return callSharedMethodWithContext(
    scope,
    'Array.prototype.slice',
    node,
    args
  );
}
exports.callArraySlice = callArraySlice;

/**
 * Returns a call to `Function.prototype.bind` using either `call` or `apply`
 * depending on what the value of `args` is. If `args` is an expression then
 * `apply` is used. If `args` is an array of expressions, then `call`.
 *
 * @param {Scope} scope
 * @param {Expression} fn
 * @param {Expression} context
 * @param {Expression|Array.<Expression>} args
 * @return {CallExpression}
 */
function callFunctionBind(scope, fn, context, args) {
  var bind = sharedFor(scope, 'Function.prototype.bind');

  if (n.Expression.check(args)) {
    return b.callExpression(
      b.memberExpression(bind, b.identifier('apply'), false),
      [fn, b.callExpression(
        b.memberExpression(
          b.arrayExpression([context]),
          b.identifier('concat'),
          false
        ),
        [args]
      )]
    );
  } else {
    return b.callExpression(
      b.memberExpression(bind, b.identifier('call'), false),
      [fn, context].concat(args || [])
    );
  }
}
exports.callFunctionBind = callFunctionBind;

/**
 * Gets an iterator for the value representing the given expression.
 *
 * @param {Scope} scope
 * @param {Expression} expression
 * @return {CallExpression}
 */
function callGetIterator(scope, expression) {
  var getIterator = injectGetIteratorHelper(scope.getGlobalScope());
  return b.callExpression(getIterator, [expression]);
}
exports.callGetIterator = callGetIterator;

/**
 * Returns a reference to a shared function that implements the default
 * `@@iterator` for arrays.
 *
 * @private
 * @param {Scope} scope
 * @return {CallExpression}
 */
function getArrayIterator(scope) {
  return injectGetArrayIteratorHelper(scope.getGlobalScope());
}
exports.getArrayIterator = getArrayIterator;

/**
 * return a range of value from an iterator
 *
 * @param {Scope} scope
 * @param {Expression} iterator
 * @param {Literal} index
 * @param {Literal} begin
 * @param {Literal} len
 * @return {CallExpression}
 */
function callGetIteratorRange(scope, iterator, index, begin, len) {
  var getIteratorRange = injectGetIteratorRangeHelper(scope.getGlobalScope());
  return b.callExpression(getIteratorRange, [iterator, index, begin, len]);
}
exports.callGetIteratorRange = callGetIteratorRange;

/**
 * The [[Get]] internal method on objects.
 *
 * @param {Scope} scope
 * @param {Expression} object
 * @param {Expression} property
 * @param {Expression} receiver
 * @return {CallExpression}
 */
function callGet(scope, object, property, receiver) {
  var get = injectGetHelper(scope.getGlobalScope());
  return b.callExpression(get, [object, property, receiver]);
}
exports.callGet = callGet;

/**
 * Returns a call to `Object.getOwnPropertyDescriptor` with the given `object`
 * and `property`.
 *
 * @param {Scope} scope
 * @param {Expression} object
 * @param {Expression|string} property
 * @return {CallExpression}
 */
function callGetOwnPropertyDescriptor(scope, object, property) {
  if (typeof property === 'string') {
    property = b.literal(property);
  }

  return callSharedMethod(
    scope,
    'Object.getOwnPropertyDescriptor',
    [object, property]
  );
}
exports.callGetOwnPropertyDescriptor = callGetOwnPropertyDescriptor;

/**
 * Returns a call to `Object.getPrototypeOf` with the given `object`.
 *
 * @param {Scope} scope
 * @param {Expression} object
 * @return {CallExpression}
 */
function callGetPrototypeOf(scope, object) {
  return callSharedMethod(scope, 'Object.getPrototypeOf', [object]);
}
exports.callGetPrototypeOf = callGetPrototypeOf;

/**
 * Returns a call to `hasOwnProperty` with `node` as the context and `property`
 * as the property to check.
 *
 * @param {Scope} scope
 * @param {Expression} node
 * @param {Expression|string} property
 * @return {CallExpression}
 */
function callHasOwnProperty(scope, node, property) {
  if (typeof property === 'string') {
    property = b.literal(property);
  }

  return callSharedMethodWithContext(
    scope,
    'Object.prototype.hasOwnProperty',
    node,
    [property]
  );
}
exports.callHasOwnProperty = callHasOwnProperty;

/**
 * Returns a call to the given `callee` with `args` as the arguments. If
 * `callee` is a string then it is treated as a globally-accessible function
 * such as `Object.defineProperty` which will be stored in a unique temporary
 * variable. Subsequent calls to this function will re-use the same temporary
 * variable.
 *
 * @param {Scope} scope
 * @param {Expression|string} callee
 * @param {Array.<Expression>} args
 * @return {CallExpression}
 */
function callSharedMethod(scope, callee, args) {
  if (typeof callee === 'string') {
    callee = sharedFor(scope, callee);
  }

  return b.callExpression(callee, args);
}
exports.callSharedMethod = callSharedMethod;

/**
 * Returns a call to the given `callee` with `context` as the method context
 * and `args` as the arguments. If `callee` is a string then it is treated as a
 * globally-accessible function such as `Array.prototype.slice` which will be
 * stored in a unique temporary variable. Subsequent calls to this function
 * will re-use the same temporary variable.
 *
 * @param {Scope} scope
 * @param {Expression|string} callee
 * @param {Expression} context
 * @param {Array.<Expression>} args
 * @return {CallExpression}
 */
function callSharedMethodWithContext(scope, callee, context, args) {
  if (typeof callee === 'string') {
    callee = sharedFor(scope, callee);
  }

  return b.callExpression(
    b.memberExpression(callee, b.identifier('call'), false),
    [context].concat(args)
  );
}
exports.callSharedMethodWithContext = callSharedMethodWithContext;

/**
 * Gets a list of identifiers referencing global variables anywhere within the
 * given `ast`. Assuming the ast is for this code:
 *
 *   var a;
 *   function b(){ return c; }
 *   b(d);
 *
 * Then `getGlobals` will return two identifiers, `c` and `d`.
 *
 * @param {Node} ast
 * @return {Array.<Identifier>}
 */
function getGlobals(ast) {
  var globals = [];
  var seen = Object.create(null);

  types.visit(ast, {
    visitNode: function(path) {
      this.traverse(path);
      var node = path.value;

      if (isReference(path) && !path.scope.lookup(node.name)) {
        if (!(node.name in seen)) {
          seen[node.name] = true;
          globals.push(node);
        }
      }
    }
  });

  return globals;
}
exports.getGlobals = getGlobals;

/**
 * Generate a safe JavaScript identifier for the given string.
 *
 * @param {string} string
 * @return {string}
 * @private
 */
function identifierForString(string) {
  // TODO: Verify this regex.
  return string.replace(/[^\w\d\$_]/g, '$');
}

/**
 * Injects the 'get' pre-built helper.
 *
 * @param {Scope} scope
 * @return {Identifier}
 */
function injectGetHelper(scope) {
  return injectShared(
    scope,
    'get',
    function() {
      return require('./helpers/get')(scope);
    }
  );
}

/**
 * Injects the 'getArrayIterator' pre-built helper.
 *
 * @param {Scope} scope
 * @return {Identifier}
 */
function injectGetArrayIteratorHelper(scope) {
  return injectShared(
    scope,
    'getArrayIterator',
    function() {
      return require('./helpers/getArrayIterator')(scope);
    }
  );
}

/**
 * Injects the 'getIterator' pre-built helper.
 *
 * @param {Scope} scope
 * @return {Identifier}
 */
function injectGetIteratorHelper(scope) {
  return injectShared(
    scope,
    'getIterator',
    function() {
      return require('./helpers/getIterator')(scope);
    }
  );
}

/**
 * Injects the 'getIteratorRange' pre-built helper.
 *
 * @param {Scope} scope
 * @return {Identifier}
 */
function injectGetIteratorRangeHelper(scope) {
  return injectShared(
    scope,
    'getIteratorRange',
    function() {
      return require('./helpers/getIteratorRange')(scope);
    }
  );
}

/**
 * Injects a shared variable with a unique identifier. Only the first call with
 * the same `scope` and `name` will result in a variable declaration being
 * created. The `expression` passed in can either be an AST node or a function
 * to generate one. This function is generally used to inject repeatedly-used
 * values and prevent repeated execution.
 *
 * @param {Scope} scope
 * @param {string} name
 * @param {Expression|function(): Expression} expression
 * @return {Identifier}
 */
function injectShared(scope, name, expression) {
  var scopeSecret = getSecret(scope);

  if (!(name in scopeSecret)) {
    scopeSecret[name] = injectVariable(
      scope,
      uniqueIdentifier(scope, name),
      typeof expression === 'function' ?
        expression() :
        expression
    );
  }

  return scopeSecret[name];
}
exports.injectShared = injectShared;

/**
 * Injects a variable with the given `identifier` into the given `scope` as a
 * `var` declaration with an optional initial value.
 *
 * @param {Scope} scope
 * @param {Identifier} identifier
 * @param {Expression=} init
 * @return {Identifier} Returns the given `identifier`.
 */
function injectVariable(scope, identifier, init) {
  var bodyPath = scope.path.get('body');

  if (n.BlockStatement.check(bodyPath.value)) {
    bodyPath = bodyPath.get('body');
  }

  bodyPath.unshift(
    b.variableDeclaration(
      'var',
      [b.variableDeclarator(identifier, init || null)]
    )
  );

  // Ensure this identifier counts as used in this scope.
  var name = identifier.name;
  var bindings = scope.getBindings();
  if (!hasOwnProp.call(bindings, name)) {
    bindings[name] = [];
  }
  bindings[name].push(new NodePath(identifier));

  return identifier;
}
exports.injectVariable = injectVariable;

/**
 * Determines whether the given `path` is a value reference. For example, `a`
 * and `b` are references, but `c` is not:
 *
 *    a(b.c);
 *
 * Only identifiers count as references.
 *
 * @param {NodePath} path
 * @param {string=} name
 * @return {boolean}
 */
function isReference(path, name) {
  var node = path.value;
  assert.ok(n.Node.check(node));

  if (n.Identifier.check(node)) {
    if (name && node.name !== name) { return false; }

    var parent = path.parent.value;
    if (n.VariableDeclarator.check(parent)) {
      return parent.init === node;
    } else if (n.MemberExpression.check(parent)) {
      return parent.object === node || (
        parent.computed && parent.property === node
      );
    } else if (n.Function.check(parent)) {
      return parent.id !== node && !parent.params.some(function(param) {
        return param === node;
      });
    } else if (n.ClassDeclaration.check(parent) || n.ClassExpression.check(parent)) {
      return parent.id !== node;
    } else if (n.CatchClause.check(parent)) {
      return parent.param !== node;
    } else if (n.Property.check(parent)) {
      return parent.key !== node;
    } else if (n.MethodDefinition.check(parent)) {
      return parent.key !== node;
    } else if (n.ImportSpecifier.check(parent)) {
      return false;
    } else if (n.ImportDefaultSpecifier.check(parent)) {
      return false;
    } else if (n.ImportNamespaceSpecifier.check(parent)) {
      return false;
    } else if (n.LabeledStatement.check(parent)) {
      return false;
    } else {
      return true;
    }
  }

  return false;
}
exports.isReference = isReference;

/**
 * Determines whether the given `name` should be considered "used" in the given
 * `scope`. For a name to be used, it should either:
 *
 *   1. Be declared in this scope or a parent scope.
 *   2. Be referenced in this scope, a parent scope, or any child scopes.
 *
 * For example, `a`, `b`, and `d` are used in the global scope of this example
 * while `c` is not:
 *
 *   var a;
 *   function b() {}
 *
 *   try {
 *     a = b(d);
 *   } catch (c) {
 *   }
 *
 * @param {Scope} scope
 * @param {string} name
 * @return {boolean}
 */
function isUsed(scope, name) {
  if (scope.lookup(name)) {
    return true;
  }

  var globalScope = scope.getGlobalScope();
  var globalScopeSecret = getSecret(globalScope);

  if (!globalScopeSecret.globals) {
    globalScopeSecret.globals = getGlobals(globalScope.node);
  }

  return globalScopeSecret.globals.some(function(global) {
    return global.name === name;
  });
}
exports.isUsed = isUsed;

/**
 * Injects a shared variable by getting the named value from a dotted path. For
 * example, this will return an identifier that can be used in place of the
 * named expression:
 *
 *    sharedFor(scope, 'Object.defineProperty')
 *
 * Subsequent calls to `sharedFor` in the same scope will return the same
 * identifier.
 *
 * @param {Scope} scope
 * @param {string} name
 * @return {Identifier}
 */
function sharedFor(scope, name) {
  return injectShared(
    scope,
    name,
    function() {
      var parts = name.split('.');
      var result = b.identifier(parts[0]);

      for (var i = 1, length = parts.length; i < length; i++) {
        result = b.memberExpression(
          result,
          b.identifier(parts[i]),
          false
        );
      }

      return result;
    }
  );
}
exports.sharedFor = sharedFor;

/**
 * Generates an identifier guaranteed not to collide with any others in the
 * given `scope`. This function will also never generate the same identifier
 * twice for any `scope` whose global scope already got that identifier.
 *
 * Called in a scope with no global references and no variables, the first time
 * this function is called it will return an identifier named `$__0`.
 *
 * When called with a name that name will be used with a prefix, "$__", if
 * possible. If that name is already used then it will append incrementing
 * numbers until it finds a name that isn't used.
 *
 * @param {Scope} scope
 * @param {string=} name
 * @return {Identifier}
 * @see isUsed
 */
function uniqueIdentifier(scope, name) {
  var prefix = '$__' + identifierForString(name ? name : '');
  var globalScopeSecret = getSecret(scope.getGlobalScope());
  var n = globalScopeSecret.nextId || 0;
  var identifier = name ? prefix : null;

  while (!identifier || isUsed(scope, identifier)) {
    identifier = prefix + n;
    n++;
  }

  globalScopeSecret.nextId = n;

  return b.identifier(identifier);
}
exports.uniqueIdentifier = uniqueIdentifier;

},{"./helpers/get":42,"./helpers/getArrayIterator":43,"./helpers/getIterator":44,"./helpers/getIteratorRange":45,"./replacement":47,"assert":49,"ast-types":37,"private":63}],47:[function(require,module,exports){
/* jshint node:true, undef:true, unused:true */

/**
 * Represents a replacement of a node path with zero or more nodes.
 *
 * @constructor
 * @param {NodePath} nodePath
 * @param {Array.<Node>} nodes
 */
function Replacement(nodePath, nodes) {
  this.queue = [];
  if (nodePath && nodes) {
    this.queue.push([nodePath, nodes]);
  }
}

/**
 * Performs the replacement.
 */
Replacement.prototype.replace = function() {
  for (var i = 0, length = this.queue.length; i < length; i++) {
    var item = this.queue[i];
    item[0].replace.apply(item[0], item[1]);
  }
};

/**
 * Incorporates the replacements from the given Replacement into this one.
 *
 * @param {Replacement} anotherReplacement
 */
Replacement.prototype.and = function(anotherReplacement) {
  this.queue.push.apply(this.queue, anotherReplacement.queue);
  return this;
};

/**
 * Constructs a Replacement that, when run, will remove the node from the AST.
 *
 * @param {NodePath} nodePath
 * @returns {Replacement}
 */
Replacement.removes = function(nodePath) {
  return new Replacement(nodePath, []);
};

/**
 * Constructs a Replacement that, when run, will insert the given nodes after
 * the one in nodePath.
 *
 * @param {NodePath} nodePath
 * @param {Array.<Node>} nodes
 * @returns {Replacement}
 */
Replacement.adds = function(nodePath, nodes) {
  return new Replacement(nodePath, [nodePath.node].concat(nodes));
};

/**
 * Constructs a Replacement that, when run, swaps the node in nodePath with the
 * given node or nodes.
 *
 * @param {NodePath} nodePath
 * @param {Node|Array.<Node>} nodes
 */
Replacement.swaps = function(nodePath, nodes) {
  if ({}.toString.call(nodes) !== '[object Array]') {
    nodes = [nodes];
  }
  return new Replacement(nodePath, nodes);
};

/**
 * Build replacements for each of the items in nodePaths by passing them to the
 * given callback. If the callback returns null for a given node path then no
 * replacement will be created for that node.
 *
 * @param {Array.<NodePath>} nodePaths
 * @param {function(NodePath): ?Replacement} callback
 * @returns {Replacement}
 */
Replacement.map = function(nodePaths, callback) {
  var result = new Replacement();

  nodePaths.each(function(nodePath) {
    var replacement = callback(nodePath);
    if (replacement) {
      result.and(replacement);
    }
  });

  return result;
};

module.exports = Replacement;

},{}],48:[function(require,module,exports){

},{}],49:[function(require,module,exports){
// http://wiki.commonjs.org/wiki/Unit_Testing/1.0
//
// THIS IS NOT TESTED NOR LIKELY TO WORK OUTSIDE V8!
//
// Originally from narwhal.js (http://narwhaljs.org)
// Copyright (c) 2009 Thomas Robinson <280north.com>
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the 'Software'), to
// deal in the Software without restriction, including without limitation the
// rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
// sell copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN
// ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
// WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

// when used in node, this will actually load the util module we depend on
// versus loading the builtin util module as happens otherwise
// this is a bug in node module loading as far as I am concerned
var util = require('util/');

var pSlice = Array.prototype.slice;
var hasOwn = Object.prototype.hasOwnProperty;

// 1. The assert module provides functions that throw
// AssertionError's when particular conditions are not met. The
// assert module must conform to the following interface.

var assert = module.exports = ok;

// 2. The AssertionError is defined in assert.
// new assert.AssertionError({ message: message,
//                             actual: actual,
//                             expected: expected })

assert.AssertionError = function AssertionError(options) {
  this.name = 'AssertionError';
  this.actual = options.actual;
  this.expected = options.expected;
  this.operator = options.operator;
  if (options.message) {
    this.message = options.message;
    this.generatedMessage = false;
  } else {
    this.message = getMessage(this);
    this.generatedMessage = true;
  }
  var stackStartFunction = options.stackStartFunction || fail;

  if (Error.captureStackTrace) {
    Error.captureStackTrace(this, stackStartFunction);
  }
  else {
    // non v8 browsers so we can have a stacktrace
    var err = new Error();
    if (err.stack) {
      var out = err.stack;

      // try to strip useless frames
      var fn_name = stackStartFunction.name;
      var idx = out.indexOf('\n' + fn_name);
      if (idx >= 0) {
        // once we have located the function frame
        // we need to strip out everything before it (and its line)
        var next_line = out.indexOf('\n', idx + 1);
        out = out.substring(next_line + 1);
      }

      this.stack = out;
    }
  }
};

// assert.AssertionError instanceof Error
util.inherits(assert.AssertionError, Error);

function replacer(key, value) {
  if (util.isUndefined(value)) {
    return '' + value;
  }
  if (util.isNumber(value) && (isNaN(value) || !isFinite(value))) {
    return value.toString();
  }
  if (util.isFunction(value) || util.isRegExp(value)) {
    return value.toString();
  }
  return value;
}

function truncate(s, n) {
  if (util.isString(s)) {
    return s.length < n ? s : s.slice(0, n);
  } else {
    return s;
  }
}

function getMessage(self) {
  return truncate(JSON.stringify(self.actual, replacer), 128) + ' ' +
         self.operator + ' ' +
         truncate(JSON.stringify(self.expected, replacer), 128);
}

// At present only the three keys mentioned above are used and
// understood by the spec. Implementations or sub modules can pass
// other keys to the AssertionError's constructor - they will be
// ignored.

// 3. All of the following functions must throw an AssertionError
// when a corresponding condition is not met, with a message that
// may be undefined if not provided.  All assertion methods provide
// both the actual and expected values to the assertion error for
// display purposes.

function fail(actual, expected, message, operator, stackStartFunction) {
  throw new assert.AssertionError({
    message: message,
    actual: actual,
    expected: expected,
    operator: operator,
    stackStartFunction: stackStartFunction
  });
}

// EXTENSION! allows for well behaved errors defined elsewhere.
assert.fail = fail;

// 4. Pure assertion tests whether a value is truthy, as determined
// by !!guard.
// assert.ok(guard, message_opt);
// This statement is equivalent to assert.equal(true, !!guard,
// message_opt);. To test strictly for the value true, use
// assert.strictEqual(true, guard, message_opt);.

function ok(value, message) {
  if (!value) fail(value, true, message, '==', assert.ok);
}
assert.ok = ok;

// 5. The equality assertion tests shallow, coercive equality with
// ==.
// assert.equal(actual, expected, message_opt);

assert.equal = function equal(actual, expected, message) {
  if (actual != expected) fail(actual, expected, message, '==', assert.equal);
};

// 6. The non-equality assertion tests for whether two objects are not equal
// with != assert.notEqual(actual, expected, message_opt);

assert.notEqual = function notEqual(actual, expected, message) {
  if (actual == expected) {
    fail(actual, expected, message, '!=', assert.notEqual);
  }
};

// 7. The equivalence assertion tests a deep equality relation.
// assert.deepEqual(actual, expected, message_opt);

assert.deepEqual = function deepEqual(actual, expected, message) {
  if (!_deepEqual(actual, expected)) {
    fail(actual, expected, message, 'deepEqual', assert.deepEqual);
  }
};

function _deepEqual(actual, expected) {
  // 7.1. All identical values are equivalent, as determined by ===.
  if (actual === expected) {
    return true;

  } else if (util.isBuffer(actual) && util.isBuffer(expected)) {
    if (actual.length != expected.length) return false;

    for (var i = 0; i < actual.length; i++) {
      if (actual[i] !== expected[i]) return false;
    }

    return true;

  // 7.2. If the expected value is a Date object, the actual value is
  // equivalent if it is also a Date object that refers to the same time.
  } else if (util.isDate(actual) && util.isDate(expected)) {
    return actual.getTime() === expected.getTime();

  // 7.3 If the expected value is a RegExp object, the actual value is
  // equivalent if it is also a RegExp object with the same source and
  // properties (`global`, `multiline`, `lastIndex`, `ignoreCase`).
  } else if (util.isRegExp(actual) && util.isRegExp(expected)) {
    return actual.source === expected.source &&
           actual.global === expected.global &&
           actual.multiline === expected.multiline &&
           actual.lastIndex === expected.lastIndex &&
           actual.ignoreCase === expected.ignoreCase;

  // 7.4. Other pairs that do not both pass typeof value == 'object',
  // equivalence is determined by ==.
  } else if (!util.isObject(actual) && !util.isObject(expected)) {
    return actual == expected;

  // 7.5 For all other Object pairs, including Array objects, equivalence is
  // determined by having the same number of owned properties (as verified
  // with Object.prototype.hasOwnProperty.call), the same set of keys
  // (although not necessarily the same order), equivalent values for every
  // corresponding key, and an identical 'prototype' property. Note: this
  // accounts for both named and indexed properties on Arrays.
  } else {
    return objEquiv(actual, expected);
  }
}

function isArguments(object) {
  return Object.prototype.toString.call(object) == '[object Arguments]';
}

function objEquiv(a, b) {
  if (util.isNullOrUndefined(a) || util.isNullOrUndefined(b))
    return false;
  // an identical 'prototype' property.
  if (a.prototype !== b.prototype) return false;
  //~~~I've managed to break Object.keys through screwy arguments passing.
  //   Converting to array solves the problem.
  if (isArguments(a)) {
    if (!isArguments(b)) {
      return false;
    }
    a = pSlice.call(a);
    b = pSlice.call(b);
    return _deepEqual(a, b);
  }
  try {
    var ka = objectKeys(a),
        kb = objectKeys(b),
        key, i;
  } catch (e) {//happens when one is a string literal and the other isn't
    return false;
  }
  // having the same number of owned properties (keys incorporates
  // hasOwnProperty)
  if (ka.length != kb.length)
    return false;
  //the same set of keys (although not necessarily the same order),
  ka.sort();
  kb.sort();
  //~~~cheap key test
  for (i = ka.length - 1; i >= 0; i--) {
    if (ka[i] != kb[i])
      return false;
  }
  //equivalent values for every corresponding key, and
  //~~~possibly expensive deep test
  for (i = ka.length - 1; i >= 0; i--) {
    key = ka[i];
    if (!_deepEqual(a[key], b[key])) return false;
  }
  return true;
}

// 8. The non-equivalence assertion tests for any deep inequality.
// assert.notDeepEqual(actual, expected, message_opt);

assert.notDeepEqual = function notDeepEqual(actual, expected, message) {
  if (_deepEqual(actual, expected)) {
    fail(actual, expected, message, 'notDeepEqual', assert.notDeepEqual);
  }
};

// 9. The strict equality assertion tests strict equality, as determined by ===.
// assert.strictEqual(actual, expected, message_opt);

assert.strictEqual = function strictEqual(actual, expected, message) {
  if (actual !== expected) {
    fail(actual, expected, message, '===', assert.strictEqual);
  }
};

// 10. The strict non-equality assertion tests for strict inequality, as
// determined by !==.  assert.notStrictEqual(actual, expected, message_opt);

assert.notStrictEqual = function notStrictEqual(actual, expected, message) {
  if (actual === expected) {
    fail(actual, expected, message, '!==', assert.notStrictEqual);
  }
};

function expectedException(actual, expected) {
  if (!actual || !expected) {
    return false;
  }

  if (Object.prototype.toString.call(expected) == '[object RegExp]') {
    return expected.test(actual);
  } else if (actual instanceof expected) {
    return true;
  } else if (expected.call({}, actual) === true) {
    return true;
  }

  return false;
}

function _throws(shouldThrow, block, expected, message) {
  var actual;

  if (util.isString(expected)) {
    message = expected;
    expected = null;
  }

  try {
    block();
  } catch (e) {
    actual = e;
  }

  message = (expected && expected.name ? ' (' + expected.name + ').' : '.') +
            (message ? ' ' + message : '.');

  if (shouldThrow && !actual) {
    fail(actual, expected, 'Missing expected exception' + message);
  }

  if (!shouldThrow && expectedException(actual, expected)) {
    fail(actual, expected, 'Got unwanted exception' + message);
  }

  if ((shouldThrow && actual && expected &&
      !expectedException(actual, expected)) || (!shouldThrow && actual)) {
    throw actual;
  }
}

// 11. Expected to throw an error:
// assert.throws(block, Error_opt, message_opt);

assert.throws = function(block, /*optional*/error, /*optional*/message) {
  _throws.apply(this, [true].concat(pSlice.call(arguments)));
};

// EXTENSION! This is annoying to write outside this module.
assert.doesNotThrow = function(block, /*optional*/message) {
  _throws.apply(this, [false].concat(pSlice.call(arguments)));
};

assert.ifError = function(err) { if (err) {throw err;}};

var objectKeys = Object.keys || function (obj) {
  var keys = [];
  for (var key in obj) {
    if (hasOwn.call(obj, key)) keys.push(key);
  }
  return keys;
};

},{"util/":59}],50:[function(require,module,exports){
/*!
 * The buffer module from node.js, for the browser.
 *
 * @author   Feross Aboukhadijeh <feross@feross.org> <http://feross.org>
 * @license  MIT
 */

var base64 = require('base64-js')
var ieee754 = require('ieee754')
var isArray = require('is-array')

exports.Buffer = Buffer
exports.SlowBuffer = Buffer
exports.INSPECT_MAX_BYTES = 50
Buffer.poolSize = 8192 // not used by this implementation

var kMaxLength = 0x3fffffff

/**
 * If `Buffer.TYPED_ARRAY_SUPPORT`:
 *   === true    Use Uint8Array implementation (fastest)
 *   === false   Use Object implementation (most compatible, even IE6)
 *
 * Browsers that support typed arrays are IE 10+, Firefox 4+, Chrome 7+, Safari 5.1+,
 * Opera 11.6+, iOS 4.2+.
 *
 * Note:
 *
 * - Implementation must support adding new properties to `Uint8Array` instances.
 *   Firefox 4-29 lacked support, fixed in Firefox 30+.
 *   See: https://bugzilla.mozilla.org/show_bug.cgi?id=695438.
 *
 *  - Chrome 9-10 is missing the `TypedArray.prototype.subarray` function.
 *
 *  - IE10 has a broken `TypedArray.prototype.subarray` function which returns arrays of
 *    incorrect length in some situations.
 *
 * We detect these buggy browsers and set `Buffer.TYPED_ARRAY_SUPPORT` to `false` so they will
 * get the Object implementation, which is slower but will work correctly.
 */
Buffer.TYPED_ARRAY_SUPPORT = (function () {
  try {
    var buf = new ArrayBuffer(0)
    var arr = new Uint8Array(buf)
    arr.foo = function () { return 42 }
    return 42 === arr.foo() && // typed array instances can be augmented
        typeof arr.subarray === 'function' && // chrome 9-10 lack `subarray`
        new Uint8Array(1).subarray(1, 1).byteLength === 0 // ie10 has broken `subarray`
  } catch (e) {
    return false
  }
})()

/**
 * Class: Buffer
 * =============
 *
 * The Buffer constructor returns instances of `Uint8Array` that are augmented
 * with function properties for all the node `Buffer` API functions. We use
 * `Uint8Array` so that square bracket notation works as expected -- it returns
 * a single octet.
 *
 * By augmenting the instances, we can avoid modifying the `Uint8Array`
 * prototype.
 */
function Buffer (subject, encoding, noZero) {
  if (!(this instanceof Buffer))
    return new Buffer(subject, encoding, noZero)

  var type = typeof subject

  // Find the length
  var length
  if (type === 'number')
    length = subject > 0 ? subject >>> 0 : 0
  else if (type === 'string') {
    if (encoding === 'base64')
      subject = base64clean(subject)
    length = Buffer.byteLength(subject, encoding)
  } else if (type === 'object' && subject !== null) { // assume object is array-like
    if (subject.type === 'Buffer' && isArray(subject.data))
      subject = subject.data
    length = +subject.length > 0 ? Math.floor(+subject.length) : 0
  } else
    throw new TypeError('must start with number, buffer, array or string')

  if (this.length > kMaxLength)
    throw new RangeError('Attempt to allocate Buffer larger than maximum ' +
      'size: 0x' + kMaxLength.toString(16) + ' bytes')

  var buf
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    // Preferred: Return an augmented `Uint8Array` instance for best performance
    buf = Buffer._augment(new Uint8Array(length))
  } else {
    // Fallback: Return THIS instance of Buffer (created by `new`)
    buf = this
    buf.length = length
    buf._isBuffer = true
  }

  var i
  if (Buffer.TYPED_ARRAY_SUPPORT && typeof subject.byteLength === 'number') {
    // Speed optimization -- use set if we're copying from a typed array
    buf._set(subject)
  } else if (isArrayish(subject)) {
    // Treat array-ish objects as a byte array
    if (Buffer.isBuffer(subject)) {
      for (i = 0; i < length; i++)
        buf[i] = subject.readUInt8(i)
    } else {
      for (i = 0; i < length; i++)
        buf[i] = ((subject[i] % 256) + 256) % 256
    }
  } else if (type === 'string') {
    buf.write(subject, 0, encoding)
  } else if (type === 'number' && !Buffer.TYPED_ARRAY_SUPPORT && !noZero) {
    for (i = 0; i < length; i++) {
      buf[i] = 0
    }
  }

  return buf
}

Buffer.isBuffer = function (b) {
  return !!(b != null && b._isBuffer)
}

Buffer.compare = function (a, b) {
  if (!Buffer.isBuffer(a) || !Buffer.isBuffer(b))
    throw new TypeError('Arguments must be Buffers')

  var x = a.length
  var y = b.length
  for (var i = 0, len = Math.min(x, y); i < len && a[i] === b[i]; i++) {}
  if (i !== len) {
    x = a[i]
    y = b[i]
  }
  if (x < y) return -1
  if (y < x) return 1
  return 0
}

Buffer.isEncoding = function (encoding) {
  switch (String(encoding).toLowerCase()) {
    case 'hex':
    case 'utf8':
    case 'utf-8':
    case 'ascii':
    case 'binary':
    case 'base64':
    case 'raw':
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      return true
    default:
      return false
  }
}

Buffer.concat = function (list, totalLength) {
  if (!isArray(list)) throw new TypeError('Usage: Buffer.concat(list[, length])')

  if (list.length === 0) {
    return new Buffer(0)
  } else if (list.length === 1) {
    return list[0]
  }

  var i
  if (totalLength === undefined) {
    totalLength = 0
    for (i = 0; i < list.length; i++) {
      totalLength += list[i].length
    }
  }

  var buf = new Buffer(totalLength)
  var pos = 0
  for (i = 0; i < list.length; i++) {
    var item = list[i]
    item.copy(buf, pos)
    pos += item.length
  }
  return buf
}

Buffer.byteLength = function (str, encoding) {
  var ret
  str = str + ''
  switch (encoding || 'utf8') {
    case 'ascii':
    case 'binary':
    case 'raw':
      ret = str.length
      break
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      ret = str.length * 2
      break
    case 'hex':
      ret = str.length >>> 1
      break
    case 'utf8':
    case 'utf-8':
      ret = utf8ToBytes(str).length
      break
    case 'base64':
      ret = base64ToBytes(str).length
      break
    default:
      ret = str.length
  }
  return ret
}

// pre-set for values that may exist in the future
Buffer.prototype.length = undefined
Buffer.prototype.parent = undefined

// toString(encoding, start=0, end=buffer.length)
Buffer.prototype.toString = function (encoding, start, end) {
  var loweredCase = false

  start = start >>> 0
  end = end === undefined || end === Infinity ? this.length : end >>> 0

  if (!encoding) encoding = 'utf8'
  if (start < 0) start = 0
  if (end > this.length) end = this.length
  if (end <= start) return ''

  while (true) {
    switch (encoding) {
      case 'hex':
        return hexSlice(this, start, end)

      case 'utf8':
      case 'utf-8':
        return utf8Slice(this, start, end)

      case 'ascii':
        return asciiSlice(this, start, end)

      case 'binary':
        return binarySlice(this, start, end)

      case 'base64':
        return base64Slice(this, start, end)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return utf16leSlice(this, start, end)

      default:
        if (loweredCase)
          throw new TypeError('Unknown encoding: ' + encoding)
        encoding = (encoding + '').toLowerCase()
        loweredCase = true
    }
  }
}

Buffer.prototype.equals = function (b) {
  if(!Buffer.isBuffer(b)) throw new TypeError('Argument must be a Buffer')
  return Buffer.compare(this, b) === 0
}

Buffer.prototype.inspect = function () {
  var str = ''
  var max = exports.INSPECT_MAX_BYTES
  if (this.length > 0) {
    str = this.toString('hex', 0, max).match(/.{2}/g).join(' ')
    if (this.length > max)
      str += ' ... '
  }
  return '<Buffer ' + str + '>'
}

Buffer.prototype.compare = function (b) {
  if (!Buffer.isBuffer(b)) throw new TypeError('Argument must be a Buffer')
  return Buffer.compare(this, b)
}

// `get` will be removed in Node 0.13+
Buffer.prototype.get = function (offset) {
  console.log('.get() is deprecated. Access using array indexes instead.')
  return this.readUInt8(offset)
}

// `set` will be removed in Node 0.13+
Buffer.prototype.set = function (v, offset) {
  console.log('.set() is deprecated. Access using array indexes instead.')
  return this.writeUInt8(v, offset)
}

function hexWrite (buf, string, offset, length) {
  offset = Number(offset) || 0
  var remaining = buf.length - offset
  if (!length) {
    length = remaining
  } else {
    length = Number(length)
    if (length > remaining) {
      length = remaining
    }
  }

  // must be an even number of digits
  var strLen = string.length
  if (strLen % 2 !== 0) throw new Error('Invalid hex string')

  if (length > strLen / 2) {
    length = strLen / 2
  }
  for (var i = 0; i < length; i++) {
    var byte = parseInt(string.substr(i * 2, 2), 16)
    if (isNaN(byte)) throw new Error('Invalid hex string')
    buf[offset + i] = byte
  }
  return i
}

function utf8Write (buf, string, offset, length) {
  var charsWritten = blitBuffer(utf8ToBytes(string), buf, offset, length)
  return charsWritten
}

function asciiWrite (buf, string, offset, length) {
  var charsWritten = blitBuffer(asciiToBytes(string), buf, offset, length)
  return charsWritten
}

function binaryWrite (buf, string, offset, length) {
  return asciiWrite(buf, string, offset, length)
}

function base64Write (buf, string, offset, length) {
  var charsWritten = blitBuffer(base64ToBytes(string), buf, offset, length)
  return charsWritten
}

function utf16leWrite (buf, string, offset, length) {
  var charsWritten = blitBuffer(utf16leToBytes(string), buf, offset, length)
  return charsWritten
}

Buffer.prototype.write = function (string, offset, length, encoding) {
  // Support both (string, offset, length, encoding)
  // and the legacy (string, encoding, offset, length)
  if (isFinite(offset)) {
    if (!isFinite(length)) {
      encoding = length
      length = undefined
    }
  } else {  // legacy
    var swap = encoding
    encoding = offset
    offset = length
    length = swap
  }

  offset = Number(offset) || 0
  var remaining = this.length - offset
  if (!length) {
    length = remaining
  } else {
    length = Number(length)
    if (length > remaining) {
      length = remaining
    }
  }
  encoding = String(encoding || 'utf8').toLowerCase()

  var ret
  switch (encoding) {
    case 'hex':
      ret = hexWrite(this, string, offset, length)
      break
    case 'utf8':
    case 'utf-8':
      ret = utf8Write(this, string, offset, length)
      break
    case 'ascii':
      ret = asciiWrite(this, string, offset, length)
      break
    case 'binary':
      ret = binaryWrite(this, string, offset, length)
      break
    case 'base64':
      ret = base64Write(this, string, offset, length)
      break
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      ret = utf16leWrite(this, string, offset, length)
      break
    default:
      throw new TypeError('Unknown encoding: ' + encoding)
  }
  return ret
}

Buffer.prototype.toJSON = function () {
  return {
    type: 'Buffer',
    data: Array.prototype.slice.call(this._arr || this, 0)
  }
}

function base64Slice (buf, start, end) {
  if (start === 0 && end === buf.length) {
    return base64.fromByteArray(buf)
  } else {
    return base64.fromByteArray(buf.slice(start, end))
  }
}

function utf8Slice (buf, start, end) {
  var res = ''
  var tmp = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; i++) {
    if (buf[i] <= 0x7F) {
      res += decodeUtf8Char(tmp) + String.fromCharCode(buf[i])
      tmp = ''
    } else {
      tmp += '%' + buf[i].toString(16)
    }
  }

  return res + decodeUtf8Char(tmp)
}

function asciiSlice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; i++) {
    ret += String.fromCharCode(buf[i])
  }
  return ret
}

function binarySlice (buf, start, end) {
  return asciiSlice(buf, start, end)
}

function hexSlice (buf, start, end) {
  var len = buf.length

  if (!start || start < 0) start = 0
  if (!end || end < 0 || end > len) end = len

  var out = ''
  for (var i = start; i < end; i++) {
    out += toHex(buf[i])
  }
  return out
}

function utf16leSlice (buf, start, end) {
  var bytes = buf.slice(start, end)
  var res = ''
  for (var i = 0; i < bytes.length; i += 2) {
    res += String.fromCharCode(bytes[i] + bytes[i + 1] * 256)
  }
  return res
}

Buffer.prototype.slice = function (start, end) {
  var len = this.length
  start = ~~start
  end = end === undefined ? len : ~~end

  if (start < 0) {
    start += len;
    if (start < 0)
      start = 0
  } else if (start > len) {
    start = len
  }

  if (end < 0) {
    end += len
    if (end < 0)
      end = 0
  } else if (end > len) {
    end = len
  }

  if (end < start)
    end = start

  if (Buffer.TYPED_ARRAY_SUPPORT) {
    return Buffer._augment(this.subarray(start, end))
  } else {
    var sliceLen = end - start
    var newBuf = new Buffer(sliceLen, undefined, true)
    for (var i = 0; i < sliceLen; i++) {
      newBuf[i] = this[i + start]
    }
    return newBuf
  }
}

/*
 * Need to make sure that buffer isn't trying to write out of bounds.
 */
function checkOffset (offset, ext, length) {
  if ((offset % 1) !== 0 || offset < 0)
    throw new RangeError('offset is not uint')
  if (offset + ext > length)
    throw new RangeError('Trying to access beyond buffer length')
}

Buffer.prototype.readUInt8 = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 1, this.length)
  return this[offset]
}

Buffer.prototype.readUInt16LE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 2, this.length)
  return this[offset] | (this[offset + 1] << 8)
}

Buffer.prototype.readUInt16BE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 2, this.length)
  return (this[offset] << 8) | this[offset + 1]
}

Buffer.prototype.readUInt32LE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 4, this.length)

  return ((this[offset]) |
      (this[offset + 1] << 8) |
      (this[offset + 2] << 16)) +
      (this[offset + 3] * 0x1000000)
}

Buffer.prototype.readUInt32BE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 4, this.length)

  return (this[offset] * 0x1000000) +
      ((this[offset + 1] << 16) |
      (this[offset + 2] << 8) |
      this[offset + 3])
}

Buffer.prototype.readInt8 = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 1, this.length)
  if (!(this[offset] & 0x80))
    return (this[offset])
  return ((0xff - this[offset] + 1) * -1)
}

Buffer.prototype.readInt16LE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 2, this.length)
  var val = this[offset] | (this[offset + 1] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt16BE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 2, this.length)
  var val = this[offset + 1] | (this[offset] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt32LE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 4, this.length)

  return (this[offset]) |
      (this[offset + 1] << 8) |
      (this[offset + 2] << 16) |
      (this[offset + 3] << 24)
}

Buffer.prototype.readInt32BE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 4, this.length)

  return (this[offset] << 24) |
      (this[offset + 1] << 16) |
      (this[offset + 2] << 8) |
      (this[offset + 3])
}

Buffer.prototype.readFloatLE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, true, 23, 4)
}

Buffer.prototype.readFloatBE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, false, 23, 4)
}

Buffer.prototype.readDoubleLE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, true, 52, 8)
}

Buffer.prototype.readDoubleBE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, false, 52, 8)
}

function checkInt (buf, value, offset, ext, max, min) {
  if (!Buffer.isBuffer(buf)) throw new TypeError('buffer must be a Buffer instance')
  if (value > max || value < min) throw new TypeError('value is out of bounds')
  if (offset + ext > buf.length) throw new TypeError('index out of range')
}

Buffer.prototype.writeUInt8 = function (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert)
    checkInt(this, value, offset, 1, 0xff, 0)
  if (!Buffer.TYPED_ARRAY_SUPPORT) value = Math.floor(value)
  this[offset] = value
  return offset + 1
}

function objectWriteUInt16 (buf, value, offset, littleEndian) {
  if (value < 0) value = 0xffff + value + 1
  for (var i = 0, j = Math.min(buf.length - offset, 2); i < j; i++) {
    buf[offset + i] = (value & (0xff << (8 * (littleEndian ? i : 1 - i)))) >>>
      (littleEndian ? i : 1 - i) * 8
  }
}

Buffer.prototype.writeUInt16LE = function (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert)
    checkInt(this, value, offset, 2, 0xffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = value
    this[offset + 1] = (value >>> 8)
  } else objectWriteUInt16(this, value, offset, true)
  return offset + 2
}

Buffer.prototype.writeUInt16BE = function (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert)
    checkInt(this, value, offset, 2, 0xffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 8)
    this[offset + 1] = value
  } else objectWriteUInt16(this, value, offset, false)
  return offset + 2
}

function objectWriteUInt32 (buf, value, offset, littleEndian) {
  if (value < 0) value = 0xffffffff + value + 1
  for (var i = 0, j = Math.min(buf.length - offset, 4); i < j; i++) {
    buf[offset + i] = (value >>> (littleEndian ? i : 3 - i) * 8) & 0xff
  }
}

Buffer.prototype.writeUInt32LE = function (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert)
    checkInt(this, value, offset, 4, 0xffffffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset + 3] = (value >>> 24)
    this[offset + 2] = (value >>> 16)
    this[offset + 1] = (value >>> 8)
    this[offset] = value
  } else objectWriteUInt32(this, value, offset, true)
  return offset + 4
}

Buffer.prototype.writeUInt32BE = function (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert)
    checkInt(this, value, offset, 4, 0xffffffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 24)
    this[offset + 1] = (value >>> 16)
    this[offset + 2] = (value >>> 8)
    this[offset + 3] = value
  } else objectWriteUInt32(this, value, offset, false)
  return offset + 4
}

Buffer.prototype.writeInt8 = function (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert)
    checkInt(this, value, offset, 1, 0x7f, -0x80)
  if (!Buffer.TYPED_ARRAY_SUPPORT) value = Math.floor(value)
  if (value < 0) value = 0xff + value + 1
  this[offset] = value
  return offset + 1
}

Buffer.prototype.writeInt16LE = function (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert)
    checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = value
    this[offset + 1] = (value >>> 8)
  } else objectWriteUInt16(this, value, offset, true)
  return offset + 2
}

Buffer.prototype.writeInt16BE = function (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert)
    checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 8)
    this[offset + 1] = value
  } else objectWriteUInt16(this, value, offset, false)
  return offset + 2
}

Buffer.prototype.writeInt32LE = function (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert)
    checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = value
    this[offset + 1] = (value >>> 8)
    this[offset + 2] = (value >>> 16)
    this[offset + 3] = (value >>> 24)
  } else objectWriteUInt32(this, value, offset, true)
  return offset + 4
}

Buffer.prototype.writeInt32BE = function (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert)
    checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  if (value < 0) value = 0xffffffff + value + 1
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 24)
    this[offset + 1] = (value >>> 16)
    this[offset + 2] = (value >>> 8)
    this[offset + 3] = value
  } else objectWriteUInt32(this, value, offset, false)
  return offset + 4
}

function checkIEEE754 (buf, value, offset, ext, max, min) {
  if (value > max || value < min) throw new TypeError('value is out of bounds')
  if (offset + ext > buf.length) throw new TypeError('index out of range')
}

function writeFloat (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert)
    checkIEEE754(buf, value, offset, 4, 3.4028234663852886e+38, -3.4028234663852886e+38)
  ieee754.write(buf, value, offset, littleEndian, 23, 4)
  return offset + 4
}

Buffer.prototype.writeFloatLE = function (value, offset, noAssert) {
  return writeFloat(this, value, offset, true, noAssert)
}

Buffer.prototype.writeFloatBE = function (value, offset, noAssert) {
  return writeFloat(this, value, offset, false, noAssert)
}

function writeDouble (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert)
    checkIEEE754(buf, value, offset, 8, 1.7976931348623157E+308, -1.7976931348623157E+308)
  ieee754.write(buf, value, offset, littleEndian, 52, 8)
  return offset + 8
}

Buffer.prototype.writeDoubleLE = function (value, offset, noAssert) {
  return writeDouble(this, value, offset, true, noAssert)
}

Buffer.prototype.writeDoubleBE = function (value, offset, noAssert) {
  return writeDouble(this, value, offset, false, noAssert)
}

// copy(targetBuffer, targetStart=0, sourceStart=0, sourceEnd=buffer.length)
Buffer.prototype.copy = function (target, target_start, start, end) {
  var source = this

  if (!start) start = 0
  if (!end && end !== 0) end = this.length
  if (!target_start) target_start = 0

  // Copy 0 bytes; we're done
  if (end === start) return
  if (target.length === 0 || source.length === 0) return

  // Fatal error conditions
  if (end < start) throw new TypeError('sourceEnd < sourceStart')
  if (target_start < 0 || target_start >= target.length)
    throw new TypeError('targetStart out of bounds')
  if (start < 0 || start >= source.length) throw new TypeError('sourceStart out of bounds')
  if (end < 0 || end > source.length) throw new TypeError('sourceEnd out of bounds')

  // Are we oob?
  if (end > this.length)
    end = this.length
  if (target.length - target_start < end - start)
    end = target.length - target_start + start

  var len = end - start

  if (len < 100 || !Buffer.TYPED_ARRAY_SUPPORT) {
    for (var i = 0; i < len; i++) {
      target[i + target_start] = this[i + start]
    }
  } else {
    target._set(this.subarray(start, start + len), target_start)
  }
}

// fill(value, start=0, end=buffer.length)
Buffer.prototype.fill = function (value, start, end) {
  if (!value) value = 0
  if (!start) start = 0
  if (!end) end = this.length

  if (end < start) throw new TypeError('end < start')

  // Fill 0 bytes; we're done
  if (end === start) return
  if (this.length === 0) return

  if (start < 0 || start >= this.length) throw new TypeError('start out of bounds')
  if (end < 0 || end > this.length) throw new TypeError('end out of bounds')

  var i
  if (typeof value === 'number') {
    for (i = start; i < end; i++) {
      this[i] = value
    }
  } else {
    var bytes = utf8ToBytes(value.toString())
    var len = bytes.length
    for (i = start; i < end; i++) {
      this[i] = bytes[i % len]
    }
  }

  return this
}

/**
 * Creates a new `ArrayBuffer` with the *copied* memory of the buffer instance.
 * Added in Node 0.12. Only available in browsers that support ArrayBuffer.
 */
Buffer.prototype.toArrayBuffer = function () {
  if (typeof Uint8Array !== 'undefined') {
    if (Buffer.TYPED_ARRAY_SUPPORT) {
      return (new Buffer(this)).buffer
    } else {
      var buf = new Uint8Array(this.length)
      for (var i = 0, len = buf.length; i < len; i += 1) {
        buf[i] = this[i]
      }
      return buf.buffer
    }
  } else {
    throw new TypeError('Buffer.toArrayBuffer not supported in this browser')
  }
}

// HELPER FUNCTIONS
// ================

var BP = Buffer.prototype

/**
 * Augment a Uint8Array *instance* (not the Uint8Array class!) with Buffer methods
 */
Buffer._augment = function (arr) {
  arr._isBuffer = true

  // save reference to original Uint8Array get/set methods before overwriting
  arr._get = arr.get
  arr._set = arr.set

  // deprecated, will be removed in node 0.13+
  arr.get = BP.get
  arr.set = BP.set

  arr.write = BP.write
  arr.toString = BP.toString
  arr.toLocaleString = BP.toString
  arr.toJSON = BP.toJSON
  arr.equals = BP.equals
  arr.compare = BP.compare
  arr.copy = BP.copy
  arr.slice = BP.slice
  arr.readUInt8 = BP.readUInt8
  arr.readUInt16LE = BP.readUInt16LE
  arr.readUInt16BE = BP.readUInt16BE
  arr.readUInt32LE = BP.readUInt32LE
  arr.readUInt32BE = BP.readUInt32BE
  arr.readInt8 = BP.readInt8
  arr.readInt16LE = BP.readInt16LE
  arr.readInt16BE = BP.readInt16BE
  arr.readInt32LE = BP.readInt32LE
  arr.readInt32BE = BP.readInt32BE
  arr.readFloatLE = BP.readFloatLE
  arr.readFloatBE = BP.readFloatBE
  arr.readDoubleLE = BP.readDoubleLE
  arr.readDoubleBE = BP.readDoubleBE
  arr.writeUInt8 = BP.writeUInt8
  arr.writeUInt16LE = BP.writeUInt16LE
  arr.writeUInt16BE = BP.writeUInt16BE
  arr.writeUInt32LE = BP.writeUInt32LE
  arr.writeUInt32BE = BP.writeUInt32BE
  arr.writeInt8 = BP.writeInt8
  arr.writeInt16LE = BP.writeInt16LE
  arr.writeInt16BE = BP.writeInt16BE
  arr.writeInt32LE = BP.writeInt32LE
  arr.writeInt32BE = BP.writeInt32BE
  arr.writeFloatLE = BP.writeFloatLE
  arr.writeFloatBE = BP.writeFloatBE
  arr.writeDoubleLE = BP.writeDoubleLE
  arr.writeDoubleBE = BP.writeDoubleBE
  arr.fill = BP.fill
  arr.inspect = BP.inspect
  arr.toArrayBuffer = BP.toArrayBuffer

  return arr
}

var INVALID_BASE64_RE = /[^+\/0-9A-z]/g

function base64clean (str) {
  // Node strips out invalid characters like \n and \t from the string, base64-js does not
  str = stringtrim(str).replace(INVALID_BASE64_RE, '')
  // Node allows for non-padded base64 strings (missing trailing ===), base64-js does not
  while (str.length % 4 !== 0) {
    str = str + '='
  }
  return str
}

function stringtrim (str) {
  if (str.trim) return str.trim()
  return str.replace(/^\s+|\s+$/g, '')
}

function isArrayish (subject) {
  return isArray(subject) || Buffer.isBuffer(subject) ||
      subject && typeof subject === 'object' &&
      typeof subject.length === 'number'
}

function toHex (n) {
  if (n < 16) return '0' + n.toString(16)
  return n.toString(16)
}

function utf8ToBytes (str) {
  var byteArray = []
  for (var i = 0; i < str.length; i++) {
    var b = str.charCodeAt(i)
    if (b <= 0x7F) {
      byteArray.push(b)
    } else {
      var start = i
      if (b >= 0xD800 && b <= 0xDFFF) i++
      var h = encodeURIComponent(str.slice(start, i+1)).substr(1).split('%')
      for (var j = 0; j < h.length; j++) {
        byteArray.push(parseInt(h[j], 16))
      }
    }
  }
  return byteArray
}

function asciiToBytes (str) {
  var byteArray = []
  for (var i = 0; i < str.length; i++) {
    // Node's code seems to be doing this and not & 0x7F..
    byteArray.push(str.charCodeAt(i) & 0xFF)
  }
  return byteArray
}

function utf16leToBytes (str) {
  var c, hi, lo
  var byteArray = []
  for (var i = 0; i < str.length; i++) {
    c = str.charCodeAt(i)
    hi = c >> 8
    lo = c % 256
    byteArray.push(lo)
    byteArray.push(hi)
  }

  return byteArray
}

function base64ToBytes (str) {
  return base64.toByteArray(str)
}

function blitBuffer (src, dst, offset, length) {
  for (var i = 0; i < length; i++) {
    if ((i + offset >= dst.length) || (i >= src.length))
      break
    dst[i + offset] = src[i]
  }
  return i
}

function decodeUtf8Char (str) {
  try {
    return decodeURIComponent(str)
  } catch (err) {
    return String.fromCharCode(0xFFFD) // UTF 8 invalid char
  }
}

},{"base64-js":51,"ieee754":52,"is-array":53}],51:[function(require,module,exports){
var lookup = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

;(function (exports) {
	'use strict';

  var Arr = (typeof Uint8Array !== 'undefined')
    ? Uint8Array
    : Array

	var PLUS   = '+'.charCodeAt(0)
	var SLASH  = '/'.charCodeAt(0)
	var NUMBER = '0'.charCodeAt(0)
	var LOWER  = 'a'.charCodeAt(0)
	var UPPER  = 'A'.charCodeAt(0)

	function decode (elt) {
		var code = elt.charCodeAt(0)
		if (code === PLUS)
			return 62 // '+'
		if (code === SLASH)
			return 63 // '/'
		if (code < NUMBER)
			return -1 //no match
		if (code < NUMBER + 10)
			return code - NUMBER + 26 + 26
		if (code < UPPER + 26)
			return code - UPPER
		if (code < LOWER + 26)
			return code - LOWER + 26
	}

	function b64ToByteArray (b64) {
		var i, j, l, tmp, placeHolders, arr

		if (b64.length % 4 > 0) {
			throw new Error('Invalid string. Length must be a multiple of 4')
		}

		// the number of equal signs (place holders)
		// if there are two placeholders, than the two characters before it
		// represent one byte
		// if there is only one, then the three characters before it represent 2 bytes
		// this is just a cheap hack to not do indexOf twice
		var len = b64.length
		placeHolders = '=' === b64.charAt(len - 2) ? 2 : '=' === b64.charAt(len - 1) ? 1 : 0

		// base64 is 4/3 + up to two characters of the original data
		arr = new Arr(b64.length * 3 / 4 - placeHolders)

		// if there are placeholders, only get up to the last complete 4 chars
		l = placeHolders > 0 ? b64.length - 4 : b64.length

		var L = 0

		function push (v) {
			arr[L++] = v
		}

		for (i = 0, j = 0; i < l; i += 4, j += 3) {
			tmp = (decode(b64.charAt(i)) << 18) | (decode(b64.charAt(i + 1)) << 12) | (decode(b64.charAt(i + 2)) << 6) | decode(b64.charAt(i + 3))
			push((tmp & 0xFF0000) >> 16)
			push((tmp & 0xFF00) >> 8)
			push(tmp & 0xFF)
		}

		if (placeHolders === 2) {
			tmp = (decode(b64.charAt(i)) << 2) | (decode(b64.charAt(i + 1)) >> 4)
			push(tmp & 0xFF)
		} else if (placeHolders === 1) {
			tmp = (decode(b64.charAt(i)) << 10) | (decode(b64.charAt(i + 1)) << 4) | (decode(b64.charAt(i + 2)) >> 2)
			push((tmp >> 8) & 0xFF)
			push(tmp & 0xFF)
		}

		return arr
	}

	function uint8ToBase64 (uint8) {
		var i,
			extraBytes = uint8.length % 3, // if we have 1 byte left, pad 2 bytes
			output = "",
			temp, length

		function encode (num) {
			return lookup.charAt(num)
		}

		function tripletToBase64 (num) {
			return encode(num >> 18 & 0x3F) + encode(num >> 12 & 0x3F) + encode(num >> 6 & 0x3F) + encode(num & 0x3F)
		}

		// go through the array every three bytes, we'll deal with trailing stuff later
		for (i = 0, length = uint8.length - extraBytes; i < length; i += 3) {
			temp = (uint8[i] << 16) + (uint8[i + 1] << 8) + (uint8[i + 2])
			output += tripletToBase64(temp)
		}

		// pad the end with zeros, but make sure to not forget the extra bytes
		switch (extraBytes) {
			case 1:
				temp = uint8[uint8.length - 1]
				output += encode(temp >> 2)
				output += encode((temp << 4) & 0x3F)
				output += '=='
				break
			case 2:
				temp = (uint8[uint8.length - 2] << 8) + (uint8[uint8.length - 1])
				output += encode(temp >> 10)
				output += encode((temp >> 4) & 0x3F)
				output += encode((temp << 2) & 0x3F)
				output += '='
				break
		}

		return output
	}

	exports.toByteArray = b64ToByteArray
	exports.fromByteArray = uint8ToBase64
}(typeof exports === 'undefined' ? (this.base64js = {}) : exports))

},{}],52:[function(require,module,exports){
exports.read = function(buffer, offset, isLE, mLen, nBytes) {
  var e, m,
      eLen = nBytes * 8 - mLen - 1,
      eMax = (1 << eLen) - 1,
      eBias = eMax >> 1,
      nBits = -7,
      i = isLE ? (nBytes - 1) : 0,
      d = isLE ? -1 : 1,
      s = buffer[offset + i];

  i += d;

  e = s & ((1 << (-nBits)) - 1);
  s >>= (-nBits);
  nBits += eLen;
  for (; nBits > 0; e = e * 256 + buffer[offset + i], i += d, nBits -= 8);

  m = e & ((1 << (-nBits)) - 1);
  e >>= (-nBits);
  nBits += mLen;
  for (; nBits > 0; m = m * 256 + buffer[offset + i], i += d, nBits -= 8);

  if (e === 0) {
    e = 1 - eBias;
  } else if (e === eMax) {
    return m ? NaN : ((s ? -1 : 1) * Infinity);
  } else {
    m = m + Math.pow(2, mLen);
    e = e - eBias;
  }
  return (s ? -1 : 1) * m * Math.pow(2, e - mLen);
};

exports.write = function(buffer, value, offset, isLE, mLen, nBytes) {
  var e, m, c,
      eLen = nBytes * 8 - mLen - 1,
      eMax = (1 << eLen) - 1,
      eBias = eMax >> 1,
      rt = (mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0),
      i = isLE ? 0 : (nBytes - 1),
      d = isLE ? 1 : -1,
      s = value < 0 || (value === 0 && 1 / value < 0) ? 1 : 0;

  value = Math.abs(value);

  if (isNaN(value) || value === Infinity) {
    m = isNaN(value) ? 1 : 0;
    e = eMax;
  } else {
    e = Math.floor(Math.log(value) / Math.LN2);
    if (value * (c = Math.pow(2, -e)) < 1) {
      e--;
      c *= 2;
    }
    if (e + eBias >= 1) {
      value += rt / c;
    } else {
      value += rt * Math.pow(2, 1 - eBias);
    }
    if (value * c >= 2) {
      e++;
      c /= 2;
    }

    if (e + eBias >= eMax) {
      m = 0;
      e = eMax;
    } else if (e + eBias >= 1) {
      m = (value * c - 1) * Math.pow(2, mLen);
      e = e + eBias;
    } else {
      m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen);
      e = 0;
    }
  }

  for (; mLen >= 8; buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8);

  e = (e << mLen) | m;
  eLen += mLen;
  for (; eLen > 0; buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8);

  buffer[offset + i - d] |= s * 128;
};

},{}],53:[function(require,module,exports){

/**
 * isArray
 */

var isArray = Array.isArray;

/**
 * toString
 */

var str = Object.prototype.toString;

/**
 * Whether or not the given `val`
 * is an array.
 *
 * example:
 *
 *        isArray([]);
 *        // > true
 *        isArray(arguments);
 *        // > false
 *        isArray('');
 *        // > false
 *
 * @param {mixed} val
 * @return {bool}
 */

module.exports = isArray || function (val) {
  return !! val && '[object Array]' == str.call(val);
};

},{}],54:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

function EventEmitter() {
  this._events = this._events || {};
  this._maxListeners = this._maxListeners || undefined;
}
module.exports = EventEmitter;

// Backwards-compat with node 0.10.x
EventEmitter.EventEmitter = EventEmitter;

EventEmitter.prototype._events = undefined;
EventEmitter.prototype._maxListeners = undefined;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
EventEmitter.defaultMaxListeners = 10;

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
EventEmitter.prototype.setMaxListeners = function(n) {
  if (!isNumber(n) || n < 0 || isNaN(n))
    throw TypeError('n must be a positive number');
  this._maxListeners = n;
  return this;
};

EventEmitter.prototype.emit = function(type) {
  var er, handler, len, args, i, listeners;

  if (!this._events)
    this._events = {};

  // If there is no 'error' event listener then throw.
  if (type === 'error') {
    if (!this._events.error ||
        (isObject(this._events.error) && !this._events.error.length)) {
      er = arguments[1];
      if (er instanceof Error) {
        throw er; // Unhandled 'error' event
      }
      throw TypeError('Uncaught, unspecified "error" event.');
    }
  }

  handler = this._events[type];

  if (isUndefined(handler))
    return false;

  if (isFunction(handler)) {
    switch (arguments.length) {
      // fast cases
      case 1:
        handler.call(this);
        break;
      case 2:
        handler.call(this, arguments[1]);
        break;
      case 3:
        handler.call(this, arguments[1], arguments[2]);
        break;
      // slower
      default:
        len = arguments.length;
        args = new Array(len - 1);
        for (i = 1; i < len; i++)
          args[i - 1] = arguments[i];
        handler.apply(this, args);
    }
  } else if (isObject(handler)) {
    len = arguments.length;
    args = new Array(len - 1);
    for (i = 1; i < len; i++)
      args[i - 1] = arguments[i];

    listeners = handler.slice();
    len = listeners.length;
    for (i = 0; i < len; i++)
      listeners[i].apply(this, args);
  }

  return true;
};

EventEmitter.prototype.addListener = function(type, listener) {
  var m;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events)
    this._events = {};

  // To avoid recursion in the case that type === "newListener"! Before
  // adding it to the listeners, first emit "newListener".
  if (this._events.newListener)
    this.emit('newListener', type,
              isFunction(listener.listener) ?
              listener.listener : listener);

  if (!this._events[type])
    // Optimize the case of one listener. Don't need the extra array object.
    this._events[type] = listener;
  else if (isObject(this._events[type]))
    // If we've already got an array, just append.
    this._events[type].push(listener);
  else
    // Adding the second element, need to change to array.
    this._events[type] = [this._events[type], listener];

  // Check for listener leak
  if (isObject(this._events[type]) && !this._events[type].warned) {
    var m;
    if (!isUndefined(this._maxListeners)) {
      m = this._maxListeners;
    } else {
      m = EventEmitter.defaultMaxListeners;
    }

    if (m && m > 0 && this._events[type].length > m) {
      this._events[type].warned = true;
      console.error('(node) warning: possible EventEmitter memory ' +
                    'leak detected. %d listeners added. ' +
                    'Use emitter.setMaxListeners() to increase limit.',
                    this._events[type].length);
      if (typeof console.trace === 'function') {
        // not supported in IE 10
        console.trace();
      }
    }
  }

  return this;
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.once = function(type, listener) {
  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  var fired = false;

  function g() {
    this.removeListener(type, g);

    if (!fired) {
      fired = true;
      listener.apply(this, arguments);
    }
  }

  g.listener = listener;
  this.on(type, g);

  return this;
};

// emits a 'removeListener' event iff the listener was removed
EventEmitter.prototype.removeListener = function(type, listener) {
  var list, position, length, i;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events || !this._events[type])
    return this;

  list = this._events[type];
  length = list.length;
  position = -1;

  if (list === listener ||
      (isFunction(list.listener) && list.listener === listener)) {
    delete this._events[type];
    if (this._events.removeListener)
      this.emit('removeListener', type, listener);

  } else if (isObject(list)) {
    for (i = length; i-- > 0;) {
      if (list[i] === listener ||
          (list[i].listener && list[i].listener === listener)) {
        position = i;
        break;
      }
    }

    if (position < 0)
      return this;

    if (list.length === 1) {
      list.length = 0;
      delete this._events[type];
    } else {
      list.splice(position, 1);
    }

    if (this._events.removeListener)
      this.emit('removeListener', type, listener);
  }

  return this;
};

EventEmitter.prototype.removeAllListeners = function(type) {
  var key, listeners;

  if (!this._events)
    return this;

  // not listening for removeListener, no need to emit
  if (!this._events.removeListener) {
    if (arguments.length === 0)
      this._events = {};
    else if (this._events[type])
      delete this._events[type];
    return this;
  }

  // emit removeListener for all listeners on all events
  if (arguments.length === 0) {
    for (key in this._events) {
      if (key === 'removeListener') continue;
      this.removeAllListeners(key);
    }
    this.removeAllListeners('removeListener');
    this._events = {};
    return this;
  }

  listeners = this._events[type];

  if (isFunction(listeners)) {
    this.removeListener(type, listeners);
  } else {
    // LIFO order
    while (listeners.length)
      this.removeListener(type, listeners[listeners.length - 1]);
  }
  delete this._events[type];

  return this;
};

EventEmitter.prototype.listeners = function(type) {
  var ret;
  if (!this._events || !this._events[type])
    ret = [];
  else if (isFunction(this._events[type]))
    ret = [this._events[type]];
  else
    ret = this._events[type].slice();
  return ret;
};

EventEmitter.listenerCount = function(emitter, type) {
  var ret;
  if (!emitter._events || !emitter._events[type])
    ret = 0;
  else if (isFunction(emitter._events[type]))
    ret = 1;
  else
    ret = emitter._events[type].length;
  return ret;
};

function isFunction(arg) {
  return typeof arg === 'function';
}

function isNumber(arg) {
  return typeof arg === 'number';
}

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}

function isUndefined(arg) {
  return arg === void 0;
}

},{}],55:[function(require,module,exports){
if (typeof Object.create === 'function') {
  // implementation from standard node.js 'util' module
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    ctor.prototype = Object.create(superCtor.prototype, {
      constructor: {
        value: ctor,
        enumerable: false,
        writable: true,
        configurable: true
      }
    });
  };
} else {
  // old school shim for old browsers
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    var TempCtor = function () {}
    TempCtor.prototype = superCtor.prototype
    ctor.prototype = new TempCtor()
    ctor.prototype.constructor = ctor
  }
}

},{}],56:[function(require,module,exports){
(function (process){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

// resolves . and .. elements in a path array with directory names there
// must be no slashes, empty elements, or device names (c:\) in the array
// (so also no leading and trailing slashes - it does not distinguish
// relative and absolute paths)
function normalizeArray(parts, allowAboveRoot) {
  // if the path tries to go above the root, `up` ends up > 0
  var up = 0;
  for (var i = parts.length - 1; i >= 0; i--) {
    var last = parts[i];
    if (last === '.') {
      parts.splice(i, 1);
    } else if (last === '..') {
      parts.splice(i, 1);
      up++;
    } else if (up) {
      parts.splice(i, 1);
      up--;
    }
  }

  // if the path is allowed to go above the root, restore leading ..s
  if (allowAboveRoot) {
    for (; up--; up) {
      parts.unshift('..');
    }
  }

  return parts;
}

// Split a filename into [root, dir, basename, ext], unix version
// 'root' is just a slash, or nothing.
var splitPathRe =
    /^(\/?|)([\s\S]*?)((?:\.{1,2}|[^\/]+?|)(\.[^.\/]*|))(?:[\/]*)$/;
var splitPath = function(filename) {
  return splitPathRe.exec(filename).slice(1);
};

// path.resolve([from ...], to)
// posix version
exports.resolve = function() {
  var resolvedPath = '',
      resolvedAbsolute = false;

  for (var i = arguments.length - 1; i >= -1 && !resolvedAbsolute; i--) {
    var path = (i >= 0) ? arguments[i] : process.cwd();

    // Skip empty and invalid entries
    if (typeof path !== 'string') {
      throw new TypeError('Arguments to path.resolve must be strings');
    } else if (!path) {
      continue;
    }

    resolvedPath = path + '/' + resolvedPath;
    resolvedAbsolute = path.charAt(0) === '/';
  }

  // At this point the path should be resolved to a full absolute path, but
  // handle relative paths to be safe (might happen when process.cwd() fails)

  // Normalize the path
  resolvedPath = normalizeArray(filter(resolvedPath.split('/'), function(p) {
    return !!p;
  }), !resolvedAbsolute).join('/');

  return ((resolvedAbsolute ? '/' : '') + resolvedPath) || '.';
};

// path.normalize(path)
// posix version
exports.normalize = function(path) {
  var isAbsolute = exports.isAbsolute(path),
      trailingSlash = substr(path, -1) === '/';

  // Normalize the path
  path = normalizeArray(filter(path.split('/'), function(p) {
    return !!p;
  }), !isAbsolute).join('/');

  if (!path && !isAbsolute) {
    path = '.';
  }
  if (path && trailingSlash) {
    path += '/';
  }

  return (isAbsolute ? '/' : '') + path;
};

// posix version
exports.isAbsolute = function(path) {
  return path.charAt(0) === '/';
};

// posix version
exports.join = function() {
  var paths = Array.prototype.slice.call(arguments, 0);
  return exports.normalize(filter(paths, function(p, index) {
    if (typeof p !== 'string') {
      throw new TypeError('Arguments to path.join must be strings');
    }
    return p;
  }).join('/'));
};


// path.relative(from, to)
// posix version
exports.relative = function(from, to) {
  from = exports.resolve(from).substr(1);
  to = exports.resolve(to).substr(1);

  function trim(arr) {
    var start = 0;
    for (; start < arr.length; start++) {
      if (arr[start] !== '') break;
    }

    var end = arr.length - 1;
    for (; end >= 0; end--) {
      if (arr[end] !== '') break;
    }

    if (start > end) return [];
    return arr.slice(start, end - start + 1);
  }

  var fromParts = trim(from.split('/'));
  var toParts = trim(to.split('/'));

  var length = Math.min(fromParts.length, toParts.length);
  var samePartsLength = length;
  for (var i = 0; i < length; i++) {
    if (fromParts[i] !== toParts[i]) {
      samePartsLength = i;
      break;
    }
  }

  var outputParts = [];
  for (var i = samePartsLength; i < fromParts.length; i++) {
    outputParts.push('..');
  }

  outputParts = outputParts.concat(toParts.slice(samePartsLength));

  return outputParts.join('/');
};

exports.sep = '/';
exports.delimiter = ':';

exports.dirname = function(path) {
  var result = splitPath(path),
      root = result[0],
      dir = result[1];

  if (!root && !dir) {
    // No dirname whatsoever
    return '.';
  }

  if (dir) {
    // It has a dirname, strip trailing slash
    dir = dir.substr(0, dir.length - 1);
  }

  return root + dir;
};


exports.basename = function(path, ext) {
  var f = splitPath(path)[2];
  // TODO: make this comparison case-insensitive on windows?
  if (ext && f.substr(-1 * ext.length) === ext) {
    f = f.substr(0, f.length - ext.length);
  }
  return f;
};


exports.extname = function(path) {
  return splitPath(path)[3];
};

function filter (xs, f) {
    if (xs.filter) return xs.filter(f);
    var res = [];
    for (var i = 0; i < xs.length; i++) {
        if (f(xs[i], i, xs)) res.push(xs[i]);
    }
    return res;
}

// String.prototype.substr - negative index don't work in IE8
var substr = 'ab'.substr(-1) === 'b'
    ? function (str, start, len) { return str.substr(start, len) }
    : function (str, start, len) {
        if (start < 0) start = str.length + start;
        return str.substr(start, len);
    }
;

}).call(this,require('_process'))
},{"_process":57}],57:[function(require,module,exports){
// shim for using process in browser

var process = module.exports = {};

process.nextTick = (function () {
    var canSetImmediate = typeof window !== 'undefined'
    && window.setImmediate;
    var canPost = typeof window !== 'undefined'
    && window.postMessage && window.addEventListener
    ;

    if (canSetImmediate) {
        return function (f) { return window.setImmediate(f) };
    }

    if (canPost) {
        var queue = [];
        window.addEventListener('message', function (ev) {
            var source = ev.source;
            if ((source === window || source === null) && ev.data === 'process-tick') {
                ev.stopPropagation();
                if (queue.length > 0) {
                    var fn = queue.shift();
                    fn();
                }
            }
        }, true);

        return function nextTick(fn) {
            queue.push(fn);
            window.postMessage('process-tick', '*');
        };
    }

    return function nextTick(fn) {
        setTimeout(fn, 0);
    };
})();

process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;

process.binding = function (name) {
    throw new Error('process.binding is not supported');
}

// TODO(shtylman)
process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};

},{}],58:[function(require,module,exports){
module.exports = function isBuffer(arg) {
  return arg && typeof arg === 'object'
    && typeof arg.copy === 'function'
    && typeof arg.fill === 'function'
    && typeof arg.readUInt8 === 'function';
}
},{}],59:[function(require,module,exports){
(function (process,global){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

var formatRegExp = /%[sdj%]/g;
exports.format = function(f) {
  if (!isString(f)) {
    var objects = [];
    for (var i = 0; i < arguments.length; i++) {
      objects.push(inspect(arguments[i]));
    }
    return objects.join(' ');
  }

  var i = 1;
  var args = arguments;
  var len = args.length;
  var str = String(f).replace(formatRegExp, function(x) {
    if (x === '%%') return '%';
    if (i >= len) return x;
    switch (x) {
      case '%s': return String(args[i++]);
      case '%d': return Number(args[i++]);
      case '%j':
        try {
          return JSON.stringify(args[i++]);
        } catch (_) {
          return '[Circular]';
        }
      default:
        return x;
    }
  });
  for (var x = args[i]; i < len; x = args[++i]) {
    if (isNull(x) || !isObject(x)) {
      str += ' ' + x;
    } else {
      str += ' ' + inspect(x);
    }
  }
  return str;
};


// Mark that a method should not be used.
// Returns a modified function which warns once by default.
// If --no-deprecation is set, then it is a no-op.
exports.deprecate = function(fn, msg) {
  // Allow for deprecating things in the process of starting up.
  if (isUndefined(global.process)) {
    return function() {
      return exports.deprecate(fn, msg).apply(this, arguments);
    };
  }

  if (process.noDeprecation === true) {
    return fn;
  }

  var warned = false;
  function deprecated() {
    if (!warned) {
      if (process.throwDeprecation) {
        throw new Error(msg);
      } else if (process.traceDeprecation) {
        console.trace(msg);
      } else {
        console.error(msg);
      }
      warned = true;
    }
    return fn.apply(this, arguments);
  }

  return deprecated;
};


var debugs = {};
var debugEnviron;
exports.debuglog = function(set) {
  if (isUndefined(debugEnviron))
    debugEnviron = process.env.NODE_DEBUG || '';
  set = set.toUpperCase();
  if (!debugs[set]) {
    if (new RegExp('\\b' + set + '\\b', 'i').test(debugEnviron)) {
      var pid = process.pid;
      debugs[set] = function() {
        var msg = exports.format.apply(exports, arguments);
        console.error('%s %d: %s', set, pid, msg);
      };
    } else {
      debugs[set] = function() {};
    }
  }
  return debugs[set];
};


/**
 * Echos the value of a value. Trys to print the value out
 * in the best way possible given the different types.
 *
 * @param {Object} obj The object to print out.
 * @param {Object} opts Optional options object that alters the output.
 */
/* legacy: obj, showHidden, depth, colors*/
function inspect(obj, opts) {
  // default options
  var ctx = {
    seen: [],
    stylize: stylizeNoColor
  };
  // legacy...
  if (arguments.length >= 3) ctx.depth = arguments[2];
  if (arguments.length >= 4) ctx.colors = arguments[3];
  if (isBoolean(opts)) {
    // legacy...
    ctx.showHidden = opts;
  } else if (opts) {
    // got an "options" object
    exports._extend(ctx, opts);
  }
  // set default options
  if (isUndefined(ctx.showHidden)) ctx.showHidden = false;
  if (isUndefined(ctx.depth)) ctx.depth = 2;
  if (isUndefined(ctx.colors)) ctx.colors = false;
  if (isUndefined(ctx.customInspect)) ctx.customInspect = true;
  if (ctx.colors) ctx.stylize = stylizeWithColor;
  return formatValue(ctx, obj, ctx.depth);
}
exports.inspect = inspect;


// http://en.wikipedia.org/wiki/ANSI_escape_code#graphics
inspect.colors = {
  'bold' : [1, 22],
  'italic' : [3, 23],
  'underline' : [4, 24],
  'inverse' : [7, 27],
  'white' : [37, 39],
  'grey' : [90, 39],
  'black' : [30, 39],
  'blue' : [34, 39],
  'cyan' : [36, 39],
  'green' : [32, 39],
  'magenta' : [35, 39],
  'red' : [31, 39],
  'yellow' : [33, 39]
};

// Don't use 'blue' not visible on cmd.exe
inspect.styles = {
  'special': 'cyan',
  'number': 'yellow',
  'boolean': 'yellow',
  'undefined': 'grey',
  'null': 'bold',
  'string': 'green',
  'date': 'magenta',
  // "name": intentionally not styling
  'regexp': 'red'
};


function stylizeWithColor(str, styleType) {
  var style = inspect.styles[styleType];

  if (style) {
    return '\u001b[' + inspect.colors[style][0] + 'm' + str +
           '\u001b[' + inspect.colors[style][1] + 'm';
  } else {
    return str;
  }
}


function stylizeNoColor(str, styleType) {
  return str;
}


function arrayToHash(array) {
  var hash = {};

  array.forEach(function(val, idx) {
    hash[val] = true;
  });

  return hash;
}


function formatValue(ctx, value, recurseTimes) {
  // Provide a hook for user-specified inspect functions.
  // Check that value is an object with an inspect function on it
  if (ctx.customInspect &&
      value &&
      isFunction(value.inspect) &&
      // Filter out the util module, it's inspect function is special
      value.inspect !== exports.inspect &&
      // Also filter out any prototype objects using the circular check.
      !(value.constructor && value.constructor.prototype === value)) {
    var ret = value.inspect(recurseTimes, ctx);
    if (!isString(ret)) {
      ret = formatValue(ctx, ret, recurseTimes);
    }
    return ret;
  }

  // Primitive types cannot have properties
  var primitive = formatPrimitive(ctx, value);
  if (primitive) {
    return primitive;
  }

  // Look up the keys of the object.
  var keys = Object.keys(value);
  var visibleKeys = arrayToHash(keys);

  if (ctx.showHidden) {
    keys = Object.getOwnPropertyNames(value);
  }

  // IE doesn't make error fields non-enumerable
  // http://msdn.microsoft.com/en-us/library/ie/dww52sbt(v=vs.94).aspx
  if (isError(value)
      && (keys.indexOf('message') >= 0 || keys.indexOf('description') >= 0)) {
    return formatError(value);
  }

  // Some type of object without properties can be shortcutted.
  if (keys.length === 0) {
    if (isFunction(value)) {
      var name = value.name ? ': ' + value.name : '';
      return ctx.stylize('[Function' + name + ']', 'special');
    }
    if (isRegExp(value)) {
      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
    }
    if (isDate(value)) {
      return ctx.stylize(Date.prototype.toString.call(value), 'date');
    }
    if (isError(value)) {
      return formatError(value);
    }
  }

  var base = '', array = false, braces = ['{', '}'];

  // Make Array say that they are Array
  if (isArray(value)) {
    array = true;
    braces = ['[', ']'];
  }

  // Make functions say that they are functions
  if (isFunction(value)) {
    var n = value.name ? ': ' + value.name : '';
    base = ' [Function' + n + ']';
  }

  // Make RegExps say that they are RegExps
  if (isRegExp(value)) {
    base = ' ' + RegExp.prototype.toString.call(value);
  }

  // Make dates with properties first say the date
  if (isDate(value)) {
    base = ' ' + Date.prototype.toUTCString.call(value);
  }

  // Make error with message first say the error
  if (isError(value)) {
    base = ' ' + formatError(value);
  }

  if (keys.length === 0 && (!array || value.length == 0)) {
    return braces[0] + base + braces[1];
  }

  if (recurseTimes < 0) {
    if (isRegExp(value)) {
      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
    } else {
      return ctx.stylize('[Object]', 'special');
    }
  }

  ctx.seen.push(value);

  var output;
  if (array) {
    output = formatArray(ctx, value, recurseTimes, visibleKeys, keys);
  } else {
    output = keys.map(function(key) {
      return formatProperty(ctx, value, recurseTimes, visibleKeys, key, array);
    });
  }

  ctx.seen.pop();

  return reduceToSingleString(output, base, braces);
}


function formatPrimitive(ctx, value) {
  if (isUndefined(value))
    return ctx.stylize('undefined', 'undefined');
  if (isString(value)) {
    var simple = '\'' + JSON.stringify(value).replace(/^"|"$/g, '')
                                             .replace(/'/g, "\\'")
                                             .replace(/\\"/g, '"') + '\'';
    return ctx.stylize(simple, 'string');
  }
  if (isNumber(value))
    return ctx.stylize('' + value, 'number');
  if (isBoolean(value))
    return ctx.stylize('' + value, 'boolean');
  // For some reason typeof null is "object", so special case here.
  if (isNull(value))
    return ctx.stylize('null', 'null');
}


function formatError(value) {
  return '[' + Error.prototype.toString.call(value) + ']';
}


function formatArray(ctx, value, recurseTimes, visibleKeys, keys) {
  var output = [];
  for (var i = 0, l = value.length; i < l; ++i) {
    if (hasOwnProperty(value, String(i))) {
      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
          String(i), true));
    } else {
      output.push('');
    }
  }
  keys.forEach(function(key) {
    if (!key.match(/^\d+$/)) {
      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
          key, true));
    }
  });
  return output;
}


function formatProperty(ctx, value, recurseTimes, visibleKeys, key, array) {
  var name, str, desc;
  desc = Object.getOwnPropertyDescriptor(value, key) || { value: value[key] };
  if (desc.get) {
    if (desc.set) {
      str = ctx.stylize('[Getter/Setter]', 'special');
    } else {
      str = ctx.stylize('[Getter]', 'special');
    }
  } else {
    if (desc.set) {
      str = ctx.stylize('[Setter]', 'special');
    }
  }
  if (!hasOwnProperty(visibleKeys, key)) {
    name = '[' + key + ']';
  }
  if (!str) {
    if (ctx.seen.indexOf(desc.value) < 0) {
      if (isNull(recurseTimes)) {
        str = formatValue(ctx, desc.value, null);
      } else {
        str = formatValue(ctx, desc.value, recurseTimes - 1);
      }
      if (str.indexOf('\n') > -1) {
        if (array) {
          str = str.split('\n').map(function(line) {
            return '  ' + line;
          }).join('\n').substr(2);
        } else {
          str = '\n' + str.split('\n').map(function(line) {
            return '   ' + line;
          }).join('\n');
        }
      }
    } else {
      str = ctx.stylize('[Circular]', 'special');
    }
  }
  if (isUndefined(name)) {
    if (array && key.match(/^\d+$/)) {
      return str;
    }
    name = JSON.stringify('' + key);
    if (name.match(/^"([a-zA-Z_][a-zA-Z_0-9]*)"$/)) {
      name = name.substr(1, name.length - 2);
      name = ctx.stylize(name, 'name');
    } else {
      name = name.replace(/'/g, "\\'")
                 .replace(/\\"/g, '"')
                 .replace(/(^"|"$)/g, "'");
      name = ctx.stylize(name, 'string');
    }
  }

  return name + ': ' + str;
}


function reduceToSingleString(output, base, braces) {
  var numLinesEst = 0;
  var length = output.reduce(function(prev, cur) {
    numLinesEst++;
    if (cur.indexOf('\n') >= 0) numLinesEst++;
    return prev + cur.replace(/\u001b\[\d\d?m/g, '').length + 1;
  }, 0);

  if (length > 60) {
    return braces[0] +
           (base === '' ? '' : base + '\n ') +
           ' ' +
           output.join(',\n  ') +
           ' ' +
           braces[1];
  }

  return braces[0] + base + ' ' + output.join(', ') + ' ' + braces[1];
}


// NOTE: These type checking functions intentionally don't use `instanceof`
// because it is fragile and can be easily faked with `Object.create()`.
function isArray(ar) {
  return Array.isArray(ar);
}
exports.isArray = isArray;

function isBoolean(arg) {
  return typeof arg === 'boolean';
}
exports.isBoolean = isBoolean;

function isNull(arg) {
  return arg === null;
}
exports.isNull = isNull;

function isNullOrUndefined(arg) {
  return arg == null;
}
exports.isNullOrUndefined = isNullOrUndefined;

function isNumber(arg) {
  return typeof arg === 'number';
}
exports.isNumber = isNumber;

function isString(arg) {
  return typeof arg === 'string';
}
exports.isString = isString;

function isSymbol(arg) {
  return typeof arg === 'symbol';
}
exports.isSymbol = isSymbol;

function isUndefined(arg) {
  return arg === void 0;
}
exports.isUndefined = isUndefined;

function isRegExp(re) {
  return isObject(re) && objectToString(re) === '[object RegExp]';
}
exports.isRegExp = isRegExp;

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}
exports.isObject = isObject;

function isDate(d) {
  return isObject(d) && objectToString(d) === '[object Date]';
}
exports.isDate = isDate;

function isError(e) {
  return isObject(e) &&
      (objectToString(e) === '[object Error]' || e instanceof Error);
}
exports.isError = isError;

function isFunction(arg) {
  return typeof arg === 'function';
}
exports.isFunction = isFunction;

function isPrimitive(arg) {
  return arg === null ||
         typeof arg === 'boolean' ||
         typeof arg === 'number' ||
         typeof arg === 'string' ||
         typeof arg === 'symbol' ||  // ES6 symbol
         typeof arg === 'undefined';
}
exports.isPrimitive = isPrimitive;

exports.isBuffer = require('./support/isBuffer');

function objectToString(o) {
  return Object.prototype.toString.call(o);
}


function pad(n) {
  return n < 10 ? '0' + n.toString(10) : n.toString(10);
}


var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep',
              'Oct', 'Nov', 'Dec'];

// 26 Feb 16:19:34
function timestamp() {
  var d = new Date();
  var time = [pad(d.getHours()),
              pad(d.getMinutes()),
              pad(d.getSeconds())].join(':');
  return [d.getDate(), months[d.getMonth()], time].join(' ');
}


// log is just a thin wrapper to console.log that prepends a timestamp
exports.log = function() {
  console.log('%s - %s', timestamp(), exports.format.apply(exports, arguments));
};


/**
 * Inherit the prototype methods from one constructor into another.
 *
 * The Function.prototype.inherits from lang.js rewritten as a standalone
 * function (not on Function.prototype). NOTE: If this file is to be loaded
 * during bootstrapping this function needs to be rewritten using some native
 * functions as prototype setup using normal JavaScript does not work as
 * expected during bootstrapping (see mirror.js in r114903).
 *
 * @param {function} ctor Constructor function which needs to inherit the
 *     prototype.
 * @param {function} superCtor Constructor function to inherit prototype from.
 */
exports.inherits = require('inherits');

exports._extend = function(origin, add) {
  // Don't do anything if add isn't an object
  if (!add || !isObject(add)) return origin;

  var keys = Object.keys(add);
  var i = keys.length;
  while (i--) {
    origin[keys[i]] = add[keys[i]];
  }
  return origin;
};

function hasOwnProperty(obj, prop) {
  return Object.prototype.hasOwnProperty.call(obj, prop);
}

}).call(this,require('_process'),typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./support/isBuffer":58,"_process":57,"inherits":55}],60:[function(require,module,exports){
/*
  Copyright (C) 2013 Ariya Hidayat <ariya.hidayat@gmail.com>
  Copyright (C) 2013 Thaddee Tyl <thaddee.tyl@gmail.com>
  Copyright (C) 2012 Ariya Hidayat <ariya.hidayat@gmail.com>
  Copyright (C) 2012 Mathias Bynens <mathias@qiwi.be>
  Copyright (C) 2012 Joost-Wim Boekesteijn <joost-wim@boekesteijn.nl>
  Copyright (C) 2012 Kris Kowal <kris.kowal@cixar.com>
  Copyright (C) 2012 Yusuke Suzuki <utatane.tea@gmail.com>
  Copyright (C) 2012 Arpad Borsos <arpad.borsos@googlemail.com>
  Copyright (C) 2011 Ariya Hidayat <ariya.hidayat@gmail.com>

  Redistribution and use in source and binary forms, with or without
  modification, are permitted provided that the following conditions are met:

    * Redistributions of source code must retain the above copyright
      notice, this list of conditions and the following disclaimer.
    * Redistributions in binary form must reproduce the above copyright
      notice, this list of conditions and the following disclaimer in the
      documentation and/or other materials provided with the distribution.

  THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
  AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
  IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
  ARE DISCLAIMED. IN NO EVENT SHALL <COPYRIGHT HOLDER> BE LIABLE FOR ANY
  DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
  (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
  LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
  ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
  (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF
  THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
*/

/*jslint bitwise:true plusplus:true */
/*global esprima:true, define:true, exports:true, window: true,
throwError: true, generateStatement: true, peek: true,
parseAssignmentExpression: true, parseBlock: true,
parseClassExpression: true, parseClassDeclaration: true, parseExpression: true,
parseForStatement: true,
parseFunctionDeclaration: true, parseFunctionExpression: true,
parseFunctionSourceElements: true, parseVariableIdentifier: true,
parseImportSpecifier: true,
parseLeftHandSideExpression: true, parseParams: true, validateParam: true,
parseSpreadOrAssignmentExpression: true,
parseStatement: true, parseSourceElement: true, parseConciseBody: true,
advanceXJSChild: true, isXJSIdentifierStart: true, isXJSIdentifierPart: true,
scanXJSStringLiteral: true, scanXJSIdentifier: true,
parseXJSAttributeValue: true, parseXJSChild: true, parseXJSElement: true, parseXJSExpressionContainer: true, parseXJSEmptyExpression: true,
parseTypeAnnotation: true, parseTypeAnnotatableIdentifier: true,
parseYieldExpression: true, parseAwaitExpression: true
*/

(function (root, factory) {
    'use strict';

    // Universal Module Definition (UMD) to support AMD, CommonJS/Node.js,
    // Rhino, and plain browser loading.
    if (typeof define === 'function' && define.amd) {
        define(['exports'], factory);
    } else if (typeof exports !== 'undefined') {
        factory(exports);
    } else {
        factory((root.esprima = {}));
    }
}(this, function (exports) {
    'use strict';

    var Token,
        TokenName,
        FnExprTokens,
        Syntax,
        PropertyKind,
        Messages,
        Regex,
        SyntaxTreeDelegate,
        XHTMLEntities,
        ClassPropertyType,
        source,
        strict,
        index,
        lineNumber,
        lineStart,
        length,
        delegate,
        lookahead,
        state,
        extra;

    Token = {
        BooleanLiteral: 1,
        EOF: 2,
        Identifier: 3,
        Keyword: 4,
        NullLiteral: 5,
        NumericLiteral: 6,
        Punctuator: 7,
        StringLiteral: 8,
        RegularExpression: 9,
        Template: 10,
        XJSIdentifier: 11,
        XJSText: 12
    };

    TokenName = {};
    TokenName[Token.BooleanLiteral] = 'Boolean';
    TokenName[Token.EOF] = '<end>';
    TokenName[Token.Identifier] = 'Identifier';
    TokenName[Token.Keyword] = 'Keyword';
    TokenName[Token.NullLiteral] = 'Null';
    TokenName[Token.NumericLiteral] = 'Numeric';
    TokenName[Token.Punctuator] = 'Punctuator';
    TokenName[Token.StringLiteral] = 'String';
    TokenName[Token.XJSIdentifier] = 'XJSIdentifier';
    TokenName[Token.XJSText] = 'XJSText';
    TokenName[Token.RegularExpression] = 'RegularExpression';

    // A function following one of those tokens is an expression.
    FnExprTokens = ['(', '{', '[', 'in', 'typeof', 'instanceof', 'new',
                    'return', 'case', 'delete', 'throw', 'void',
                    // assignment operators
                    '=', '+=', '-=', '*=', '/=', '%=', '<<=', '>>=', '>>>=',
                    '&=', '|=', '^=', ',',
                    // binary/unary operators
                    '+', '-', '*', '/', '%', '++', '--', '<<', '>>', '>>>', '&',
                    '|', '^', '!', '~', '&&', '||', '?', ':', '===', '==', '>=',
                    '<=', '<', '>', '!=', '!=='];

    Syntax = {
        ArrayExpression: 'ArrayExpression',
        ArrayPattern: 'ArrayPattern',
        ArrowFunctionExpression: 'ArrowFunctionExpression',
        AssignmentExpression: 'AssignmentExpression',
        BinaryExpression: 'BinaryExpression',
        BlockStatement: 'BlockStatement',
        BreakStatement: 'BreakStatement',
        CallExpression: 'CallExpression',
        CatchClause: 'CatchClause',
        ClassBody: 'ClassBody',
        ClassDeclaration: 'ClassDeclaration',
        ClassExpression: 'ClassExpression',
        ClassProperty: 'ClassProperty',
        ComprehensionBlock: 'ComprehensionBlock',
        ComprehensionExpression: 'ComprehensionExpression',
        ConditionalExpression: 'ConditionalExpression',
        ContinueStatement: 'ContinueStatement',
        DebuggerStatement: 'DebuggerStatement',
        DoWhileStatement: 'DoWhileStatement',
        EmptyStatement: 'EmptyStatement',
        ExportDeclaration: 'ExportDeclaration',
        ExportBatchSpecifier: 'ExportBatchSpecifier',
        ExportSpecifier: 'ExportSpecifier',
        ExpressionStatement: 'ExpressionStatement',
        ForInStatement: 'ForInStatement',
        ForOfStatement: 'ForOfStatement',
        ForStatement: 'ForStatement',
        FunctionDeclaration: 'FunctionDeclaration',
        FunctionExpression: 'FunctionExpression',
        Identifier: 'Identifier',
        IfStatement: 'IfStatement',
        ImportDeclaration: 'ImportDeclaration',
        ImportDefaultSpecifier: 'ImportDefaultSpecifier',
        ImportNamespaceSpecifier: 'ImportNamespaceSpecifier',
        ImportSpecifier: 'ImportSpecifier',
        LabeledStatement: 'LabeledStatement',
        Literal: 'Literal',
        LogicalExpression: 'LogicalExpression',
        MemberExpression: 'MemberExpression',
        MethodDefinition: 'MethodDefinition',
        ModuleSpecifier: 'ModuleSpecifier',
        NewExpression: 'NewExpression',
        ObjectExpression: 'ObjectExpression',
        ObjectPattern: 'ObjectPattern',
        ObjectTypeAnnotation: 'ObjectTypeAnnotation',
        OptionalParameter: 'OptionalParameter',
        ParametricTypeAnnotation: 'ParametricTypeAnnotation',
        ParametricallyTypedIdentifier: 'ParametricallyTypedIdentifier',
        Program: 'Program',
        Property: 'Property',
        ReturnStatement: 'ReturnStatement',
        SequenceExpression: 'SequenceExpression',
        SpreadElement: 'SpreadElement',
        SpreadProperty: 'SpreadProperty',
        SwitchCase: 'SwitchCase',
        SwitchStatement: 'SwitchStatement',
        TaggedTemplateExpression: 'TaggedTemplateExpression',
        TemplateElement: 'TemplateElement',
        TemplateLiteral: 'TemplateLiteral',
        ThisExpression: 'ThisExpression',
        ThrowStatement: 'ThrowStatement',
        TryStatement: 'TryStatement',
        TypeAnnotatedIdentifier: 'TypeAnnotatedIdentifier',
        TypeAnnotation: 'TypeAnnotation',
        UnaryExpression: 'UnaryExpression',
        UpdateExpression: 'UpdateExpression',
        VariableDeclaration: 'VariableDeclaration',
        VariableDeclarator: 'VariableDeclarator',
        VoidTypeAnnotation: 'VoidTypeAnnotation',
        WhileStatement: 'WhileStatement',
        WithStatement: 'WithStatement',
        XJSIdentifier: 'XJSIdentifier',
        XJSNamespacedName: 'XJSNamespacedName',
        XJSMemberExpression: 'XJSMemberExpression',
        XJSEmptyExpression: 'XJSEmptyExpression',
        XJSExpressionContainer: 'XJSExpressionContainer',
        XJSElement: 'XJSElement',
        XJSClosingElement: 'XJSClosingElement',
        XJSOpeningElement: 'XJSOpeningElement',
        XJSAttribute: 'XJSAttribute',
        XJSSpreadAttribute: 'XJSSpreadAttribute',
        XJSText: 'XJSText',
        YieldExpression: 'YieldExpression',
        AwaitExpression: 'AwaitExpression'
    };

    PropertyKind = {
        Data: 1,
        Get: 2,
        Set: 4
    };

    ClassPropertyType = {
        'static': 'static',
        prototype: 'prototype'
    };

    // Error messages should be identical to V8.
    Messages = {
        UnexpectedToken:  'Unexpected token %0',
        UnexpectedNumber:  'Unexpected number',
        UnexpectedString:  'Unexpected string',
        UnexpectedIdentifier:  'Unexpected identifier',
        UnexpectedReserved:  'Unexpected reserved word',
        UnexpectedTemplate:  'Unexpected quasi %0',
        UnexpectedEOS:  'Unexpected end of input',
        NewlineAfterThrow:  'Illegal newline after throw',
        InvalidRegExp: 'Invalid regular expression',
        UnterminatedRegExp:  'Invalid regular expression: missing /',
        InvalidLHSInAssignment:  'Invalid left-hand side in assignment',
        InvalidLHSInFormalsList:  'Invalid left-hand side in formals list',
        InvalidLHSInForIn:  'Invalid left-hand side in for-in',
        MultipleDefaultsInSwitch: 'More than one default clause in switch statement',
        NoCatchOrFinally:  'Missing catch or finally after try',
        UnknownLabel: 'Undefined label \'%0\'',
        Redeclaration: '%0 \'%1\' has already been declared',
        IllegalContinue: 'Illegal continue statement',
        IllegalBreak: 'Illegal break statement',
        IllegalDuplicateClassProperty: 'Illegal duplicate property in class definition',
        IllegalReturn: 'Illegal return statement',
        IllegalSpread: 'Illegal spread element',
        StrictModeWith:  'Strict mode code may not include a with statement',
        StrictCatchVariable:  'Catch variable may not be eval or arguments in strict mode',
        StrictVarName:  'Variable name may not be eval or arguments in strict mode',
        StrictParamName:  'Parameter name eval or arguments is not allowed in strict mode',
        StrictParamDupe: 'Strict mode function may not have duplicate parameter names',
        ParameterAfterRestParameter: 'Rest parameter must be final parameter of an argument list',
        DefaultRestParameter: 'Rest parameter can not have a default value',
        ElementAfterSpreadElement: 'Spread must be the final element of an element list',
        PropertyAfterSpreadProperty: 'A rest property must be the final property of an object literal',
        ObjectPatternAsRestParameter: 'Invalid rest parameter',
        ObjectPatternAsSpread: 'Invalid spread argument',
        StrictFunctionName:  'Function name may not be eval or arguments in strict mode',
        StrictOctalLiteral:  'Octal literals are not allowed in strict mode.',
        StrictDelete:  'Delete of an unqualified identifier in strict mode.',
        StrictDuplicateProperty:  'Duplicate data property in object literal not allowed in strict mode',
        AccessorDataProperty:  'Object literal may not have data and accessor property with the same name',
        AccessorGetSet:  'Object literal may not have multiple get/set accessors with the same name',
        StrictLHSAssignment:  'Assignment to eval or arguments is not allowed in strict mode',
        StrictLHSPostfix:  'Postfix increment/decrement may not have eval or arguments operand in strict mode',
        StrictLHSPrefix:  'Prefix increment/decrement may not have eval or arguments operand in strict mode',
        StrictReservedWord:  'Use of future reserved word in strict mode',
        MissingFromClause: 'Missing from clause',
        NoAsAfterImportNamespace: 'Missing as after import *',
        InvalidModuleSpecifier: 'Invalid module specifier',
        NoUnintializedConst: 'Const must be initialized',
        ComprehensionRequiresBlock: 'Comprehension must have at least one block',
        ComprehensionError:  'Comprehension Error',
        EachNotAllowed:  'Each is not supported',
        InvalidXJSAttributeValue: 'XJS value should be either an expression or a quoted XJS text',
        ExpectedXJSClosingTag: 'Expected corresponding XJS closing tag for %0',
        AdjacentXJSElements: 'Adjacent XJS elements must be wrapped in an enclosing tag'
    };

    // See also tools/generate-unicode-regex.py.
    Regex = {
        NonAsciiIdentifierStart: new RegExp('[\xaa\xb5\xba\xc0-\xd6\xd8-\xf6\xf8-\u02c1\u02c6-\u02d1\u02e0-\u02e4\u02ec\u02ee\u0370-\u0374\u0376\u0377\u037a-\u037d\u0386\u0388-\u038a\u038c\u038e-\u03a1\u03a3-\u03f5\u03f7-\u0481\u048a-\u0527\u0531-\u0556\u0559\u0561-\u0587\u05d0-\u05ea\u05f0-\u05f2\u0620-\u064a\u066e\u066f\u0671-\u06d3\u06d5\u06e5\u06e6\u06ee\u06ef\u06fa-\u06fc\u06ff\u0710\u0712-\u072f\u074d-\u07a5\u07b1\u07ca-\u07ea\u07f4\u07f5\u07fa\u0800-\u0815\u081a\u0824\u0828\u0840-\u0858\u08a0\u08a2-\u08ac\u0904-\u0939\u093d\u0950\u0958-\u0961\u0971-\u0977\u0979-\u097f\u0985-\u098c\u098f\u0990\u0993-\u09a8\u09aa-\u09b0\u09b2\u09b6-\u09b9\u09bd\u09ce\u09dc\u09dd\u09df-\u09e1\u09f0\u09f1\u0a05-\u0a0a\u0a0f\u0a10\u0a13-\u0a28\u0a2a-\u0a30\u0a32\u0a33\u0a35\u0a36\u0a38\u0a39\u0a59-\u0a5c\u0a5e\u0a72-\u0a74\u0a85-\u0a8d\u0a8f-\u0a91\u0a93-\u0aa8\u0aaa-\u0ab0\u0ab2\u0ab3\u0ab5-\u0ab9\u0abd\u0ad0\u0ae0\u0ae1\u0b05-\u0b0c\u0b0f\u0b10\u0b13-\u0b28\u0b2a-\u0b30\u0b32\u0b33\u0b35-\u0b39\u0b3d\u0b5c\u0b5d\u0b5f-\u0b61\u0b71\u0b83\u0b85-\u0b8a\u0b8e-\u0b90\u0b92-\u0b95\u0b99\u0b9a\u0b9c\u0b9e\u0b9f\u0ba3\u0ba4\u0ba8-\u0baa\u0bae-\u0bb9\u0bd0\u0c05-\u0c0c\u0c0e-\u0c10\u0c12-\u0c28\u0c2a-\u0c33\u0c35-\u0c39\u0c3d\u0c58\u0c59\u0c60\u0c61\u0c85-\u0c8c\u0c8e-\u0c90\u0c92-\u0ca8\u0caa-\u0cb3\u0cb5-\u0cb9\u0cbd\u0cde\u0ce0\u0ce1\u0cf1\u0cf2\u0d05-\u0d0c\u0d0e-\u0d10\u0d12-\u0d3a\u0d3d\u0d4e\u0d60\u0d61\u0d7a-\u0d7f\u0d85-\u0d96\u0d9a-\u0db1\u0db3-\u0dbb\u0dbd\u0dc0-\u0dc6\u0e01-\u0e30\u0e32\u0e33\u0e40-\u0e46\u0e81\u0e82\u0e84\u0e87\u0e88\u0e8a\u0e8d\u0e94-\u0e97\u0e99-\u0e9f\u0ea1-\u0ea3\u0ea5\u0ea7\u0eaa\u0eab\u0ead-\u0eb0\u0eb2\u0eb3\u0ebd\u0ec0-\u0ec4\u0ec6\u0edc-\u0edf\u0f00\u0f40-\u0f47\u0f49-\u0f6c\u0f88-\u0f8c\u1000-\u102a\u103f\u1050-\u1055\u105a-\u105d\u1061\u1065\u1066\u106e-\u1070\u1075-\u1081\u108e\u10a0-\u10c5\u10c7\u10cd\u10d0-\u10fa\u10fc-\u1248\u124a-\u124d\u1250-\u1256\u1258\u125a-\u125d\u1260-\u1288\u128a-\u128d\u1290-\u12b0\u12b2-\u12b5\u12b8-\u12be\u12c0\u12c2-\u12c5\u12c8-\u12d6\u12d8-\u1310\u1312-\u1315\u1318-\u135a\u1380-\u138f\u13a0-\u13f4\u1401-\u166c\u166f-\u167f\u1681-\u169a\u16a0-\u16ea\u16ee-\u16f0\u1700-\u170c\u170e-\u1711\u1720-\u1731\u1740-\u1751\u1760-\u176c\u176e-\u1770\u1780-\u17b3\u17d7\u17dc\u1820-\u1877\u1880-\u18a8\u18aa\u18b0-\u18f5\u1900-\u191c\u1950-\u196d\u1970-\u1974\u1980-\u19ab\u19c1-\u19c7\u1a00-\u1a16\u1a20-\u1a54\u1aa7\u1b05-\u1b33\u1b45-\u1b4b\u1b83-\u1ba0\u1bae\u1baf\u1bba-\u1be5\u1c00-\u1c23\u1c4d-\u1c4f\u1c5a-\u1c7d\u1ce9-\u1cec\u1cee-\u1cf1\u1cf5\u1cf6\u1d00-\u1dbf\u1e00-\u1f15\u1f18-\u1f1d\u1f20-\u1f45\u1f48-\u1f4d\u1f50-\u1f57\u1f59\u1f5b\u1f5d\u1f5f-\u1f7d\u1f80-\u1fb4\u1fb6-\u1fbc\u1fbe\u1fc2-\u1fc4\u1fc6-\u1fcc\u1fd0-\u1fd3\u1fd6-\u1fdb\u1fe0-\u1fec\u1ff2-\u1ff4\u1ff6-\u1ffc\u2071\u207f\u2090-\u209c\u2102\u2107\u210a-\u2113\u2115\u2119-\u211d\u2124\u2126\u2128\u212a-\u212d\u212f-\u2139\u213c-\u213f\u2145-\u2149\u214e\u2160-\u2188\u2c00-\u2c2e\u2c30-\u2c5e\u2c60-\u2ce4\u2ceb-\u2cee\u2cf2\u2cf3\u2d00-\u2d25\u2d27\u2d2d\u2d30-\u2d67\u2d6f\u2d80-\u2d96\u2da0-\u2da6\u2da8-\u2dae\u2db0-\u2db6\u2db8-\u2dbe\u2dc0-\u2dc6\u2dc8-\u2dce\u2dd0-\u2dd6\u2dd8-\u2dde\u2e2f\u3005-\u3007\u3021-\u3029\u3031-\u3035\u3038-\u303c\u3041-\u3096\u309d-\u309f\u30a1-\u30fa\u30fc-\u30ff\u3105-\u312d\u3131-\u318e\u31a0-\u31ba\u31f0-\u31ff\u3400-\u4db5\u4e00-\u9fcc\ua000-\ua48c\ua4d0-\ua4fd\ua500-\ua60c\ua610-\ua61f\ua62a\ua62b\ua640-\ua66e\ua67f-\ua697\ua6a0-\ua6ef\ua717-\ua71f\ua722-\ua788\ua78b-\ua78e\ua790-\ua793\ua7a0-\ua7aa\ua7f8-\ua801\ua803-\ua805\ua807-\ua80a\ua80c-\ua822\ua840-\ua873\ua882-\ua8b3\ua8f2-\ua8f7\ua8fb\ua90a-\ua925\ua930-\ua946\ua960-\ua97c\ua984-\ua9b2\ua9cf\uaa00-\uaa28\uaa40-\uaa42\uaa44-\uaa4b\uaa60-\uaa76\uaa7a\uaa80-\uaaaf\uaab1\uaab5\uaab6\uaab9-\uaabd\uaac0\uaac2\uaadb-\uaadd\uaae0-\uaaea\uaaf2-\uaaf4\uab01-\uab06\uab09-\uab0e\uab11-\uab16\uab20-\uab26\uab28-\uab2e\uabc0-\uabe2\uac00-\ud7a3\ud7b0-\ud7c6\ud7cb-\ud7fb\uf900-\ufa6d\ufa70-\ufad9\ufb00-\ufb06\ufb13-\ufb17\ufb1d\ufb1f-\ufb28\ufb2a-\ufb36\ufb38-\ufb3c\ufb3e\ufb40\ufb41\ufb43\ufb44\ufb46-\ufbb1\ufbd3-\ufd3d\ufd50-\ufd8f\ufd92-\ufdc7\ufdf0-\ufdfb\ufe70-\ufe74\ufe76-\ufefc\uff21-\uff3a\uff41-\uff5a\uff66-\uffbe\uffc2-\uffc7\uffca-\uffcf\uffd2-\uffd7\uffda-\uffdc]'),
        NonAsciiIdentifierPart: new RegExp('[\xaa\xb5\xba\xc0-\xd6\xd8-\xf6\xf8-\u02c1\u02c6-\u02d1\u02e0-\u02e4\u02ec\u02ee\u0300-\u0374\u0376\u0377\u037a-\u037d\u0386\u0388-\u038a\u038c\u038e-\u03a1\u03a3-\u03f5\u03f7-\u0481\u0483-\u0487\u048a-\u0527\u0531-\u0556\u0559\u0561-\u0587\u0591-\u05bd\u05bf\u05c1\u05c2\u05c4\u05c5\u05c7\u05d0-\u05ea\u05f0-\u05f2\u0610-\u061a\u0620-\u0669\u066e-\u06d3\u06d5-\u06dc\u06df-\u06e8\u06ea-\u06fc\u06ff\u0710-\u074a\u074d-\u07b1\u07c0-\u07f5\u07fa\u0800-\u082d\u0840-\u085b\u08a0\u08a2-\u08ac\u08e4-\u08fe\u0900-\u0963\u0966-\u096f\u0971-\u0977\u0979-\u097f\u0981-\u0983\u0985-\u098c\u098f\u0990\u0993-\u09a8\u09aa-\u09b0\u09b2\u09b6-\u09b9\u09bc-\u09c4\u09c7\u09c8\u09cb-\u09ce\u09d7\u09dc\u09dd\u09df-\u09e3\u09e6-\u09f1\u0a01-\u0a03\u0a05-\u0a0a\u0a0f\u0a10\u0a13-\u0a28\u0a2a-\u0a30\u0a32\u0a33\u0a35\u0a36\u0a38\u0a39\u0a3c\u0a3e-\u0a42\u0a47\u0a48\u0a4b-\u0a4d\u0a51\u0a59-\u0a5c\u0a5e\u0a66-\u0a75\u0a81-\u0a83\u0a85-\u0a8d\u0a8f-\u0a91\u0a93-\u0aa8\u0aaa-\u0ab0\u0ab2\u0ab3\u0ab5-\u0ab9\u0abc-\u0ac5\u0ac7-\u0ac9\u0acb-\u0acd\u0ad0\u0ae0-\u0ae3\u0ae6-\u0aef\u0b01-\u0b03\u0b05-\u0b0c\u0b0f\u0b10\u0b13-\u0b28\u0b2a-\u0b30\u0b32\u0b33\u0b35-\u0b39\u0b3c-\u0b44\u0b47\u0b48\u0b4b-\u0b4d\u0b56\u0b57\u0b5c\u0b5d\u0b5f-\u0b63\u0b66-\u0b6f\u0b71\u0b82\u0b83\u0b85-\u0b8a\u0b8e-\u0b90\u0b92-\u0b95\u0b99\u0b9a\u0b9c\u0b9e\u0b9f\u0ba3\u0ba4\u0ba8-\u0baa\u0bae-\u0bb9\u0bbe-\u0bc2\u0bc6-\u0bc8\u0bca-\u0bcd\u0bd0\u0bd7\u0be6-\u0bef\u0c01-\u0c03\u0c05-\u0c0c\u0c0e-\u0c10\u0c12-\u0c28\u0c2a-\u0c33\u0c35-\u0c39\u0c3d-\u0c44\u0c46-\u0c48\u0c4a-\u0c4d\u0c55\u0c56\u0c58\u0c59\u0c60-\u0c63\u0c66-\u0c6f\u0c82\u0c83\u0c85-\u0c8c\u0c8e-\u0c90\u0c92-\u0ca8\u0caa-\u0cb3\u0cb5-\u0cb9\u0cbc-\u0cc4\u0cc6-\u0cc8\u0cca-\u0ccd\u0cd5\u0cd6\u0cde\u0ce0-\u0ce3\u0ce6-\u0cef\u0cf1\u0cf2\u0d02\u0d03\u0d05-\u0d0c\u0d0e-\u0d10\u0d12-\u0d3a\u0d3d-\u0d44\u0d46-\u0d48\u0d4a-\u0d4e\u0d57\u0d60-\u0d63\u0d66-\u0d6f\u0d7a-\u0d7f\u0d82\u0d83\u0d85-\u0d96\u0d9a-\u0db1\u0db3-\u0dbb\u0dbd\u0dc0-\u0dc6\u0dca\u0dcf-\u0dd4\u0dd6\u0dd8-\u0ddf\u0df2\u0df3\u0e01-\u0e3a\u0e40-\u0e4e\u0e50-\u0e59\u0e81\u0e82\u0e84\u0e87\u0e88\u0e8a\u0e8d\u0e94-\u0e97\u0e99-\u0e9f\u0ea1-\u0ea3\u0ea5\u0ea7\u0eaa\u0eab\u0ead-\u0eb9\u0ebb-\u0ebd\u0ec0-\u0ec4\u0ec6\u0ec8-\u0ecd\u0ed0-\u0ed9\u0edc-\u0edf\u0f00\u0f18\u0f19\u0f20-\u0f29\u0f35\u0f37\u0f39\u0f3e-\u0f47\u0f49-\u0f6c\u0f71-\u0f84\u0f86-\u0f97\u0f99-\u0fbc\u0fc6\u1000-\u1049\u1050-\u109d\u10a0-\u10c5\u10c7\u10cd\u10d0-\u10fa\u10fc-\u1248\u124a-\u124d\u1250-\u1256\u1258\u125a-\u125d\u1260-\u1288\u128a-\u128d\u1290-\u12b0\u12b2-\u12b5\u12b8-\u12be\u12c0\u12c2-\u12c5\u12c8-\u12d6\u12d8-\u1310\u1312-\u1315\u1318-\u135a\u135d-\u135f\u1380-\u138f\u13a0-\u13f4\u1401-\u166c\u166f-\u167f\u1681-\u169a\u16a0-\u16ea\u16ee-\u16f0\u1700-\u170c\u170e-\u1714\u1720-\u1734\u1740-\u1753\u1760-\u176c\u176e-\u1770\u1772\u1773\u1780-\u17d3\u17d7\u17dc\u17dd\u17e0-\u17e9\u180b-\u180d\u1810-\u1819\u1820-\u1877\u1880-\u18aa\u18b0-\u18f5\u1900-\u191c\u1920-\u192b\u1930-\u193b\u1946-\u196d\u1970-\u1974\u1980-\u19ab\u19b0-\u19c9\u19d0-\u19d9\u1a00-\u1a1b\u1a20-\u1a5e\u1a60-\u1a7c\u1a7f-\u1a89\u1a90-\u1a99\u1aa7\u1b00-\u1b4b\u1b50-\u1b59\u1b6b-\u1b73\u1b80-\u1bf3\u1c00-\u1c37\u1c40-\u1c49\u1c4d-\u1c7d\u1cd0-\u1cd2\u1cd4-\u1cf6\u1d00-\u1de6\u1dfc-\u1f15\u1f18-\u1f1d\u1f20-\u1f45\u1f48-\u1f4d\u1f50-\u1f57\u1f59\u1f5b\u1f5d\u1f5f-\u1f7d\u1f80-\u1fb4\u1fb6-\u1fbc\u1fbe\u1fc2-\u1fc4\u1fc6-\u1fcc\u1fd0-\u1fd3\u1fd6-\u1fdb\u1fe0-\u1fec\u1ff2-\u1ff4\u1ff6-\u1ffc\u200c\u200d\u203f\u2040\u2054\u2071\u207f\u2090-\u209c\u20d0-\u20dc\u20e1\u20e5-\u20f0\u2102\u2107\u210a-\u2113\u2115\u2119-\u211d\u2124\u2126\u2128\u212a-\u212d\u212f-\u2139\u213c-\u213f\u2145-\u2149\u214e\u2160-\u2188\u2c00-\u2c2e\u2c30-\u2c5e\u2c60-\u2ce4\u2ceb-\u2cf3\u2d00-\u2d25\u2d27\u2d2d\u2d30-\u2d67\u2d6f\u2d7f-\u2d96\u2da0-\u2da6\u2da8-\u2dae\u2db0-\u2db6\u2db8-\u2dbe\u2dc0-\u2dc6\u2dc8-\u2dce\u2dd0-\u2dd6\u2dd8-\u2dde\u2de0-\u2dff\u2e2f\u3005-\u3007\u3021-\u302f\u3031-\u3035\u3038-\u303c\u3041-\u3096\u3099\u309a\u309d-\u309f\u30a1-\u30fa\u30fc-\u30ff\u3105-\u312d\u3131-\u318e\u31a0-\u31ba\u31f0-\u31ff\u3400-\u4db5\u4e00-\u9fcc\ua000-\ua48c\ua4d0-\ua4fd\ua500-\ua60c\ua610-\ua62b\ua640-\ua66f\ua674-\ua67d\ua67f-\ua697\ua69f-\ua6f1\ua717-\ua71f\ua722-\ua788\ua78b-\ua78e\ua790-\ua793\ua7a0-\ua7aa\ua7f8-\ua827\ua840-\ua873\ua880-\ua8c4\ua8d0-\ua8d9\ua8e0-\ua8f7\ua8fb\ua900-\ua92d\ua930-\ua953\ua960-\ua97c\ua980-\ua9c0\ua9cf-\ua9d9\uaa00-\uaa36\uaa40-\uaa4d\uaa50-\uaa59\uaa60-\uaa76\uaa7a\uaa7b\uaa80-\uaac2\uaadb-\uaadd\uaae0-\uaaef\uaaf2-\uaaf6\uab01-\uab06\uab09-\uab0e\uab11-\uab16\uab20-\uab26\uab28-\uab2e\uabc0-\uabea\uabec\uabed\uabf0-\uabf9\uac00-\ud7a3\ud7b0-\ud7c6\ud7cb-\ud7fb\uf900-\ufa6d\ufa70-\ufad9\ufb00-\ufb06\ufb13-\ufb17\ufb1d-\ufb28\ufb2a-\ufb36\ufb38-\ufb3c\ufb3e\ufb40\ufb41\ufb43\ufb44\ufb46-\ufbb1\ufbd3-\ufd3d\ufd50-\ufd8f\ufd92-\ufdc7\ufdf0-\ufdfb\ufe00-\ufe0f\ufe20-\ufe26\ufe33\ufe34\ufe4d-\ufe4f\ufe70-\ufe74\ufe76-\ufefc\uff10-\uff19\uff21-\uff3a\uff3f\uff41-\uff5a\uff66-\uffbe\uffc2-\uffc7\uffca-\uffcf\uffd2-\uffd7\uffda-\uffdc]'),
        LeadingZeros: new RegExp('^0+(?!$)')
    };

    // Ensure the condition is true, otherwise throw an error.
    // This is only to have a better contract semantic, i.e. another safety net
    // to catch a logic error. The condition shall be fulfilled in normal case.
    // Do NOT use this to enforce a certain condition on any user input.

    function assert(condition, message) {
        if (!condition) {
            throw new Error('ASSERT: ' + message);
        }
    }

    function isDecimalDigit(ch) {
        return (ch >= 48 && ch <= 57);   // 0..9
    }

    function isHexDigit(ch) {
        return '0123456789abcdefABCDEF'.indexOf(ch) >= 0;
    }

    function isOctalDigit(ch) {
        return '01234567'.indexOf(ch) >= 0;
    }


    // 7.2 White Space

    function isWhiteSpace(ch) {
        return (ch === 32) ||  // space
            (ch === 9) ||      // tab
            (ch === 0xB) ||
            (ch === 0xC) ||
            (ch === 0xA0) ||
            (ch >= 0x1680 && '\u1680\u180E\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200A\u202F\u205F\u3000\uFEFF'.indexOf(String.fromCharCode(ch)) > 0);
    }

    // 7.3 Line Terminators

    function isLineTerminator(ch) {
        return (ch === 10) || (ch === 13) || (ch === 0x2028) || (ch === 0x2029);
    }

    // 7.6 Identifier Names and Identifiers

    function isIdentifierStart(ch) {
        return (ch === 36) || (ch === 95) ||  // $ (dollar) and _ (underscore)
            (ch >= 65 && ch <= 90) ||         // A..Z
            (ch >= 97 && ch <= 122) ||        // a..z
            (ch === 92) ||                    // \ (backslash)
            ((ch >= 0x80) && Regex.NonAsciiIdentifierStart.test(String.fromCharCode(ch)));
    }

    function isIdentifierPart(ch) {
        return (ch === 36) || (ch === 95) ||  // $ (dollar) and _ (underscore)
            (ch >= 65 && ch <= 90) ||         // A..Z
            (ch >= 97 && ch <= 122) ||        // a..z
            (ch >= 48 && ch <= 57) ||         // 0..9
            (ch === 92) ||                    // \ (backslash)
            ((ch >= 0x80) && Regex.NonAsciiIdentifierPart.test(String.fromCharCode(ch)));
    }

    // 7.6.1.2 Future Reserved Words

    function isFutureReservedWord(id) {
        switch (id) {
        case 'class':
        case 'enum':
        case 'export':
        case 'extends':
        case 'import':
        case 'super':
            return true;
        default:
            return false;
        }
    }

    function isStrictModeReservedWord(id) {
        switch (id) {
        case 'implements':
        case 'interface':
        case 'package':
        case 'private':
        case 'protected':
        case 'public':
        case 'static':
        case 'yield':
        case 'let':
            return true;
        default:
            return false;
        }
    }

    function isRestrictedWord(id) {
        return id === 'eval' || id === 'arguments';
    }

    // 7.6.1.1 Keywords

    function isKeyword(id) {
        if (strict && isStrictModeReservedWord(id)) {
            return true;
        }

        // 'const' is specialized as Keyword in V8.
        // 'yield' is only treated as a keyword in strict mode.
        // 'let' is for compatiblity with SpiderMonkey and ES.next.
        // Some others are from future reserved words.

        switch (id.length) {
        case 2:
            return (id === 'if') || (id === 'in') || (id === 'do');
        case 3:
            return (id === 'var') || (id === 'for') || (id === 'new') ||
                (id === 'try') || (id === 'let');
        case 4:
            return (id === 'this') || (id === 'else') || (id === 'case') ||
                (id === 'void') || (id === 'with') || (id === 'enum');
        case 5:
            return (id === 'while') || (id === 'break') || (id === 'catch') ||
                (id === 'throw') || (id === 'const') ||
                (id === 'class') || (id === 'super');
        case 6:
            return (id === 'return') || (id === 'typeof') || (id === 'delete') ||
                (id === 'switch') || (id === 'export') || (id === 'import');
        case 7:
            return (id === 'default') || (id === 'finally') || (id === 'extends');
        case 8:
            return (id === 'function') || (id === 'continue') || (id === 'debugger');
        case 10:
            return (id === 'instanceof');
        default:
            return false;
        }
    }

    // 7.4 Comments

    function skipComment() {
        var ch, blockComment, lineComment;

        blockComment = false;
        lineComment = false;

        while (index < length) {
            ch = source.charCodeAt(index);

            if (lineComment) {
                ++index;
                if (isLineTerminator(ch)) {
                    lineComment = false;
                    if (ch === 13 && source.charCodeAt(index) === 10) {
                        ++index;
                    }
                    ++lineNumber;
                    lineStart = index;
                }
            } else if (blockComment) {
                if (isLineTerminator(ch)) {
                    if (ch === 13) {
                        ++index;
                    }
                    if (ch !== 13 || source.charCodeAt(index) === 10) {
                        ++lineNumber;
                        ++index;
                        lineStart = index;
                        if (index >= length) {
                            throwError({}, Messages.UnexpectedToken, 'ILLEGAL');
                        }
                    }
                } else {
                    ch = source.charCodeAt(index++);
                    if (index >= length) {
                        throwError({}, Messages.UnexpectedToken, 'ILLEGAL');
                    }
                    // Block comment ends with '*/' (char #42, char #47).
                    if (ch === 42) {
                        ch = source.charCodeAt(index);
                        if (ch === 47) {
                            ++index;
                            blockComment = false;
                        }
                    }
                }
            } else if (ch === 47) {
                ch = source.charCodeAt(index + 1);
                // Line comment starts with '//' (char #47, char #47).
                if (ch === 47) {
                    index += 2;
                    lineComment = true;
                } else if (ch === 42) {
                    // Block comment starts with '/*' (char #47, char #42).
                    index += 2;
                    blockComment = true;
                    if (index >= length) {
                        throwError({}, Messages.UnexpectedToken, 'ILLEGAL');
                    }
                } else {
                    break;
                }
            } else if (isWhiteSpace(ch)) {
                ++index;
            } else if (isLineTerminator(ch)) {
                ++index;
                if (ch === 13 && source.charCodeAt(index) === 10) {
                    ++index;
                }
                ++lineNumber;
                lineStart = index;
            } else {
                break;
            }
        }
    }

    function scanHexEscape(prefix) {
        var i, len, ch, code = 0;

        len = (prefix === 'u') ? 4 : 2;
        for (i = 0; i < len; ++i) {
            if (index < length && isHexDigit(source[index])) {
                ch = source[index++];
                code = code * 16 + '0123456789abcdef'.indexOf(ch.toLowerCase());
            } else {
                return '';
            }
        }
        return String.fromCharCode(code);
    }

    function scanUnicodeCodePointEscape() {
        var ch, code, cu1, cu2;

        ch = source[index];
        code = 0;

        // At least, one hex digit is required.
        if (ch === '}') {
            throwError({}, Messages.UnexpectedToken, 'ILLEGAL');
        }

        while (index < length) {
            ch = source[index++];
            if (!isHexDigit(ch)) {
                break;
            }
            code = code * 16 + '0123456789abcdef'.indexOf(ch.toLowerCase());
        }

        if (code > 0x10FFFF || ch !== '}') {
            throwError({}, Messages.UnexpectedToken, 'ILLEGAL');
        }

        // UTF-16 Encoding
        if (code <= 0xFFFF) {
            return String.fromCharCode(code);
        }
        cu1 = ((code - 0x10000) >> 10) + 0xD800;
        cu2 = ((code - 0x10000) & 1023) + 0xDC00;
        return String.fromCharCode(cu1, cu2);
    }

    function getEscapedIdentifier() {
        var ch, id;

        ch = source.charCodeAt(index++);
        id = String.fromCharCode(ch);

        // '\u' (char #92, char #117) denotes an escaped character.
        if (ch === 92) {
            if (source.charCodeAt(index) !== 117) {
                throwError({}, Messages.UnexpectedToken, 'ILLEGAL');
            }
            ++index;
            ch = scanHexEscape('u');
            if (!ch || ch === '\\' || !isIdentifierStart(ch.charCodeAt(0))) {
                throwError({}, Messages.UnexpectedToken, 'ILLEGAL');
            }
            id = ch;
        }

        while (index < length) {
            ch = source.charCodeAt(index);
            if (!isIdentifierPart(ch)) {
                break;
            }
            ++index;
            id += String.fromCharCode(ch);

            // '\u' (char #92, char #117) denotes an escaped character.
            if (ch === 92) {
                id = id.substr(0, id.length - 1);
                if (source.charCodeAt(index) !== 117) {
                    throwError({}, Messages.UnexpectedToken, 'ILLEGAL');
                }
                ++index;
                ch = scanHexEscape('u');
                if (!ch || ch === '\\' || !isIdentifierPart(ch.charCodeAt(0))) {
                    throwError({}, Messages.UnexpectedToken, 'ILLEGAL');
                }
                id += ch;
            }
        }

        return id;
    }

    function getIdentifier() {
        var start, ch;

        start = index++;
        while (index < length) {
            ch = source.charCodeAt(index);
            if (ch === 92) {
                // Blackslash (char #92) marks Unicode escape sequence.
                index = start;
                return getEscapedIdentifier();
            }
            if (isIdentifierPart(ch)) {
                ++index;
            } else {
                break;
            }
        }

        return source.slice(start, index);
    }

    function scanIdentifier() {
        var start, id, type;

        start = index;

        // Backslash (char #92) starts an escaped character.
        id = (source.charCodeAt(index) === 92) ? getEscapedIdentifier() : getIdentifier();

        // There is no keyword or literal with only one character.
        // Thus, it must be an identifier.
        if (id.length === 1) {
            type = Token.Identifier;
        } else if (isKeyword(id)) {
            type = Token.Keyword;
        } else if (id === 'null') {
            type = Token.NullLiteral;
        } else if (id === 'true' || id === 'false') {
            type = Token.BooleanLiteral;
        } else {
            type = Token.Identifier;
        }

        return {
            type: type,
            value: id,
            lineNumber: lineNumber,
            lineStart: lineStart,
            range: [start, index]
        };
    }


    // 7.7 Punctuators

    function scanPunctuator() {
        var start = index,
            code = source.charCodeAt(index),
            code2,
            ch1 = source[index],
            ch2,
            ch3,
            ch4;

        switch (code) {
        // Check for most common single-character punctuators.
        case 40:   // ( open bracket
        case 41:   // ) close bracket
        case 59:   // ; semicolon
        case 44:   // , comma
        case 123:  // { open curly brace
        case 125:  // } close curly brace
        case 91:   // [
        case 93:   // ]
        case 58:   // :
        case 63:   // ?
        case 126:  // ~
            ++index;
            if (extra.tokenize) {
                if (code === 40) {
                    extra.openParenToken = extra.tokens.length;
                } else if (code === 123) {
                    extra.openCurlyToken = extra.tokens.length;
                }
            }
            return {
                type: Token.Punctuator,
                value: String.fromCharCode(code),
                lineNumber: lineNumber,
                lineStart: lineStart,
                range: [start, index]
            };

        default:
            code2 = source.charCodeAt(index + 1);

            // '=' (char #61) marks an assignment or comparison operator.
            if (code2 === 61) {
                switch (code) {
                case 37:  // %
                case 38:  // &
                case 42:  // *:
                case 43:  // +
                case 45:  // -
                case 47:  // /
                case 60:  // <
                case 62:  // >
                case 94:  // ^
                case 124: // |
                    index += 2;
                    return {
                        type: Token.Punctuator,
                        value: String.fromCharCode(code) + String.fromCharCode(code2),
                        lineNumber: lineNumber,
                        lineStart: lineStart,
                        range: [start, index]
                    };

                case 33: // !
                case 61: // =
                    index += 2;

                    // !== and ===
                    if (source.charCodeAt(index) === 61) {
                        ++index;
                    }
                    return {
                        type: Token.Punctuator,
                        value: source.slice(start, index),
                        lineNumber: lineNumber,
                        lineStart: lineStart,
                        range: [start, index]
                    };
                default:
                    break;
                }
            }
            break;
        }

        // Peek more characters.

        ch2 = source[index + 1];
        ch3 = source[index + 2];
        ch4 = source[index + 3];

        // 4-character punctuator: >>>=

        if (ch1 === '>' && ch2 === '>' && ch3 === '>') {
            if (ch4 === '=') {
                index += 4;
                return {
                    type: Token.Punctuator,
                    value: '>>>=',
                    lineNumber: lineNumber,
                    lineStart: lineStart,
                    range: [start, index]
                };
            }
        }

        // 3-character punctuators: === !== >>> <<= >>=

        if (ch1 === '>' && ch2 === '>' && ch3 === '>') {
            index += 3;
            return {
                type: Token.Punctuator,
                value: '>>>',
                lineNumber: lineNumber,
                lineStart: lineStart,
                range: [start, index]
            };
        }

        if (ch1 === '<' && ch2 === '<' && ch3 === '=') {
            index += 3;
            return {
                type: Token.Punctuator,
                value: '<<=',
                lineNumber: lineNumber,
                lineStart: lineStart,
                range: [start, index]
            };
        }

        if (ch1 === '>' && ch2 === '>' && ch3 === '=') {
            index += 3;
            return {
                type: Token.Punctuator,
                value: '>>=',
                lineNumber: lineNumber,
                lineStart: lineStart,
                range: [start, index]
            };
        }

        if (ch1 === '.' && ch2 === '.' && ch3 === '.') {
            index += 3;
            return {
                type: Token.Punctuator,
                value: '...',
                lineNumber: lineNumber,
                lineStart: lineStart,
                range: [start, index]
            };
        }

        // Other 2-character punctuators: ++ -- << >> && ||

        if (ch1 === ch2 && ('+-<>&|'.indexOf(ch1) >= 0)) {
            index += 2;
            return {
                type: Token.Punctuator,
                value: ch1 + ch2,
                lineNumber: lineNumber,
                lineStart: lineStart,
                range: [start, index]
            };
        }

        if (ch1 === '=' && ch2 === '>') {
            index += 2;
            return {
                type: Token.Punctuator,
                value: '=>',
                lineNumber: lineNumber,
                lineStart: lineStart,
                range: [start, index]
            };
        }

        if ('<>=!+-*%&|^/'.indexOf(ch1) >= 0) {
            ++index;
            return {
                type: Token.Punctuator,
                value: ch1,
                lineNumber: lineNumber,
                lineStart: lineStart,
                range: [start, index]
            };
        }

        if (ch1 === '.') {
            ++index;
            return {
                type: Token.Punctuator,
                value: ch1,
                lineNumber: lineNumber,
                lineStart: lineStart,
                range: [start, index]
            };
        }

        throwError({}, Messages.UnexpectedToken, 'ILLEGAL');
    }

    // 7.8.3 Numeric Literals

    function scanHexLiteral(start) {
        var number = '';

        while (index < length) {
            if (!isHexDigit(source[index])) {
                break;
            }
            number += source[index++];
        }

        if (number.length === 0) {
            throwError({}, Messages.UnexpectedToken, 'ILLEGAL');
        }

        if (isIdentifierStart(source.charCodeAt(index))) {
            throwError({}, Messages.UnexpectedToken, 'ILLEGAL');
        }

        return {
            type: Token.NumericLiteral,
            value: parseInt('0x' + number, 16),
            lineNumber: lineNumber,
            lineStart: lineStart,
            range: [start, index]
        };
    }

    function scanOctalLiteral(prefix, start) {
        var number, octal;

        if (isOctalDigit(prefix)) {
            octal = true;
            number = '0' + source[index++];
        } else {
            octal = false;
            ++index;
            number = '';
        }

        while (index < length) {
            if (!isOctalDigit(source[index])) {
                break;
            }
            number += source[index++];
        }

        if (!octal && number.length === 0) {
            // only 0o or 0O
            throwError({}, Messages.UnexpectedToken, 'ILLEGAL');
        }

        if (isIdentifierStart(source.charCodeAt(index)) || isDecimalDigit(source.charCodeAt(index))) {
            throwError({}, Messages.UnexpectedToken, 'ILLEGAL');
        }

        return {
            type: Token.NumericLiteral,
            value: parseInt(number, 8),
            octal: octal,
            lineNumber: lineNumber,
            lineStart: lineStart,
            range: [start, index]
        };
    }

    function scanNumericLiteral() {
        var number, start, ch, octal;

        ch = source[index];
        assert(isDecimalDigit(ch.charCodeAt(0)) || (ch === '.'),
            'Numeric literal must start with a decimal digit or a decimal point');

        start = index;
        number = '';
        if (ch !== '.') {
            number = source[index++];
            ch = source[index];

            // Hex number starts with '0x'.
            // Octal number starts with '0'.
            // Octal number in ES6 starts with '0o'.
            // Binary number in ES6 starts with '0b'.
            if (number === '0') {
                if (ch === 'x' || ch === 'X') {
                    ++index;
                    return scanHexLiteral(start);
                }
                if (ch === 'b' || ch === 'B') {
                    ++index;
                    number = '';

                    while (index < length) {
                        ch = source[index];
                        if (ch !== '0' && ch !== '1') {
                            break;
                        }
                        number += source[index++];
                    }

                    if (number.length === 0) {
                        // only 0b or 0B
                        throwError({}, Messages.UnexpectedToken, 'ILLEGAL');
                    }

                    if (index < length) {
                        ch = source.charCodeAt(index);
                        if (isIdentifierStart(ch) || isDecimalDigit(ch)) {
                            throwError({}, Messages.UnexpectedToken, 'ILLEGAL');
                        }
                    }
                    return {
                        type: Token.NumericLiteral,
                        value: parseInt(number, 2),
                        lineNumber: lineNumber,
                        lineStart: lineStart,
                        range: [start, index]
                    };
                }
                if (ch === 'o' || ch === 'O' || isOctalDigit(ch)) {
                    return scanOctalLiteral(ch, start);
                }
                // decimal number starts with '0' such as '09' is illegal.
                if (ch && isDecimalDigit(ch.charCodeAt(0))) {
                    throwError({}, Messages.UnexpectedToken, 'ILLEGAL');
                }
            }

            while (isDecimalDigit(source.charCodeAt(index))) {
                number += source[index++];
            }
            ch = source[index];
        }

        if (ch === '.') {
            number += source[index++];
            while (isDecimalDigit(source.charCodeAt(index))) {
                number += source[index++];
            }
            ch = source[index];
        }

        if (ch === 'e' || ch === 'E') {
            number += source[index++];

            ch = source[index];
            if (ch === '+' || ch === '-') {
                number += source[index++];
            }
            if (isDecimalDigit(source.charCodeAt(index))) {
                while (isDecimalDigit(source.charCodeAt(index))) {
                    number += source[index++];
                }
            } else {
                throwError({}, Messages.UnexpectedToken, 'ILLEGAL');
            }
        }

        if (isIdentifierStart(source.charCodeAt(index))) {
            throwError({}, Messages.UnexpectedToken, 'ILLEGAL');
        }

        return {
            type: Token.NumericLiteral,
            value: parseFloat(number),
            lineNumber: lineNumber,
            lineStart: lineStart,
            range: [start, index]
        };
    }

    // 7.8.4 String Literals

    function scanStringLiteral() {
        var str = '', quote, start, ch, code, unescaped, restore, octal = false;

        quote = source[index];
        assert((quote === '\'' || quote === '"'),
            'String literal must starts with a quote');

        start = index;
        ++index;

        while (index < length) {
            ch = source[index++];

            if (ch === quote) {
                quote = '';
                break;
            } else if (ch === '\\') {
                ch = source[index++];
                if (!ch || !isLineTerminator(ch.charCodeAt(0))) {
                    switch (ch) {
                    case 'n':
                        str += '\n';
                        break;
                    case 'r':
                        str += '\r';
                        break;
                    case 't':
                        str += '\t';
                        break;
                    case 'u':
                    case 'x':
                        if (source[index] === '{') {
                            ++index;
                            str += scanUnicodeCodePointEscape();
                        } else {
                            restore = index;
                            unescaped = scanHexEscape(ch);
                            if (unescaped) {
                                str += unescaped;
                            } else {
                                index = restore;
                                str += ch;
                            }
                        }
                        break;
                    case 'b':
                        str += '\b';
                        break;
                    case 'f':
                        str += '\f';
                        break;
                    case 'v':
                        str += '\x0B';
                        break;

                    default:
                        if (isOctalDigit(ch)) {
                            code = '01234567'.indexOf(ch);

                            // \0 is not octal escape sequence
                            if (code !== 0) {
                                octal = true;
                            }

                            if (index < length && isOctalDigit(source[index])) {
                                octal = true;
                                code = code * 8 + '01234567'.indexOf(source[index++]);

                                // 3 digits are only allowed when string starts
                                // with 0, 1, 2, 3
                                if ('0123'.indexOf(ch) >= 0 &&
                                        index < length &&
                                        isOctalDigit(source[index])) {
                                    code = code * 8 + '01234567'.indexOf(source[index++]);
                                }
                            }
                            str += String.fromCharCode(code);
                        } else {
                            str += ch;
                        }
                        break;
                    }
                } else {
                    ++lineNumber;
                    if (ch ===  '\r' && source[index] === '\n') {
                        ++index;
                    }
                    lineStart = index;
                }
            } else if (isLineTerminator(ch.charCodeAt(0))) {
                break;
            } else {
                str += ch;
            }
        }

        if (quote !== '') {
            throwError({}, Messages.UnexpectedToken, 'ILLEGAL');
        }

        return {
            type: Token.StringLiteral,
            value: str,
            octal: octal,
            lineNumber: lineNumber,
            lineStart: lineStart,
            range: [start, index]
        };
    }

    function scanTemplate() {
        var cooked = '', ch, start, terminated, tail, restore, unescaped, code, octal;

        terminated = false;
        tail = false;
        start = index;

        ++index;

        while (index < length) {
            ch = source[index++];
            if (ch === '`') {
                tail = true;
                terminated = true;
                break;
            } else if (ch === '$') {
                if (source[index] === '{') {
                    ++index;
                    terminated = true;
                    break;
                }
                cooked += ch;
            } else if (ch === '\\') {
                ch = source[index++];
                if (!isLineTerminator(ch.charCodeAt(0))) {
                    switch (ch) {
                    case 'n':
                        cooked += '\n';
                        break;
                    case 'r':
                        cooked += '\r';
                        break;
                    case 't':
                        cooked += '\t';
                        break;
                    case 'u':
                    case 'x':
                        if (source[index] === '{') {
                            ++index;
                            cooked += scanUnicodeCodePointEscape();
                        } else {
                            restore = index;
                            unescaped = scanHexEscape(ch);
                            if (unescaped) {
                                cooked += unescaped;
                            } else {
                                index = restore;
                                cooked += ch;
                            }
                        }
                        break;
                    case 'b':
                        cooked += '\b';
                        break;
                    case 'f':
                        cooked += '\f';
                        break;
                    case 'v':
                        cooked += '\v';
                        break;

                    default:
                        if (isOctalDigit(ch)) {
                            code = '01234567'.indexOf(ch);

                            // \0 is not octal escape sequence
                            if (code !== 0) {
                                octal = true;
                            }

                            if (index < length && isOctalDigit(source[index])) {
                                octal = true;
                                code = code * 8 + '01234567'.indexOf(source[index++]);

                                // 3 digits are only allowed when string starts
                                // with 0, 1, 2, 3
                                if ('0123'.indexOf(ch) >= 0 &&
                                        index < length &&
                                        isOctalDigit(source[index])) {
                                    code = code * 8 + '01234567'.indexOf(source[index++]);
                                }
                            }
                            cooked += String.fromCharCode(code);
                        } else {
                            cooked += ch;
                        }
                        break;
                    }
                } else {
                    ++lineNumber;
                    if (ch ===  '\r' && source[index] === '\n') {
                        ++index;
                    }
                    lineStart = index;
                }
            } else if (isLineTerminator(ch.charCodeAt(0))) {
                ++lineNumber;
                if (ch ===  '\r' && source[index] === '\n') {
                    ++index;
                }
                lineStart = index;
                cooked += '\n';
            } else {
                cooked += ch;
            }
        }

        if (!terminated) {
            throwError({}, Messages.UnexpectedToken, 'ILLEGAL');
        }

        return {
            type: Token.Template,
            value: {
                cooked: cooked,
                raw: source.slice(start + 1, index - ((tail) ? 1 : 2))
            },
            tail: tail,
            octal: octal,
            lineNumber: lineNumber,
            lineStart: lineStart,
            range: [start, index]
        };
    }

    function scanTemplateElement(option) {
        var startsWith, template;

        lookahead = null;
        skipComment();

        startsWith = (option.head) ? '`' : '}';

        if (source[index] !== startsWith) {
            throwError({}, Messages.UnexpectedToken, 'ILLEGAL');
        }

        template = scanTemplate();

        peek();

        return template;
    }

    function scanRegExp() {
        var str, ch, start, pattern, flags, value, classMarker = false, restore, terminated = false, tmp;

        lookahead = null;
        skipComment();

        start = index;
        ch = source[index];
        assert(ch === '/', 'Regular expression literal must start with a slash');
        str = source[index++];

        while (index < length) {
            ch = source[index++];
            str += ch;
            if (classMarker) {
                if (ch === ']') {
                    classMarker = false;
                }
            } else {
                if (ch === '\\') {
                    ch = source[index++];
                    // ECMA-262 7.8.5
                    if (isLineTerminator(ch.charCodeAt(0))) {
                        throwError({}, Messages.UnterminatedRegExp);
                    }
                    str += ch;
                } else if (ch === '/') {
                    terminated = true;
                    break;
                } else if (ch === '[') {
                    classMarker = true;
                } else if (isLineTerminator(ch.charCodeAt(0))) {
                    throwError({}, Messages.UnterminatedRegExp);
                }
            }
        }

        if (!terminated) {
            throwError({}, Messages.UnterminatedRegExp);
        }

        // Exclude leading and trailing slash.
        pattern = str.substr(1, str.length - 2);

        flags = '';
        while (index < length) {
            ch = source[index];
            if (!isIdentifierPart(ch.charCodeAt(0))) {
                break;
            }

            ++index;
            if (ch === '\\' && index < length) {
                ch = source[index];
                if (ch === 'u') {
                    ++index;
                    restore = index;
                    ch = scanHexEscape('u');
                    if (ch) {
                        flags += ch;
                        for (str += '\\u'; restore < index; ++restore) {
                            str += source[restore];
                        }
                    } else {
                        index = restore;
                        flags += 'u';
                        str += '\\u';
                    }
                } else {
                    str += '\\';
                }
            } else {
                flags += ch;
                str += ch;
            }
        }

        tmp = pattern;
        if (flags.indexOf('u') >= 0) {
            // Replace each astral symbol and every Unicode code point
            // escape sequence that represents such a symbol with a single
            // ASCII symbol to avoid throwing on regular expressions that
            // are only valid in combination with the `/u` flag.
            tmp = tmp
                .replace(/\\u\{([0-9a-fA-F]{5,6})\}/g, 'x')
                .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, 'x');
        }

        // First, detect invalid regular expressions.
        try {
            value = new RegExp(tmp);
        } catch (e) {
            throwError({}, Messages.InvalidRegExp);
        }

        // Return a regular expression object for this pattern-flag pair, or
        // `null` in case the current environment doesn't support the flags it
        // uses.
        try {
            value = new RegExp(pattern, flags);
        } catch (exception) {
            value = null;
        }

        peek();

        if (extra.tokenize) {
            return {
                type: Token.RegularExpression,
                value: value,
                regex: {
                    pattern: pattern,
                    flags: flags
                },
                lineNumber: lineNumber,
                lineStart: lineStart,
                range: [start, index]
            };
        }
        return {
            literal: str,
            value: value,
            regex: {
                pattern: pattern,
                flags: flags
            },
            range: [start, index]
        };
    }

    function isIdentifierName(token) {
        return token.type === Token.Identifier ||
            token.type === Token.Keyword ||
            token.type === Token.BooleanLiteral ||
            token.type === Token.NullLiteral;
    }

    function advanceSlash() {
        var prevToken,
            checkToken;
        // Using the following algorithm:
        // https://github.com/mozilla/sweet.js/wiki/design
        prevToken = extra.tokens[extra.tokens.length - 1];
        if (!prevToken) {
            // Nothing before that: it cannot be a division.
            return scanRegExp();
        }
        if (prevToken.type === 'Punctuator') {
            if (prevToken.value === ')') {
                checkToken = extra.tokens[extra.openParenToken - 1];
                if (checkToken &&
                        checkToken.type === 'Keyword' &&
                        (checkToken.value === 'if' ||
                         checkToken.value === 'while' ||
                         checkToken.value === 'for' ||
                         checkToken.value === 'with')) {
                    return scanRegExp();
                }
                return scanPunctuator();
            }
            if (prevToken.value === '}') {
                // Dividing a function by anything makes little sense,
                // but we have to check for that.
                if (extra.tokens[extra.openCurlyToken - 3] &&
                        extra.tokens[extra.openCurlyToken - 3].type === 'Keyword') {
                    // Anonymous function.
                    checkToken = extra.tokens[extra.openCurlyToken - 4];
                    if (!checkToken) {
                        return scanPunctuator();
                    }
                } else if (extra.tokens[extra.openCurlyToken - 4] &&
                        extra.tokens[extra.openCurlyToken - 4].type === 'Keyword') {
                    // Named function.
                    checkToken = extra.tokens[extra.openCurlyToken - 5];
                    if (!checkToken) {
                        return scanRegExp();
                    }
                } else {
                    return scanPunctuator();
                }
                // checkToken determines whether the function is
                // a declaration or an expression.
                if (FnExprTokens.indexOf(checkToken.value) >= 0) {
                    // It is an expression.
                    return scanPunctuator();
                }
                // It is a declaration.
                return scanRegExp();
            }
            return scanRegExp();
        }
        if (prevToken.type === 'Keyword') {
            return scanRegExp();
        }
        return scanPunctuator();
    }

    function advance() {
        var ch;

        if (!state.inXJSChild) {
            skipComment();
        }

        if (index >= length) {
            return {
                type: Token.EOF,
                lineNumber: lineNumber,
                lineStart: lineStart,
                range: [index, index]
            };
        }

        if (state.inXJSChild) {
            return advanceXJSChild();
        }

        ch = source.charCodeAt(index);

        // Very common: ( and ) and ;
        if (ch === 40 || ch === 41 || ch === 58) {
            return scanPunctuator();
        }

        // String literal starts with single quote (#39) or double quote (#34).
        if (ch === 39 || ch === 34) {
            if (state.inXJSTag) {
                return scanXJSStringLiteral();
            }
            return scanStringLiteral();
        }

        if (state.inXJSTag && isXJSIdentifierStart(ch)) {
            return scanXJSIdentifier();
        }

        if (ch === 96) {
            return scanTemplate();
        }
        if (isIdentifierStart(ch)) {
            return scanIdentifier();
        }

        // Dot (.) char #46 can also start a floating-point number, hence the need
        // to check the next character.
        if (ch === 46) {
            if (isDecimalDigit(source.charCodeAt(index + 1))) {
                return scanNumericLiteral();
            }
            return scanPunctuator();
        }

        if (isDecimalDigit(ch)) {
            return scanNumericLiteral();
        }

        // Slash (/) char #47 can also start a regex.
        if (extra.tokenize && ch === 47) {
            return advanceSlash();
        }

        return scanPunctuator();
    }

    function lex() {
        var token;

        token = lookahead;
        index = token.range[1];
        lineNumber = token.lineNumber;
        lineStart = token.lineStart;

        lookahead = advance();

        index = token.range[1];
        lineNumber = token.lineNumber;
        lineStart = token.lineStart;

        return token;
    }

    function peek() {
        var pos, line, start;

        pos = index;
        line = lineNumber;
        start = lineStart;
        lookahead = advance();
        index = pos;
        lineNumber = line;
        lineStart = start;
    }

    function lookahead2() {
        var adv, pos, line, start, result;

        // If we are collecting the tokens, don't grab the next one yet.
        adv = (typeof extra.advance === 'function') ? extra.advance : advance;

        pos = index;
        line = lineNumber;
        start = lineStart;

        // Scan for the next immediate token.
        if (lookahead === null) {
            lookahead = adv();
        }
        index = lookahead.range[1];
        lineNumber = lookahead.lineNumber;
        lineStart = lookahead.lineStart;

        // Grab the token right after.
        result = adv();
        index = pos;
        lineNumber = line;
        lineStart = start;

        return result;
    }

    function rewind(token) {
        index = token.range[0];
        lineNumber = token.lineNumber;
        lineStart = token.lineStart;
        lookahead = token;
    }

    function markerCreate() {
        if (!extra.loc && !extra.range) {
            return undefined;
        }
        skipComment();
        return {offset: index, line: lineNumber, col: index - lineStart};
    }

    function markerCreatePreserveWhitespace() {
        if (!extra.loc && !extra.range) {
            return undefined;
        }
        return {offset: index, line: lineNumber, col: index - lineStart};
    }

    function processComment(node) {
        var lastChild,
            trailingComments,
            bottomRight = extra.bottomRightStack,
            last = bottomRight[bottomRight.length - 1];

        if (node.type === Syntax.Program) {
            if (node.body.length > 0) {
                return;
            }
        }

        if (extra.trailingComments.length > 0) {
            if (extra.trailingComments[0].range[0] >= node.range[1]) {
                trailingComments = extra.trailingComments;
                extra.trailingComments = [];
            } else {
                extra.trailingComments.length = 0;
            }
        } else {
            if (last && last.trailingComments && last.trailingComments[0].range[0] >= node.range[1]) {
                trailingComments = last.trailingComments;
                delete last.trailingComments;
            }
        }

        // Eating the stack.
        if (last) {
            while (last && last.range[0] >= node.range[0]) {
                lastChild = last;
                last = bottomRight.pop();
            }
        }

        if (lastChild) {
            if (lastChild.leadingComments && lastChild.leadingComments[lastChild.leadingComments.length - 1].range[1] <= node.range[0]) {
                node.leadingComments = lastChild.leadingComments;
                delete lastChild.leadingComments;
            }
        } else if (extra.leadingComments.length > 0 && extra.leadingComments[extra.leadingComments.length - 1].range[1] <= node.range[0]) {
            node.leadingComments = extra.leadingComments;
            extra.leadingComments = [];
        }

        if (trailingComments) {
            node.trailingComments = trailingComments;
        }

        bottomRight.push(node);
    }

    function markerApply(marker, node) {
        if (extra.range) {
            node.range = [marker.offset, index];
        }
        if (extra.loc) {
            node.loc = {
                start: {
                    line: marker.line,
                    column: marker.col
                },
                end: {
                    line: lineNumber,
                    column: index - lineStart
                }
            };
            node = delegate.postProcess(node);
        }
        if (extra.attachComment) {
            processComment(node);
        }
        return node;
    }

    SyntaxTreeDelegate = {

        name: 'SyntaxTree',

        postProcess: function (node) {
            return node;
        },

        createArrayExpression: function (elements) {
            return {
                type: Syntax.ArrayExpression,
                elements: elements
            };
        },

        createAssignmentExpression: function (operator, left, right) {
            return {
                type: Syntax.AssignmentExpression,
                operator: operator,
                left: left,
                right: right
            };
        },

        createBinaryExpression: function (operator, left, right) {
            var type = (operator === '||' || operator === '&&') ? Syntax.LogicalExpression :
                        Syntax.BinaryExpression;
            return {
                type: type,
                operator: operator,
                left: left,
                right: right
            };
        },

        createBlockStatement: function (body) {
            return {
                type: Syntax.BlockStatement,
                body: body
            };
        },

        createBreakStatement: function (label) {
            return {
                type: Syntax.BreakStatement,
                label: label
            };
        },

        createCallExpression: function (callee, args) {
            return {
                type: Syntax.CallExpression,
                callee: callee,
                'arguments': args
            };
        },

        createCatchClause: function (param, body) {
            return {
                type: Syntax.CatchClause,
                param: param,
                body: body
            };
        },

        createConditionalExpression: function (test, consequent, alternate) {
            return {
                type: Syntax.ConditionalExpression,
                test: test,
                consequent: consequent,
                alternate: alternate
            };
        },

        createContinueStatement: function (label) {
            return {
                type: Syntax.ContinueStatement,
                label: label
            };
        },

        createDebuggerStatement: function () {
            return {
                type: Syntax.DebuggerStatement
            };
        },

        createDoWhileStatement: function (body, test) {
            return {
                type: Syntax.DoWhileStatement,
                body: body,
                test: test
            };
        },

        createEmptyStatement: function () {
            return {
                type: Syntax.EmptyStatement
            };
        },

        createExpressionStatement: function (expression) {
            return {
                type: Syntax.ExpressionStatement,
                expression: expression
            };
        },

        createForStatement: function (init, test, update, body) {
            return {
                type: Syntax.ForStatement,
                init: init,
                test: test,
                update: update,
                body: body
            };
        },

        createForInStatement: function (left, right, body) {
            return {
                type: Syntax.ForInStatement,
                left: left,
                right: right,
                body: body,
                each: false
            };
        },

        createForOfStatement: function (left, right, body) {
            return {
                type: Syntax.ForOfStatement,
                left: left,
                right: right,
                body: body
            };
        },

        createFunctionDeclaration: function (id, params, defaults, body, rest, generator, expression,
                                             isAsync, returnType, parametricType) {
            var funDecl = {
                type: Syntax.FunctionDeclaration,
                id: id,
                params: params,
                defaults: defaults,
                body: body,
                rest: rest,
                generator: generator,
                expression: expression,
                returnType: returnType,
                parametricType: parametricType
            };

            if (isAsync) {
                funDecl.async = true;
            }

            return funDecl;
        },

        createFunctionExpression: function (id, params, defaults, body, rest, generator, expression,
                                            isAsync, returnType, parametricType) {
            var funExpr = {
                type: Syntax.FunctionExpression,
                id: id,
                params: params,
                defaults: defaults,
                body: body,
                rest: rest,
                generator: generator,
                expression: expression,
                returnType: returnType,
                parametricType: parametricType
            };

            if (isAsync) {
                funExpr.async = true;
            }

            return funExpr;
        },

        createIdentifier: function (name) {
            return {
                type: Syntax.Identifier,
                name: name,
                // Only here to initialize the shape of the object to ensure
                // that the 'typeAnnotation' key is ordered before others that
                // are added later (like 'loc' and 'range'). This just helps
                // keep the shape of Identifier nodes consistent with everything
                // else.
                typeAnnotation: undefined
            };
        },

        createTypeAnnotation: function (typeIdentifier, parametricType, params, returnType, nullable) {
            return {
                type: Syntax.TypeAnnotation,
                id: typeIdentifier,
                parametricType: parametricType,
                params: params,
                returnType: returnType,
                nullable: nullable
            };
        },

        createParametricTypeAnnotation: function (parametricTypes) {
            return {
                type: Syntax.ParametricTypeAnnotation,
                params: parametricTypes
            };
        },

        createVoidTypeAnnotation: function () {
            return {
                type: Syntax.VoidTypeAnnotation
            };
        },

        createObjectTypeAnnotation: function (properties, nullable) {
            return {
                type: Syntax.ObjectTypeAnnotation,
                properties: properties,
                nullable: nullable
            };
        },

        createTypeAnnotatedIdentifier: function (identifier, annotation, isOptionalParam) {
            return {
                type: Syntax.TypeAnnotatedIdentifier,
                id: identifier,
                annotation: annotation
            };
        },

        createOptionalParameter: function (identifier) {
            return {
                type: Syntax.OptionalParameter,
                id: identifier
            };
        },

        createXJSAttribute: function (name, value) {
            return {
                type: Syntax.XJSAttribute,
                name: name,
                value: value || null
            };
        },

        createXJSSpreadAttribute: function (argument) {
            return {
                type: Syntax.XJSSpreadAttribute,
                argument: argument
            };
        },

        createXJSIdentifier: function (name) {
            return {
                type: Syntax.XJSIdentifier,
                name: name
            };
        },

        createXJSNamespacedName: function (namespace, name) {
            return {
                type: Syntax.XJSNamespacedName,
                namespace: namespace,
                name: name
            };
        },

        createXJSMemberExpression: function (object, property) {
            return {
                type: Syntax.XJSMemberExpression,
                object: object,
                property: property
            };
        },

        createXJSElement: function (openingElement, closingElement, children) {
            return {
                type: Syntax.XJSElement,
                openingElement: openingElement,
                closingElement: closingElement,
                children: children
            };
        },

        createXJSEmptyExpression: function () {
            return {
                type: Syntax.XJSEmptyExpression
            };
        },

        createXJSExpressionContainer: function (expression) {
            return {
                type: Syntax.XJSExpressionContainer,
                expression: expression
            };
        },

        createXJSOpeningElement: function (name, attributes, selfClosing) {
            return {
                type: Syntax.XJSOpeningElement,
                name: name,
                selfClosing: selfClosing,
                attributes: attributes
            };
        },

        createXJSClosingElement: function (name) {
            return {
                type: Syntax.XJSClosingElement,
                name: name
            };
        },

        createIfStatement: function (test, consequent, alternate) {
            return {
                type: Syntax.IfStatement,
                test: test,
                consequent: consequent,
                alternate: alternate
            };
        },

        createLabeledStatement: function (label, body) {
            return {
                type: Syntax.LabeledStatement,
                label: label,
                body: body
            };
        },

        createLiteral: function (token) {
            var object = {
                type: Syntax.Literal,
                value: token.value,
                raw: source.slice(token.range[0], token.range[1])
            };
            if (token.regex) {
                object.regex = token.regex;
            }
            return object;
        },

        createMemberExpression: function (accessor, object, property) {
            return {
                type: Syntax.MemberExpression,
                computed: accessor === '[',
                object: object,
                property: property
            };
        },

        createNewExpression: function (callee, args) {
            return {
                type: Syntax.NewExpression,
                callee: callee,
                'arguments': args
            };
        },

        createObjectExpression: function (properties) {
            return {
                type: Syntax.ObjectExpression,
                properties: properties
            };
        },

        createPostfixExpression: function (operator, argument) {
            return {
                type: Syntax.UpdateExpression,
                operator: operator,
                argument: argument,
                prefix: false
            };
        },

        createProgram: function (body) {
            return {
                type: Syntax.Program,
                body: body
            };
        },

        createProperty: function (kind, key, value, method, shorthand, computed) {
            return {
                type: Syntax.Property,
                key: key,
                value: value,
                kind: kind,
                method: method,
                shorthand: shorthand,
                computed: computed
            };
        },

        createReturnStatement: function (argument) {
            return {
                type: Syntax.ReturnStatement,
                argument: argument
            };
        },

        createSequenceExpression: function (expressions) {
            return {
                type: Syntax.SequenceExpression,
                expressions: expressions
            };
        },

        createSwitchCase: function (test, consequent) {
            return {
                type: Syntax.SwitchCase,
                test: test,
                consequent: consequent
            };
        },

        createSwitchStatement: function (discriminant, cases) {
            return {
                type: Syntax.SwitchStatement,
                discriminant: discriminant,
                cases: cases
            };
        },

        createThisExpression: function () {
            return {
                type: Syntax.ThisExpression
            };
        },

        createThrowStatement: function (argument) {
            return {
                type: Syntax.ThrowStatement,
                argument: argument
            };
        },

        createTryStatement: function (block, guardedHandlers, handlers, finalizer) {
            return {
                type: Syntax.TryStatement,
                block: block,
                guardedHandlers: guardedHandlers,
                handlers: handlers,
                finalizer: finalizer
            };
        },

        createUnaryExpression: function (operator, argument) {
            if (operator === '++' || operator === '--') {
                return {
                    type: Syntax.UpdateExpression,
                    operator: operator,
                    argument: argument,
                    prefix: true
                };
            }
            return {
                type: Syntax.UnaryExpression,
                operator: operator,
                argument: argument,
                prefix: true
            };
        },

        createVariableDeclaration: function (declarations, kind) {
            return {
                type: Syntax.VariableDeclaration,
                declarations: declarations,
                kind: kind
            };
        },

        createVariableDeclarator: function (id, init) {
            return {
                type: Syntax.VariableDeclarator,
                id: id,
                init: init
            };
        },

        createWhileStatement: function (test, body) {
            return {
                type: Syntax.WhileStatement,
                test: test,
                body: body
            };
        },

        createWithStatement: function (object, body) {
            return {
                type: Syntax.WithStatement,
                object: object,
                body: body
            };
        },

        createTemplateElement: function (value, tail) {
            return {
                type: Syntax.TemplateElement,
                value: value,
                tail: tail
            };
        },

        createTemplateLiteral: function (quasis, expressions) {
            return {
                type: Syntax.TemplateLiteral,
                quasis: quasis,
                expressions: expressions
            };
        },

        createSpreadElement: function (argument) {
            return {
                type: Syntax.SpreadElement,
                argument: argument
            };
        },

        createSpreadProperty: function (argument) {
            return {
                type: Syntax.SpreadProperty,
                argument: argument
            };
        },

        createTaggedTemplateExpression: function (tag, quasi) {
            return {
                type: Syntax.TaggedTemplateExpression,
                tag: tag,
                quasi: quasi
            };
        },

        createArrowFunctionExpression: function (params, defaults, body, rest, expression, isAsync) {
            var arrowExpr = {
                type: Syntax.ArrowFunctionExpression,
                id: null,
                params: params,
                defaults: defaults,
                body: body,
                rest: rest,
                generator: false,
                expression: expression
            };

            if (isAsync) {
                arrowExpr.async = true;
            }

            return arrowExpr;
        },

        createMethodDefinition: function (propertyType, kind, key, value) {
            return {
                type: Syntax.MethodDefinition,
                key: key,
                value: value,
                kind: kind,
                'static': propertyType === ClassPropertyType.static
            };
        },

        createClassProperty: function (propertyIdentifier) {
            return {
                type: Syntax.ClassProperty,
                id: propertyIdentifier
            };
        },

        createClassBody: function (body) {
            return {
                type: Syntax.ClassBody,
                body: body
            };
        },

        createClassExpression: function (id, superClass, body, parametricType) {
            return {
                type: Syntax.ClassExpression,
                id: id,
                superClass: superClass,
                body: body,
                parametricType: parametricType
            };
        },

        createClassDeclaration: function (id, superClass, body, parametricType, superParametricType) {
            return {
                type: Syntax.ClassDeclaration,
                id: id,
                superClass: superClass,
                body: body,
                parametricType: parametricType,
                superParametricType: superParametricType
            };
        },

        createModuleSpecifier: function (token) {
            return {
                type: Syntax.ModuleSpecifier,
                value: token.value,
                raw: source.slice(token.range[0], token.range[1])
            };
        },

        createExportSpecifier: function (id, name) {
            return {
                type: Syntax.ExportSpecifier,
                id: id,
                name: name
            };
        },

        createExportBatchSpecifier: function () {
            return {
                type: Syntax.ExportBatchSpecifier
            };
        },

        createImportDefaultSpecifier: function (id) {
            return {
                type: Syntax.ImportDefaultSpecifier,
                id: id
            };
        },

        createImportNamespaceSpecifier: function (id) {
            return {
                type: Syntax.ImportNamespaceSpecifier,
                id: id
            };
        },

        createExportDeclaration: function (isDefault, declaration, specifiers, source) {
            return {
                type: Syntax.ExportDeclaration,
                'default': !!isDefault,
                declaration: declaration,
                specifiers: specifiers,
                source: source
            };
        },

        createImportSpecifier: function (id, name) {
            return {
                type: Syntax.ImportSpecifier,
                id: id,
                name: name
            };
        },

        createImportDeclaration: function (specifiers, source) {
            return {
                type: Syntax.ImportDeclaration,
                specifiers: specifiers,
                source: source
            };
        },

        createYieldExpression: function (argument, delegate) {
            return {
                type: Syntax.YieldExpression,
                argument: argument,
                delegate: delegate
            };
        },

        createAwaitExpression: function (argument) {
            return {
                type: Syntax.AwaitExpression,
                argument: argument
            };
        },

        createComprehensionExpression: function (filter, blocks, body) {
            return {
                type: Syntax.ComprehensionExpression,
                filter: filter,
                blocks: blocks,
                body: body
            };
        }

    };

    // Return true if there is a line terminator before the next token.

    function peekLineTerminator() {
        var pos, line, start, found;

        pos = index;
        line = lineNumber;
        start = lineStart;
        skipComment();
        found = lineNumber !== line;
        index = pos;
        lineNumber = line;
        lineStart = start;

        return found;
    }

    // Throw an exception

    function throwError(token, messageFormat) {
        var error,
            args = Array.prototype.slice.call(arguments, 2),
            msg = messageFormat.replace(
                /%(\d)/g,
                function (whole, index) {
                    assert(index < args.length, 'Message reference must be in range');
                    return args[index];
                }
            );

        if (typeof token.lineNumber === 'number') {
            error = new Error('Line ' + token.lineNumber + ': ' + msg);
            error.index = token.range[0];
            error.lineNumber = token.lineNumber;
            error.column = token.range[0] - lineStart + 1;
        } else {
            error = new Error('Line ' + lineNumber + ': ' + msg);
            error.index = index;
            error.lineNumber = lineNumber;
            error.column = index - lineStart + 1;
        }

        error.description = msg;
        throw error;
    }

    function throwErrorTolerant() {
        try {
            throwError.apply(null, arguments);
        } catch (e) {
            if (extra.errors) {
                extra.errors.push(e);
            } else {
                throw e;
            }
        }
    }


    // Throw an exception because of the token.

    function throwUnexpected(token) {
        if (token.type === Token.EOF) {
            throwError(token, Messages.UnexpectedEOS);
        }

        if (token.type === Token.NumericLiteral) {
            throwError(token, Messages.UnexpectedNumber);
        }

        if (token.type === Token.StringLiteral || token.type === Token.XJSText) {
            throwError(token, Messages.UnexpectedString);
        }

        if (token.type === Token.Identifier) {
            throwError(token, Messages.UnexpectedIdentifier);
        }

        if (token.type === Token.Keyword) {
            if (isFutureReservedWord(token.value)) {
                throwError(token, Messages.UnexpectedReserved);
            } else if (strict && isStrictModeReservedWord(token.value)) {
                throwErrorTolerant(token, Messages.StrictReservedWord);
                return;
            }
            throwError(token, Messages.UnexpectedToken, token.value);
        }

        if (token.type === Token.Template) {
            throwError(token, Messages.UnexpectedTemplate, token.value.raw);
        }

        // BooleanLiteral, NullLiteral, or Punctuator.
        throwError(token, Messages.UnexpectedToken, token.value);
    }

    // Expect the next token to match the specified punctuator.
    // If not, an exception will be thrown.

    function expect(value) {
        var token = lex();
        if (token.type !== Token.Punctuator || token.value !== value) {
            throwUnexpected(token);
        }
    }

    // Expect the next token to match the specified keyword.
    // If not, an exception will be thrown.

    function expectKeyword(keyword, contextual) {
        var token = lex();
        if (token.type !== (contextual ? Token.Identifier : Token.Keyword) ||
                token.value !== keyword) {
            throwUnexpected(token);
        }
    }

    // Expect the next token to match the specified contextual keyword.
    // If not, an exception will be thrown.

    function expectContextualKeyword(keyword) {
        return expectKeyword(keyword, true);
    }

    // Return true if the next token matches the specified punctuator.

    function match(value) {
        return lookahead.type === Token.Punctuator && lookahead.value === value;
    }

    // Return true if the next token matches the specified keyword

    function matchKeyword(keyword, contextual) {
        var expectedType = contextual ? Token.Identifier : Token.Keyword;
        return lookahead.type === expectedType && lookahead.value === keyword;
    }

    // Return true if the next token matches the specified contextual keyword

    function matchContextualKeyword(keyword) {
        return matchKeyword(keyword, true);
    }

    // Return true if the next token is an assignment operator

    function matchAssign() {
        var op;

        if (lookahead.type !== Token.Punctuator) {
            return false;
        }
        op = lookahead.value;
        return op === '=' ||
            op === '*=' ||
            op === '/=' ||
            op === '%=' ||
            op === '+=' ||
            op === '-=' ||
            op === '<<=' ||
            op === '>>=' ||
            op === '>>>=' ||
            op === '&=' ||
            op === '^=' ||
            op === '|=';
    }

    // Note that 'yield' is treated as a keyword in strict mode, but a
    // contextual keyword (identifier) in non-strict mode, so we need to
    // use matchKeyword('yield', false) and matchKeyword('yield', true)
    // (i.e. matchContextualKeyword) appropriately.
    function matchYield() {
        return state.yieldAllowed && matchKeyword('yield', !strict);
    }

    function matchAsync() {
        var backtrackToken = lookahead, matches = false;

        if (matchContextualKeyword('async')) {
            lex(); // Make sure peekLineTerminator() starts after 'async'.
            matches = !peekLineTerminator();
            rewind(backtrackToken); // Revert the lex().
        }

        return matches;
    }

    function matchAwait() {
        return state.awaitAllowed && matchContextualKeyword('await');
    }

    function consumeSemicolon() {
        var line, oldIndex = index, oldLineNumber = lineNumber,
            oldLineStart = lineStart, oldLookahead = lookahead;

        // Catch the very common case first: immediately a semicolon (char #59).
        if (source.charCodeAt(index) === 59) {
            lex();
            return;
        }

        line = lineNumber;
        skipComment();
        if (lineNumber !== line) {
            index = oldIndex;
            lineNumber = oldLineNumber;
            lineStart = oldLineStart;
            lookahead = oldLookahead;
            return;
        }

        if (match(';')) {
            lex();
            return;
        }

        if (lookahead.type !== Token.EOF && !match('}')) {
            throwUnexpected(lookahead);
        }
    }

    // Return true if provided expression is LeftHandSideExpression

    function isLeftHandSide(expr) {
        return expr.type === Syntax.Identifier || expr.type === Syntax.MemberExpression;
    }

    function isAssignableLeftHandSide(expr) {
        return isLeftHandSide(expr) || expr.type === Syntax.ObjectPattern || expr.type === Syntax.ArrayPattern;
    }

    // 11.1.4 Array Initialiser

    function parseArrayInitialiser() {
        var elements = [], blocks = [], filter = null, tmp, possiblecomprehension = true, body,
            marker = markerCreate();

        expect('[');
        while (!match(']')) {
            if (lookahead.value === 'for' &&
                    lookahead.type === Token.Keyword) {
                if (!possiblecomprehension) {
                    throwError({}, Messages.ComprehensionError);
                }
                matchKeyword('for');
                tmp = parseForStatement({ignoreBody: true});
                tmp.of = tmp.type === Syntax.ForOfStatement;
                tmp.type = Syntax.ComprehensionBlock;
                if (tmp.left.kind) { // can't be let or const
                    throwError({}, Messages.ComprehensionError);
                }
                blocks.push(tmp);
            } else if (lookahead.value === 'if' &&
                           lookahead.type === Token.Keyword) {
                if (!possiblecomprehension) {
                    throwError({}, Messages.ComprehensionError);
                }
                expectKeyword('if');
                expect('(');
                filter = parseExpression();
                expect(')');
            } else if (lookahead.value === ',' &&
                           lookahead.type === Token.Punctuator) {
                possiblecomprehension = false; // no longer allowed.
                lex();
                elements.push(null);
            } else {
                tmp = parseSpreadOrAssignmentExpression();
                elements.push(tmp);
                if (tmp && tmp.type === Syntax.SpreadElement) {
                    if (!match(']')) {
                        throwError({}, Messages.ElementAfterSpreadElement);
                    }
                } else if (!(match(']') || matchKeyword('for') || matchKeyword('if'))) {
                    expect(','); // this lexes.
                    possiblecomprehension = false;
                }
            }
        }

        expect(']');

        if (filter && !blocks.length) {
            throwError({}, Messages.ComprehensionRequiresBlock);
        }

        if (blocks.length) {
            if (elements.length !== 1) {
                throwError({}, Messages.ComprehensionError);
            }
            return markerApply(marker, delegate.createComprehensionExpression(filter, blocks, elements[0]));
        }
        return markerApply(marker, delegate.createArrayExpression(elements));
    }

    // 11.1.5 Object Initialiser

    function parsePropertyFunction(options) {
        var previousStrict, previousYieldAllowed, previousAwaitAllowed,
            params, defaults, body, marker = markerCreate();

        previousStrict = strict;
        previousYieldAllowed = state.yieldAllowed;
        state.yieldAllowed = options.generator;
        previousAwaitAllowed = state.awaitAllowed;
        state.awaitAllowed = options.async;
        params = options.params || [];
        defaults = options.defaults || [];

        body = parseConciseBody();
        if (options.name && strict && isRestrictedWord(params[0].name)) {
            throwErrorTolerant(options.name, Messages.StrictParamName);
        }
        strict = previousStrict;
        state.yieldAllowed = previousYieldAllowed;
        state.awaitAllowed = previousAwaitAllowed;

        return markerApply(marker, delegate.createFunctionExpression(
            null,
            params,
            defaults,
            body,
            options.rest || null,
            options.generator,
            body.type !== Syntax.BlockStatement,
            options.async,
            options.returnType,
            options.parametricType
        ));
    }


    function parsePropertyMethodFunction(options) {
        var previousStrict, tmp, method;

        previousStrict = strict;
        strict = true;

        tmp = parseParams();

        if (tmp.stricted) {
            throwErrorTolerant(tmp.stricted, tmp.message);
        }

        method = parsePropertyFunction({
            params: tmp.params,
            defaults: tmp.defaults,
            rest: tmp.rest,
            generator: options.generator,
            async: options.async,
            returnType: tmp.returnType,
            parametricType: options.parametricType
        });

        strict = previousStrict;

        return method;
    }


    function parseObjectPropertyKey() {
        var marker = markerCreate(),
            token = lex(),
            propertyKey,
            result;

        // Note: This function is called only from parseObjectProperty(), where
        // EOF and Punctuator tokens are already filtered out.

        if (token.type === Token.StringLiteral || token.type === Token.NumericLiteral) {
            if (strict && token.octal) {
                throwErrorTolerant(token, Messages.StrictOctalLiteral);
            }
            return markerApply(marker, delegate.createLiteral(token));
        }

        if (token.type === Token.Punctuator && token.value === '[') {
            // For computed properties we should skip the [ and ], and
            // capture in marker only the assignment expression itself.
            marker = markerCreate();
            propertyKey = parseAssignmentExpression();
            result = markerApply(marker, propertyKey);
            expect(']');
            return result;
        }

        return markerApply(marker, delegate.createIdentifier(token.value));
    }

    function parseObjectProperty() {
        var token, key, id, value, param, expr, computed,
            marker = markerCreate();

        token = lookahead;
        computed = (token.value === '[');

        if (token.type === Token.Identifier || computed || matchAsync()) {
            id = parseObjectPropertyKey();

            if (match(':')) {
                lex();

                return markerApply(
                    marker,
                    delegate.createProperty(
                        'init',
                        id,
                        parseAssignmentExpression(),
                        false,
                        false,
                        computed
                    )
                );
            }

            if (match('(')) {
                return markerApply(
                    marker,
                    delegate.createProperty(
                        'init',
                        id,
                        parsePropertyMethodFunction({
                            generator: false,
                            async: false
                        }),
                        true,
                        false,
                        computed
                    )
                );
            }

            // Property Assignment: Getter and Setter.

            if (token.value === 'get') {
                computed = (lookahead.value === '[');
                key = parseObjectPropertyKey();

                expect('(');
                expect(')');

                return markerApply(
                    marker,
                    delegate.createProperty(
                        'get',
                        key,
                        parsePropertyFunction({
                            generator: false,
                            async: false
                        }),
                        false,
                        false,
                        computed
                    )
                );
            }

            if (token.value === 'set') {
                computed = (lookahead.value === '[');
                key = parseObjectPropertyKey();

                expect('(');
                token = lookahead;
                param = [ parseTypeAnnotatableIdentifier() ];
                expect(')');

                return markerApply(
                    marker,
                    delegate.createProperty(
                        'set',
                        key,
                        parsePropertyFunction({
                            params: param,
                            generator: false,
                            async: false,
                            name: token
                        }),
                        false,
                        false,
                        computed
                    )
                );
            }

            if (token.value === 'async') {
                computed = (lookahead.value === '[');
                key = parseObjectPropertyKey();

                return markerApply(
                    marker,
                    delegate.createProperty(
                        'init',
                        key,
                        parsePropertyMethodFunction({
                            generator: false,
                            async: true
                        }),
                        true,
                        false,
                        computed
                    )
                );
            }

            if (computed) {
                // Computed properties can only be used with full notation.
                throwUnexpected(lookahead);
            }

            return markerApply(
                marker,
                delegate.createProperty('init', id, id, false, true, false)
            );
        }

        if (token.type === Token.EOF || token.type === Token.Punctuator) {
            if (!match('*')) {
                throwUnexpected(token);
            }
            lex();

            computed = (lookahead.type === Token.Punctuator && lookahead.value === '[');

            id = parseObjectPropertyKey();

            if (!match('(')) {
                throwUnexpected(lex());
            }

            return markerApply(marker, delegate.createProperty('init', id, parsePropertyMethodFunction({ generator: true }), true, false, computed));
        }
        key = parseObjectPropertyKey();
        if (match(':')) {
            lex();
            return markerApply(marker, delegate.createProperty('init', key, parseAssignmentExpression(), false, false, false));
        }
        if (match('(')) {
            return markerApply(marker, delegate.createProperty('init', key, parsePropertyMethodFunction({ generator: false }), true, false, false));
        }
        throwUnexpected(lex());
    }

    function parseObjectSpreadProperty() {
        var marker = markerCreate();
        expect('...');
        return markerApply(marker, delegate.createSpreadProperty(parseAssignmentExpression()));
    }

    function parseObjectInitialiser() {
        var properties = [], property, name, key, kind, map = {}, toString = String,
            marker = markerCreate();

        expect('{');

        while (!match('}')) {
            if (match('...')) {
                property = parseObjectSpreadProperty();
            } else {
                property = parseObjectProperty();

                if (property.key.type === Syntax.Identifier) {
                    name = property.key.name;
                } else {
                    name = toString(property.key.value);
                }
                kind = (property.kind === 'init') ? PropertyKind.Data : (property.kind === 'get') ? PropertyKind.Get : PropertyKind.Set;

                key = '$' + name;
                if (Object.prototype.hasOwnProperty.call(map, key)) {
                    if (map[key] === PropertyKind.Data) {
                        if (strict && kind === PropertyKind.Data) {
                            throwErrorTolerant({}, Messages.StrictDuplicateProperty);
                        } else if (kind !== PropertyKind.Data) {
                            throwErrorTolerant({}, Messages.AccessorDataProperty);
                        }
                    } else {
                        if (kind === PropertyKind.Data) {
                            throwErrorTolerant({}, Messages.AccessorDataProperty);
                        } else if (map[key] & kind) {
                            throwErrorTolerant({}, Messages.AccessorGetSet);
                        }
                    }
                    map[key] |= kind;
                } else {
                    map[key] = kind;
                }
            }

            properties.push(property);

            if (!match('}')) {
                expect(',');
            }
        }

        expect('}');

        return markerApply(marker, delegate.createObjectExpression(properties));
    }

    function parseTemplateElement(option) {
        var marker = markerCreate(),
            token = scanTemplateElement(option);
        if (strict && token.octal) {
            throwError(token, Messages.StrictOctalLiteral);
        }
        return markerApply(marker, delegate.createTemplateElement({ raw: token.value.raw, cooked: token.value.cooked }, token.tail));
    }

    function parseTemplateLiteral() {
        var quasi, quasis, expressions, marker = markerCreate();

        quasi = parseTemplateElement({ head: true });
        quasis = [ quasi ];
        expressions = [];

        while (!quasi.tail) {
            expressions.push(parseExpression());
            quasi = parseTemplateElement({ head: false });
            quasis.push(quasi);
        }

        return markerApply(marker, delegate.createTemplateLiteral(quasis, expressions));
    }

    // 11.1.6 The Grouping Operator

    function parseGroupExpression() {
        var expr;

        expect('(');

        ++state.parenthesizedCount;

        expr = parseExpression();

        expect(')');

        return expr;
    }

    function matchAsyncFuncExprOrDecl() {
        var token;

        if (matchAsync()) {
            token = lookahead2();
            if (token.type === Token.Keyword && token.value === 'function') {
                return true;
            }
        }

        return false;
    }

    // 11.1 Primary Expressions

    function parsePrimaryExpression() {
        var marker, type, token, expr;

        type = lookahead.type;

        if (type === Token.Identifier) {
            marker = markerCreate();
            return markerApply(marker, delegate.createIdentifier(lex().value));
        }

        if (type === Token.StringLiteral || type === Token.NumericLiteral) {
            if (strict && lookahead.octal) {
                throwErrorTolerant(lookahead, Messages.StrictOctalLiteral);
            }
            marker = markerCreate();
            return markerApply(marker, delegate.createLiteral(lex()));
        }

        if (type === Token.Keyword) {
            if (matchKeyword('this')) {
                marker = markerCreate();
                lex();
                return markerApply(marker, delegate.createThisExpression());
            }

            if (matchKeyword('function')) {
                return parseFunctionExpression();
            }

            if (matchKeyword('class')) {
                return parseClassExpression();
            }

            if (matchKeyword('super')) {
                marker = markerCreate();
                lex();
                return markerApply(marker, delegate.createIdentifier('super'));
            }
        }

        if (type === Token.BooleanLiteral) {
            marker = markerCreate();
            token = lex();
            token.value = (token.value === 'true');
            return markerApply(marker, delegate.createLiteral(token));
        }

        if (type === Token.NullLiteral) {
            marker = markerCreate();
            token = lex();
            token.value = null;
            return markerApply(marker, delegate.createLiteral(token));
        }

        if (match('[')) {
            return parseArrayInitialiser();
        }

        if (match('{')) {
            return parseObjectInitialiser();
        }

        if (match('(')) {
            return parseGroupExpression();
        }

        if (match('/') || match('/=')) {
            marker = markerCreate();
            return markerApply(marker, delegate.createLiteral(scanRegExp()));
        }

        if (type === Token.Template) {
            return parseTemplateLiteral();
        }

        if (match('<')) {
            return parseXJSElement();
        }

        throwUnexpected(lex());
    }

    // 11.2 Left-Hand-Side Expressions

    function parseArguments() {
        var args = [], arg;

        expect('(');

        if (!match(')')) {
            while (index < length) {
                arg = parseSpreadOrAssignmentExpression();
                args.push(arg);

                if (match(')')) {
                    break;
                } else if (arg.type === Syntax.SpreadElement) {
                    throwError({}, Messages.ElementAfterSpreadElement);
                }

                expect(',');
            }
        }

        expect(')');

        return args;
    }

    function parseSpreadOrAssignmentExpression() {
        if (match('...')) {
            var marker = markerCreate();
            lex();
            return markerApply(marker, delegate.createSpreadElement(parseAssignmentExpression()));
        }
        return parseAssignmentExpression();
    }

    function parseNonComputedProperty() {
        var marker = markerCreate(),
            token = lex();

        if (!isIdentifierName(token)) {
            throwUnexpected(token);
        }

        return markerApply(marker, delegate.createIdentifier(token.value));
    }

    function parseNonComputedMember() {
        expect('.');

        return parseNonComputedProperty();
    }

    function parseComputedMember() {
        var expr;

        expect('[');

        expr = parseExpression();

        expect(']');

        return expr;
    }

    function parseNewExpression() {
        var callee, args, marker = markerCreate();

        expectKeyword('new');
        callee = parseLeftHandSideExpression();
        args = match('(') ? parseArguments() : [];

        return markerApply(marker, delegate.createNewExpression(callee, args));
    }

    function parseLeftHandSideExpressionAllowCall() {
        var expr, args, marker = markerCreate();

        expr = matchKeyword('new') ? parseNewExpression() : parsePrimaryExpression();

        while (match('.') || match('[') || match('(') || lookahead.type === Token.Template) {
            if (match('(')) {
                args = parseArguments();
                expr = markerApply(marker, delegate.createCallExpression(expr, args));
            } else if (match('[')) {
                expr = markerApply(marker, delegate.createMemberExpression('[', expr, parseComputedMember()));
            } else if (match('.')) {
                expr = markerApply(marker, delegate.createMemberExpression('.', expr, parseNonComputedMember()));
            } else {
                expr = markerApply(marker, delegate.createTaggedTemplateExpression(expr, parseTemplateLiteral()));
            }
        }

        return expr;
    }

    function parseLeftHandSideExpression() {
        var expr, marker = markerCreate();

        expr = matchKeyword('new') ? parseNewExpression() : parsePrimaryExpression();

        while (match('.') || match('[') || lookahead.type === Token.Template) {
            if (match('[')) {
                expr = markerApply(marker, delegate.createMemberExpression('[', expr, parseComputedMember()));
            } else if (match('.')) {
                expr = markerApply(marker, delegate.createMemberExpression('.', expr, parseNonComputedMember()));
            } else {
                expr = markerApply(marker, delegate.createTaggedTemplateExpression(expr, parseTemplateLiteral()));
            }
        }

        return expr;
    }

    // 11.3 Postfix Expressions

    function parsePostfixExpression() {
        var marker = markerCreate(),
            expr = parseLeftHandSideExpressionAllowCall(),
            token;

        if (lookahead.type !== Token.Punctuator) {
            return expr;
        }

        if ((match('++') || match('--')) && !peekLineTerminator()) {
            // 11.3.1, 11.3.2
            if (strict && expr.type === Syntax.Identifier && isRestrictedWord(expr.name)) {
                throwErrorTolerant({}, Messages.StrictLHSPostfix);
            }

            if (!isLeftHandSide(expr)) {
                throwError({}, Messages.InvalidLHSInAssignment);
            }

            token = lex();
            expr = markerApply(marker, delegate.createPostfixExpression(token.value, expr));
        }

        return expr;
    }

    // 11.4 Unary Operators

    function parseUnaryExpression() {
        var marker, token, expr;

        if (lookahead.type !== Token.Punctuator && lookahead.type !== Token.Keyword) {
            return parsePostfixExpression();
        }

        if (match('++') || match('--')) {
            marker = markerCreate();
            token = lex();
            expr = parseUnaryExpression();
            // 11.4.4, 11.4.5
            if (strict && expr.type === Syntax.Identifier && isRestrictedWord(expr.name)) {
                throwErrorTolerant({}, Messages.StrictLHSPrefix);
            }

            if (!isLeftHandSide(expr)) {
                throwError({}, Messages.InvalidLHSInAssignment);
            }

            return markerApply(marker, delegate.createUnaryExpression(token.value, expr));
        }

        if (match('+') || match('-') || match('~') || match('!')) {
            marker = markerCreate();
            token = lex();
            expr = parseUnaryExpression();
            return markerApply(marker, delegate.createUnaryExpression(token.value, expr));
        }

        if (matchKeyword('delete') || matchKeyword('void') || matchKeyword('typeof')) {
            marker = markerCreate();
            token = lex();
            expr = parseUnaryExpression();
            expr = markerApply(marker, delegate.createUnaryExpression(token.value, expr));
            if (strict && expr.operator === 'delete' && expr.argument.type === Syntax.Identifier) {
                throwErrorTolerant({}, Messages.StrictDelete);
            }
            return expr;
        }

        return parsePostfixExpression();
    }

    function binaryPrecedence(token, allowIn) {
        var prec = 0;

        if (token.type !== Token.Punctuator && token.type !== Token.Keyword) {
            return 0;
        }

        switch (token.value) {
        case '||':
            prec = 1;
            break;

        case '&&':
            prec = 2;
            break;

        case '|':
            prec = 3;
            break;

        case '^':
            prec = 4;
            break;

        case '&':
            prec = 5;
            break;

        case '==':
        case '!=':
        case '===':
        case '!==':
            prec = 6;
            break;

        case '<':
        case '>':
        case '<=':
        case '>=':
        case 'instanceof':
            prec = 7;
            break;

        case 'in':
            prec = allowIn ? 7 : 0;
            break;

        case '<<':
        case '>>':
        case '>>>':
            prec = 8;
            break;

        case '+':
        case '-':
            prec = 9;
            break;

        case '*':
        case '/':
        case '%':
            prec = 11;
            break;

        default:
            break;
        }

        return prec;
    }

    // 11.5 Multiplicative Operators
    // 11.6 Additive Operators
    // 11.7 Bitwise Shift Operators
    // 11.8 Relational Operators
    // 11.9 Equality Operators
    // 11.10 Binary Bitwise Operators
    // 11.11 Binary Logical Operators

    function parseBinaryExpression() {
        var expr, token, prec, previousAllowIn, stack, right, operator, left, i,
            marker, markers;

        previousAllowIn = state.allowIn;
        state.allowIn = true;

        marker = markerCreate();
        left = parseUnaryExpression();

        token = lookahead;
        prec = binaryPrecedence(token, previousAllowIn);
        if (prec === 0) {
            return left;
        }
        token.prec = prec;
        lex();

        markers = [marker, markerCreate()];
        right = parseUnaryExpression();

        stack = [left, token, right];

        while ((prec = binaryPrecedence(lookahead, previousAllowIn)) > 0) {

            // Reduce: make a binary expression from the three topmost entries.
            while ((stack.length > 2) && (prec <= stack[stack.length - 2].prec)) {
                right = stack.pop();
                operator = stack.pop().value;
                left = stack.pop();
                expr = delegate.createBinaryExpression(operator, left, right);
                markers.pop();
                marker = markers.pop();
                markerApply(marker, expr);
                stack.push(expr);
                markers.push(marker);
            }

            // Shift.
            token = lex();
            token.prec = prec;
            stack.push(token);
            markers.push(markerCreate());
            expr = parseUnaryExpression();
            stack.push(expr);
        }

        state.allowIn = previousAllowIn;

        // Final reduce to clean-up the stack.
        i = stack.length - 1;
        expr = stack[i];
        markers.pop();
        while (i > 1) {
            expr = delegate.createBinaryExpression(stack[i - 1].value, stack[i - 2], expr);
            i -= 2;
            marker = markers.pop();
            markerApply(marker, expr);
        }

        return expr;
    }


    // 11.12 Conditional Operator

    function parseConditionalExpression() {
        var expr, previousAllowIn, consequent, alternate, marker = markerCreate();
        expr = parseBinaryExpression();

        if (match('?')) {
            lex();
            previousAllowIn = state.allowIn;
            state.allowIn = true;
            consequent = parseAssignmentExpression();
            state.allowIn = previousAllowIn;
            expect(':');
            alternate = parseAssignmentExpression();

            expr = markerApply(marker, delegate.createConditionalExpression(expr, consequent, alternate));
        }

        return expr;
    }

    // 11.13 Assignment Operators

    function reinterpretAsAssignmentBindingPattern(expr) {
        var i, len, property, element;

        if (expr.type === Syntax.ObjectExpression) {
            expr.type = Syntax.ObjectPattern;
            for (i = 0, len = expr.properties.length; i < len; i += 1) {
                property = expr.properties[i];
                if (property.type === Syntax.SpreadProperty) {
                    if (i < len - 1) {
                        throwError({}, Messages.PropertyAfterSpreadProperty);
                    }
                    reinterpretAsAssignmentBindingPattern(property.argument);
                } else {
                    if (property.kind !== 'init') {
                        throwError({}, Messages.InvalidLHSInAssignment);
                    }
                    reinterpretAsAssignmentBindingPattern(property.value);
                }
            }
        } else if (expr.type === Syntax.ArrayExpression) {
            expr.type = Syntax.ArrayPattern;
            for (i = 0, len = expr.elements.length; i < len; i += 1) {
                element = expr.elements[i];
                if (element) {
                    reinterpretAsAssignmentBindingPattern(element);
                }
            }
        } else if (expr.type === Syntax.Identifier) {
            if (isRestrictedWord(expr.name)) {
                throwError({}, Messages.InvalidLHSInAssignment);
            }
        } else if (expr.type === Syntax.SpreadElement) {
            reinterpretAsAssignmentBindingPattern(expr.argument);
            if (expr.argument.type === Syntax.ObjectPattern) {
                throwError({}, Messages.ObjectPatternAsSpread);
            }
        } else {
            if (expr.type !== Syntax.MemberExpression && expr.type !== Syntax.CallExpression && expr.type !== Syntax.NewExpression) {
                throwError({}, Messages.InvalidLHSInAssignment);
            }
        }
    }


    function reinterpretAsDestructuredParameter(options, expr) {
        var i, len, property, element;

        if (expr.type === Syntax.ObjectExpression) {
            expr.type = Syntax.ObjectPattern;
            for (i = 0, len = expr.properties.length; i < len; i += 1) {
                property = expr.properties[i];
                if (property.type === Syntax.SpreadProperty) {
                    if (i < len - 1) {
                        throwError({}, Messages.PropertyAfterSpreadProperty);
                    }
                    reinterpretAsDestructuredParameter(options, property.argument);
                } else {
                    if (property.kind !== 'init') {
                        throwError({}, Messages.InvalidLHSInFormalsList);
                    }
                    reinterpretAsDestructuredParameter(options, property.value);
                }
            }
        } else if (expr.type === Syntax.ArrayExpression) {
            expr.type = Syntax.ArrayPattern;
            for (i = 0, len = expr.elements.length; i < len; i += 1) {
                element = expr.elements[i];
                if (element) {
                    reinterpretAsDestructuredParameter(options, element);
                }
            }
        } else if (expr.type === Syntax.Identifier) {
            validateParam(options, expr, expr.name);
        } else {
            if (expr.type !== Syntax.MemberExpression) {
                throwError({}, Messages.InvalidLHSInFormalsList);
            }
        }
    }

    function reinterpretAsCoverFormalsList(expressions) {
        var i, len, param, params, defaults, defaultCount, options, rest;

        params = [];
        defaults = [];
        defaultCount = 0;
        rest = null;
        options = {
            paramSet: {}
        };

        for (i = 0, len = expressions.length; i < len; i += 1) {
            param = expressions[i];
            if (param.type === Syntax.Identifier) {
                params.push(param);
                defaults.push(null);
                validateParam(options, param, param.name);
            } else if (param.type === Syntax.ObjectExpression || param.type === Syntax.ArrayExpression) {
                reinterpretAsDestructuredParameter(options, param);
                params.push(param);
                defaults.push(null);
            } else if (param.type === Syntax.SpreadElement) {
                assert(i === len - 1, 'It is guaranteed that SpreadElement is last element by parseExpression');
                reinterpretAsDestructuredParameter(options, param.argument);
                rest = param.argument;
            } else if (param.type === Syntax.AssignmentExpression) {
                params.push(param.left);
                defaults.push(param.right);
                ++defaultCount;
                validateParam(options, param.left, param.left.name);
            } else {
                return null;
            }
        }

        if (options.message === Messages.StrictParamDupe) {
            throwError(
                strict ? options.stricted : options.firstRestricted,
                options.message
            );
        }

        if (defaultCount === 0) {
            defaults = [];
        }

        return {
            params: params,
            defaults: defaults,
            rest: rest,
            stricted: options.stricted,
            firstRestricted: options.firstRestricted,
            message: options.message
        };
    }

    function parseArrowFunctionExpression(options, marker) {
        var previousStrict, previousYieldAllowed, previousAwaitAllowed, body;

        expect('=>');

        previousStrict = strict;
        previousYieldAllowed = state.yieldAllowed;
        state.yieldAllowed = false;
        previousAwaitAllowed = state.awaitAllowed;
        state.awaitAllowed = !!options.async;
        body = parseConciseBody();

        if (strict && options.firstRestricted) {
            throwError(options.firstRestricted, options.message);
        }
        if (strict && options.stricted) {
            throwErrorTolerant(options.stricted, options.message);
        }

        strict = previousStrict;
        state.yieldAllowed = previousYieldAllowed;
        state.awaitAllowed = previousAwaitAllowed;

        return markerApply(marker, delegate.createArrowFunctionExpression(
            options.params,
            options.defaults,
            body,
            options.rest,
            body.type !== Syntax.BlockStatement,
            !!options.async
        ));
    }

    function parseAssignmentExpression() {
        var marker, expr, token, params, oldParenthesizedCount,
            backtrackToken = lookahead, possiblyAsync = false;

        if (matchYield()) {
            return parseYieldExpression();
        }

        if (matchAwait()) {
            return parseAwaitExpression();
        }

        oldParenthesizedCount = state.parenthesizedCount;

        marker = markerCreate();

        if (matchAsyncFuncExprOrDecl()) {
            return parseFunctionExpression();
        }

        if (matchAsync()) {
            // We can't be completely sure that this 'async' token is
            // actually a contextual keyword modifying a function
            // expression, so we might have to un-lex() it later by
            // calling rewind(backtrackToken).
            possiblyAsync = true;
            lex();
        }

        if (match('(')) {
            token = lookahead2();
            if ((token.type === Token.Punctuator && token.value === ')') || token.value === '...') {
                params = parseParams();
                if (!match('=>')) {
                    throwUnexpected(lex());
                }
                params.async = possiblyAsync;
                return parseArrowFunctionExpression(params, marker);
            }
        }

        token = lookahead;

        // If the 'async' keyword is not followed by a '(' character or an
        // identifier, then it can't be an arrow function modifier, and we
        // should interpret it as a normal identifer.
        if (possiblyAsync && !match('(') && token.type !== Token.Identifier) {
            possiblyAsync = false;
            rewind(backtrackToken);
        }

        expr = parseConditionalExpression();

        if (match('=>') &&
                (state.parenthesizedCount === oldParenthesizedCount ||
                state.parenthesizedCount === (oldParenthesizedCount + 1))) {
            if (expr.type === Syntax.Identifier) {
                params = reinterpretAsCoverFormalsList([ expr ]);
            } else if (expr.type === Syntax.SequenceExpression) {
                params = reinterpretAsCoverFormalsList(expr.expressions);
            }
            if (params) {
                params.async = possiblyAsync;
                return parseArrowFunctionExpression(params, marker);
            }
        }

        // If we haven't returned by now, then the 'async' keyword was not
        // a function modifier, and we should rewind and interpret it as a
        // normal identifier.
        if (possiblyAsync) {
            possiblyAsync = false;
            rewind(backtrackToken);
            expr = parseConditionalExpression();
        }

        if (matchAssign()) {
            // 11.13.1
            if (strict && expr.type === Syntax.Identifier && isRestrictedWord(expr.name)) {
                throwErrorTolerant(token, Messages.StrictLHSAssignment);
            }

            // ES.next draf 11.13 Runtime Semantics step 1
            if (match('=') && (expr.type === Syntax.ObjectExpression || expr.type === Syntax.ArrayExpression)) {
                reinterpretAsAssignmentBindingPattern(expr);
            } else if (!isLeftHandSide(expr)) {
                throwError({}, Messages.InvalidLHSInAssignment);
            }

            expr = markerApply(marker, delegate.createAssignmentExpression(lex().value, expr, parseAssignmentExpression()));
        }

        return expr;
    }

    // 11.14 Comma Operator

    function parseExpression() {
        var marker, expr, expressions, sequence, coverFormalsList, spreadFound, oldParenthesizedCount;

        oldParenthesizedCount = state.parenthesizedCount;

        marker = markerCreate();
        expr = parseAssignmentExpression();
        expressions = [ expr ];

        if (match(',')) {
            while (index < length) {
                if (!match(',')) {
                    break;
                }

                lex();
                expr = parseSpreadOrAssignmentExpression();
                expressions.push(expr);

                if (expr.type === Syntax.SpreadElement) {
                    spreadFound = true;
                    if (!match(')')) {
                        throwError({}, Messages.ElementAfterSpreadElement);
                    }
                    break;
                }
            }

            sequence = markerApply(marker, delegate.createSequenceExpression(expressions));
        }

        if (match('=>')) {
            // Do not allow nested parentheses on the LHS of the =>.
            if (state.parenthesizedCount === oldParenthesizedCount || state.parenthesizedCount === (oldParenthesizedCount + 1)) {
                expr = expr.type === Syntax.SequenceExpression ? expr.expressions : expressions;
                coverFormalsList = reinterpretAsCoverFormalsList(expr);
                if (coverFormalsList) {
                    return parseArrowFunctionExpression(coverFormalsList, marker);
                }
            }
            throwUnexpected(lex());
        }

        if (spreadFound && lookahead2().value !== '=>') {
            throwError({}, Messages.IllegalSpread);
        }

        return sequence || expr;
    }

    // 12.1 Block

    function parseStatementList() {
        var list = [],
            statement;

        while (index < length) {
            if (match('}')) {
                break;
            }
            statement = parseSourceElement();
            if (typeof statement === 'undefined') {
                break;
            }
            list.push(statement);
        }

        return list;
    }

    function parseBlock() {
        var block, marker = markerCreate();

        expect('{');

        block = parseStatementList();

        expect('}');

        return markerApply(marker, delegate.createBlockStatement(block));
    }

    // 12.2 Variable Statement

    function parseObjectTypeAnnotation(nullable) {
        var isMethod, marker, properties = [], property, propertyKey,
            propertyTypeAnnotation;

        expect('{');

        while (!match('}')) {
            marker = markerCreate();
            propertyKey = parseObjectPropertyKey();
            isMethod = match('(');
            propertyTypeAnnotation = parseTypeAnnotation();
            properties.push(markerApply(marker, delegate.createProperty(
                'init',
                propertyKey,
                propertyTypeAnnotation,
                isMethod,
                false
            )));

            if (!match('}')) {
                if (match(',') || match(';')) {
                    lex();
                } else {
                    throwUnexpected(lookahead);
                }
            }
        }

        expect('}');

        return delegate.createObjectTypeAnnotation(properties, nullable);
    }

    function parseVoidTypeAnnotation() {
        var marker = markerCreate();
        expectKeyword('void');
        return markerApply(marker, delegate.createVoidTypeAnnotation());
    }

    function parseParametricTypeAnnotation() {
        var marker = markerCreate(), typeIdentifier, paramTypes = [];

        expect('<');
        while (!match('>')) {
            paramTypes.push(parseVariableIdentifier());
            if (!match('>')) {
                expect(',');
            }
        }
        expect('>');

        return markerApply(marker, delegate.createParametricTypeAnnotation(
            paramTypes
        ));
    }

    function parseTypeAnnotation(dontExpectColon) {
        var typeIdentifier = null, params = null, returnType = null,
            nullable = false, marker = markerCreate(), returnTypeMarker = null,
            parametricType, annotation;

        if (!dontExpectColon) {
            expect(':');
        }

        if (match('?')) {
            lex();
            nullable = true;
        }

        if (match('{')) {
            return markerApply(marker, parseObjectTypeAnnotation(nullable));
        }

        if (lookahead.type === Token.Identifier) {
            typeIdentifier = parseVariableIdentifier();
            if (match('<')) {
                parametricType = parseParametricTypeAnnotation();
            }
        } else if (match('(')) {
            lex();
            params = [];
            while (lookahead.type === Token.Identifier || match('?')) {
                params.push(parseTypeAnnotatableIdentifier(
                    true, /* requireTypeAnnotation */
                    true /* canBeOptionalParam */
                ));
                if (!match(')')) {
                    expect(',');
                }
            }
            expect(')');

            returnTypeMarker = markerCreate();
            expect('=>');

            returnType = parseTypeAnnotation(true);
        } else {
            if (!matchKeyword('void')) {
                throwUnexpected(lookahead);
            } else {
                return markerApply(marker, parseVoidTypeAnnotation());
            }
        }

        return markerApply(marker, delegate.createTypeAnnotation(
            typeIdentifier,
            parametricType,
            params,
            returnType,
            nullable
        ));
    }

    function parseVariableIdentifier() {
        var marker = markerCreate(),
            token = lex();

        if (token.type !== Token.Identifier) {
            throwUnexpected(token);
        }

        return markerApply(marker, delegate.createIdentifier(token.value));
    }

    function parseTypeAnnotatableIdentifier(requireTypeAnnotation, canBeOptionalParam) {
        var marker = markerCreate(),
            ident = parseVariableIdentifier(),
            isOptionalParam = false;

        if (canBeOptionalParam && match('?')) {
            expect('?');
            isOptionalParam = true;
        }

        if (requireTypeAnnotation || match(':')) {
            ident = markerApply(marker, delegate.createTypeAnnotatedIdentifier(
                ident,
                parseTypeAnnotation()
            ));
        }

        if (isOptionalParam) {
            ident = markerApply(marker, delegate.createOptionalParameter(ident));
        }

        return ident;
    }

    function parseVariableDeclaration(kind) {
        var id,
            marker = markerCreate(),
            init = null;
        if (match('{')) {
            id = parseObjectInitialiser();
            reinterpretAsAssignmentBindingPattern(id);
        } else if (match('[')) {
            id = parseArrayInitialiser();
            reinterpretAsAssignmentBindingPattern(id);
        } else {
            id = state.allowKeyword ? parseNonComputedProperty() : parseTypeAnnotatableIdentifier();
            // 12.2.1
            if (strict && isRestrictedWord(id.name)) {
                throwErrorTolerant({}, Messages.StrictVarName);
            }
        }

        if (kind === 'const') {
            if (!match('=')) {
                throwError({}, Messages.NoUnintializedConst);
            }
            expect('=');
            init = parseAssignmentExpression();
        } else if (match('=')) {
            lex();
            init = parseAssignmentExpression();
        }

        return markerApply(marker, delegate.createVariableDeclarator(id, init));
    }

    function parseVariableDeclarationList(kind) {
        var list = [];

        do {
            list.push(parseVariableDeclaration(kind));
            if (!match(',')) {
                break;
            }
            lex();
        } while (index < length);

        return list;
    }

    function parseVariableStatement() {
        var declarations, marker = markerCreate();

        expectKeyword('var');

        declarations = parseVariableDeclarationList();

        consumeSemicolon();

        return markerApply(marker, delegate.createVariableDeclaration(declarations, 'var'));
    }

    // kind may be `const` or `let`
    // Both are experimental and not in the specification yet.
    // see http://wiki.ecmascript.org/doku.php?id=harmony:const
    // and http://wiki.ecmascript.org/doku.php?id=harmony:let
    function parseConstLetDeclaration(kind) {
        var declarations, marker = markerCreate();

        expectKeyword(kind);

        declarations = parseVariableDeclarationList(kind);

        consumeSemicolon();

        return markerApply(marker, delegate.createVariableDeclaration(declarations, kind));
    }

    // people.mozilla.org/~jorendorff/es6-draft.html

    function parseModuleSpecifier() {
        var marker = markerCreate(),
            specifier;

        if (lookahead.type !== Token.StringLiteral) {
            throwError({}, Messages.InvalidModuleSpecifier);
        }
        specifier = delegate.createModuleSpecifier(lookahead);
        lex();
        return markerApply(marker, specifier);
    }

    function parseExportBatchSpecifier() {
        var marker = markerCreate();
        expect('*');
        return markerApply(marker, delegate.createExportBatchSpecifier());
    }

    function parseExportSpecifier() {
        var id, name = null, marker = markerCreate(), from;
        if (matchKeyword('default')) {
            lex();
            id = markerApply(marker, delegate.createIdentifier('default'));
            // export {default} from "something";
        } else {
            id = parseVariableIdentifier();
        }
        if (matchContextualKeyword('as')) {
            lex();
            name = parseNonComputedProperty();
        }

        return markerApply(marker, delegate.createExportSpecifier(id, name));
    }

    function parseExportDeclaration() {
        var backtrackToken, id, previousAllowKeyword, declaration = null,
            isExportFromIdentifier,
            src = null, specifiers = [],
            marker = markerCreate();

        expectKeyword('export');

        if (matchKeyword('default')) {
            // covers:
            // export default ...
            lex();
            if (matchKeyword('function') || matchKeyword('class')) {
                backtrackToken = lookahead;
                lex();
                if (isIdentifierName(lookahead)) {
                    // covers:
                    // export default function foo () {}
                    // export default class foo {}
                    id = parseNonComputedProperty();
                    rewind(backtrackToken);
                    return markerApply(marker, delegate.createExportDeclaration(true, parseSourceElement(), [id], null));
                }
                // covers:
                // export default function () {}
                // export default class {}
                rewind(backtrackToken);
                switch (lookahead.value) {
                case 'class':
                    return markerApply(marker, delegate.createExportDeclaration(true, parseClassExpression(), [], null));
                case 'function':
                    return markerApply(marker, delegate.createExportDeclaration(true, parseFunctionExpression(), [], null));
                }
            }

            if (matchContextualKeyword('from')) {
                throwError({}, Messages.UnexpectedToken, lookahead.value);
            }

            // covers:
            // export default {};
            // export default [];
            if (match('{')) {
                declaration = parseObjectInitialiser();
            } else if (match('[')) {
                declaration = parseArrayInitialiser();
            } else {
                declaration = parseAssignmentExpression();
            }
            consumeSemicolon();
            return markerApply(marker, delegate.createExportDeclaration(true, declaration, [], null));
        }

        // non-default export
        if (lookahead.type === Token.Keyword) {
            // covers:
            // export var f = 1;
            switch (lookahead.value) {
            case 'let':
            case 'const':
            case 'var':
            case 'class':
            case 'function':
                return markerApply(marker, delegate.createExportDeclaration(false, parseSourceElement(), specifiers, null));
            }
        }

        if (match('*')) {
            // covers:
            // export * from "foo";
            specifiers.push(parseExportBatchSpecifier());

            if (!matchContextualKeyword('from')) {
                throwError({}, lookahead.value ?
                        Messages.UnexpectedToken : Messages.MissingFromClause, lookahead.value);
            }
            lex();
            src = parseModuleSpecifier();
            consumeSemicolon();

            return markerApply(marker, delegate.createExportDeclaration(false, null, specifiers, src));
        }

        expect('{');
        do {
            isExportFromIdentifier = isExportFromIdentifier || matchKeyword('default');
            specifiers.push(parseExportSpecifier());
        } while (match(',') && lex());
        expect('}');

        if (matchContextualKeyword('from')) {
            // covering:
            // export {default} from "foo";
            // export {foo} from "foo";
            lex();
            src = parseModuleSpecifier();
            consumeSemicolon();
        } else if (isExportFromIdentifier) {
            // covering:
            // export {default}; // missing fromClause
            throwError({}, lookahead.value ?
                    Messages.UnexpectedToken : Messages.MissingFromClause, lookahead.value);
        } else {
            // cover
            // export {foo};
            consumeSemicolon();
        }
        return markerApply(marker, delegate.createExportDeclaration(false, declaration, specifiers, src));
    }


    function parseImportSpecifier() {
        // import {<foo as bar>} ...;
        var id, name = null, marker = markerCreate();

        id = parseNonComputedProperty();
        if (matchContextualKeyword('as')) {
            lex();
            name = parseVariableIdentifier();
        }

        return markerApply(marker, delegate.createImportSpecifier(id, name));
    }

    function parseNamedImports() {
        var specifiers = [];
        // {foo, bar as bas}
        expect('{');
        do {
            specifiers.push(parseImportSpecifier());
        } while (match(',') && lex());
        expect('}');
        return specifiers;
    }

    function parseImportDefaultSpecifier() {
        // import <foo> ...;
        var id, marker = markerCreate();

        id = parseNonComputedProperty();

        return markerApply(marker, delegate.createImportDefaultSpecifier(id));
    }

    function parseImportNamespaceSpecifier() {
        // import <* as foo> ...;
        var id, marker = markerCreate();

        expect('*');
        if (!matchContextualKeyword('as')) {
            throwError({}, Messages.NoAsAfterImportNamespace);
        }
        lex();
        id = parseNonComputedProperty();

        return markerApply(marker, delegate.createImportNamespaceSpecifier(id));
    }

    function parseImportDeclaration() {
        var specifiers, src, marker = markerCreate();

        expectKeyword('import');
        specifiers = [];

        if (lookahead.type === Token.StringLiteral) {
            // covers:
            // import "foo";
            src = parseModuleSpecifier();
            consumeSemicolon();
            return markerApply(marker, delegate.createImportDeclaration(specifiers, src));
        }

        if (!matchKeyword('default') && isIdentifierName(lookahead)) {
            // covers:
            // import foo
            // import foo, ...
            specifiers.push(parseImportDefaultSpecifier());
            if (match(',')) {
                lex();
            }
        }
        if (match('*')) {
            // covers:
            // import foo, * as foo
            // import * as foo
            specifiers.push(parseImportNamespaceSpecifier());
        } else if (match('{')) {
            // covers:
            // import foo, {bar}
            // import {bar}
            specifiers = specifiers.concat(parseNamedImports());
        }

        if (!matchContextualKeyword('from')) {
            throwError({}, lookahead.value ?
                    Messages.UnexpectedToken : Messages.MissingFromClause, lookahead.value);
        }
        lex();
        src = parseModuleSpecifier();
        consumeSemicolon();

        return markerApply(marker, delegate.createImportDeclaration(specifiers, src));
    }

    // 12.3 Empty Statement

    function parseEmptyStatement() {
        var marker = markerCreate();
        expect(';');
        return markerApply(marker, delegate.createEmptyStatement());
    }

    // 12.4 Expression Statement

    function parseExpressionStatement() {
        var marker = markerCreate(), expr = parseExpression();
        consumeSemicolon();
        return markerApply(marker, delegate.createExpressionStatement(expr));
    }

    // 12.5 If statement

    function parseIfStatement() {
        var test, consequent, alternate, marker = markerCreate();

        expectKeyword('if');

        expect('(');

        test = parseExpression();

        expect(')');

        consequent = parseStatement();

        if (matchKeyword('else')) {
            lex();
            alternate = parseStatement();
        } else {
            alternate = null;
        }

        return markerApply(marker, delegate.createIfStatement(test, consequent, alternate));
    }

    // 12.6 Iteration Statements

    function parseDoWhileStatement() {
        var body, test, oldInIteration, marker = markerCreate();

        expectKeyword('do');

        oldInIteration = state.inIteration;
        state.inIteration = true;

        body = parseStatement();

        state.inIteration = oldInIteration;

        expectKeyword('while');

        expect('(');

        test = parseExpression();

        expect(')');

        if (match(';')) {
            lex();
        }

        return markerApply(marker, delegate.createDoWhileStatement(body, test));
    }

    function parseWhileStatement() {
        var test, body, oldInIteration, marker = markerCreate();

        expectKeyword('while');

        expect('(');

        test = parseExpression();

        expect(')');

        oldInIteration = state.inIteration;
        state.inIteration = true;

        body = parseStatement();

        state.inIteration = oldInIteration;

        return markerApply(marker, delegate.createWhileStatement(test, body));
    }

    function parseForVariableDeclaration() {
        var marker = markerCreate(),
            token = lex(),
            declarations = parseVariableDeclarationList();

        return markerApply(marker, delegate.createVariableDeclaration(declarations, token.value));
    }

    function parseForStatement(opts) {
        var init, test, update, left, right, body, operator, oldInIteration,
            marker = markerCreate();
        init = test = update = null;
        expectKeyword('for');

        // http://wiki.ecmascript.org/doku.php?id=proposals:iterators_and_generators&s=each
        if (matchContextualKeyword('each')) {
            throwError({}, Messages.EachNotAllowed);
        }

        expect('(');

        if (match(';')) {
            lex();
        } else {
            if (matchKeyword('var') || matchKeyword('let') || matchKeyword('const')) {
                state.allowIn = false;
                init = parseForVariableDeclaration();
                state.allowIn = true;

                if (init.declarations.length === 1) {
                    if (matchKeyword('in') || matchContextualKeyword('of')) {
                        operator = lookahead;
                        if (!((operator.value === 'in' || init.kind !== 'var') && init.declarations[0].init)) {
                            lex();
                            left = init;
                            right = parseExpression();
                            init = null;
                        }
                    }
                }
            } else {
                state.allowIn = false;
                init = parseExpression();
                state.allowIn = true;

                if (matchContextualKeyword('of')) {
                    operator = lex();
                    left = init;
                    right = parseExpression();
                    init = null;
                } else if (matchKeyword('in')) {
                    // LeftHandSideExpression
                    if (!isAssignableLeftHandSide(init)) {
                        throwError({}, Messages.InvalidLHSInForIn);
                    }
                    operator = lex();
                    left = init;
                    right = parseExpression();
                    init = null;
                }
            }

            if (typeof left === 'undefined') {
                expect(';');
            }
        }

        if (typeof left === 'undefined') {

            if (!match(';')) {
                test = parseExpression();
            }
            expect(';');

            if (!match(')')) {
                update = parseExpression();
            }
        }

        expect(')');

        oldInIteration = state.inIteration;
        state.inIteration = true;

        if (!(opts !== undefined && opts.ignoreBody)) {
            body = parseStatement();
        }

        state.inIteration = oldInIteration;

        if (typeof left === 'undefined') {
            return markerApply(marker, delegate.createForStatement(init, test, update, body));
        }

        if (operator.value === 'in') {
            return markerApply(marker, delegate.createForInStatement(left, right, body));
        }
        return markerApply(marker, delegate.createForOfStatement(left, right, body));
    }

    // 12.7 The continue statement

    function parseContinueStatement() {
        var label = null, key, marker = markerCreate();

        expectKeyword('continue');

        // Optimize the most common form: 'continue;'.
        if (source.charCodeAt(index) === 59) {
            lex();

            if (!state.inIteration) {
                throwError({}, Messages.IllegalContinue);
            }

            return markerApply(marker, delegate.createContinueStatement(null));
        }

        if (peekLineTerminator()) {
            if (!state.inIteration) {
                throwError({}, Messages.IllegalContinue);
            }

            return markerApply(marker, delegate.createContinueStatement(null));
        }

        if (lookahead.type === Token.Identifier) {
            label = parseVariableIdentifier();

            key = '$' + label.name;
            if (!Object.prototype.hasOwnProperty.call(state.labelSet, key)) {
                throwError({}, Messages.UnknownLabel, label.name);
            }
        }

        consumeSemicolon();

        if (label === null && !state.inIteration) {
            throwError({}, Messages.IllegalContinue);
        }

        return markerApply(marker, delegate.createContinueStatement(label));
    }

    // 12.8 The break statement

    function parseBreakStatement() {
        var label = null, key, marker = markerCreate();

        expectKeyword('break');

        // Catch the very common case first: immediately a semicolon (char #59).
        if (source.charCodeAt(index) === 59) {
            lex();

            if (!(state.inIteration || state.inSwitch)) {
                throwError({}, Messages.IllegalBreak);
            }

            return markerApply(marker, delegate.createBreakStatement(null));
        }

        if (peekLineTerminator()) {
            if (!(state.inIteration || state.inSwitch)) {
                throwError({}, Messages.IllegalBreak);
            }

            return markerApply(marker, delegate.createBreakStatement(null));
        }

        if (lookahead.type === Token.Identifier) {
            label = parseVariableIdentifier();

            key = '$' + label.name;
            if (!Object.prototype.hasOwnProperty.call(state.labelSet, key)) {
                throwError({}, Messages.UnknownLabel, label.name);
            }
        }

        consumeSemicolon();

        if (label === null && !(state.inIteration || state.inSwitch)) {
            throwError({}, Messages.IllegalBreak);
        }

        return markerApply(marker, delegate.createBreakStatement(label));
    }

    // 12.9 The return statement

    function parseReturnStatement() {
        var argument = null, marker = markerCreate();

        expectKeyword('return');

        if (!state.inFunctionBody) {
            throwErrorTolerant({}, Messages.IllegalReturn);
        }

        // 'return' followed by a space and an identifier is very common.
        if (source.charCodeAt(index) === 32) {
            if (isIdentifierStart(source.charCodeAt(index + 1))) {
                argument = parseExpression();
                consumeSemicolon();
                return markerApply(marker, delegate.createReturnStatement(argument));
            }
        }

        if (peekLineTerminator()) {
            return markerApply(marker, delegate.createReturnStatement(null));
        }

        if (!match(';')) {
            if (!match('}') && lookahead.type !== Token.EOF) {
                argument = parseExpression();
            }
        }

        consumeSemicolon();

        return markerApply(marker, delegate.createReturnStatement(argument));
    }

    // 12.10 The with statement

    function parseWithStatement() {
        var object, body, marker = markerCreate();

        if (strict) {
            throwErrorTolerant({}, Messages.StrictModeWith);
        }

        expectKeyword('with');

        expect('(');

        object = parseExpression();

        expect(')');

        body = parseStatement();

        return markerApply(marker, delegate.createWithStatement(object, body));
    }

    // 12.10 The swith statement

    function parseSwitchCase() {
        var test,
            consequent = [],
            sourceElement,
            marker = markerCreate();

        if (matchKeyword('default')) {
            lex();
            test = null;
        } else {
            expectKeyword('case');
            test = parseExpression();
        }
        expect(':');

        while (index < length) {
            if (match('}') || matchKeyword('default') || matchKeyword('case')) {
                break;
            }
            sourceElement = parseSourceElement();
            if (typeof sourceElement === 'undefined') {
                break;
            }
            consequent.push(sourceElement);
        }

        return markerApply(marker, delegate.createSwitchCase(test, consequent));
    }

    function parseSwitchStatement() {
        var discriminant, cases, clause, oldInSwitch, defaultFound, marker = markerCreate();

        expectKeyword('switch');

        expect('(');

        discriminant = parseExpression();

        expect(')');

        expect('{');

        cases = [];

        if (match('}')) {
            lex();
            return markerApply(marker, delegate.createSwitchStatement(discriminant, cases));
        }

        oldInSwitch = state.inSwitch;
        state.inSwitch = true;
        defaultFound = false;

        while (index < length) {
            if (match('}')) {
                break;
            }
            clause = parseSwitchCase();
            if (clause.test === null) {
                if (defaultFound) {
                    throwError({}, Messages.MultipleDefaultsInSwitch);
                }
                defaultFound = true;
            }
            cases.push(clause);
        }

        state.inSwitch = oldInSwitch;

        expect('}');

        return markerApply(marker, delegate.createSwitchStatement(discriminant, cases));
    }

    // 12.13 The throw statement

    function parseThrowStatement() {
        var argument, marker = markerCreate();

        expectKeyword('throw');

        if (peekLineTerminator()) {
            throwError({}, Messages.NewlineAfterThrow);
        }

        argument = parseExpression();

        consumeSemicolon();

        return markerApply(marker, delegate.createThrowStatement(argument));
    }

    // 12.14 The try statement

    function parseCatchClause() {
        var param, body, marker = markerCreate();

        expectKeyword('catch');

        expect('(');
        if (match(')')) {
            throwUnexpected(lookahead);
        }

        param = parseExpression();
        // 12.14.1
        if (strict && param.type === Syntax.Identifier && isRestrictedWord(param.name)) {
            throwErrorTolerant({}, Messages.StrictCatchVariable);
        }

        expect(')');
        body = parseBlock();
        return markerApply(marker, delegate.createCatchClause(param, body));
    }

    function parseTryStatement() {
        var block, handlers = [], finalizer = null, marker = markerCreate();

        expectKeyword('try');

        block = parseBlock();

        if (matchKeyword('catch')) {
            handlers.push(parseCatchClause());
        }

        if (matchKeyword('finally')) {
            lex();
            finalizer = parseBlock();
        }

        if (handlers.length === 0 && !finalizer) {
            throwError({}, Messages.NoCatchOrFinally);
        }

        return markerApply(marker, delegate.createTryStatement(block, [], handlers, finalizer));
    }

    // 12.15 The debugger statement

    function parseDebuggerStatement() {
        var marker = markerCreate();
        expectKeyword('debugger');

        consumeSemicolon();

        return markerApply(marker, delegate.createDebuggerStatement());
    }

    // 12 Statements

    function parseStatement() {
        var type = lookahead.type,
            marker,
            expr,
            labeledBody,
            key;

        if (type === Token.EOF) {
            throwUnexpected(lookahead);
        }

        if (type === Token.Punctuator) {
            switch (lookahead.value) {
            case ';':
                return parseEmptyStatement();
            case '{':
                return parseBlock();
            case '(':
                return parseExpressionStatement();
            default:
                break;
            }
        }

        if (type === Token.Keyword) {
            switch (lookahead.value) {
            case 'break':
                return parseBreakStatement();
            case 'continue':
                return parseContinueStatement();
            case 'debugger':
                return parseDebuggerStatement();
            case 'do':
                return parseDoWhileStatement();
            case 'for':
                return parseForStatement();
            case 'function':
                return parseFunctionDeclaration();
            case 'class':
                return parseClassDeclaration();
            case 'if':
                return parseIfStatement();
            case 'return':
                return parseReturnStatement();
            case 'switch':
                return parseSwitchStatement();
            case 'throw':
                return parseThrowStatement();
            case 'try':
                return parseTryStatement();
            case 'var':
                return parseVariableStatement();
            case 'while':
                return parseWhileStatement();
            case 'with':
                return parseWithStatement();
            default:
                break;
            }
        }

        if (matchAsyncFuncExprOrDecl()) {
            return parseFunctionDeclaration();
        }

        marker = markerCreate();
        expr = parseExpression();

        // 12.12 Labelled Statements
        if ((expr.type === Syntax.Identifier) && match(':')) {
            lex();

            key = '$' + expr.name;
            if (Object.prototype.hasOwnProperty.call(state.labelSet, key)) {
                throwError({}, Messages.Redeclaration, 'Label', expr.name);
            }

            state.labelSet[key] = true;
            labeledBody = parseStatement();
            delete state.labelSet[key];
            return markerApply(marker, delegate.createLabeledStatement(expr, labeledBody));
        }

        consumeSemicolon();

        return markerApply(marker, delegate.createExpressionStatement(expr));
    }

    // 13 Function Definition

    function parseConciseBody() {
        if (match('{')) {
            return parseFunctionSourceElements();
        }
        return parseAssignmentExpression();
    }

    function parseFunctionSourceElements() {
        var sourceElement, sourceElements = [], token, directive, firstRestricted,
            oldLabelSet, oldInIteration, oldInSwitch, oldInFunctionBody, oldParenthesizedCount,
            marker = markerCreate();

        expect('{');

        while (index < length) {
            if (lookahead.type !== Token.StringLiteral) {
                break;
            }
            token = lookahead;

            sourceElement = parseSourceElement();
            sourceElements.push(sourceElement);
            if (sourceElement.expression.type !== Syntax.Literal) {
                // this is not directive
                break;
            }
            directive = source.slice(token.range[0] + 1, token.range[1] - 1);
            if (directive === 'use strict') {
                strict = true;
                if (firstRestricted) {
                    throwErrorTolerant(firstRestricted, Messages.StrictOctalLiteral);
                }
            } else {
                if (!firstRestricted && token.octal) {
                    firstRestricted = token;
                }
            }
        }

        oldLabelSet = state.labelSet;
        oldInIteration = state.inIteration;
        oldInSwitch = state.inSwitch;
        oldInFunctionBody = state.inFunctionBody;
        oldParenthesizedCount = state.parenthesizedCount;

        state.labelSet = {};
        state.inIteration = false;
        state.inSwitch = false;
        state.inFunctionBody = true;
        state.parenthesizedCount = 0;

        while (index < length) {
            if (match('}')) {
                break;
            }
            sourceElement = parseSourceElement();
            if (typeof sourceElement === 'undefined') {
                break;
            }
            sourceElements.push(sourceElement);
        }

        expect('}');

        state.labelSet = oldLabelSet;
        state.inIteration = oldInIteration;
        state.inSwitch = oldInSwitch;
        state.inFunctionBody = oldInFunctionBody;
        state.parenthesizedCount = oldParenthesizedCount;

        return markerApply(marker, delegate.createBlockStatement(sourceElements));
    }

    function validateParam(options, param, name) {
        var key = '$' + name;
        if (strict) {
            if (isRestrictedWord(name)) {
                options.stricted = param;
                options.message = Messages.StrictParamName;
            }
            if (Object.prototype.hasOwnProperty.call(options.paramSet, key)) {
                options.stricted = param;
                options.message = Messages.StrictParamDupe;
            }
        } else if (!options.firstRestricted) {
            if (isRestrictedWord(name)) {
                options.firstRestricted = param;
                options.message = Messages.StrictParamName;
            } else if (isStrictModeReservedWord(name)) {
                options.firstRestricted = param;
                options.message = Messages.StrictReservedWord;
            } else if (Object.prototype.hasOwnProperty.call(options.paramSet, key)) {
                options.firstRestricted = param;
                options.message = Messages.StrictParamDupe;
            }
        }
        options.paramSet[key] = true;
    }

    function parseParam(options) {
        var token, rest, param, def;

        token = lookahead;
        if (token.value === '...') {
            token = lex();
            rest = true;
        }

        if (match('[')) {
            param = parseArrayInitialiser();
            reinterpretAsDestructuredParameter(options, param);
        } else if (match('{')) {
            if (rest) {
                throwError({}, Messages.ObjectPatternAsRestParameter);
            }
            param = parseObjectInitialiser();
            reinterpretAsDestructuredParameter(options, param);
        } else {
            // Typing rest params is awkward, so punting on that for now
            param =
                rest
                ? parseVariableIdentifier()
                : parseTypeAnnotatableIdentifier(
                    false, /* requireTypeAnnotation */
                    true /* canBeOptionalParam */
                );

            validateParam(options, token, token.value);
        }

        if (match('=')) {
            if (rest) {
                throwErrorTolerant(lookahead, Messages.DefaultRestParameter);
            }
            lex();
            def = parseAssignmentExpression();
            ++options.defaultCount;
        }

        if (rest) {
            if (!match(')')) {
                throwError({}, Messages.ParameterAfterRestParameter);
            }
            options.rest = param;
            return false;
        }

        options.params.push(param);
        options.defaults.push(def);
        return !match(')');
    }

    function parseParams(firstRestricted) {
        var options, marker = markerCreate();

        options = {
            params: [],
            defaultCount: 0,
            defaults: [],
            rest: null,
            firstRestricted: firstRestricted
        };

        expect('(');

        if (!match(')')) {
            options.paramSet = {};
            while (index < length) {
                if (!parseParam(options)) {
                    break;
                }
                expect(',');
            }
        }

        expect(')');

        if (options.defaultCount === 0) {
            options.defaults = [];
        }

        if (match(':')) {
            options.returnType = parseTypeAnnotation();
        }

        return markerApply(marker, options);
    }

    function parseFunctionDeclaration() {
        var id, body, token, tmp, firstRestricted, message, generator, isAsync,
            previousStrict, previousYieldAllowed, previousAwaitAllowed,
            marker = markerCreate(), parametricType;

        isAsync = false;
        if (matchAsync()) {
            lex();
            isAsync = true;
        }

        expectKeyword('function');

        generator = false;
        if (match('*')) {
            lex();
            generator = true;
        }

        token = lookahead;

        id = parseVariableIdentifier();

        if (match('<')) {
            parametricType = parseParametricTypeAnnotation();
        }

        if (strict) {
            if (isRestrictedWord(token.value)) {
                throwErrorTolerant(token, Messages.StrictFunctionName);
            }
        } else {
            if (isRestrictedWord(token.value)) {
                firstRestricted = token;
                message = Messages.StrictFunctionName;
            } else if (isStrictModeReservedWord(token.value)) {
                firstRestricted = token;
                message = Messages.StrictReservedWord;
            }
        }

        tmp = parseParams(firstRestricted);
        firstRestricted = tmp.firstRestricted;
        if (tmp.message) {
            message = tmp.message;
        }

        previousStrict = strict;
        previousYieldAllowed = state.yieldAllowed;
        state.yieldAllowed = generator;
        previousAwaitAllowed = state.awaitAllowed;
        state.awaitAllowed = isAsync;

        body = parseFunctionSourceElements();

        if (strict && firstRestricted) {
            throwError(firstRestricted, message);
        }
        if (strict && tmp.stricted) {
            throwErrorTolerant(tmp.stricted, message);
        }
        strict = previousStrict;
        state.yieldAllowed = previousYieldAllowed;
        state.awaitAllowed = previousAwaitAllowed;

        return markerApply(
            marker,
            delegate.createFunctionDeclaration(
                id,
                tmp.params,
                tmp.defaults,
                body,
                tmp.rest,
                generator,
                false,
                isAsync,
                tmp.returnType,
                parametricType
            )
        );
    }

    function parseFunctionExpression() {
        var token, id = null, firstRestricted, message, tmp, body, generator, isAsync,
            previousStrict, previousYieldAllowed, previousAwaitAllowed,
            marker = markerCreate(), parametricType;

        isAsync = false;
        if (matchAsync()) {
            lex();
            isAsync = true;
        }

        expectKeyword('function');

        generator = false;

        if (match('*')) {
            lex();
            generator = true;
        }

        if (!match('(')) {
            if (!match('<')) {
                token = lookahead;
                id = parseVariableIdentifier();

                if (strict) {
                    if (isRestrictedWord(token.value)) {
                        throwErrorTolerant(token, Messages.StrictFunctionName);
                    }
                } else {
                    if (isRestrictedWord(token.value)) {
                        firstRestricted = token;
                        message = Messages.StrictFunctionName;
                    } else if (isStrictModeReservedWord(token.value)) {
                        firstRestricted = token;
                        message = Messages.StrictReservedWord;
                    }
                }
            }

            if (match('<')) {
                parametricType = parseParametricTypeAnnotation();
            }
        }

        tmp = parseParams(firstRestricted);
        firstRestricted = tmp.firstRestricted;
        if (tmp.message) {
            message = tmp.message;
        }

        previousStrict = strict;
        previousYieldAllowed = state.yieldAllowed;
        state.yieldAllowed = generator;
        previousAwaitAllowed = state.awaitAllowed;
        state.awaitAllowed = isAsync;

        body = parseFunctionSourceElements();

        if (strict && firstRestricted) {
            throwError(firstRestricted, message);
        }
        if (strict && tmp.stricted) {
            throwErrorTolerant(tmp.stricted, message);
        }
        strict = previousStrict;
        state.yieldAllowed = previousYieldAllowed;
        state.awaitAllowed = previousAwaitAllowed;

        return markerApply(
            marker,
            delegate.createFunctionExpression(
                id,
                tmp.params,
                tmp.defaults,
                body,
                tmp.rest,
                generator,
                false,
                isAsync,
                tmp.returnType,
                parametricType
            )
        );
    }

    function parseYieldExpression() {
        var delegateFlag, expr, marker = markerCreate();

        expectKeyword('yield', !strict);

        delegateFlag = false;
        if (match('*')) {
            lex();
            delegateFlag = true;
        }

        expr = parseAssignmentExpression();

        return markerApply(marker, delegate.createYieldExpression(expr, delegateFlag));
    }

    function parseAwaitExpression() {
        var expr, marker = markerCreate();
        expectContextualKeyword('await');
        expr = parseAssignmentExpression();
        return markerApply(marker, delegate.createAwaitExpression(expr));
    }

    // 14 Classes

    function parseMethodDefinition(existingPropNames) {
        var token, key, param, propType, isValidDuplicateProp = false,
            isAsync, marker = markerCreate(), token2, parametricType,
            parametricTypeMarker, annotationMarker;

        if (lookahead.value === 'static') {
            propType = ClassPropertyType.static;
            lex();
        } else {
            propType = ClassPropertyType.prototype;
        }

        if (match('*')) {
            lex();
            return markerApply(marker, delegate.createMethodDefinition(
                propType,
                '',
                parseObjectPropertyKey(),
                parsePropertyMethodFunction({ generator: true })
            ));
        }

        token = lookahead;
        //parametricTypeMarker = markerCreate();
        key = parseObjectPropertyKey();

        if (token.value === 'get' && !match('(')) {
            key = parseObjectPropertyKey();

            // It is a syntax error if any other properties have a name
            // duplicating this one unless they are a setter
            if (existingPropNames[propType].hasOwnProperty(key.name)) {
                isValidDuplicateProp =
                    // There isn't already a getter for this prop
                    existingPropNames[propType][key.name].get === undefined
                    // There isn't already a data prop by this name
                    && existingPropNames[propType][key.name].data === undefined
                    // The only existing prop by this name is a setter
                    && existingPropNames[propType][key.name].set !== undefined;
                if (!isValidDuplicateProp) {
                    throwError(key, Messages.IllegalDuplicateClassProperty);
                }
            } else {
                existingPropNames[propType][key.name] = {};
            }
            existingPropNames[propType][key.name].get = true;

            expect('(');
            expect(')');
            return markerApply(marker, delegate.createMethodDefinition(
                propType,
                'get',
                key,
                parsePropertyFunction({ generator: false })
            ));
        }
        if (token.value === 'set' && !match('(')) {
            key = parseObjectPropertyKey();

            // It is a syntax error if any other properties have a name
            // duplicating this one unless they are a getter
            if (existingPropNames[propType].hasOwnProperty(key.name)) {
                isValidDuplicateProp =
                    // There isn't already a setter for this prop
                    existingPropNames[propType][key.name].set === undefined
                    // There isn't already a data prop by this name
                    && existingPropNames[propType][key.name].data === undefined
                    // The only existing prop by this name is a getter
                    && existingPropNames[propType][key.name].get !== undefined;
                if (!isValidDuplicateProp) {
                    throwError(key, Messages.IllegalDuplicateClassProperty);
                }
            } else {
                existingPropNames[propType][key.name] = {};
            }
            existingPropNames[propType][key.name].set = true;

            expect('(');
            token = lookahead;
            param = [ parseTypeAnnotatableIdentifier() ];
            expect(')');
            return markerApply(marker, delegate.createMethodDefinition(
                propType,
                'set',
                key,
                parsePropertyFunction({ params: param, generator: false, name: token })
            ));
        }

        if (match('<')) {
            parametricType = parseParametricTypeAnnotation();
        }

        isAsync = token.value === 'async' && !match('(');
        if (isAsync) {
            key = parseObjectPropertyKey();
        }

        // It is a syntax error if any other properties have the same name as a
        // non-getter, non-setter method
        if (existingPropNames[propType].hasOwnProperty(key.name)) {
            throwError(key, Messages.IllegalDuplicateClassProperty);
        } else {
            existingPropNames[propType][key.name] = {};
        }
        existingPropNames[propType][key.name].data = true;

        return markerApply(marker, delegate.createMethodDefinition(
            propType,
            '',
            key,
            parsePropertyMethodFunction({
                generator: false,
                async: isAsync,
                parametricType: parametricType
            })
        ));
    }

    function parseClassProperty(existingPropNames) {
        var marker = markerCreate(), propertyIdentifier;

        propertyIdentifier = parseTypeAnnotatableIdentifier();
        expect(';');

        return markerApply(marker, delegate.createClassProperty(
            propertyIdentifier
        ));
    }

    function parseClassElement(existingProps) {
        if (match(';')) {
            lex();
            return;
        }

        var doubleLookahead = lookahead2();
        if (doubleLookahead.type === Token.Punctuator) {
            if (doubleLookahead.value === ':') {
                return parseClassProperty(existingProps);
            }
        }

        return parseMethodDefinition(existingProps);
    }

    function parseClassBody() {
        var classElement, classElements = [], existingProps = {}, marker = markerCreate();

        existingProps[ClassPropertyType.static] = {};
        existingProps[ClassPropertyType.prototype] = {};

        expect('{');

        while (index < length) {
            if (match('}')) {
                break;
            }
            classElement = parseClassElement(existingProps);

            if (typeof classElement !== 'undefined') {
                classElements.push(classElement);
            }
        }

        expect('}');

        return markerApply(marker, delegate.createClassBody(classElements));
    }

    function parseClassExpression() {
        var id, previousYieldAllowed, superClass = null, marker = markerCreate(),
            parametricType;

        expectKeyword('class');

        if (!matchKeyword('extends') && !match('{')) {
            id = parseVariableIdentifier();
        }

        if (match('<')) {
            parametricType = parseParametricTypeAnnotation();
        }

        if (matchKeyword('extends')) {
            expectKeyword('extends');
            previousYieldAllowed = state.yieldAllowed;
            state.yieldAllowed = false;
            superClass = parseAssignmentExpression();
            state.yieldAllowed = previousYieldAllowed;
        }

        return markerApply(marker, delegate.createClassExpression(id, superClass, parseClassBody(), parametricType));
    }

    function parseClassDeclaration() {
        var id, previousYieldAllowed, superClass = null, marker = markerCreate(),
            parametricType, superParametricType;

        expectKeyword('class');

        id = parseVariableIdentifier();

        if (match('<')) {
            parametricType = parseParametricTypeAnnotation();
        }

        if (matchKeyword('extends')) {
            expectKeyword('extends');
            previousYieldAllowed = state.yieldAllowed;
            state.yieldAllowed = false;
            superClass = parseAssignmentExpression();
            state.yieldAllowed = previousYieldAllowed;
        }

        return markerApply(marker, delegate.createClassDeclaration(id, superClass, parseClassBody(), parametricType, superParametricType));
    }

    // 15 Program

    function parseSourceElement() {
        if (lookahead.type === Token.Keyword) {
            switch (lookahead.value) {
            case 'const':
            case 'let':
                return parseConstLetDeclaration(lookahead.value);
            case 'function':
                return parseFunctionDeclaration();
            default:
                return parseStatement();
            }
        }

        if (lookahead.type !== Token.EOF) {
            return parseStatement();
        }
    }

    function parseProgramElement() {
        if (lookahead.type === Token.Keyword) {
            switch (lookahead.value) {
            case 'export':
                return parseExportDeclaration();
            case 'import':
                return parseImportDeclaration();
            }
        }

        return parseSourceElement();
    }

    function parseProgramElements() {
        var sourceElement, sourceElements = [], token, directive, firstRestricted;

        while (index < length) {
            token = lookahead;
            if (token.type !== Token.StringLiteral) {
                break;
            }

            sourceElement = parseProgramElement();
            sourceElements.push(sourceElement);
            if (sourceElement.expression.type !== Syntax.Literal) {
                // this is not directive
                break;
            }
            directive = source.slice(token.range[0] + 1, token.range[1] - 1);
            if (directive === 'use strict') {
                strict = true;
                if (firstRestricted) {
                    throwErrorTolerant(firstRestricted, Messages.StrictOctalLiteral);
                }
            } else {
                if (!firstRestricted && token.octal) {
                    firstRestricted = token;
                }
            }
        }

        while (index < length) {
            sourceElement = parseProgramElement();
            if (typeof sourceElement === 'undefined') {
                break;
            }
            sourceElements.push(sourceElement);
        }
        return sourceElements;
    }

    function parseProgram() {
        var body, marker = markerCreate();
        strict = false;
        peek();
        body = parseProgramElements();
        return markerApply(marker, delegate.createProgram(body));
    }

    // The following functions are needed only when the option to preserve
    // the comments is active.

    function addComment(type, value, start, end, loc) {
        var comment;

        assert(typeof start === 'number', 'Comment must have valid position');

        // Because the way the actual token is scanned, often the comments
        // (if any) are skipped twice during the lexical analysis.
        // Thus, we need to skip adding a comment if the comment array already
        // handled it.
        if (state.lastCommentStart >= start) {
            return;
        }
        state.lastCommentStart = start;

        comment = {
            type: type,
            value: value
        };
        if (extra.range) {
            comment.range = [start, end];
        }
        if (extra.loc) {
            comment.loc = loc;
        }
        extra.comments.push(comment);
        if (extra.attachComment) {
            extra.leadingComments.push(comment);
            extra.trailingComments.push(comment);
        }
    }

    function scanComment() {
        var comment, ch, loc, start, blockComment, lineComment;

        comment = '';
        blockComment = false;
        lineComment = false;

        while (index < length) {
            ch = source[index];

            if (lineComment) {
                ch = source[index++];
                if (isLineTerminator(ch.charCodeAt(0))) {
                    loc.end = {
                        line: lineNumber,
                        column: index - lineStart - 1
                    };
                    lineComment = false;
                    addComment('Line', comment, start, index - 1, loc);
                    if (ch === '\r' && source[index] === '\n') {
                        ++index;
                    }
                    ++lineNumber;
                    lineStart = index;
                    comment = '';
                } else if (index >= length) {
                    lineComment = false;
                    comment += ch;
                    loc.end = {
                        line: lineNumber,
                        column: length - lineStart
                    };
                    addComment('Line', comment, start, length, loc);
                } else {
                    comment += ch;
                }
            } else if (blockComment) {
                if (isLineTerminator(ch.charCodeAt(0))) {
                    if (ch === '\r') {
                        ++index;
                        comment += '\r';
                    }
                    if (ch !== '\r' || source[index] === '\n') {
                        comment += source[index];
                        ++lineNumber;
                        ++index;
                        lineStart = index;
                        if (index >= length) {
                            throwError({}, Messages.UnexpectedToken, 'ILLEGAL');
                        }
                    }
                } else {
                    ch = source[index++];
                    if (index >= length) {
                        throwError({}, Messages.UnexpectedToken, 'ILLEGAL');
                    }
                    comment += ch;
                    if (ch === '*') {
                        ch = source[index];
                        if (ch === '/') {
                            comment = comment.substr(0, comment.length - 1);
                            blockComment = false;
                            ++index;
                            loc.end = {
                                line: lineNumber,
                                column: index - lineStart
                            };
                            addComment('Block', comment, start, index, loc);
                            comment = '';
                        }
                    }
                }
            } else if (ch === '/') {
                ch = source[index + 1];
                if (ch === '/') {
                    loc = {
                        start: {
                            line: lineNumber,
                            column: index - lineStart
                        }
                    };
                    start = index;
                    index += 2;
                    lineComment = true;
                    if (index >= length) {
                        loc.end = {
                            line: lineNumber,
                            column: index - lineStart
                        };
                        lineComment = false;
                        addComment('Line', comment, start, index, loc);
                    }
                } else if (ch === '*') {
                    start = index;
                    index += 2;
                    blockComment = true;
                    loc = {
                        start: {
                            line: lineNumber,
                            column: index - lineStart - 2
                        }
                    };
                    if (index >= length) {
                        throwError({}, Messages.UnexpectedToken, 'ILLEGAL');
                    }
                } else {
                    break;
                }
            } else if (isWhiteSpace(ch.charCodeAt(0))) {
                ++index;
            } else if (isLineTerminator(ch.charCodeAt(0))) {
                ++index;
                if (ch ===  '\r' && source[index] === '\n') {
                    ++index;
                }
                ++lineNumber;
                lineStart = index;
            } else {
                break;
            }
        }
    }

    // 16 XJS

    XHTMLEntities = {
        quot: '\u0022',
        amp: '&',
        apos: '\u0027',
        lt: '<',
        gt: '>',
        nbsp: '\u00A0',
        iexcl: '\u00A1',
        cent: '\u00A2',
        pound: '\u00A3',
        curren: '\u00A4',
        yen: '\u00A5',
        brvbar: '\u00A6',
        sect: '\u00A7',
        uml: '\u00A8',
        copy: '\u00A9',
        ordf: '\u00AA',
        laquo: '\u00AB',
        not: '\u00AC',
        shy: '\u00AD',
        reg: '\u00AE',
        macr: '\u00AF',
        deg: '\u00B0',
        plusmn: '\u00B1',
        sup2: '\u00B2',
        sup3: '\u00B3',
        acute: '\u00B4',
        micro: '\u00B5',
        para: '\u00B6',
        middot: '\u00B7',
        cedil: '\u00B8',
        sup1: '\u00B9',
        ordm: '\u00BA',
        raquo: '\u00BB',
        frac14: '\u00BC',
        frac12: '\u00BD',
        frac34: '\u00BE',
        iquest: '\u00BF',
        Agrave: '\u00C0',
        Aacute: '\u00C1',
        Acirc: '\u00C2',
        Atilde: '\u00C3',
        Auml: '\u00C4',
        Aring: '\u00C5',
        AElig: '\u00C6',
        Ccedil: '\u00C7',
        Egrave: '\u00C8',
        Eacute: '\u00C9',
        Ecirc: '\u00CA',
        Euml: '\u00CB',
        Igrave: '\u00CC',
        Iacute: '\u00CD',
        Icirc: '\u00CE',
        Iuml: '\u00CF',
        ETH: '\u00D0',
        Ntilde: '\u00D1',
        Ograve: '\u00D2',
        Oacute: '\u00D3',
        Ocirc: '\u00D4',
        Otilde: '\u00D5',
        Ouml: '\u00D6',
        times: '\u00D7',
        Oslash: '\u00D8',
        Ugrave: '\u00D9',
        Uacute: '\u00DA',
        Ucirc: '\u00DB',
        Uuml: '\u00DC',
        Yacute: '\u00DD',
        THORN: '\u00DE',
        szlig: '\u00DF',
        agrave: '\u00E0',
        aacute: '\u00E1',
        acirc: '\u00E2',
        atilde: '\u00E3',
        auml: '\u00E4',
        aring: '\u00E5',
        aelig: '\u00E6',
        ccedil: '\u00E7',
        egrave: '\u00E8',
        eacute: '\u00E9',
        ecirc: '\u00EA',
        euml: '\u00EB',
        igrave: '\u00EC',
        iacute: '\u00ED',
        icirc: '\u00EE',
        iuml: '\u00EF',
        eth: '\u00F0',
        ntilde: '\u00F1',
        ograve: '\u00F2',
        oacute: '\u00F3',
        ocirc: '\u00F4',
        otilde: '\u00F5',
        ouml: '\u00F6',
        divide: '\u00F7',
        oslash: '\u00F8',
        ugrave: '\u00F9',
        uacute: '\u00FA',
        ucirc: '\u00FB',
        uuml: '\u00FC',
        yacute: '\u00FD',
        thorn: '\u00FE',
        yuml: '\u00FF',
        OElig: '\u0152',
        oelig: '\u0153',
        Scaron: '\u0160',
        scaron: '\u0161',
        Yuml: '\u0178',
        fnof: '\u0192',
        circ: '\u02C6',
        tilde: '\u02DC',
        Alpha: '\u0391',
        Beta: '\u0392',
        Gamma: '\u0393',
        Delta: '\u0394',
        Epsilon: '\u0395',
        Zeta: '\u0396',
        Eta: '\u0397',
        Theta: '\u0398',
        Iota: '\u0399',
        Kappa: '\u039A',
        Lambda: '\u039B',
        Mu: '\u039C',
        Nu: '\u039D',
        Xi: '\u039E',
        Omicron: '\u039F',
        Pi: '\u03A0',
        Rho: '\u03A1',
        Sigma: '\u03A3',
        Tau: '\u03A4',
        Upsilon: '\u03A5',
        Phi: '\u03A6',
        Chi: '\u03A7',
        Psi: '\u03A8',
        Omega: '\u03A9',
        alpha: '\u03B1',
        beta: '\u03B2',
        gamma: '\u03B3',
        delta: '\u03B4',
        epsilon: '\u03B5',
        zeta: '\u03B6',
        eta: '\u03B7',
        theta: '\u03B8',
        iota: '\u03B9',
        kappa: '\u03BA',
        lambda: '\u03BB',
        mu: '\u03BC',
        nu: '\u03BD',
        xi: '\u03BE',
        omicron: '\u03BF',
        pi: '\u03C0',
        rho: '\u03C1',
        sigmaf: '\u03C2',
        sigma: '\u03C3',
        tau: '\u03C4',
        upsilon: '\u03C5',
        phi: '\u03C6',
        chi: '\u03C7',
        psi: '\u03C8',
        omega: '\u03C9',
        thetasym: '\u03D1',
        upsih: '\u03D2',
        piv: '\u03D6',
        ensp: '\u2002',
        emsp: '\u2003',
        thinsp: '\u2009',
        zwnj: '\u200C',
        zwj: '\u200D',
        lrm: '\u200E',
        rlm: '\u200F',
        ndash: '\u2013',
        mdash: '\u2014',
        lsquo: '\u2018',
        rsquo: '\u2019',
        sbquo: '\u201A',
        ldquo: '\u201C',
        rdquo: '\u201D',
        bdquo: '\u201E',
        dagger: '\u2020',
        Dagger: '\u2021',
        bull: '\u2022',
        hellip: '\u2026',
        permil: '\u2030',
        prime: '\u2032',
        Prime: '\u2033',
        lsaquo: '\u2039',
        rsaquo: '\u203A',
        oline: '\u203E',
        frasl: '\u2044',
        euro: '\u20AC',
        image: '\u2111',
        weierp: '\u2118',
        real: '\u211C',
        trade: '\u2122',
        alefsym: '\u2135',
        larr: '\u2190',
        uarr: '\u2191',
        rarr: '\u2192',
        darr: '\u2193',
        harr: '\u2194',
        crarr: '\u21B5',
        lArr: '\u21D0',
        uArr: '\u21D1',
        rArr: '\u21D2',
        dArr: '\u21D3',
        hArr: '\u21D4',
        forall: '\u2200',
        part: '\u2202',
        exist: '\u2203',
        empty: '\u2205',
        nabla: '\u2207',
        isin: '\u2208',
        notin: '\u2209',
        ni: '\u220B',
        prod: '\u220F',
        sum: '\u2211',
        minus: '\u2212',
        lowast: '\u2217',
        radic: '\u221A',
        prop: '\u221D',
        infin: '\u221E',
        ang: '\u2220',
        and: '\u2227',
        or: '\u2228',
        cap: '\u2229',
        cup: '\u222A',
        'int': '\u222B',
        there4: '\u2234',
        sim: '\u223C',
        cong: '\u2245',
        asymp: '\u2248',
        ne: '\u2260',
        equiv: '\u2261',
        le: '\u2264',
        ge: '\u2265',
        sub: '\u2282',
        sup: '\u2283',
        nsub: '\u2284',
        sube: '\u2286',
        supe: '\u2287',
        oplus: '\u2295',
        otimes: '\u2297',
        perp: '\u22A5',
        sdot: '\u22C5',
        lceil: '\u2308',
        rceil: '\u2309',
        lfloor: '\u230A',
        rfloor: '\u230B',
        lang: '\u2329',
        rang: '\u232A',
        loz: '\u25CA',
        spades: '\u2660',
        clubs: '\u2663',
        hearts: '\u2665',
        diams: '\u2666'
    };

    function getQualifiedXJSName(object) {
        if (object.type === Syntax.XJSIdentifier) {
            return object.name;
        }
        if (object.type === Syntax.XJSNamespacedName) {
            return object.namespace.name + ':' + object.name.name;
        }
        if (object.type === Syntax.XJSMemberExpression) {
            return (
                getQualifiedXJSName(object.object) + '.' +
                getQualifiedXJSName(object.property)
            );
        }
    }

    function isXJSIdentifierStart(ch) {
        // exclude backslash (\)
        return (ch !== 92) && isIdentifierStart(ch);
    }

    function isXJSIdentifierPart(ch) {
        // exclude backslash (\) and add hyphen (-)
        return (ch !== 92) && (ch === 45 || isIdentifierPart(ch));
    }

    function scanXJSIdentifier() {
        var ch, start, value = '';

        start = index;
        while (index < length) {
            ch = source.charCodeAt(index);
            if (!isXJSIdentifierPart(ch)) {
                break;
            }
            value += source[index++];
        }

        return {
            type: Token.XJSIdentifier,
            value: value,
            lineNumber: lineNumber,
            lineStart: lineStart,
            range: [start, index]
        };
    }

    function scanXJSEntity() {
        var ch, str = '', start = index, count = 0, code;
        ch = source[index];
        assert(ch === '&', 'Entity must start with an ampersand');
        index++;
        while (index < length && count++ < 10) {
            ch = source[index++];
            if (ch === ';') {
                break;
            }
            str += ch;
        }

        // Well-formed entity (ending was found).
        if (ch === ';') {
            // Numeric entity.
            if (str[0] === '#') {
                if (str[1] === 'x') {
                    code = +('0' + str.substr(1));
                } else {
                    // Removing leading zeros in order to avoid treating as octal in old browsers.
                    code = +str.substr(1).replace(Regex.LeadingZeros, '');
                }

                if (!isNaN(code)) {
                    return String.fromCharCode(code);
                }
            } else if (XHTMLEntities[str]) {
                return XHTMLEntities[str];
            }
        }

        // Treat non-entity sequences as regular text.
        index = start + 1;
        return '&';
    }

    function scanXJSText(stopChars) {
        var ch, str = '', start;
        start = index;
        while (index < length) {
            ch = source[index];
            if (stopChars.indexOf(ch) !== -1) {
                break;
            }
            if (ch === '&') {
                str += scanXJSEntity();
            } else {
                index++;
                if (ch === '\r' && source[index] === '\n') {
                    str += ch;
                    ch = source[index];
                    index++;
                }
                if (isLineTerminator(ch.charCodeAt(0))) {
                    ++lineNumber;
                    lineStart = index;
                }
                str += ch;
            }
        }
        return {
            type: Token.XJSText,
            value: str,
            lineNumber: lineNumber,
            lineStart: lineStart,
            range: [start, index]
        };
    }

    function scanXJSStringLiteral() {
        var innerToken, quote, start;

        quote = source[index];
        assert((quote === '\'' || quote === '"'),
            'String literal must starts with a quote');

        start = index;
        ++index;

        innerToken = scanXJSText([quote]);

        if (quote !== source[index]) {
            throwError({}, Messages.UnexpectedToken, 'ILLEGAL');
        }

        ++index;

        innerToken.range = [start, index];

        return innerToken;
    }

    /**
     * Between XJS opening and closing tags (e.g. <foo>HERE</foo>), anything that
     * is not another XJS tag and is not an expression wrapped by {} is text.
     */
    function advanceXJSChild() {
        var ch = source.charCodeAt(index);

        // { (123) and < (60)
        if (ch !== 123 && ch !== 60) {
            return scanXJSText(['<', '{']);
        }

        return scanPunctuator();
    }

    function parseXJSIdentifier() {
        var token, marker = markerCreate();

        if (lookahead.type !== Token.XJSIdentifier) {
            throwUnexpected(lookahead);
        }

        token = lex();
        return markerApply(marker, delegate.createXJSIdentifier(token.value));
    }

    function parseXJSNamespacedName() {
        var namespace, name, marker = markerCreate();

        namespace = parseXJSIdentifier();
        expect(':');
        name = parseXJSIdentifier();

        return markerApply(marker, delegate.createXJSNamespacedName(namespace, name));
    }

    function parseXJSMemberExpression() {
        var marker = markerCreate(),
            expr = parseXJSIdentifier();

        while (match('.')) {
            lex();
            expr = markerApply(marker, delegate.createXJSMemberExpression(expr, parseXJSIdentifier()));
        }

        return expr;
    }

    function parseXJSElementName() {
        if (lookahead2().value === ':') {
            return parseXJSNamespacedName();
        }
        if (lookahead2().value === '.') {
            return parseXJSMemberExpression();
        }

        return parseXJSIdentifier();
    }

    function parseXJSAttributeName() {
        if (lookahead2().value === ':') {
            return parseXJSNamespacedName();
        }

        return parseXJSIdentifier();
    }

    function parseXJSAttributeValue() {
        var value, marker;
        if (match('{')) {
            value = parseXJSExpressionContainer();
            if (value.expression.type === Syntax.XJSEmptyExpression) {
                throwError(
                    value,
                    'XJS attributes must only be assigned a non-empty ' +
                        'expression'
                );
            }
        } else if (match('<')) {
            value = parseXJSElement();
        } else if (lookahead.type === Token.XJSText) {
            marker = markerCreate();
            value = markerApply(marker, delegate.createLiteral(lex()));
        } else {
            throwError({}, Messages.InvalidXJSAttributeValue);
        }
        return value;
    }

    function parseXJSEmptyExpression() {
        var marker = markerCreatePreserveWhitespace();
        while (source.charAt(index) !== '}') {
            index++;
        }
        return markerApply(marker, delegate.createXJSEmptyExpression());
    }

    function parseXJSExpressionContainer() {
        var expression, origInXJSChild, origInXJSTag, marker = markerCreate();

        origInXJSChild = state.inXJSChild;
        origInXJSTag = state.inXJSTag;
        state.inXJSChild = false;
        state.inXJSTag = false;

        expect('{');

        if (match('}')) {
            expression = parseXJSEmptyExpression();
        } else {
            expression = parseExpression();
        }

        state.inXJSChild = origInXJSChild;
        state.inXJSTag = origInXJSTag;

        expect('}');

        return markerApply(marker, delegate.createXJSExpressionContainer(expression));
    }

    function parseXJSSpreadAttribute() {
        var expression, origInXJSChild, origInXJSTag, marker = markerCreate();

        origInXJSChild = state.inXJSChild;
        origInXJSTag = state.inXJSTag;
        state.inXJSChild = false;
        state.inXJSTag = false;

        expect('{');
        expect('...');

        expression = parseAssignmentExpression();

        state.inXJSChild = origInXJSChild;
        state.inXJSTag = origInXJSTag;

        expect('}');

        return markerApply(marker, delegate.createXJSSpreadAttribute(expression));
    }

    function parseXJSAttribute() {
        var name, marker;

        if (match('{')) {
            return parseXJSSpreadAttribute();
        }

        marker = markerCreate();

        name = parseXJSAttributeName();

        // HTML empty attribute
        if (match('=')) {
            lex();
            return markerApply(marker, delegate.createXJSAttribute(name, parseXJSAttributeValue()));
        }

        return markerApply(marker, delegate.createXJSAttribute(name));
    }

    function parseXJSChild() {
        var token, marker;
        if (match('{')) {
            token = parseXJSExpressionContainer();
        } else if (lookahead.type === Token.XJSText) {
            marker = markerCreatePreserveWhitespace();
            token = markerApply(marker, delegate.createLiteral(lex()));
        } else {
            token = parseXJSElement();
        }
        return token;
    }

    function parseXJSClosingElement() {
        var name, origInXJSChild, origInXJSTag, marker = markerCreate();
        origInXJSChild = state.inXJSChild;
        origInXJSTag = state.inXJSTag;
        state.inXJSChild = false;
        state.inXJSTag = true;
        expect('<');
        expect('/');
        name = parseXJSElementName();
        // Because advance() (called by lex() called by expect()) expects there
        // to be a valid token after >, it needs to know whether to look for a
        // standard JS token or an XJS text node
        state.inXJSChild = origInXJSChild;
        state.inXJSTag = origInXJSTag;
        expect('>');
        return markerApply(marker, delegate.createXJSClosingElement(name));
    }

    function parseXJSOpeningElement() {
        var name, attribute, attributes = [], selfClosing = false, origInXJSChild, origInXJSTag, marker = markerCreate();

        origInXJSChild = state.inXJSChild;
        origInXJSTag = state.inXJSTag;
        state.inXJSChild = false;
        state.inXJSTag = true;

        expect('<');

        name = parseXJSElementName();

        while (index < length &&
                lookahead.value !== '/' &&
                lookahead.value !== '>') {
            attributes.push(parseXJSAttribute());
        }

        state.inXJSTag = origInXJSTag;

        if (lookahead.value === '/') {
            expect('/');
            // Because advance() (called by lex() called by expect()) expects
            // there to be a valid token after >, it needs to know whether to
            // look for a standard JS token or an XJS text node
            state.inXJSChild = origInXJSChild;
            expect('>');
            selfClosing = true;
        } else {
            state.inXJSChild = true;
            expect('>');
        }
        return markerApply(marker, delegate.createXJSOpeningElement(name, attributes, selfClosing));
    }

    function parseXJSElement() {
        var openingElement, closingElement = null, children = [], origInXJSChild, origInXJSTag, marker = markerCreate();

        origInXJSChild = state.inXJSChild;
        origInXJSTag = state.inXJSTag;
        openingElement = parseXJSOpeningElement();

        if (!openingElement.selfClosing) {
            while (index < length) {
                state.inXJSChild = false; // Call lookahead2() with inXJSChild = false because </ should not be considered in the child
                if (lookahead.value === '<' && lookahead2().value === '/') {
                    break;
                }
                state.inXJSChild = true;
                children.push(parseXJSChild());
            }
            state.inXJSChild = origInXJSChild;
            state.inXJSTag = origInXJSTag;
            closingElement = parseXJSClosingElement();
            if (getQualifiedXJSName(closingElement.name) !== getQualifiedXJSName(openingElement.name)) {
                throwError({}, Messages.ExpectedXJSClosingTag, getQualifiedXJSName(openingElement.name));
            }
        }

        // When (erroneously) writing two adjacent tags like
        //
        //     var x = <div>one</div><div>two</div>;
        //
        // the default error message is a bit incomprehensible. Since it's
        // rarely (never?) useful to write a less-than sign after an XJS
        // element, we disallow it here in the parser in order to provide a
        // better error message. (In the rare case that the less-than operator
        // was intended, the left tag can be wrapped in parentheses.)
        if (!origInXJSChild && match('<')) {
            throwError(lookahead, Messages.AdjacentXJSElements);
        }

        return markerApply(marker, delegate.createXJSElement(openingElement, closingElement, children));
    }

    function collectToken() {
        var start, loc, token, range, value, entry;

        if (!state.inXJSChild) {
            skipComment();
        }

        start = index;
        loc = {
            start: {
                line: lineNumber,
                column: index - lineStart
            }
        };

        token = extra.advance();
        loc.end = {
            line: lineNumber,
            column: index - lineStart
        };

        if (token.type !== Token.EOF) {
            range = [token.range[0], token.range[1]];
            value = source.slice(token.range[0], token.range[1]);
            entry = {
                type: TokenName[token.type],
                value: value,
                range: range,
                loc: loc
            };
            if (token.regex) {
                entry.regex = {
                    pattern: token.regex.pattern,
                    flags: token.regex.flags
                };
            }
            extra.tokens.push(entry);
        }

        return token;
    }

    function collectRegex() {
        var pos, loc, regex, token;

        skipComment();

        pos = index;
        loc = {
            start: {
                line: lineNumber,
                column: index - lineStart
            }
        };

        regex = extra.scanRegExp();
        loc.end = {
            line: lineNumber,
            column: index - lineStart
        };

        if (!extra.tokenize) {
            // Pop the previous token, which is likely '/' or '/='
            if (extra.tokens.length > 0) {
                token = extra.tokens[extra.tokens.length - 1];
                if (token.range[0] === pos && token.type === 'Punctuator') {
                    if (token.value === '/' || token.value === '/=') {
                        extra.tokens.pop();
                    }
                }
            }

            extra.tokens.push({
                type: 'RegularExpression',
                value: regex.literal,
                regex: regex.regex,
                range: [pos, index],
                loc: loc
            });
        }

        return regex;
    }

    function filterTokenLocation() {
        var i, entry, token, tokens = [];

        for (i = 0; i < extra.tokens.length; ++i) {
            entry = extra.tokens[i];
            token = {
                type: entry.type,
                value: entry.value
            };
            if (entry.regex) {
                token.regex = {
                    pattern: entry.regex.pattern,
                    flags: entry.regex.flags
                };
            }
            if (extra.range) {
                token.range = entry.range;
            }
            if (extra.loc) {
                token.loc = entry.loc;
            }
            tokens.push(token);
        }

        extra.tokens = tokens;
    }

    function patch() {
        if (extra.comments) {
            extra.skipComment = skipComment;
            skipComment = scanComment;
        }

        if (typeof extra.tokens !== 'undefined') {
            extra.advance = advance;
            extra.scanRegExp = scanRegExp;

            advance = collectToken;
            scanRegExp = collectRegex;
        }
    }

    function unpatch() {
        if (typeof extra.skipComment === 'function') {
            skipComment = extra.skipComment;
        }

        if (typeof extra.scanRegExp === 'function') {
            advance = extra.advance;
            scanRegExp = extra.scanRegExp;
        }
    }

    // This is used to modify the delegate.

    function extend(object, properties) {
        var entry, result = {};

        for (entry in object) {
            if (object.hasOwnProperty(entry)) {
                result[entry] = object[entry];
            }
        }

        for (entry in properties) {
            if (properties.hasOwnProperty(entry)) {
                result[entry] = properties[entry];
            }
        }

        return result;
    }

    function tokenize(code, options) {
        var toString,
            token,
            tokens;

        toString = String;
        if (typeof code !== 'string' && !(code instanceof String)) {
            code = toString(code);
        }

        delegate = SyntaxTreeDelegate;
        source = code;
        index = 0;
        lineNumber = (source.length > 0) ? 1 : 0;
        lineStart = 0;
        length = source.length;
        lookahead = null;
        state = {
            allowKeyword: true,
            allowIn: true,
            labelSet: {},
            inFunctionBody: false,
            inIteration: false,
            inSwitch: false,
            lastCommentStart: -1
        };

        extra = {};

        // Options matching.
        options = options || {};

        // Of course we collect tokens here.
        options.tokens = true;
        extra.tokens = [];
        extra.tokenize = true;
        // The following two fields are necessary to compute the Regex tokens.
        extra.openParenToken = -1;
        extra.openCurlyToken = -1;

        extra.range = (typeof options.range === 'boolean') && options.range;
        extra.loc = (typeof options.loc === 'boolean') && options.loc;

        if (typeof options.comment === 'boolean' && options.comment) {
            extra.comments = [];
        }
        if (typeof options.tolerant === 'boolean' && options.tolerant) {
            extra.errors = [];
        }

        if (length > 0) {
            if (typeof source[0] === 'undefined') {
                // Try first to convert to a string. This is good as fast path
                // for old IE which understands string indexing for string
                // literals only and not for string object.
                if (code instanceof String) {
                    source = code.valueOf();
                }
            }
        }

        patch();

        try {
            peek();
            if (lookahead.type === Token.EOF) {
                return extra.tokens;
            }

            token = lex();
            while (lookahead.type !== Token.EOF) {
                try {
                    token = lex();
                } catch (lexError) {
                    token = lookahead;
                    if (extra.errors) {
                        extra.errors.push(lexError);
                        // We have to break on the first error
                        // to avoid infinite loops.
                        break;
                    } else {
                        throw lexError;
                    }
                }
            }

            filterTokenLocation();
            tokens = extra.tokens;
            if (typeof extra.comments !== 'undefined') {
                tokens.comments = extra.comments;
            }
            if (typeof extra.errors !== 'undefined') {
                tokens.errors = extra.errors;
            }
        } catch (e) {
            throw e;
        } finally {
            unpatch();
            extra = {};
        }
        return tokens;
    }

    function parse(code, options) {
        var program, toString;

        toString = String;
        if (typeof code !== 'string' && !(code instanceof String)) {
            code = toString(code);
        }

        delegate = SyntaxTreeDelegate;
        source = code;
        index = 0;
        lineNumber = (source.length > 0) ? 1 : 0;
        lineStart = 0;
        length = source.length;
        lookahead = null;
        state = {
            allowKeyword: false,
            allowIn: true,
            labelSet: {},
            parenthesizedCount: 0,
            inFunctionBody: false,
            inIteration: false,
            inSwitch: false,
            inXJSChild: false,
            inXJSTag: false,
            lastCommentStart: -1,
            yieldAllowed: false,
            awaitAllowed: false
        };

        extra = {};
        if (typeof options !== 'undefined') {
            extra.range = (typeof options.range === 'boolean') && options.range;
            extra.loc = (typeof options.loc === 'boolean') && options.loc;
            extra.attachComment = (typeof options.attachComment === 'boolean') && options.attachComment;

            if (extra.loc && options.source !== null && options.source !== undefined) {
                delegate = extend(delegate, {
                    'postProcess': function (node) {
                        node.loc.source = toString(options.source);
                        return node;
                    }
                });
            }

            if (typeof options.tokens === 'boolean' && options.tokens) {
                extra.tokens = [];
            }
            if (typeof options.comment === 'boolean' && options.comment) {
                extra.comments = [];
            }
            if (typeof options.tolerant === 'boolean' && options.tolerant) {
                extra.errors = [];
            }
            if (extra.attachComment) {
                extra.range = true;
                extra.comments = [];
                extra.bottomRightStack = [];
                extra.trailingComments = [];
                extra.leadingComments = [];
            }
        }

        if (length > 0) {
            if (typeof source[0] === 'undefined') {
                // Try first to convert to a string. This is good as fast path
                // for old IE which understands string indexing for string
                // literals only and not for string object.
                if (code instanceof String) {
                    source = code.valueOf();
                }
            }
        }

        patch();
        try {
            program = parseProgram();
            if (typeof extra.comments !== 'undefined') {
                program.comments = extra.comments;
            }
            if (typeof extra.tokens !== 'undefined') {
                filterTokenLocation();
                program.tokens = extra.tokens;
            }
            if (typeof extra.errors !== 'undefined') {
                program.errors = extra.errors;
            }
        } catch (e) {
            throw e;
        } finally {
            unpatch();
            extra = {};
        }

        return program;
    }

    // Sync with *.json manifests.
    exports.version = '7001.0001.0000-dev-harmony-fb';

    exports.tokenize = tokenize;

    exports.parse = parse;

    // Deep copy.
    exports.Syntax = (function () {
        var name, types = {};

        if (typeof Object.create === 'function') {
            types = Object.create(null);
        }

        for (name in Syntax) {
            if (Syntax.hasOwnProperty(name)) {
                types[name] = Syntax[name];
            }
        }

        if (typeof Object.freeze === 'function') {
            Object.freeze(types);
        }

        return types;
    }());

}));
/* vim: set sw=4 ts=4 et tw=80 : */

},{}],61:[function(require,module,exports){
module.exports = require('./lib/fake-fs')
},{"./lib/fake-fs":62}],62:[function(require,module,exports){
(function (Buffer){
var PATH = require('path')
var normalize = PATH.normalize
var join = PATH.join
var dirname = PATH.dirname
var basename = PATH.basename

function resolve(p) {
  return PATH.resolve(p).replace(/\\/g, '/') // Windows support
}

function FsError(code) {
  var err = new Error(code)
  err.code = code
  return err
}

function toBuffer(data, encoding) {
  data = data || new Buffer(0)
  return Buffer.isBuffer(data)
    ? data
    : new Buffer(data, encoding || 'utf8')
}

function initTimes(o) {
  var now = new Date
  o.mtime = now
  o.ctime = now
  o.atime = now
}

function updateTimes(stat) {
  var now = new Date
  stat.mtime = now
  stat.ctime = now
}

function Dir(stats) {
  initTimes(this)
  mix(this, stats)
  this.children = {}
}

Dir.prototype.isDirectory = function() {
  return true
}

Dir.prototype.isFile = function() {
  return false
}

Dir.prototype.toString = function() {
  return 'directory'
}

function File(stats) {
  initTimes(this)
  mix(this, stats)
}

File.prototype.isDirectory = function() {
  return false
}

File.prototype.isFile = function() {
  return true
}

File.prototype.toString = function() {
  return 'file'
}

module.exports = Fs

function Fs (paths) {
  if (!(this instanceof Fs)) {
    return new Fs(paths)
  }
  this.root = new Dir
}

Fs.prototype.dir = function(path, opts) {
  return this._add(path, new Dir(opts))
}

Fs.prototype.file = function(path, content, encoding) {
  var stat = typeof content == 'object' && !Buffer.isBuffer(content) && content
  if (stat) {
    content = stat.content
    encoding = stat.encoding
  }
  var file = new File(stat || {})
  file.content = toBuffer(content, encoding)
  return this._add(path, file)
}

Fs.prototype._add = function(path, item) {
  var segs = path == '/'
    ? []
    : resolve(path).split('/').slice(1)

  var dir = this.root
  for (var i = 0; i < segs.length - 1; i++) {
    dir = dir.children[segs[i]] || (dir.children[segs[i]] = new Dir)
    if (!dir.isDirectory()) {
      throw new Error('There is already ' + dir + ' defined at ' + segs.slice(i).join('/'))
    }
  }
  dir.children[segs[i]] = item
  return this
}

Fs.prototype._itemAt = function(path) {
  var segs = path == '/'
    ? []
    : resolve(path).split('/').slice(1)

  var item = this.root
  for (var i = 0; i < segs.length; i++) {
    item = item.children && item.children[segs[i]]
    if (!item) return
  }
  return item
}

Fs.prototype._get = function(path) {
  var item = this._itemAt(path)
  if (!item) throw FsError('ENOENT')
  return item
}

Fs.prototype._rem = function(path) {
  var parent = this._get(dirname(path))
  if (!parent.isDirectory()) throw FsError('ENOTDIR')
  var itemName = basename(path)
  delete parent.children[itemName]
}

Fs.prototype.statSync = function(path) {
  return this._get(path)
}

Fs.prototype.existsSync = function(path) {
  return !!this._itemAt(path)
}

Fs.prototype.readdirSync = function(dir) {
  var item = this._get(dir)
  if (!item.isDirectory()) throw FsError('ENOTDIR')
  return Object.keys(item.children)
}

Fs.prototype.readFileSync = function(filename, encoding) {
  var item = this._get(filename)
  if (item.isDirectory()) throw FsError('EISDIR')
  var buf = item.content
  return encoding ? buf.toString(encoding) : buf
}

Fs.prototype.writeFileSync = function(filename, data, encoding) {
  var parent = this._get(dirname(filename))
  if (!parent.isDirectory()) throw FsError('ENOTDIR')
  if (!this.existsSync(filename)) {
    updateTimes(parent)
  }
  this.file(filename, data, encoding)
}

Fs.prototype.appendFileSync = function(filename, data, encoding) {
  var item = this._itemAt(filename)
  if (item) {
    if (item.isDirectory()) throw FsError('EISDIR')
    item.content = Buffer.concat([item.content, toBuffer(data, encoding)])
    updateTimes(item)
  } else {
    this.writeFileSync(filename, data, encoding)
  }
}

Fs.prototype.mkdirSync = function(dir, mode) {
  if (this.existsSync(dir)) throw FsError('EEXIST')
  var parent = this._get(dirname(dir))
  if (!parent.isDirectory()) throw FsError('ENOTDIR')
  updateTimes(parent)
  this.dir(dir)
}

Fs.prototype.rmdirSync = function(path) {
  if (!this.existsSync(path)) throw FsError('ENOENT')

  var item = this._get(path)
  if (!item.isDirectory()) throw FsError('ENOTDIR')

  var hasChildren = item.children && Object.keys(item.children).length
  if (hasChildren) throw FsError('ENOTEMPTY')

  var parent = this._get(dirname(path))
  updateTimes(parent)
  this._rem(path)
}

Fs.prototype.unlinkSync = function(path) {
  if (!this.existsSync(path)) throw FsError('ENOENT')

  var item = this._get(path)
  if (item.isDirectory()) throw FsError('EISDIR')

  var parent = this._get(dirname(path))
  updateTimes(parent)
  this._rem(path)
}

Fs.prototype.renameSync = function(oldPath, newPath) {
  if (!this.existsSync(oldPath)) throw FsError('ENOENT')

  if (this.existsSync(newPath) && this.statSync(newPath).isDirectory())
   throw FsError('EPERM')

  var newParent = this._get(dirname(newPath))
  if (!newParent.isDirectory()) throw FsError('ENOTDIR')

  var fileOrDir = this._get(oldPath)

  var oldParent = this._get(dirname(oldPath))
  updateTimes(oldParent)
  this._rem(oldPath)

  updateTimes(newParent)
  this._add(newPath, fileOrDir)
}

;['readdir', 'stat', 'rmdir', 'unlink'].forEach(function(meth) {
  var sync = meth + 'Sync'
  Fs.prototype[meth] = function(p, cb) {
    var res, err
    try {
      res = this[sync].call(this, p)
    } catch(e) {
      err = e
    }
    cb && cb(err, res)
  }
})

Fs.prototype.readFile = function(filename, encoding, cb) {
  if (typeof encoding != 'string') {
    cb = encoding
    encoding = undefined
  }
  var res, err
  try {
    res = this.readFileSync(filename, encoding)
  } catch(e) {
    err = e
  }
  cb && cb(err, res)
}

Fs.prototype.writeFile = function(filename, data, encoding, cb) {
  if (typeof encoding == 'function') {
    cb = encoding
    encoding = null
  }
  encoding = encoding || 'utf8'
  var err
  try {
    this.writeFileSync(filename, data, encoding)
  } catch(e) {
    err = e
  }
  cb && cb(err)
}

Fs.prototype.appendFile = function(filename, data, opts, cb) {
  if (typeof opts == 'function') {
    cb = opts
    opts = null
  }
  var err
  try {
    this.appendFileSync(filename, data, opts)
  } catch(e) {
    err = e
  }
  cb && cb(err)
}

Fs.prototype.exists = function(path, cb) {
  cb && cb(this.existsSync(path))
}

Fs.prototype.mkdir = function(dir, mode, cb) {
  if (typeof mode == 'function') {
    cb = mode
  }
  var res, err
  try {
    res = this.mkdirSync(dir)
  } catch (e) {
    err = e
  }
  cb && cb(err, res)
}

Fs.prototype.rename = function(oldPath, newPath, cb) {
  var res, err
  try {
    res = this.renameSync(oldPath, newPath)
  } catch (e) {
    err = e
  }
  cb && cb(err, res)
}

Fs.prototype.bind = function() {
  for(var key in this) {
    if (typeof this[key] == 'function')
      this[key] = this[key].bind(this)
  }
  return this
}

Fs.prototype.patch = function() {
  this._orig = {}
  var fs = require('fs')
  methods.forEach(function(meth) {
    this._orig[meth] = fs[meth]
    fs[meth] = this[meth].bind(this)
  }, this)
}

Fs.prototype.unpatch = function() {
  var fs = require('fs')
  for (var key in this._orig) {
    fs[key] = this._orig[key]
  }
}

var methods = [
  'exists',
  'stat',
  'readdir',
  'mkdir',
  'readFile',
  'writeFile',
  'appendFile',
  'rmdir',
  'unlink',
  'rename'
].reduce(function(res, meth) {
  res.push(meth)
  res.push(meth + 'Sync')
  return res
}, [])

Fs.prototype.at = function(path) {
  return new Proxy(this, path)
}

function Proxy(fs, path) {
  this.fs = fs
  this.path = path
}

Proxy.prototype.dir = function(p) {
  p = join(this.path, p)
  this.fs.dir.apply(this.fs, arguments)
  return this
}

Proxy.prototype.file = function(p) {
  p = join(this.path, p)
  this.fs.file.apply(this.fs, arguments)
  return this
}

Proxy.prototype.at = function(p) {
  p = join(this.path, p)
  return this.fs.at.apply(this.fs, arguments)
}

function mix(t, src) {
  for(var key in src) {
    t[key] = src[key]
  }
  return t
}
}).call(this,require("buffer").Buffer)
},{"buffer":50,"fs":48,"path":56}],63:[function(require,module,exports){
"use strict";

var originalObject = Object;
var originalDefProp = Object.defineProperty;
var originalCreate = Object.create;

function defProp(obj, name, value) {
  if (originalDefProp) try {
    originalDefProp.call(originalObject, obj, name, { value: value });
  } catch (definePropertyIsBrokenInIE8) {
    obj[name] = value;
  } else {
    obj[name] = value;
  }
}

// For functions that will be invoked using .call or .apply, we need to
// define those methods on the function objects themselves, rather than
// inheriting them from Function.prototype, so that a malicious or clumsy
// third party cannot interfere with the functionality of this module by
// redefining Function.prototype.call or .apply.
function makeSafeToCall(fun) {
  if (fun) {
    defProp(fun, "call", fun.call);
    defProp(fun, "apply", fun.apply);
  }
  return fun;
}

makeSafeToCall(originalDefProp);
makeSafeToCall(originalCreate);

var hasOwn = makeSafeToCall(Object.prototype.hasOwnProperty);
var numToStr = makeSafeToCall(Number.prototype.toString);
var strSlice = makeSafeToCall(String.prototype.slice);

var cloner = function(){};
function create(prototype) {
  if (originalCreate) {
    return originalCreate.call(originalObject, prototype);
  }
  cloner.prototype = prototype || null;
  return new cloner;
}

var rand = Math.random;
var uniqueKeys = create(null);

function makeUniqueKey() {
  // Collisions are highly unlikely, but this module is in the business of
  // making guarantees rather than safe bets.
  do var uniqueKey = strSlice.call(numToStr.call(rand(), 36), 2);
  while (hasOwn.call(uniqueKeys, uniqueKey));
  return uniqueKeys[uniqueKey] = uniqueKey;
}

// External users might find this function useful, but it is not necessary
// for the typical use of this module.
defProp(exports, "makeUniqueKey", makeUniqueKey);

// Object.getOwnPropertyNames is the only way to enumerate non-enumerable
// properties, so if we wrap it to ignore our secret keys, there should be
// no way (except guessing) to access those properties.
var originalGetOPNs = Object.getOwnPropertyNames;
Object.getOwnPropertyNames = function getOwnPropertyNames(object) {
  for (var names = originalGetOPNs(object),
           src = 0,
           dst = 0,
           len = names.length;
       src < len;
       ++src) {
    if (!hasOwn.call(uniqueKeys, names[src])) {
      if (src > dst) {
        names[dst] = names[src];
      }
      ++dst;
    }
  }
  names.length = dst;
  return names;
};

function defaultCreatorFn(object) {
  return create(null);
}

function makeAccessor(secretCreatorFn) {
  var brand = makeUniqueKey();
  var passkey = create(null);

  secretCreatorFn = secretCreatorFn || defaultCreatorFn;

  function register(object) {
    var secret; // Created lazily.

    function vault(key, forget) {
      // Only code that has access to the passkey can retrieve (or forget)
      // the secret object.
      if (key === passkey) {
        return forget
          ? secret = null
          : secret || (secret = secretCreatorFn(object));
      }
    }

    defProp(object, brand, vault);
  }

  function accessor(object) {
    if (!hasOwn.call(object, brand))
      register(object);
    return object[brand](passkey);
  }

  accessor.forget = function(object) {
    if (hasOwn.call(object, brand))
      object[brand](passkey, true);
  };

  return accessor;
}

defProp(exports, "makeAccessor", makeAccessor);

},{}],64:[function(require,module,exports){
var assert = require("assert");
var types = require("./types");
var isArray = types.builtInTypes.array;
var isObject = types.builtInTypes.object;
var linesModule = require("./lines");
var fromString = linesModule.fromString;
var Lines = linesModule.Lines;
var concat = linesModule.concat;
var comparePos = require("./util").comparePos;

exports.add = function(ast, lines) {
    var comments = ast.comments;
    if (!isArray.check(comments)) {
        return;
    }
    delete ast.comments;

    assert.ok(lines instanceof Lines);

    var pt = new PosTracker,
        len = comments.length,
        comment,
        key,
        loc, locs = pt.locs,
        pair,
        sorted = [];

    pt.visit(ast);

    for (var i = 0; i < len; ++i) {
        comment = comments[i];
        Object.defineProperty(comment.loc, "lines", { value: lines });
        pt.getEntry(comment, "end").comment = comment;
    }

    for (key in locs) {
        loc = locs[key];
        pair = key.split(",");

        sorted.push({
            line: +pair[0],
            column: +pair[1],
            startNode: loc.startNode,
            endNode: loc.endNode,
            comment: loc.comment
        });
    }

    sorted.sort(comparePos);

    var pendingComments = [];
    var previousNode;

    function addComment(node, comment) {
        if (node) {
            var comments = node.comments || (node.comments = []);
            comments.push(comment);
        }
    }

    function dumpTrailing() {
        pendingComments.forEach(function(comment) {
            addComment(previousNode, comment);
            comment.trailing = true;
        });

        pendingComments.length = 0;
    }

    sorted.forEach(function(entry) {
        if (entry.endNode) {
            // If we're ending a node with comments still pending, then we
            // need to attach those comments to the previous node before
            // updating the previous node.
            dumpTrailing();
            previousNode = entry.endNode;
        }

        if (entry.comment) {
            pendingComments.push(entry.comment);
        }

        if (entry.startNode) {
            var node = entry.startNode;
            var nodeStartColumn = node.loc.start.column;
            var didAddLeadingComment = false;
            var gapEndLoc = node.loc.start;

            // Iterate backwards through pendingComments, examining the
            // gaps between them. In order to earn the .possiblyLeading
            // status, a comment must be separated from entry.startNode by
            // an unbroken series of whitespace-only gaps.
            for (var i = pendingComments.length - 1; i >= 0; --i) {
                var comment = pendingComments[i];
                var gap = lines.slice(comment.loc.end, gapEndLoc);
                gapEndLoc = comment.loc.start;

                if (gap.isOnlyWhitespace()) {
                    comment.possiblyLeading = true;
                } else {
                    break;
                }
            }

            pendingComments.forEach(function(comment) {
                if (!comment.possiblyLeading) {
                    // If comment.possiblyLeading was not set to true
                    // above, the comment must be a trailing comment.
                    comment.trailing = true;
                    addComment(previousNode, comment);

                } else if (didAddLeadingComment) {
                    // If we previously added a leading comment to this
                    // node, then any subsequent pending comments must
                    // also be leading comments, even if they are indented
                    // more deeply than the node itself.
                    assert.strictEqual(comment.possiblyLeading, true);
                    comment.trailing = false;
                    addComment(node, comment);

                } else if (comment.type === "Line" &&
                           comment.loc.start.column > nodeStartColumn) {
                    // If the comment is a //-style comment and indented
                    // more deeply than the node itself, and we have not
                    // encountered any other leading comments, treat this
                    // comment as a trailing comment and add it to the
                    // previous node.
                    comment.trailing = true;
                    addComment(previousNode, comment);

                } else {
                    // Here we have the first leading comment for this node.
                    comment.trailing = false;
                    addComment(node, comment);
                    didAddLeadingComment = true;
                }
            });

            pendingComments.length = 0;

            // Note: the previous node is the node that started OR ended
            // most recently.
            previousNode = entry.startNode;
        }
    });

    // Provided we have a previous node to add them to, dump any
    // still-pending comments into the last node we came across.
    dumpTrailing();
};

function PosTracker() {
    assert.ok(this instanceof PosTracker);
    this.locs = {};
}

var PTp = PosTracker.prototype;

PTp.getEntry = function(node, which) {
    var locs = this.locs,
        loc = node && node.loc,
        pos = loc && loc[which],
        key = pos && (pos.line + "," + pos.column);
    return key && (locs[key] || (locs[key] = {}));
};

PTp.visit = function(node) {
    if (isArray.check(node)) {
        node.forEach(this.visit, this);
    } else if (isObject.check(node)) {
        var entry = this.getEntry(node, "start");
        if (entry && !entry.startNode) {
            entry.startNode = node;
        }

        var names = types.getFieldNames(node);
        for (var i = 0, len = names.length; i < len; ++i) {
            this.visit(node[names[i]]);
        }

        if ((entry = this.getEntry(node, "end"))) {
            entry.endNode = node;
        }
    }
};

/**
 * @param {Object} options - Options object that configures printing.
 */
function printLeadingComment(comment, options) {
    var orig = comment.original;
    var loc = orig && orig.loc;
    var lines = loc && loc.lines;
    var parts = [];

    if (comment.type === "Block") {
        parts.push("/*", fromString(comment.value, options), "*/");
    } else if (comment.type === "Line") {
        parts.push("//", fromString(comment.value, options));
    } else assert.fail(comment.type);

    if (comment.trailing) {
        // When we print trailing comments as leading comments, we don't
        // want to bring any trailing spaces along.
        parts.push("\n");

    } else if (lines instanceof Lines) {
        var trailingSpace = lines.slice(
            loc.end,
            lines.skipSpaces(loc.end)
        );

        if (trailingSpace.length === 1) {
            // If the trailing space contains no newlines, then we want to
            // preserve it exactly as we found it.
            parts.push(trailingSpace);
        } else {
            // If the trailing space contains newlines, then replace it
            // with just that many newlines, with all other spaces removed.
            parts.push(new Array(trailingSpace.length).join("\n"));
        }

    } else {
        parts.push("\n");
    }

    return concat(parts).stripMargin(loc ? loc.start.column : 0);
}

/**
 * @param {Object} options - Options object that configures printing.
 */
function printTrailingComment(comment, options) {
    var orig = comment.original;
    var loc = orig && orig.loc;
    var lines = loc && loc.lines;
    var parts = [];

    if (lines instanceof Lines) {
        var fromPos = lines.skipSpaces(loc.start, true) || lines.firstPos();
        var leadingSpace = lines.slice(fromPos, loc.start);

        if (leadingSpace.length === 1) {
            // If the leading space contains no newlines, then we want to
            // preserve it exactly as we found it.
            parts.push(leadingSpace);
        } else {
            // If the leading space contains newlines, then replace it
            // with just that many newlines, sans all other spaces.
            parts.push(new Array(leadingSpace.length).join("\n"));
        }
    }

    if (comment.type === "Block") {
        parts.push("/*", fromString(comment.value, options), "*/");
    } else if (comment.type === "Line") {
        parts.push("//", fromString(comment.value, options), "\n");
    } else assert.fail(comment.type);

    return concat(parts).stripMargin(
        loc ? loc.start.column : 0,
        true // Skip the first line, in case there were leading spaces.
    );
}

/**
 * @param {Object} options - Options object that configures printing.
 */
exports.printComments = function(comments, innerLines, options) {
    if (innerLines) {
        assert.ok(innerLines instanceof Lines);
    } else {
        innerLines = fromString("");
    }

    var count = comments ? comments.length : 0;
    if (count === 0) {
        return innerLines;
    }

    var parts = [];
    var leading = [];
    var trailing = [];

    comments.forEach(function(comment) {
        // For now, only /*comments*/ can be trailing comments.
        if (comment.type === "Block" &&
            comment.trailing) {
            trailing.push(comment);
        } else {
            leading.push(comment);
        }
    });

    leading.forEach(function(comment) {
        parts.push(printLeadingComment(comment, options));
    });

    parts.push(innerLines);

    trailing.forEach(function(comment) {
        parts.push(printTrailingComment(comment, options));
    });

    return concat(parts);
};

},{"./lines":65,"./types":71,"./util":72,"assert":49}],65:[function(require,module,exports){
var assert = require("assert");
var sourceMap = require("source-map");
var normalizeOptions = require("./options").normalize;
var secretKey = require("private").makeUniqueKey();
var types = require("./types");
var isString = types.builtInTypes.string;
var comparePos = require("./util").comparePos;
var Mapping = require("./mapping");

// Goals:
// 1. Minimize new string creation.
// 2. Keep (de)identation O(lines) time.
// 3. Permit negative indentations.
// 4. Enforce immutability.
// 5. No newline characters.

function getSecret(lines) {
    return lines[secretKey];
}

function Lines(infos, sourceFileName) {
    assert.ok(this instanceof Lines);
    assert.ok(infos.length > 0);

    if (sourceFileName) {
        isString.assert(sourceFileName);
    } else {
        sourceFileName = null;
    }

    Object.defineProperty(this, secretKey, {
        value: {
            infos: infos,
            mappings: [],
            name: sourceFileName,
            cachedSourceMap: null
        }
    });

    if (sourceFileName) {
        getSecret(this).mappings.push(new Mapping(this, {
            start: this.firstPos(),
            end: this.lastPos()
        }));
    }
}

// Exposed for instanceof checks. The fromString function should be used
// to create new Lines objects.
exports.Lines = Lines;
var Lp = Lines.prototype;

// These properties used to be assigned to each new object in the Lines
// constructor, but we can more efficiently stuff them into the secret and
// let these lazy accessors compute their values on-the-fly.
Object.defineProperties(Lp, {
    length: {
        get: function() {
            return getSecret(this).infos.length;
        }
    },

    name: {
        get: function() {
            return getSecret(this).name;
        }
    }
});

function copyLineInfo(info) {
    return {
        line: info.line,
        indent: info.indent,
        sliceStart: info.sliceStart,
        sliceEnd: info.sliceEnd
    };
}

var fromStringCache = {};
var hasOwn = fromStringCache.hasOwnProperty;
var maxCacheKeyLen = 10;

function countSpaces(spaces, tabWidth) {
    var count = 0;
    var len = spaces.length;

    for (var i = 0; i < len; ++i) {
        var ch = spaces.charAt(i);

        if (ch === " ") {
            count += 1;

        } else if (ch === "\t") {
            assert.strictEqual(typeof tabWidth, "number");
            assert.ok(tabWidth > 0);

            var next = Math.ceil(count / tabWidth) * tabWidth;
            if (next === count) {
                count += tabWidth;
            } else {
                count = next;
            }

        } else if (ch === "\r") {
            // Ignore carriage return characters.

        } else {
            assert.fail("unexpected whitespace character", ch);
        }
    }

    return count;
}
exports.countSpaces = countSpaces;

var leadingSpaceExp = /^\s*/;

/**
 * @param {Object} options - Options object that configures printing.
 */
function fromString(string, options) {
    if (string instanceof Lines)
        return string;

    string += "";

    var tabWidth = options && options.tabWidth;
    var tabless = string.indexOf("\t") < 0;
    var cacheable = !options && tabless && (string.length <= maxCacheKeyLen);

    assert.ok(tabWidth || tabless, "No tab width specified but encountered tabs in string\n" + string);

    if (cacheable && hasOwn.call(fromStringCache, string))
        return fromStringCache[string];

    var lines = new Lines(string.split("\n").map(function(line) {
        var spaces = leadingSpaceExp.exec(line)[0];
        return {
            line: line,
            indent: countSpaces(spaces, tabWidth),
            sliceStart: spaces.length,
            sliceEnd: line.length
        };
    }), normalizeOptions(options).sourceFileName);

    if (cacheable)
        fromStringCache[string] = lines;

    return lines;
}
exports.fromString = fromString;

function isOnlyWhitespace(string) {
    return !/\S/.test(string);
}

Lp.toString = function(options) {
    return this.sliceString(this.firstPos(), this.lastPos(), options);
};

Lp.getSourceMap = function(sourceMapName, sourceRoot) {
    if (!sourceMapName) {
        // Although we could make up a name or generate an anonymous
        // source map, instead we assume that any consumer who does not
        // provide a name does not actually want a source map.
        return null;
    }

    var targetLines = this;

    function updateJSON(json) {
        json = json || {};

        isString.assert(sourceMapName);
        json.file = sourceMapName;

        if (sourceRoot) {
            isString.assert(sourceRoot);
            json.sourceRoot = sourceRoot;
        }

        return json;
    }

    var secret = getSecret(targetLines);
    if (secret.cachedSourceMap) {
        // Since Lines objects are immutable, we can reuse any source map
        // that was previously generated. Nevertheless, we return a new
        // JSON object here to protect the cached source map from outside
        // modification.
        return updateJSON(secret.cachedSourceMap.toJSON());
    }

    var smg = new sourceMap.SourceMapGenerator(updateJSON());
    var sourcesToContents = {};

    secret.mappings.forEach(function(mapping) {
        var sourceCursor = mapping.sourceLines.skipSpaces(
            mapping.sourceLoc.start
        ) || mapping.sourceLines.lastPos();

        var targetCursor = targetLines.skipSpaces(
            mapping.targetLoc.start
        ) || targetLines.lastPos();

        while (comparePos(sourceCursor, mapping.sourceLoc.end) < 0 &&
               comparePos(targetCursor, mapping.targetLoc.end) < 0) {

            var sourceChar = mapping.sourceLines.charAt(sourceCursor);
            var targetChar = targetLines.charAt(targetCursor);
            assert.strictEqual(sourceChar, targetChar);

            var sourceName = mapping.sourceLines.name;

            // Add mappings one character at a time for maximum resolution.
            smg.addMapping({
                source: sourceName,
                original: { line: sourceCursor.line,
                            column: sourceCursor.column },
                generated: { line: targetCursor.line,
                             column: targetCursor.column }
            });

            if (!hasOwn.call(sourcesToContents, sourceName)) {
                var sourceContent = mapping.sourceLines.toString();
                smg.setSourceContent(sourceName, sourceContent);
                sourcesToContents[sourceName] = sourceContent;
            }

            targetLines.nextPos(targetCursor, true);
            mapping.sourceLines.nextPos(sourceCursor, true);
        }
    });

    secret.cachedSourceMap = smg;

    return smg.toJSON();
};

Lp.bootstrapCharAt = function(pos) {
    assert.strictEqual(typeof pos, "object");
    assert.strictEqual(typeof pos.line, "number");
    assert.strictEqual(typeof pos.column, "number");

    var line = pos.line,
        column = pos.column,
        strings = this.toString().split("\n"),
        string = strings[line - 1];

    if (typeof string === "undefined")
        return "";

    if (column === string.length &&
        line < strings.length)
        return "\n";

    if (column >= string.length)
        return "";

    return string.charAt(column);
};

Lp.charAt = function(pos) {
    assert.strictEqual(typeof pos, "object");
    assert.strictEqual(typeof pos.line, "number");
    assert.strictEqual(typeof pos.column, "number");

    var line = pos.line,
        column = pos.column,
        secret = getSecret(this),
        infos = secret.infos,
        info = infos[line - 1],
        c = column;

    if (typeof info === "undefined" || c < 0)
        return "";

    var indent = this.getIndentAt(line);
    if (c < indent)
        return " ";

    c += info.sliceStart - indent;

    if (c === info.sliceEnd &&
        line < this.length)
        return "\n";

    if (c >= info.sliceEnd)
        return "";

    return info.line.charAt(c);
};

Lp.stripMargin = function(width, skipFirstLine) {
    if (width === 0)
        return this;

    assert.ok(width > 0, "negative margin: " + width);

    if (skipFirstLine && this.length === 1)
        return this;

    var secret = getSecret(this);

    var lines = new Lines(secret.infos.map(function(info, i) {
        if (info.line && (i > 0 || !skipFirstLine)) {
            info = copyLineInfo(info);
            info.indent = Math.max(0, info.indent - width);
        }
        return info;
    }));

    if (secret.mappings.length > 0) {
        var newMappings = getSecret(lines).mappings;
        assert.strictEqual(newMappings.length, 0);
        secret.mappings.forEach(function(mapping) {
            newMappings.push(mapping.indent(width, skipFirstLine, true));
        });
    }

    return lines;
};

Lp.indent = function(by) {
    if (by === 0)
        return this;

    var secret = getSecret(this);

    var lines = new Lines(secret.infos.map(function(info) {
        if (info.line) {
            info = copyLineInfo(info);
            info.indent += by;
        }
        return info
    }));

    if (secret.mappings.length > 0) {
        var newMappings = getSecret(lines).mappings;
        assert.strictEqual(newMappings.length, 0);
        secret.mappings.forEach(function(mapping) {
            newMappings.push(mapping.indent(by));
        });
    }

    return lines;
};

Lp.indentTail = function(by) {
    if (by === 0)
        return this;

    if (this.length < 2)
        return this;

    var secret = getSecret(this);

    var lines = new Lines(secret.infos.map(function(info, i) {
        if (i > 0 && info.line) {
            info = copyLineInfo(info);
            info.indent += by;
        }

        return info;
    }));

    if (secret.mappings.length > 0) {
        var newMappings = getSecret(lines).mappings;
        assert.strictEqual(newMappings.length, 0);
        secret.mappings.forEach(function(mapping) {
            newMappings.push(mapping.indent(by, true));
        });
    }

    return lines;
};

Lp.getIndentAt = function(line) {
    assert.ok(line >= 1, "no line " + line + " (line numbers start from 1)");
    var secret = getSecret(this),
        info = secret.infos[line - 1];
    return Math.max(info.indent, 0);
};

Lp.guessTabWidth = function() {
    var secret = getSecret(this);
    if (hasOwn.call(secret, "cachedTabWidth")) {
        return secret.cachedTabWidth;
    }

    var counts = []; // Sparse array.
    var lastIndent = 0;

    for (var line = 1, last = this.length; line <= last; ++line) {
        var info = secret.infos[line - 1];
        var sliced = info.line.slice(info.sliceStart, info.sliceEnd);

        // Whitespace-only lines don't tell us much about the likely tab
        // width of this code.
        if (isOnlyWhitespace(sliced)) {
            continue;
        }

        var diff = Math.abs(info.indent - lastIndent);
        counts[diff] = ~~counts[diff] + 1;
        lastIndent = info.indent;
    }

    var maxCount = -1;
    var result = 2;

    for (var tabWidth = 1;
         tabWidth < counts.length;
         tabWidth += 1) {
        if (hasOwn.call(counts, tabWidth) &&
            counts[tabWidth] > maxCount) {
            maxCount = counts[tabWidth];
            result = tabWidth;
        }
    }

    return secret.cachedTabWidth = result;
};

Lp.isOnlyWhitespace = function() {
    return isOnlyWhitespace(this.toString());
};

Lp.isPrecededOnlyByWhitespace = function(pos) {
    return this.slice({
        line: pos.line,
        column: 0
    }, pos).isOnlyWhitespace();
};

Lp.getLineLength = function(line) {
    var secret = getSecret(this),
        info = secret.infos[line - 1];
    return this.getIndentAt(line) + info.sliceEnd - info.sliceStart;
};

Lp.nextPos = function(pos, skipSpaces) {
    var l = Math.max(pos.line, 0),
        c = Math.max(pos.column, 0);

    if (c < this.getLineLength(l)) {
        pos.column += 1;

        return skipSpaces
            ? !!this.skipSpaces(pos, false, true)
            : true;
    }

    if (l < this.length) {
        pos.line += 1;
        pos.column = 0;

        return skipSpaces
            ? !!this.skipSpaces(pos, false, true)
            : true;
    }

    return false;
};

Lp.prevPos = function(pos, skipSpaces) {
    var l = pos.line,
        c = pos.column;

    if (c < 1) {
        l -= 1;

        if (l < 1)
            return false;

        c = this.getLineLength(l);

    } else {
        c = Math.min(c - 1, this.getLineLength(l));
    }

    pos.line = l;
    pos.column = c;

    return skipSpaces
        ? !!this.skipSpaces(pos, true, true)
        : true;
};

Lp.firstPos = function() {
    // Trivial, but provided for completeness.
    return { line: 1, column: 0 };
};

Lp.lastPos = function() {
    return {
        line: this.length,
        column: this.getLineLength(this.length)
    };
};

Lp.skipSpaces = function(pos, backward, modifyInPlace) {
    if (pos) {
        pos = modifyInPlace ? pos : {
            line: pos.line,
            column: pos.column
        };
    } else if (backward) {
        pos = this.lastPos();
    } else {
        pos = this.firstPos();
    }

    if (backward) {
        while (this.prevPos(pos)) {
            if (!isOnlyWhitespace(this.charAt(pos)) &&
                this.nextPos(pos)) {
                return pos;
            }
        }

        return null;

    } else {
        while (isOnlyWhitespace(this.charAt(pos))) {
            if (!this.nextPos(pos)) {
                return null;
            }
        }

        return pos;
    }
};

Lp.trimLeft = function() {
    var pos = this.skipSpaces(this.firstPos(), false, true);
    return pos ? this.slice(pos) : emptyLines;
};

Lp.trimRight = function() {
    var pos = this.skipSpaces(this.lastPos(), true, true);
    return pos ? this.slice(this.firstPos(), pos) : emptyLines;
};

Lp.trim = function() {
    var start = this.skipSpaces(this.firstPos(), false, true);
    if (start === null)
        return emptyLines;

    var end = this.skipSpaces(this.lastPos(), true, true);
    assert.notStrictEqual(end, null);

    return this.slice(start, end);
};

Lp.eachPos = function(callback, startPos, skipSpaces) {
    var pos = this.firstPos();

    if (startPos) {
        pos.line = startPos.line,
        pos.column = startPos.column
    }

    if (skipSpaces && !this.skipSpaces(pos, false, true)) {
        return; // Encountered nothing but spaces.
    }

    do callback.call(this, pos);
    while (this.nextPos(pos, skipSpaces));
};

Lp.bootstrapSlice = function(start, end) {
    var strings = this.toString().split("\n").slice(
            start.line - 1, end.line);

    strings.push(strings.pop().slice(0, end.column));
    strings[0] = strings[0].slice(start.column);

    return fromString(strings.join("\n"));
};

Lp.slice = function(start, end) {
    if (!end) {
        if (!start) {
            // The client seems to want a copy of this Lines object, but
            // Lines objects are immutable, so it's perfectly adequate to
            // return the same object.
            return this;
        }

        // Slice to the end if no end position was provided.
        end = this.lastPos();
    }

    var secret = getSecret(this);
    var sliced = secret.infos.slice(start.line - 1, end.line);

    if (start.line === end.line) {
        sliced[0] = sliceInfo(sliced[0], start.column, end.column);
    } else {
        assert.ok(start.line < end.line);
        sliced[0] = sliceInfo(sliced[0], start.column);
        sliced.push(sliceInfo(sliced.pop(), 0, end.column));
    }

    var lines = new Lines(sliced);

    if (secret.mappings.length > 0) {
        var newMappings = getSecret(lines).mappings;
        assert.strictEqual(newMappings.length, 0);
        secret.mappings.forEach(function(mapping) {
            var sliced = mapping.slice(this, start, end);
            if (sliced) {
                newMappings.push(sliced);
            }
        }, this);
    }

    return lines;
};

function sliceInfo(info, startCol, endCol) {
    var sliceStart = info.sliceStart;
    var sliceEnd = info.sliceEnd;
    var indent = Math.max(info.indent, 0);
    var lineLength = indent + sliceEnd - sliceStart;

    if (typeof endCol === "undefined") {
        endCol = lineLength;
    }

    startCol = Math.max(startCol, 0);
    endCol = Math.min(endCol, lineLength);
    endCol = Math.max(endCol, startCol);

    if (endCol < indent) {
        indent = endCol;
        sliceEnd = sliceStart;
    } else {
        sliceEnd -= lineLength - endCol;
    }

    lineLength = endCol;
    lineLength -= startCol;

    if (startCol < indent) {
        indent -= startCol;
    } else {
        startCol -= indent;
        indent = 0;
        sliceStart += startCol;
    }

    assert.ok(indent >= 0);
    assert.ok(sliceStart <= sliceEnd);
    assert.strictEqual(lineLength, indent + sliceEnd - sliceStart);

    if (info.indent === indent &&
        info.sliceStart === sliceStart &&
        info.sliceEnd === sliceEnd) {
        return info;
    }

    return {
        line: info.line,
        indent: indent,
        sliceStart: sliceStart,
        sliceEnd: sliceEnd
    };
}

Lp.bootstrapSliceString = function(start, end, options) {
    return this.slice(start, end).toString(options);
};

Lp.sliceString = function(start, end, options) {
    if (!end) {
        if (!start) {
            // The client seems to want a copy of this Lines object, but
            // Lines objects are immutable, so it's perfectly adequate to
            // return the same object.
            return this;
        }

        // Slice to the end if no end position was provided.
        end = this.lastPos();
    }

    options = normalizeOptions(options);

    var infos = getSecret(this).infos;
    var parts = [];
    var tabWidth = options.tabWidth;

    for (var line = start.line; line <= end.line; ++line) {
        var info = infos[line - 1];

        if (line === start.line) {
            if (line === end.line) {
                info = sliceInfo(info, start.column, end.column);
            } else {
                info = sliceInfo(info, start.column);
            }
        } else if (line === end.line) {
            info = sliceInfo(info, 0, end.column);
        }

        var indent = Math.max(info.indent, 0);

        var before = info.line.slice(0, info.sliceStart);
        if (options.reuseWhitespace &&
            isOnlyWhitespace(before) &&
            countSpaces(before, options.tabWidth) === indent) {
            // Reuse original spaces if the indentation is correct.
            parts.push(info.line.slice(0, info.sliceEnd));
            continue;
        }

        var tabs = 0;
        var spaces = indent;

        if (options.useTabs) {
            tabs = Math.floor(indent / tabWidth);
            spaces -= tabs * tabWidth;
        }

        var result = "";

        if (tabs > 0) {
            result += new Array(tabs + 1).join("\t");
        }

        if (spaces > 0) {
            result += new Array(spaces + 1).join(" ");
        }

        result += info.line.slice(info.sliceStart, info.sliceEnd);

        parts.push(result);
    }

    return parts.join("\n");
};

Lp.isEmpty = function() {
    return this.length < 2 && this.getLineLength(1) < 1;
};

Lp.join = function(elements) {
    var separator = this;
    var separatorSecret = getSecret(separator);
    var infos = [];
    var mappings = [];
    var prevInfo;

    function appendSecret(secret) {
        if (secret === null)
            return;

        if (prevInfo) {
            var info = secret.infos[0];
            var indent = new Array(info.indent + 1).join(" ");
            var prevLine = infos.length;
            var prevColumn = Math.max(prevInfo.indent, 0) +
                prevInfo.sliceEnd - prevInfo.sliceStart;

            prevInfo.line = prevInfo.line.slice(
                0, prevInfo.sliceEnd) + indent + info.line.slice(
                    info.sliceStart, info.sliceEnd);

            prevInfo.sliceEnd = prevInfo.line.length;

            if (secret.mappings.length > 0) {
                secret.mappings.forEach(function(mapping) {
                    mappings.push(mapping.add(prevLine, prevColumn));
                });
            }

        } else if (secret.mappings.length > 0) {
            mappings.push.apply(mappings, secret.mappings);
        }

        secret.infos.forEach(function(info, i) {
            if (!prevInfo || i > 0) {
                prevInfo = copyLineInfo(info);
                infos.push(prevInfo);
            }
        });
    }

    function appendWithSeparator(secret, i) {
        if (i > 0)
            appendSecret(separatorSecret);
        appendSecret(secret);
    }

    elements.map(function(elem) {
        var lines = fromString(elem);
        if (lines.isEmpty())
            return null;
        return getSecret(lines);
    }).forEach(separator.isEmpty()
               ? appendSecret
               : appendWithSeparator);

    if (infos.length < 1)
        return emptyLines;

    var lines = new Lines(infos);

    getSecret(lines).mappings = mappings;

    return lines;
};

exports.concat = function(elements) {
    return emptyLines.join(elements);
};

Lp.concat = function(other) {
    var args = arguments,
        list = [this];
    list.push.apply(list, args);
    assert.strictEqual(list.length, args.length + 1);
    return emptyLines.join(list);
};

// The emptyLines object needs to be created all the way down here so that
// Lines.prototype will be fully populated.
var emptyLines = fromString("");

},{"./mapping":66,"./options":67,"./types":71,"./util":72,"assert":49,"private":63,"source-map":76}],66:[function(require,module,exports){
var assert = require("assert");
var types = require("./types");
var isString = types.builtInTypes.string;
var isNumber = types.builtInTypes.number;
var SourceLocation = types.namedTypes.SourceLocation;
var Position = types.namedTypes.Position;
var linesModule = require("./lines");
var comparePos = require("./util").comparePos;

function Mapping(sourceLines, sourceLoc, targetLoc) {
    assert.ok(this instanceof Mapping);
    assert.ok(sourceLines instanceof linesModule.Lines);
    SourceLocation.assert(sourceLoc);

    if (targetLoc) {
        // In certain cases it's possible for targetLoc.{start,end}.column
        // values to be negative, which technically makes them no longer
        // valid SourceLocation nodes, so we need to be more forgiving.
        assert.ok(
            isNumber.check(targetLoc.start.line) &&
            isNumber.check(targetLoc.start.column) &&
            isNumber.check(targetLoc.end.line) &&
            isNumber.check(targetLoc.end.column)
        );
    } else {
        // Assume identity mapping if no targetLoc specified.
        targetLoc = sourceLoc;
    }

    Object.defineProperties(this, {
        sourceLines: { value: sourceLines },
        sourceLoc: { value: sourceLoc },
        targetLoc: { value: targetLoc }
    });
}

var Mp = Mapping.prototype;
module.exports = Mapping;

Mp.slice = function(lines, start, end) {
    assert.ok(lines instanceof linesModule.Lines);
    Position.assert(start);

    if (end) {
        Position.assert(end);
    } else {
        end = lines.lastPos();
    }

    var sourceLines = this.sourceLines;
    var sourceLoc = this.sourceLoc;
    var targetLoc = this.targetLoc;

    function skip(name) {
        var sourceFromPos = sourceLoc[name];
        var targetFromPos = targetLoc[name];
        var targetToPos = start;

        if (name === "end") {
            targetToPos = end;
        } else {
            assert.strictEqual(name, "start");
        }

        return skipChars(
            sourceLines, sourceFromPos,
            lines, targetFromPos, targetToPos
        );
    }

    if (comparePos(start, targetLoc.start) <= 0) {
        if (comparePos(targetLoc.end, end) <= 0) {
            targetLoc = {
                start: subtractPos(targetLoc.start, start.line, start.column),
                end: subtractPos(targetLoc.end, start.line, start.column)
            };

            // The sourceLoc can stay the same because the contents of the
            // targetLoc have not changed.

        } else if (comparePos(end, targetLoc.start) <= 0) {
            return null;

        } else {
            sourceLoc = {
                start: sourceLoc.start,
                end: skip("end")
            };

            targetLoc = {
                start: subtractPos(targetLoc.start, start.line, start.column),
                end: subtractPos(end, start.line, start.column)
            };
        }

    } else {
        if (comparePos(targetLoc.end, start) <= 0) {
            return null;
        }

        if (comparePos(targetLoc.end, end) <= 0) {
            sourceLoc = {
                start: skip("start"),
                end: sourceLoc.end
            };

            targetLoc = {
                // Same as subtractPos(start, start.line, start.column):
                start: { line: 1, column: 0 },
                end: subtractPos(targetLoc.end, start.line, start.column)
            };

        } else {
            sourceLoc = {
                start: skip("start"),
                end: skip("end")
            };

            targetLoc = {
                // Same as subtractPos(start, start.line, start.column):
                start: { line: 1, column: 0 },
                end: subtractPos(end, start.line, start.column)
            };
        }
    }

    return new Mapping(this.sourceLines, sourceLoc, targetLoc);
};

Mp.add = function(line, column) {
    return new Mapping(this.sourceLines, this.sourceLoc, {
        start: addPos(this.targetLoc.start, line, column),
        end: addPos(this.targetLoc.end, line, column)
    });
};

function addPos(toPos, line, column) {
    return {
        line: toPos.line + line - 1,
        column: (toPos.line === 1)
            ? toPos.column + column
            : toPos.column
    };
}

Mp.subtract = function(line, column) {
    return new Mapping(this.sourceLines, this.sourceLoc, {
        start: subtractPos(this.targetLoc.start, line, column),
        end: subtractPos(this.targetLoc.end, line, column)
    });
};

function subtractPos(fromPos, line, column) {
    return {
        line: fromPos.line - line + 1,
        column: (fromPos.line === line)
            ? fromPos.column - column
            : fromPos.column
    };
}

Mp.indent = function(by, skipFirstLine, noNegativeColumns) {
    if (by === 0) {
        return this;
    }

    var targetLoc = this.targetLoc;
    var startLine = targetLoc.start.line;
    var endLine = targetLoc.end.line;

    if (skipFirstLine && startLine === 1 && endLine === 1) {
        return this;
    }

    targetLoc = {
        start: targetLoc.start,
        end: targetLoc.end
    };

    if (!skipFirstLine || startLine > 1) {
        var startColumn = targetLoc.start.column + by;
        targetLoc.start = {
            line: startLine,
            column: noNegativeColumns
                ? Math.max(0, startColumn)
                : startColumn
        };
    }

    if (!skipFirstLine || endLine > 1) {
        var endColumn = targetLoc.end.column + by;
        targetLoc.end = {
            line: endLine,
            column: noNegativeColumns
                ? Math.max(0, endColumn)
                : endColumn
        };
    }

    return new Mapping(this.sourceLines, this.sourceLoc, targetLoc);
};

function skipChars(
    sourceLines, sourceFromPos,
    targetLines, targetFromPos, targetToPos
) {
    assert.ok(sourceLines instanceof linesModule.Lines);
    assert.ok(targetLines instanceof linesModule.Lines);
    Position.assert(sourceFromPos);
    Position.assert(targetFromPos);
    Position.assert(targetToPos);

    var targetComparison = comparePos(targetFromPos, targetToPos);
    if (targetComparison === 0) {
        // Trivial case: no characters to skip.
        return sourceFromPos;
    }

    if (targetComparison < 0) {
        // Skipping forward.

        var sourceCursor = sourceLines.skipSpaces(sourceFromPos);
        var targetCursor = targetLines.skipSpaces(targetFromPos);

        var lineDiff = targetToPos.line - targetCursor.line;
        sourceCursor.line += lineDiff;
        targetCursor.line += lineDiff;

        if (lineDiff > 0) {
            // If jumping to later lines, reset columns to the beginnings
            // of those lines.
            sourceCursor.column = 0;
            targetCursor.column = 0;
        } else {
            assert.strictEqual(lineDiff, 0);
        }

        while (comparePos(targetCursor, targetToPos) < 0 &&
               targetLines.nextPos(targetCursor, true)) {
            assert.ok(sourceLines.nextPos(sourceCursor, true));
            assert.strictEqual(
                sourceLines.charAt(sourceCursor),
                targetLines.charAt(targetCursor)
            );
        }

    } else {
        // Skipping backward.

        var sourceCursor = sourceLines.skipSpaces(sourceFromPos, true);
        var targetCursor = targetLines.skipSpaces(targetFromPos, true);

        var lineDiff = targetToPos.line - targetCursor.line;
        sourceCursor.line += lineDiff;
        targetCursor.line += lineDiff;

        if (lineDiff < 0) {
            // If jumping to earlier lines, reset columns to the ends of
            // those lines.
            sourceCursor.column = sourceLines.getLineLength(sourceCursor.line);
            targetCursor.column = targetLines.getLineLength(targetCursor.line);
        } else {
            assert.strictEqual(lineDiff, 0);
        }

        while (comparePos(targetToPos, targetCursor) < 0 &&
               targetLines.prevPos(targetCursor, true)) {
            assert.ok(sourceLines.prevPos(sourceCursor, true));
            assert.strictEqual(
                sourceLines.charAt(sourceCursor),
                targetLines.charAt(targetCursor)
            );
        }
    }

    return sourceCursor;
}

},{"./lines":65,"./types":71,"./util":72,"assert":49}],67:[function(require,module,exports){
var defaults = {
    // If you want to use a different branch of esprima, or any other
    // module that supports a .parse function, pass that module object to
    // recast.parse as options.esprima.
    esprima: require("esprima-fb"),

    // Number of spaces the pretty-printer should use per tab for
    // indentation. If you do not pass this option explicitly, it will be
    // (quite reliably!) inferred from the original code.
    tabWidth: 4,

    // If you really want the pretty-printer to use tabs instead of
    // spaces, make this option true.
    useTabs: false,

    // The reprinting code leaves leading whitespace untouched unless it
    // has to reindent a line, or you pass false for this option.
    reuseWhitespace: true,

    // Some of the pretty-printer code (such as that for printing function
    // parameter lists) makes a valiant attempt to prevent really long
    // lines. You can adjust the limit by changing this option; however,
    // there is no guarantee that line length will fit inside this limit.
    wrapColumn: 74, // Aspirational for now.

    // Pass a string as options.sourceFileName to recast.parse to tell the
    // reprinter to keep track of reused code so that it can construct a
    // source map automatically.
    sourceFileName: null,

    // Pass a string as options.sourceMapName to recast.print, and
    // (provided you passed options.sourceFileName earlier) the
    // PrintResult of recast.print will have a .map property for the
    // generated source map.
    sourceMapName: null,

    // If provided, this option will be passed along to the source map
    // generator as a root directory for relative source file paths.
    sourceRoot: null,

    // If you provide a source map that was generated from a previous call
    // to recast.print as options.inputSourceMap, the old source map will
    // be composed with the new source map.
    inputSourceMap: null,

    // If you want esprima to generate .range information (recast only
    // uses .loc internally), pass true for this option.
    range: false,

    // If you want esprima not to throw exceptions when it encounters
    // non-fatal errors, keep this option true.
    tolerant: true
}, hasOwn = defaults.hasOwnProperty;

// Copy options and fill in default values.
exports.normalize = function(options) {
    options = options || defaults;

    function get(key) {
        return hasOwn.call(options, key)
            ? options[key]
            : defaults[key];
    }

    return {
        tabWidth: +get("tabWidth"),
        useTabs: !!get("useTabs"),
        reuseWhitespace: !!get("reuseWhitespace"),
        wrapColumn: Math.max(get("wrapColumn"), 0),
        sourceFileName: get("sourceFileName"),
        sourceMapName: get("sourceMapName"),
        sourceRoot: get("sourceRoot"),
        inputSourceMap: get("inputSourceMap"),
        esprima: get("esprima"),
        range: get("range"),
        tolerant: get("tolerant")
    };
};

},{"esprima-fb":60}],68:[function(require,module,exports){
var assert = require("assert");
var types = require("./types");
var n = types.namedTypes;
var b = types.builders;
var isObject = types.builtInTypes.object;
var isArray = types.builtInTypes.array;
var isFunction = types.builtInTypes.function;
var Patcher = require("./patcher").Patcher;
var normalizeOptions = require("./options").normalize;
var fromString = require("./lines").fromString;
var addComments = require("./comments").add;
var hasOwn = Object.prototype.hasOwnProperty;

exports.parse = function parse(source, options) {
    options = normalizeOptions(options);

    var lines = fromString(source, options);

    var sourceWithoutTabs = lines.toString({
        tabWidth: options.tabWidth,
        reuseWhitespace: false,
        useTabs: false
    });

    var pure = options.esprima.parse(sourceWithoutTabs, {
        loc: true,
        range: options.range,
        comment: true,
        tolerant: options.tolerant
    });

    new LocationFixer(lines).fix(pure);

    addComments(pure, lines);

    // In order to ensure we reprint leading and trailing program
    // comments, wrap the original Program node with a File node.
    pure = b.file(pure);
    pure.loc = {
        lines: lines,
        indent: 0,
        start: lines.firstPos(),
        end: lines.lastPos()
    };

    // Return a copy of the original AST so that any changes made may be
    // compared to the original.
    return copyAst(pure);
};

function LocationFixer(lines) {
    assert.ok(this instanceof LocationFixer);
    this.lines = lines;
    this.indent = 0;
}

var LFp = LocationFixer.prototype;

LFp.fix = function(node) {
    if (isArray.check(node)) {
        node.forEach(this.fix, this);
        return;
    }

    if (!isObject.check(node)) {
        return;
    }

    var lines = this.lines;
    var loc = node && node.loc;
    var start = loc && loc.start;
    var end = loc && loc.end;
    var oldIndent = this.indent;
    var newIndent = oldIndent;

    if (start) {
        start.line = Math.max(start.line, 1);

        if (lines.isPrecededOnlyByWhitespace(start)) {
            // The indent returned by lines.getIndentAt is the column of
            // the first non-space character in the line, but start.column
            // may fall before that character, as when a file begins with
            // whitespace but its start.column nevertheless must be 0.
            assert.ok(start.column <= lines.getIndentAt(start.line));
            newIndent = this.indent = start.column;
        }
    }

    var names = types.getFieldNames(node);
    for (var i = 0, len = names.length; i < len; ++i) {
        this.fix(node[names[i]]);
    }

    // Restore original value of this.indent after the recursive call.
    this.indent = oldIndent;

    if (loc) {
        loc.lines = lines;
        loc.indent = newIndent;
    }

    if (end) {
        end.line = Math.max(end.line, 1);

        var pos = {
            line: end.line,
            column: end.column
        };

        // Negative columns might indicate an Esprima bug?
        // For now, treat them as reverse indices, a la Python.
        if (pos.column < 0)
            pos.column += lines.getLineLength(pos.line);

        while (lines.prevPos(pos)) {
            if (/\S/.test(lines.charAt(pos))) {
                assert.ok(lines.nextPos(pos));

                end.line = pos.line;
                end.column = pos.column;

                break;
            }
        }
    }

    if ((n.MethodDefinition && n.MethodDefinition.check(node)) ||
        (n.Property.check(node) && (node.method || node.shorthand))) {
        // If the node is a MethodDefinition or a .method or .shorthand
        // Property, then the location information stored in
        // node.value.loc is very likely untrustworthy (just the {body}
        // part of a method, or nothing in the case of shorthand
        // properties), so we null out that information to prevent
        // accidental reuse of bogus source code during reprinting.
        node.value.loc = null;
    }
};

function copyAst(node) {
    if (typeof node !== "object") {
        return node;
    }

    if (isObject.check(node)) {
        var copy = Object.create(Object.getPrototypeOf(node), {
            original: { // Provide a link from the copy to the original.
                value: node,
                configurable: false,
                enumerable: false,
                writable: true
            }
        });

        for (var key in node) {
            var val = node[key];
            if (val && key === "loc") {
                copy.loc = {
                    start: { line: val.start.line, column: val.start.column },
                    end: { line: val.end.line, column: val.end.column }
                };
            } else if (hasOwn.call(node, key)) {
                copy[key] = copyAst(val);
            }
        }

        return copy;
    }

    if (isArray.check(node)) {
        return node.map(copyAst);
    }

    return node;
}

},{"./comments":64,"./lines":65,"./options":67,"./patcher":69,"./types":71,"assert":49}],69:[function(require,module,exports){
var assert = require("assert");
var linesModule = require("./lines");
var types = require("./types");
var getFieldValue = types.getFieldValue;
var Node = types.namedTypes.Node;
var Expression = types.namedTypes.Expression;
var SourceLocation = types.namedTypes.SourceLocation;
var util = require("./util");
var comparePos = util.comparePos;
var NodePath = types.NodePath;
var isObject = types.builtInTypes.object;
var isArray = types.builtInTypes.array;
var isString = types.builtInTypes.string;

function Patcher(lines) {
    assert.ok(this instanceof Patcher);
    assert.ok(lines instanceof linesModule.Lines);

    var self = this,
        replacements = [];

    self.replace = function(loc, lines) {
        if (isString.check(lines))
            lines = linesModule.fromString(lines);

        replacements.push({
            lines: lines,
            start: loc.start,
            end: loc.end
        });
    };

    self.get = function(loc) {
        // If no location is provided, return the complete Lines object.
        loc = loc || {
            start: { line: 1, column: 0 },
            end: { line: lines.length,
                   column: lines.getLineLength(lines.length) }
        };

        var sliceFrom = loc.start,
            toConcat = [];

        function pushSlice(from, to) {
            assert.ok(comparePos(from, to) <= 0);
            toConcat.push(lines.slice(from, to));
        }

        replacements.sort(function(a, b) {
            return comparePos(a.start, b.start);
        }).forEach(function(rep) {
            if (comparePos(sliceFrom, rep.start) > 0) {
                // Ignore nested replacement ranges.
            } else {
                pushSlice(sliceFrom, rep.start);
                toConcat.push(rep.lines);
                sliceFrom = rep.end;
            }
        });

        pushSlice(sliceFrom, loc.end);

        return linesModule.concat(toConcat);
    };
}
exports.Patcher = Patcher;

exports.getReprinter = function(path) {
    assert.ok(path instanceof NodePath);

    // Make sure that this path refers specifically to a Node, rather than
    // some non-Node subproperty of a Node.
    if (path.node !== path.value)
        return;

    var orig = path.node.original;
    var origLoc = orig && orig.loc;
    var lines = origLoc && origLoc.lines;
    var reprints = [];

    if (!lines || !findReprints(path, reprints))
        return;

    return function(print) {
        var patcher = new Patcher(lines);

        reprints.forEach(function(reprint) {
            var old = reprint.oldPath.value;
            SourceLocation.assert(old.loc, true);
            patcher.replace(
                old.loc,
                print(reprint.newPath).indentTail(old.loc.indent)
            );
        });

        return patcher.get(origLoc).indentTail(-orig.loc.indent);
    };
};

function findReprints(newPath, reprints) {
    var newNode = newPath.node;
    Node.assert(newNode);

    var oldNode = newNode.original;
    Node.assert(oldNode);

    assert.deepEqual(reprints, []);

    if (newNode.type !== oldNode.type) {
        return false;
    }

    var oldPath = new NodePath(oldNode);
    var canReprint = findChildReprints(newPath, oldPath, reprints);

    if (!canReprint) {
        // Make absolutely sure the calling code does not attempt to reprint
        // any nodes.
        reprints.length = 0;
    }

    return canReprint;
}

function findAnyReprints(newPath, oldPath, reprints) {
    var newNode = newPath.value;
    var oldNode = oldPath.value;

    if (newNode === oldNode)
        return true;

    if (isArray.check(newNode))
        return findArrayReprints(newPath, oldPath, reprints);

    if (isObject.check(newNode))
        return findObjectReprints(newPath, oldPath, reprints);

    return false;
}

function findArrayReprints(newPath, oldPath, reprints) {
    var newNode = newPath.value;
    var oldNode = oldPath.value;
    isArray.assert(newNode);
    var len = newNode.length;

    if (!(isArray.check(oldNode) &&
          oldNode.length === len))
        return false;

    for (var i = 0; i < len; ++i)
        if (!findAnyReprints(newPath.get(i), oldPath.get(i), reprints))
            return false;

    return true;
}

function findObjectReprints(newPath, oldPath, reprints) {
    var newNode = newPath.value;
    isObject.assert(newNode);

    if (newNode.original === null) {
        // If newNode.original node was set to null, reprint the node.
        return false;
    }

    var oldNode = oldPath.value;
    if (!isObject.check(oldNode))
        return false;

    if (Node.check(newNode)) {
        if (!Node.check(oldNode)) {
            return false;
        }

        if (!oldNode.loc) {
            // If we have no .loc information for oldNode, then we won't
            // be able to reprint it.
            return false;
        }

        // Here we need to decide whether the reprinted code for newNode
        // is appropriate for patching into the location of oldNode.

        if (newNode.type === oldNode.type) {
            var childReprints = [];

            if (findChildReprints(newPath, oldPath, childReprints)) {
                reprints.push.apply(reprints, childReprints);
            } else {
                reprints.push({
                    newPath: newPath,
                    oldPath: oldPath
                });
            }

            return true;
        }

        if (Expression.check(newNode) &&
            Expression.check(oldNode)) {

            // If both nodes are subtypes of Expression, then we should be
            // able to fill the location occupied by the old node with
            // code printed for the new node with no ill consequences.
            reprints.push({
                newPath: newPath,
                oldPath: oldPath
            });

            return true;
        }

        // The nodes have different types, and at least one of the types
        // is not a subtype of the Expression type, so we cannot safely
        // assume the nodes are syntactically interchangeable.
        return false;
    }

    return findChildReprints(newPath, oldPath, reprints);
}

function hasOpeningParen(oldPath) {
    assert.ok(oldPath instanceof NodePath);
    var oldNode = oldPath.value;
    var loc = oldNode.loc;
    var lines = loc && loc.lines;

    if (lines) {
        var pos = lines.skipSpaces(loc.start, true);
        if (pos && lines.prevPos(pos) && lines.charAt(pos) === "(") {
            var rootPath = oldPath;
            while (rootPath.parent)
                rootPath = rootPath.parent;
            // If we found an opening parenthesis but it occurred before
            // the start of the original subtree for this reprinting, then
            // we must not return true for hasOpeningParen(oldPath).
            return comparePos(rootPath.value.loc.start, pos) <= 0;
        }
    }

    return false;
}

function hasClosingParen(oldPath) {
    assert.ok(oldPath instanceof NodePath);
    var oldNode = oldPath.value;
    var loc = oldNode.loc;
    var lines = loc && loc.lines;

    if (lines) {
        var pos = lines.skipSpaces(loc.end);
        if (pos && lines.charAt(pos) === ")") {
            var rootPath = oldPath;
            while (rootPath.parent)
                rootPath = rootPath.parent;
            // If we found a closing parenthesis but it occurred after
            // the end of the original subtree for this reprinting, then
            // we must not return true for hasClosingParen(oldPath).
            return comparePos(pos, rootPath.value.loc.end) <= 0;
        }
    }

    return false;
}

function hasParens(oldPath) {
    // This logic can technically be fooled if the node has parentheses
    // but there are comments intervening between the parentheses and the
    // node. In such cases the node will be harmlessly wrapped in an
    // additional layer of parentheses.
    return hasOpeningParen(oldPath) && hasClosingParen(oldPath);
}

function findChildReprints(newPath, oldPath, reprints) {
    var newNode = newPath.value;
    var oldNode = oldPath.value;

    isObject.assert(newNode);
    isObject.assert(oldNode);

    if (newNode.original === null) {
        // If newNode.original node was set to null, reprint the node.
        return false;
    }

    // If this type of node cannot come lexically first in its enclosing
    // statement (e.g. a function expression or object literal), and it
    // seems to be doing so, then the only way we can ignore this problem
    // and save ourselves from falling back to the pretty printer is if an
    // opening parenthesis happens to precede the node.  For example,
    // (function(){ ... }()); does not need to be reprinted, even though
    // the FunctionExpression comes lexically first in the enclosing
    // ExpressionStatement and fails the hasParens test, because the
    // parent CallExpression passes the hasParens test. If we relied on
    // the path.needsParens() && !hasParens(oldNode) check below, the
    // absence of a closing parenthesis after the FunctionExpression would
    // trigger pretty-printing unnecessarily.
    if (!newPath.canBeFirstInStatement() &&
        newPath.firstInStatement() &&
        !hasOpeningParen(oldPath))
        return false;

    // If this node needs parentheses and will not be wrapped with
    // parentheses when reprinted, then return false to skip reprinting
    // and let it be printed generically.
    if (newPath.needsParens(true) && !hasParens(oldPath))
        return false;

    for (var k in util.getUnionOfKeys(newNode, oldNode)) {
        if (k === "loc")
            continue;

        if (!findAnyReprints(newPath.get(k), oldPath.get(k), reprints))
            return false;
    }

    return true;
}

},{"./lines":65,"./types":71,"./util":72,"assert":49}],70:[function(require,module,exports){
var assert = require("assert");
var sourceMap = require("source-map");
var printComments = require("./comments").printComments;
var linesModule = require("./lines");
var fromString = linesModule.fromString;
var concat = linesModule.concat;
var normalizeOptions = require("./options").normalize;
var getReprinter = require("./patcher").getReprinter;
var types = require("./types");
var namedTypes = types.namedTypes;
var isString = types.builtInTypes.string;
var isObject = types.builtInTypes.object;
var NodePath = types.NodePath;
var util = require("./util");

function PrintResult(code, sourceMap) {
    assert.ok(this instanceof PrintResult);

    isString.assert(code);
    this.code = code;

    if (sourceMap) {
        isObject.assert(sourceMap);
        this.map = sourceMap;
    }
}

var PRp = PrintResult.prototype;
var warnedAboutToString = false;

PRp.toString = function() {
    if (!warnedAboutToString) {
        console.warn(
            "Deprecation warning: recast.print now returns an object with " +
            "a .code property. You appear to be treating the object as a " +
            "string, which might still work but is strongly discouraged."
        );

        warnedAboutToString = true;
    }

    return this.code;
};

var emptyPrintResult = new PrintResult("");

function Printer(originalOptions) {
    assert.ok(this instanceof Printer);

    var explicitTabWidth = originalOptions && originalOptions.tabWidth;
    var options = normalizeOptions(originalOptions);
    assert.notStrictEqual(options, originalOptions);

    // It's common for client code to pass the same options into both
    // recast.parse and recast.print, but the Printer doesn't need (and
    // can be confused by) options.sourceFileName, so we null it out.
    options.sourceFileName = null;

    function printWithComments(path) {
        assert.ok(path instanceof NodePath);
        return printComments(path.node.comments, print(path), options);
    }

    function print(path, includeComments) {
        if (includeComments)
            return printWithComments(path);

        assert.ok(path instanceof NodePath);

        if (!explicitTabWidth) {
            var oldTabWidth = options.tabWidth;
            var orig = path.node.original;
            var origLoc = orig && orig.loc;
            var origLines = origLoc && origLoc.lines;
            if (origLines) {
                options.tabWidth = origLines.guessTabWidth();
                try {
                    return maybeReprint(path);
                } finally {
                    options.tabWidth = oldTabWidth;
                }
            }
        }

        return maybeReprint(path);
    }

    function maybeReprint(path) {
        var reprinter = getReprinter(path);
        if (reprinter)
            return maybeAddParens(path, reprinter(maybeReprint));
        return printRootGenerically(path);
    }

    // Print the root node generically, but then resume reprinting its
    // children non-generically.
    function printRootGenerically(path) {
        return genericPrint(path, options, printWithComments);
    }

    // Print the entire AST generically.
    function printGenerically(path) {
        return genericPrint(path, options, printGenerically);
    }

    this.print = function(ast) {
        if (!ast) {
            return emptyPrintResult;
        }

        var path = ast instanceof NodePath ? ast : new NodePath(ast);
        var lines = print(path, true);

        return new PrintResult(
            lines.toString(options),
            util.composeSourceMaps(
                options.inputSourceMap,
                lines.getSourceMap(
                    options.sourceMapName,
                    options.sourceRoot
                )
            )
        );
    };

    this.printGenerically = function(ast) {
        if (!ast) {
            return emptyPrintResult;
        }

        var path = ast instanceof NodePath ? ast : new NodePath(ast);
        var oldReuseWhitespace = options.reuseWhitespace;

        // Do not reuse whitespace (or anything else, for that matter)
        // when printing generically.
        options.reuseWhitespace = false;

        try {
            return new PrintResult(printGenerically(path).toString(options));
        } finally {
            options.reuseWhitespace = oldReuseWhitespace;
        }
    };
}

exports.Printer = Printer;

function maybeAddParens(path, lines) {
    return path.needsParens() ? concat(["(", lines, ")"]) : lines;
}

function genericPrint(path, options, printPath) {
    assert.ok(path instanceof NodePath);
    return maybeAddParens(path, genericPrintNoParens(path, options, printPath));
}

function genericPrintNoParens(path, options, print) {
    var n = path.value;

    if (!n) {
        return fromString("");
    }

    if (typeof n === "string") {
        return fromString(n, options);
    }

    namedTypes.Node.assert(n);

    switch (n.type) {
    case "File":
        path = path.get("program");
        n = path.node;
        namedTypes.Program.assert(n);

        // intentionally fall through...

    case "Program":
        return maybeAddSemicolon(
            printStatementSequence(path.get("body"), options, print)
        );

    case "EmptyStatement":
        return fromString("");

    case "ExpressionStatement":
        return concat([print(path.get("expression")), ";"]);

    case "BinaryExpression":
    case "LogicalExpression":
    case "AssignmentExpression":
        return fromString(" ").join([
            print(path.get("left")),
            n.operator,
            print(path.get("right"))
        ]);

    case "MemberExpression":
        var parts = [print(path.get("object"))];

        if (n.computed)
            parts.push("[", print(path.get("property")), "]");
        else
            parts.push(".", print(path.get("property")));

        return concat(parts);

    case "Path":
        return fromString(".").join(n.body);

    case "Identifier":
        return fromString(n.name, options);

    case "SpreadElement":
    case "SpreadElementPattern":
    case "SpreadProperty":
    case "SpreadPropertyPattern":
        return concat(["...", print(path.get("argument"))]);

    case "FunctionDeclaration":
    case "FunctionExpression":
        var parts = [];

        if (n.async)
            parts.push("async ");

        parts.push("function");

        if (n.generator)
            parts.push("*");

        if (n.id)
            parts.push(" ", print(path.get("id")));

        parts.push(
            "(",
            printFunctionParams(path, options, print),
            ") ",
            print(path.get("body")));

        return concat(parts);

    case "ArrowFunctionExpression":
        var parts = [];

        if (n.async)
            parts.push("async ");

        if (n.params.length === 1) {
            parts.push(print(path.get("params", 0)));
        } else {
            parts.push(
                "(",
                printFunctionParams(path, options, print),
                ")"
            );
        }

        parts.push(" => ", print(path.get("body")));

        return concat(parts);

    case "MethodDefinition":
        var parts = [];

        if (n.static) {
            parts.push("static ");
        }

        parts.push(printMethod(
            n.kind,
            path.get("key"),
            path.get("value"),
            options,
            print
        ));

        return concat(parts);

    case "YieldExpression":
        var parts = ["yield"];

        if (n.delegate)
            parts.push("*");

        if (n.argument)
            parts.push(" ", print(path.get("argument")));

        return concat(parts);

    case "AwaitExpression":
        var parts = ["await"];

        if (n.all)
            parts.push("*");

        if (n.argument)
            parts.push(" ", print(path.get("argument")));

        return concat(parts);

    case "ModuleDeclaration":
        var parts = ["module", print(path.get("id"))];

        if (n.source) {
            assert.ok(!n.body);
            parts.push("from", print(path.get("source")));
        } else {
            parts.push(print(path.get("body")));
        }

        return fromString(" ").join(parts);

    case "ImportSpecifier":
    case "ExportSpecifier":
        var parts = [print(path.get("id"))];

        if (n.name)
            parts.push(" as ", print(path.get("name")));

        return concat(parts);

    case "ExportBatchSpecifier":
        return fromString("*");

    case "ImportNamespaceSpecifier":
        return concat(["* as ", print(path.get("id"))]);

    case "ImportDefaultSpecifier":
        return print(path.get("id"));

    case "ExportDeclaration":
        var parts = ["export"];

        if (n["default"]) {
            parts.push(" default");

        } else if (n.specifiers &&
                   n.specifiers.length > 0) {

            if (n.specifiers.length === 1 &&
                n.specifiers[0].type === "ExportBatchSpecifier") {
                parts.push(" *");
            } else {
                parts.push(
                    " { ",
                    fromString(", ").join(path.get("specifiers").map(print)),
                    " }"
                );
            }

            if (n.source)
                parts.push(" from ", print(path.get("source")));

            parts.push(";");

            return concat(parts);
        }

        if (n.declaration) {
            if (!namedTypes.Node.check(n.declaration)) {
                console.log(JSON.stringify(n, null, 2));
            }
            var decLines = print(path.get("declaration"));
            parts.push(" ", decLines);
            if (lastNonSpaceCharacter(decLines) !== ";") {
                parts.push(";");
            }
        }

        return concat(parts);

    case "ImportDeclaration":
        var parts = ["import "];

        if (n.specifiers &&
            n.specifiers.length > 0) {

            var foundImportSpecifier = false;

            path.get("specifiers").each(function(sp) {
                if (sp.name > 0) {
                    parts.push(", ");
                }

                if (namedTypes.ImportDefaultSpecifier.check(sp.value) ||
                    namedTypes.ImportNamespaceSpecifier.check(sp.value)) {
                    assert.strictEqual(foundImportSpecifier, false);
                } else {
                    namedTypes.ImportSpecifier.assert(sp.value);
                    if (!foundImportSpecifier) {
                        foundImportSpecifier = true;
                        parts.push("{");
                    }
                }

                parts.push(print(sp));
            });

            if (foundImportSpecifier) {
                parts.push("}");
            }

            parts.push(" from ");
        }

        parts.push(print(path.get("source")), ";");

        return concat(parts);

    case "BlockStatement":
        var naked = printStatementSequence(path.get("body"), options, print);
        if (naked.isEmpty())
            return fromString("{}");

        return concat([
            "{\n",
            naked.indent(options.tabWidth),
            "\n}"
        ]);

    case "ReturnStatement":
        var parts = ["return"];

        if (n.argument) {
            var argLines = print(path.get("argument"));
            if (argLines.length > 1 &&
                namedTypes.XJSElement &&
                namedTypes.XJSElement.check(n.argument)) {
                parts.push(
                    " (\n",
                    argLines.indent(options.tabWidth),
                    "\n)"
                );
            } else {
                parts.push(" ", argLines);
            }
        }

        parts.push(";");

        return concat(parts);

    case "CallExpression":
        return concat([
            print(path.get("callee")),
            printArgumentsList(path, options, print)
        ]);

    case "ObjectExpression":
    case "ObjectPattern":
        var allowBreak = false,
            len = n.properties.length,
            parts = [len > 0 ? "{\n" : "{"];

        path.get("properties").map(function(childPath) {
            var prop = childPath.value;
            var i = childPath.name;

            var lines = print(childPath).indent(options.tabWidth);

            var multiLine = lines.length > 1;
            if (multiLine && allowBreak) {
                // Similar to the logic for BlockStatement.
                parts.push("\n");
            }

            parts.push(lines);

            if (i < len - 1) {
                // Add an extra line break if the previous object property
                // had a multi-line value.
                parts.push(multiLine ? ",\n\n" : ",\n");
                allowBreak = !multiLine;
            }
        });

        parts.push(len > 0 ? "\n}" : "}");

        return concat(parts);

    case "PropertyPattern":
        return concat([
            print(path.get("key")),
            ": ",
            print(path.get("pattern"))
        ]);

    case "Property": // Non-standard AST node type.
        if (n.method || n.kind === "get" || n.kind === "set") {
            return printMethod(
                n.kind,
                path.get("key"),
                path.get("value"),
                options,
                print
            );
        }

        if (path.node.shorthand) {
            return print(path.get("key"));
        } else {
            return concat([
                print(path.get("key")),
                ": ",
                print(path.get("value"))
            ]);
        }

    case "ArrayExpression":
    case "ArrayPattern":
        var elems = n.elements,
            len = elems.length,
            parts = ["["];

        path.get("elements").each(function(elemPath) {
            var elem = elemPath.value;
            if (!elem) {
                // If the array expression ends with a hole, that hole
                // will be ignored by the interpreter, but if it ends with
                // two (or more) holes, we need to write out two (or more)
                // commas so that the resulting code is interpreted with
                // both (all) of the holes.
                parts.push(",");
            } else {
                var i = elemPath.name;
                if (i > 0)
                    parts.push(" ");
                parts.push(print(elemPath));
                if (i < len - 1)
                    parts.push(",");
            }
        });

        parts.push("]");

        return concat(parts);

    case "SequenceExpression":
        return fromString(", ").join(path.get("expressions").map(print));

    case "ThisExpression":
        return fromString("this");

    case "Literal":
        if (typeof n.value !== "string")
            return fromString(n.value, options);

        // intentionally fall through...

    case "ModuleSpecifier":
        // A ModuleSpecifier is a string-valued Literal.
        return fromString(nodeStr(n), options);

    case "UnaryExpression":
        var parts = [n.operator];
        if (/[a-z]$/.test(n.operator))
            parts.push(" ");
        parts.push(print(path.get("argument")));
        return concat(parts);

    case "UpdateExpression":
        var parts = [
            print(path.get("argument")),
            n.operator
        ];

        if (n.prefix)
            parts.reverse();

        return concat(parts);

    case "ConditionalExpression":
        return concat([
            "(", print(path.get("test")),
            " ? ", print(path.get("consequent")),
            " : ", print(path.get("alternate")), ")"
        ]);

    case "NewExpression":
        var parts = ["new ", print(path.get("callee"))];
        var args = n.arguments;
        if (args) {
            parts.push(printArgumentsList(path, options, print));
        }

        return concat(parts);

    case "VariableDeclaration":
        var parts = [n.kind, " "];
        var maxLen = 0;
        var printed = path.get("declarations").map(function(childPath) {
            var lines = print(childPath);
            maxLen = Math.max(lines.length, maxLen);
            return lines;
        });

        if (maxLen === 1) {
            parts.push(fromString(", ").join(printed));
        } else if (printed.length > 1 ) {
            parts.push(
                fromString(",\n").join(printed)
                    .indentTail(n.kind.length + 1)
            );
        } else {
            parts.push(printed[0]);
        }

        // We generally want to terminate all variable declarations with a
        // semicolon, except when they are children of for loops.
        var parentNode = path.parent && path.parent.node;
        if (!namedTypes.ForStatement.check(parentNode) &&
            !namedTypes.ForInStatement.check(parentNode) &&
            !(namedTypes.ForOfStatement &&
              namedTypes.ForOfStatement.check(parentNode))) {
            parts.push(";");
        }

        return concat(parts);

    case "VariableDeclarator":
        return n.init ? fromString(" = ").join([
            print(path.get("id")),
            print(path.get("init"))
        ]) : print(path.get("id"));

    case "WithStatement":
        return concat([
            "with (",
            print(path.get("object")),
            ") ",
            print(path.get("body"))
        ]);

    case "IfStatement":
        var con = adjustClause(print(path.get("consequent")), options),
            parts = ["if (", print(path.get("test")), ")", con];

        if (n.alternate)
            parts.push(
                endsWithBrace(con) ? " else" : "\nelse",
                adjustClause(print(path.get("alternate")), options));

        return concat(parts);

    case "ForStatement":
        // TODO Get the for (;;) case right.
        var init = print(path.get("init")),
            sep = init.length > 1 ? ";\n" : "; ",
            forParen = "for (",
            indented = fromString(sep).join([
                init,
                print(path.get("test")),
                print(path.get("update"))
            ]).indentTail(forParen.length),
            head = concat([forParen, indented, ")"]),
            clause = adjustClause(print(path.get("body")), options),
            parts = [head];

        if (head.length > 1) {
            parts.push("\n");
            clause = clause.trimLeft();
        }

        parts.push(clause);

        return concat(parts);

    case "WhileStatement":
        return concat([
            "while (",
            print(path.get("test")),
            ")",
            adjustClause(print(path.get("body")), options)
        ]);

    case "ForInStatement":
        // Note: esprima can't actually parse "for each (".
        return concat([
            n.each ? "for each (" : "for (",
            print(path.get("left")),
            " in ",
            print(path.get("right")),
            ")",
            adjustClause(print(path.get("body")), options)
        ]);

    case "ForOfStatement":
        return concat([
            "for (",
            print(path.get("left")),
            " of ",
            print(path.get("right")),
            ")",
            adjustClause(print(path.get("body")), options)
        ]);

    case "DoWhileStatement":
        var doBody = concat([
            "do",
            adjustClause(print(path.get("body")), options)
        ]), parts = [doBody];

        if (endsWithBrace(doBody))
            parts.push(" while");
        else
            parts.push("\nwhile");

        parts.push(" (", print(path.get("test")), ");");

        return concat(parts);

    case "BreakStatement":
        var parts = ["break"];
        if (n.label)
            parts.push(" ", print(path.get("label")));
        parts.push(";");
        return concat(parts);

    case "ContinueStatement":
        var parts = ["continue"];
        if (n.label)
            parts.push(" ", print(path.get("label")));
        parts.push(";");
        return concat(parts);

    case "LabeledStatement":
        return concat([
            print(path.get("label")),
            ":\n",
            print(path.get("body"))
        ]);

    case "TryStatement":
        var parts = [
            "try ",
            print(path.get("block"))
        ];

        path.get("handlers").each(function(handler) {
            parts.push(" ", print(handler));
        });

        if (n.finalizer)
            parts.push(" finally ", print(path.get("finalizer")));

        return concat(parts);

    case "CatchClause":
        var parts = ["catch (", print(path.get("param"))];

        if (n.guard)
            // Note: esprima does not recognize conditional catch clauses.
            parts.push(" if ", print(path.get("guard")));

        parts.push(") ", print(path.get("body")));

        return concat(parts);

    case "ThrowStatement":
        return concat([
            "throw ",
            print(path.get("argument")),
            ";"
        ]);

    case "SwitchStatement":
        return concat([
            "switch (",
            print(path.get("discriminant")),
            ") {\n",
            fromString("\n").join(path.get("cases").map(print)),
            "\n}"
        ]);

        // Note: ignoring n.lexical because it has no printing consequences.

    case "SwitchCase":
        var parts = [];

        if (n.test)
            parts.push("case ", print(path.get("test")), ":");
        else
            parts.push("default:");

        if (n.consequent.length > 0) {
            parts.push("\n", printStatementSequence(
                path.get("consequent"),
                options,
                print
            ).indent(options.tabWidth));
        }

        return concat(parts);

    case "DebuggerStatement":
        return fromString("debugger;");

    // XJS extensions below.

    case "XJSAttribute":
        var parts = [print(path.get("name"))];
        if (n.value)
            parts.push("=", print(path.get("value")));
        return concat(parts);

    case "XJSIdentifier":
        return fromString(n.name, options);

    case "XJSNamespacedName":
        return fromString(":").join([
            print(path.get("namespace")),
            print(path.get("name"))
        ]);

    case "XJSMemberExpression":
        return fromString(".").join([
            print(path.get("object")),
            print(path.get("property"))
        ]);

    case "XJSSpreadAttribute":
        return concat(["{...", print(path.get("argument")), "}"]);

    case "XJSExpressionContainer":
        return concat(["{", print(path.get("expression")), "}"]);

    case "XJSElement":
        var openingLines = print(path.get("openingElement"));

        if (n.openingElement.selfClosing) {
            assert.ok(!n.closingElement);
            return openingLines;
        }

        var childLines = concat(
            path.get("children").map(function(childPath) {
                var child = childPath.value;

                if (namedTypes.Literal.check(child) &&
                    typeof child.value === "string") {
                    if (/\S/.test(child.value)) {
                        return child.value.replace(/^\s+|\s+$/g, "");
                    } else if (/\n/.test(child.value)) {
                        return "\n";
                    }
                }

                return print(childPath);
            })
        ).indentTail(options.tabWidth);

        var closingLines = print(path.get("closingElement"));

        return concat([
            openingLines,
            childLines,
            closingLines
        ]);

    case "XJSOpeningElement":
        var parts = ["<", print(path.get("name"))];
        var attrParts = [];

        path.get("attributes").each(function(attrPath) {
            attrParts.push(" ", print(attrPath));
        });

        var attrLines = concat(attrParts);

        var needLineWrap = (
            attrLines.length > 1 ||
            attrLines.getLineLength(1) > options.wrapColumn
        );

        if (needLineWrap) {
            attrParts.forEach(function(part, i) {
                if (part === " ") {
                    assert.strictEqual(i % 2, 0);
                    attrParts[i] = "\n";
                }
            });

            attrLines = concat(attrParts).indentTail(options.tabWidth);
        }

        parts.push(attrLines, n.selfClosing ? " />" : ">");

        return concat(parts);

    case "XJSClosingElement":
        return concat(["</", print(path.get("name")), ">"]);

    case "XJSText":
        return fromString(n.value, options);

    case "XJSEmptyExpression":
        return fromString("");

    case "TypeAnnotatedIdentifier":
        var parts = [
            print(path.get("annotation")),
            " ",
            print(path.get("identifier"))
        ];

        return concat(parts);

    case "ClassBody":
        if (n.body.length === 0) {
            return fromString("{}");
        }

        return concat([
            "{\n",
            printStatementSequence(path.get("body"), options, print)
                .indent(options.tabWidth),
            "\n}"
        ]);

    case "ClassPropertyDefinition":
        var parts = ["static ", print(path.get("definition"))];
        if (!namedTypes.MethodDefinition.check(n.definition))
            parts.push(";");
        return concat(parts);

    case "ClassDeclaration":
    case "ClassExpression":
        var parts = ["class"];

        if (n.id)
            parts.push(" ", print(path.get("id")));

        if (n.superClass)
            parts.push(" extends ", print(path.get("superClass")));

        parts.push(" ", print(path.get("body")));

        return concat(parts);

    // Unhandled types below. If encountered, nodes of these types should
    // be either left alone or desugared into AST types that are fully
    // supported by the pretty-printer.

    case "ClassHeritage": // TODO
    case "ComprehensionBlock": // TODO
    case "ComprehensionExpression": // TODO
    case "Glob": // TODO
    case "TaggedTemplateExpression": // TODO
    case "TemplateElement": // TODO
    case "TemplateLiteral": // TODO
    case "GeneratorExpression": // TODO
    case "LetStatement": // TODO
    case "LetExpression": // TODO
    case "GraphExpression": // TODO
    case "GraphIndexExpression": // TODO
    case "TypeAnnotation": // TODO
    default:
        debugger;
        throw new Error("unknown type: " + JSON.stringify(n.type));
    }

    return p;
}

function printStatementSequence(path, options, print) {
    var inClassBody = path.parent &&
        namedTypes.ClassBody &&
        namedTypes.ClassBody.check(path.parent.node);

    var filtered = path.filter(function(stmtPath) {
        var stmt = stmtPath.value;

        // Just in case the AST has been modified to contain falsy
        // "statements," it's safer simply to skip them.
        if (!stmt)
            return false;

        // Skip printing EmptyStatement nodes to avoid leaving stray
        // semicolons lying around.
        if (stmt.type === "EmptyStatement")
            return false;

        if (!inClassBody) {
            namedTypes.Statement.assert(stmt);
        }

        return true;
    });

    var prevTrailingSpace = null;
    var len = filtered.length;
    var parts = [];

    filtered.forEach(function(stmtPath, i) {
        var printed = print(stmtPath);
        var stmt = stmtPath.value;
        var needSemicolon = true;
        var multiLine = printed.length > 1;
        var notFirst = i > 0;
        var notLast = i < len - 1;
        var leadingSpace;
        var trailingSpace;

        if (inClassBody) {
            var stmt = stmtPath.value;

            if (namedTypes.MethodDefinition.check(stmt) ||
                (namedTypes.ClassPropertyDefinition.check(stmt) &&
                 namedTypes.MethodDefinition.check(stmt.definition))) {
                needSemicolon = false;
            }
        }

        if (needSemicolon) {
            // Try to add a semicolon to anything that isn't a method in a
            // class body.
            printed = maybeAddSemicolon(printed);
        }

        var orig = options.reuseWhitespace && stmt.original;
        var trueLoc = orig && getTrueLoc(orig);
        var lines = trueLoc && trueLoc.lines;

        if (notFirst) {
            if (lines) {
                var beforeStart = lines.skipSpaces(trueLoc.start, true);
                var beforeStartLine = beforeStart ? beforeStart.line : 1;
                var leadingGap = trueLoc.start.line - beforeStartLine;
                leadingSpace = Array(leadingGap + 1).join("\n");
            } else {
                leadingSpace = multiLine ? "\n\n" : "\n";
            }
        } else {
            leadingSpace = "";
        }

        if (notLast) {
            if (lines) {
                var afterEnd = lines.skipSpaces(trueLoc.end);
                var afterEndLine = afterEnd ? afterEnd.line : lines.length;
                var trailingGap = afterEndLine - trueLoc.end.line;
                trailingSpace = Array(trailingGap + 1).join("\n");
            } else {
                trailingSpace = multiLine ? "\n\n" : "\n";
            }
        } else {
            trailingSpace = "";
        }

        parts.push(
            maxSpace(prevTrailingSpace, leadingSpace),
            printed
        );

        if (notLast) {
            prevTrailingSpace = trailingSpace;
        } else if (trailingSpace) {
            parts.push(trailingSpace);
        }
    });

    return concat(parts);
}

function getTrueLoc(node) {
    if (!node.comments) {
        // If the node has no comments, regard node.loc as true.
        return node.loc;
    }

    var start = node.loc.start;
    var end = node.loc.end;

    // If the node has any comments, their locations might contribute to
    // the true start/end positions of the node.
    node.comments.forEach(function(comment) {
        if (comment.loc) {
            if (util.comparePos(comment.loc.start, start) < 0) {
                start = comment.loc.start;
            }

            if (util.comparePos(end, comment.loc.end) < 0) {
                end = comment.loc.end;
            }
        }
    });

    return {
        lines: node.loc.lines,
        start: start,
        end: end
    };
}

function maxSpace(s1, s2) {
    if (!s1 && !s2) {
        return fromString("");
    }

    if (!s1) {
        return fromString(s2);
    }

    if (!s2) {
        return fromString(s1);
    }

    var spaceLines1 = fromString(s1);
    var spaceLines2 = fromString(s2);

    if (spaceLines2.length > spaceLines1.length) {
        return spaceLines2;
    }

    return spaceLines1;
}

function printMethod(kind, keyPath, valuePath, options, print) {
    var parts = [];
    var key = keyPath.value;
    var value = valuePath.value;

    namedTypes.FunctionExpression.assert(value);

    if (value.async) {
        parts.push("async ");
    }

    if (!kind || kind === "init") {
        if (value.generator) {
            parts.push("*");
        }
    } else {
        assert.ok(kind === "get" || kind === "set");
        parts.push(kind, " ");
    }

    parts.push(
        print(keyPath),
        "(",
        printFunctionParams(valuePath, options, print),
        ") ",
        print(valuePath.get("body"))
    );

    return concat(parts);
}

function printArgumentsList(path, options, print) {
    var printed = path.get("arguments").map(print);

    var joined = fromString(", ").join(printed);
    if (joined.getLineLength(1) > options.wrapColumn) {
        joined = fromString(",\n").join(printed);
        return concat(["(\n", joined.indent(options.tabWidth), "\n)"]);
    }

    return concat(["(", joined, ")"]);
}

function printFunctionParams(path, options, print) {
    var fun = path.node;
    namedTypes.Function.assert(fun);

    var params = path.get("params");
    var defaults = path.get("defaults");
    var printed = params.map(defaults.value ? function(param) {
        var p = print(param);
        var d = defaults.get(param.name);
        return d.value ? concat([p, "=", print(d)]) : p;
    } : print);

    if (fun.rest) {
        printed.push(concat(["...", print(path.get("rest"))]));
    }

    var joined = fromString(", ").join(printed);
    if (joined.length > 1 ||
        joined.getLineLength(1) > options.wrapColumn) {
        joined = fromString(",\n").join(printed);
        return concat(["\n", joined.indent(options.tabWidth)]);
    }

    return joined;
}

function adjustClause(clause, options) {
    if (clause.length > 1)
        return concat([" ", clause]);

    return concat([
        "\n",
        maybeAddSemicolon(clause).indent(options.tabWidth)
    ]);
}

function lastNonSpaceCharacter(lines) {
    var pos = lines.lastPos();
    do {
        var ch = lines.charAt(pos);
        if (/\S/.test(ch))
            return ch;
    } while (lines.prevPos(pos));
}

function endsWithBrace(lines) {
    return lastNonSpaceCharacter(lines) === "}";
}

function nodeStr(n) {
    namedTypes.Literal.assert(n);
    isString.assert(n.value);
    return JSON.stringify(n.value);
}

function maybeAddSemicolon(lines) {
    var eoc = lastNonSpaceCharacter(lines);
    if (!eoc || "\n};".indexOf(eoc) < 0)
        return concat([lines, ";"]);
    return lines;
}

},{"./comments":64,"./lines":65,"./options":67,"./patcher":69,"./types":71,"./util":72,"assert":49,"source-map":76}],71:[function(require,module,exports){
var types = require("ast-types");
var def = types.Type.def;

def("File")
    .bases("Node")
    .build("program")
    .field("program", def("Program"));

types.finalize();

module.exports = types;

},{"ast-types":37}],72:[function(require,module,exports){
var assert = require("assert");
var getFieldValue = require("./types").getFieldValue;
var sourceMap = require("source-map");
var SourceMapConsumer = sourceMap.SourceMapConsumer;
var SourceMapGenerator = sourceMap.SourceMapGenerator;
var hasOwn = Object.prototype.hasOwnProperty;

function getUnionOfKeys(obj) {
    for (var i = 0, key,
             result = {},
             objs = arguments,
             argc = objs.length;
         i < argc;
         i += 1)
    {
        obj = objs[i];
        for (key in obj)
            if (hasOwn.call(obj, key))
                result[key] = true;
    }
    return result;
}
exports.getUnionOfKeys = getUnionOfKeys;

exports.assertEquivalent = function(a, b) {
    if (!deepEquivalent(a, b)) {
        throw new Error(
            JSON.stringify(a) + " not equivalent to " +
            JSON.stringify(b)
        );
    }
};

function deepEquivalent(a, b) {
    if (a === b)
        return true;

    if (a instanceof Array)
        return deepArrEquiv(a, b);

    if (typeof a === "object")
        return deepObjEquiv(a, b);

    return false;
}
exports.deepEquivalent = deepEquivalent;

function deepArrEquiv(a, b) {
    assert.ok(a instanceof Array);
    var len = a.length;

    if (!(b instanceof Array &&
          b.length === len))
        return false;

    for (var i = 0; i < len; ++i) {
        if (i in a !== i in b)
            return false;

        if (!deepEquivalent(a[i], b[i]))
            return false;
    }

    return true;
}

function deepObjEquiv(a, b) {
    assert.strictEqual(typeof a, "object");
    if (!a || !b || typeof b !== "object")
        return false;

    for (var key in getUnionOfKeys(a, b)) {
        if (key === "loc" ||
            key === "range" ||
            key === "comments" ||
            key === "raw")
            continue;

        if (!deepEquivalent(getFieldValue(a, key),
                            getFieldValue(b, key)))
        {
            return false;
        }
    }

    return true;
}

function comparePos(pos1, pos2) {
    return (pos1.line - pos2.line) || (pos1.column - pos2.column);
}
exports.comparePos = comparePos;

exports.composeSourceMaps = function(formerMap, latterMap) {
    if (formerMap) {
        if (!latterMap) {
            return formerMap;
        }
    } else {
        return latterMap || null;
    }

    var smcFormer = new SourceMapConsumer(formerMap);
    var smcLatter = new SourceMapConsumer(latterMap);
    var smg = new SourceMapGenerator({
        file: latterMap.file,
        sourceRoot: latterMap.sourceRoot
    });

    var sourcesToContents = {};

    smcLatter.eachMapping(function(mapping) {
        var origPos = smcFormer.originalPositionFor({
            line: mapping.originalLine,
            column: mapping.originalColumn
        });

        var sourceName = origPos.source;

        smg.addMapping({
            source: sourceName,
            original: {
                line: origPos.line,
                column: origPos.column
            },
            generated: {
                line: mapping.generatedLine,
                column: mapping.generatedColumn
            },
            name: mapping.name
        });

        var sourceContent = smcFormer.sourceContentFor(sourceName);
        if (sourceContent && !hasOwn.call(sourcesToContents, sourceName)) {
            sourcesToContents[sourceName] = sourceContent;
            smg.setSourceContent(sourceName, sourceContent);
        }
    });

    return smg.toJSON();
};

},{"./types":71,"assert":49,"source-map":76}],73:[function(require,module,exports){
var assert = require("assert");
var Class = require("cls");
var Node = require("./types").namedTypes.Node;
var slice = Array.prototype.slice;
var removeRequests = [];

var Visitor = exports.Visitor = Class.extend({
    visit: function(node) {
        var self = this;

        if (!node) {
            // pass

        } else if (node instanceof Array) {
            node = self.visitArray(node);

        } else if (Node.check(node)) {
            var methodName = "visit" + node.type,
                method = self[methodName] || self.genericVisit;
            node = method.call(this, node);

        } else if (typeof node === "object") {
            // Some AST node types contain ad-hoc (non-AST) objects that
            // may contain nested AST nodes.
            self.genericVisit(node);
        }

        return node;
    },

    visitArray: function(arr, noUpdate) {
        for (var elem, result, undef,
                 i = 0, len = arr.length;
             i < len;
             i += 1)
        {
            if (i in arr)
                elem = arr[i];
            else
                continue;

            var requesters = [];
            removeRequests.push(requesters);

            // Make sure we don't accidentally reuse a previous result
            // when this.visit throws an exception.
            result = undef;

            try {
                result = this.visit(elem);

            } finally {
                assert.strictEqual(
                    removeRequests.pop(),
                    requesters);
            }

            if (requesters.length > 0 || (result === null && elem !== null)) {
                // This hole will be elided by the compaction loop below.
                delete arr[i];
            } else if (result !== undef) {
                arr[i] = result;
            }
        }

        // Compact the array to eliminate holes.
        for (var dst = 0,
                 src = dst,
                 // The length of the array might have changed during the
                 // iteration performed above.
                 len = arr.length;
             src < len;
             src += 1)
            if (src in arr)
                arr[dst++] = arr[src];
        arr.length = dst;

        return arr;
    },

    remove: function() {
        var len = removeRequests.length,
            requesters = removeRequests[len - 1];
        if (requesters)
            requesters.push(this);
    },

    genericVisit: function(node) {
        var field,
            oldValue,
            newValue;

        for (field in node) {
            if (!node.hasOwnProperty(field))
                continue;

            oldValue = node[field];

            if (oldValue instanceof Array) {
                this.visitArray(oldValue);

            } else if (Node.check(oldValue)) {
                newValue = this.visit(oldValue);

                if (typeof newValue === "undefined") {
                    // Keep oldValue.
                } else {
                    node[field] = newValue;
                }

            } else if (typeof oldValue === "object") {
                this.genericVisit(oldValue);
            }
        }

        return node;
    }
});

},{"./types":71,"assert":49,"cls":75}],74:[function(require,module,exports){
(function (process){
var types = require("./lib/types");
var parse = require("./lib/parser").parse;
var Printer = require("./lib/printer").Printer;

function print(node, options) {
    return new Printer(options).print(node);
}

function prettyPrint(node, options) {
    return new Printer(options).printGenerically(node);
}

function run(transformer, options) {
    return runFile(process.argv[2], transformer, options);
}

function runFile(path, transformer, options) {
    require("fs").readFile(path, "utf-8", function(err, code) {
        if (err) {
            console.error(err);
            return;
        }

        runString(code, transformer, options);
    });
}

function defaultWriteback(output) {
    process.stdout.write(output);
}

function runString(code, transformer, options) {
    var writeback = options && options.writeback || defaultWriteback;
    transformer(parse(code, options), function(node) {
        writeback(print(node, options).code);
    });
}

Object.defineProperties(exports, {
    /**
     * Parse a string of code into an augmented syntax tree suitable for
     * arbitrary modification and reprinting.
     */
    parse: {
        enumerable: true,
        value: parse
    },

    /**
     * Traverse and potentially modify an abstract syntax tree using a
     * convenient visitor syntax:
     *
     *   recast.visit(ast, {
     *     names: [],
     *     visitIdentifier: function(path) {
     *       var node = path.value;
     *       this.visitor.names.push(node.name);
     *       this.traverse(path);
     *     }
     *   });
     */
    visit: {
        enumerable: true,
        value: types.visit
    },

    /**
     * Reprint a modified syntax tree using as much of the original source
     * code as possible.
     */
    print: {
        enumerable: true,
        value: print
    },

    /**
     * Print without attempting to reuse any original source code.
     */
    prettyPrint: {
        enumerable: false,
        value: prettyPrint
    },

    /**
     * Customized version of require("ast-types").
     */
    types: {
        enumerable: false,
        value: types
    },

    /**
     * Convenient command-line interface (see e.g. example/add-braces).
     */
    run: {
        enumerable: false,
        value: run
    },

    /**
     * Useful utilities for implementing transformer functions.
     */
    Syntax: {
        enumerable: false,
        value: (function() {
            var def = types.Type.def;
            var Syntax = {};

            Object.keys(types.namedTypes).forEach(function(name) {
                if (def(name).buildable)
                    Syntax[name] = name;
            });

            // These two types are buildable but do not technically count
            // as syntax because they are not printable.
            delete Syntax.SourceLocation;
            delete Syntax.Position;

            return Syntax;
        })()
    },

    Visitor: {
        enumerable: false,
        value: require("./lib/visitor").Visitor
    }
});

}).call(this,require('_process'))
},{"./lib/parser":68,"./lib/printer":70,"./lib/types":71,"./lib/visitor":73,"_process":57,"fs":48}],75:[function(require,module,exports){
// Sentinel value passed to base constructors to skip invoking this.init.
var populating = {};

function makeClass(base, newProps) {
  var baseProto = base.prototype;
  var ownProto = Object.create(baseProto);
  var newStatics = newProps.statics;
  var populated;

  function constructor() {
    if (!populated) {
      if (base.extend === extend) {
        // Ensure population of baseProto if base created by makeClass.
        base.call(populating);
      }

      // Wrap override methods to make this._super available.
      populate(ownProto, newProps, baseProto);

      // Help the garbage collector reclaim this object, since we
      // don't need it anymore.
      newProps = null;

      populated = true;
    }

    // When we invoke a constructor just for the sake of making sure
    // its prototype has been populated, the receiver object (this)
    // will be strictly equal to the populating object, which means we
    // want to avoid invoking this.init.
    if (this === populating) {
      return;
    }

    // Evaluate this.init only once to avoid looking up .init in the
    // prototype chain twice.
    var init = this.init;
    if (init) {
      init.apply(this, arguments);
    }
  }

  // Copy any static properties that have been assigned to the base
  // class over to the subclass.
  populate(constructor, base);

  if (newStatics) {
    // Remove the statics property from newProps so that it does not
    // get copied to the prototype.
    delete newProps.statics;

    // We re-use populate for static properties, so static methods
    // have the same access to this._super that normal methods have.
    populate(constructor, newStatics, base);

    // Help the GC reclaim this object.
    newStatics = null;
  }

  // These property assignments overwrite any properties of the same
  // name that may have been copied from base, above. Note that ownProto
  // has not been populated with any methods or properties, yet, because
  // we postpone that work until the subclass is instantiated for the
  // first time. Also note that we share a single implementation of
  // extend between all classes.
  constructor.prototype = ownProto;
  constructor.extend = extend;
  constructor.base = baseProto;

  // Setting constructor.prototype.constructor = constructor is
  // important so that instanceof works properly in all browsers.
  ownProto.constructor = constructor;

  // Setting .cls as a shorthand for .constructor is purely a
  // convenience to make calling static methods easier.
  ownProto.cls = constructor;

  // If there is a static initializer, call it now. This needs to happen
  // last so that the constructor is ready to be used if, for example,
  // constructor.init needs to create an instance of the new class.
  if (constructor.init) {
    constructor.init(constructor);
  }

  return constructor;
}

function populate(target, source, parent) {
  for (var name in source) {
    if (source.hasOwnProperty(name)) {
      target[name] = parent ? maybeWrap(name, source, parent) : source[name];
    }
  }
}

var hasOwnExp = /\bhasOwnProperty\b/;
var superExp = hasOwnExp.test(populate) ? /\b_super\b/ : /.*/;

function maybeWrap(name, child, parent) {
  var cval = child && child[name];
  var pval = parent && parent[name];

  if (typeof cval === "function" &&
      typeof pval === "function" &&
      cval !== pval && // Avoid infinite recursion.
      cval.extend !== extend && // Don't wrap classes.
      superExp.test(cval)) // Only wrap if this._super needed.
  {
    return function() {
      var saved = this._super;
      this._super = parent[name];
      try { return cval.apply(this, arguments) }
      finally { this._super = saved };
    };
  }

  return cval;
}

function extend(newProps) {
  return makeClass(this, newProps || {});
}

module.exports = extend.call(function(){});

},{}],76:[function(require,module,exports){
/*
 * Copyright 2009-2011 Mozilla Foundation and contributors
 * Licensed under the New BSD license. See LICENSE.txt or:
 * http://opensource.org/licenses/BSD-3-Clause
 */
exports.SourceMapGenerator = require('./source-map/source-map-generator').SourceMapGenerator;
exports.SourceMapConsumer = require('./source-map/source-map-consumer').SourceMapConsumer;
exports.SourceNode = require('./source-map/source-node').SourceNode;

},{"./source-map/source-map-consumer":81,"./source-map/source-map-generator":82,"./source-map/source-node":83}],77:[function(require,module,exports){
/* -*- Mode: js; js-indent-level: 2; -*- */
/*
 * Copyright 2011 Mozilla Foundation and contributors
 * Licensed under the New BSD license. See LICENSE or:
 * http://opensource.org/licenses/BSD-3-Clause
 */
if (typeof define !== 'function') {
    var define = require('amdefine')(module, require);
}
define(function (require, exports, module) {

  var util = require('./util');

  /**
   * A data structure which is a combination of an array and a set. Adding a new
   * member is O(1), testing for membership is O(1), and finding the index of an
   * element is O(1). Removing elements from the set is not supported. Only
   * strings are supported for membership.
   */
  function ArraySet() {
    this._array = [];
    this._set = {};
  }

  /**
   * Static method for creating ArraySet instances from an existing array.
   */
  ArraySet.fromArray = function ArraySet_fromArray(aArray, aAllowDuplicates) {
    var set = new ArraySet();
    for (var i = 0, len = aArray.length; i < len; i++) {
      set.add(aArray[i], aAllowDuplicates);
    }
    return set;
  };

  /**
   * Add the given string to this set.
   *
   * @param String aStr
   */
  ArraySet.prototype.add = function ArraySet_add(aStr, aAllowDuplicates) {
    var isDuplicate = this.has(aStr);
    var idx = this._array.length;
    if (!isDuplicate || aAllowDuplicates) {
      this._array.push(aStr);
    }
    if (!isDuplicate) {
      this._set[util.toSetString(aStr)] = idx;
    }
  };

  /**
   * Is the given string a member of this set?
   *
   * @param String aStr
   */
  ArraySet.prototype.has = function ArraySet_has(aStr) {
    return Object.prototype.hasOwnProperty.call(this._set,
                                                util.toSetString(aStr));
  };

  /**
   * What is the index of the given string in the array?
   *
   * @param String aStr
   */
  ArraySet.prototype.indexOf = function ArraySet_indexOf(aStr) {
    if (this.has(aStr)) {
      return this._set[util.toSetString(aStr)];
    }
    throw new Error('"' + aStr + '" is not in the set.');
  };

  /**
   * What is the element at the given index?
   *
   * @param Number aIdx
   */
  ArraySet.prototype.at = function ArraySet_at(aIdx) {
    if (aIdx >= 0 && aIdx < this._array.length) {
      return this._array[aIdx];
    }
    throw new Error('No element indexed by ' + aIdx);
  };

  /**
   * Returns the array representation of this set (which has the proper indices
   * indicated by indexOf). Note that this is a copy of the internal array used
   * for storing the members so that no one can mess with internal state.
   */
  ArraySet.prototype.toArray = function ArraySet_toArray() {
    return this._array.slice();
  };

  exports.ArraySet = ArraySet;

});

},{"./util":84,"amdefine":22}],78:[function(require,module,exports){
/* -*- Mode: js; js-indent-level: 2; -*- */
/*
 * Copyright 2011 Mozilla Foundation and contributors
 * Licensed under the New BSD license. See LICENSE or:
 * http://opensource.org/licenses/BSD-3-Clause
 *
 * Based on the Base 64 VLQ implementation in Closure Compiler:
 * https://code.google.com/p/closure-compiler/source/browse/trunk/src/com/google/debugging/sourcemap/Base64VLQ.java
 *
 * Copyright 2011 The Closure Compiler Authors. All rights reserved.
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are
 * met:
 *
 *  * Redistributions of source code must retain the above copyright
 *    notice, this list of conditions and the following disclaimer.
 *  * Redistributions in binary form must reproduce the above
 *    copyright notice, this list of conditions and the following
 *    disclaimer in the documentation and/or other materials provided
 *    with the distribution.
 *  * Neither the name of Google Inc. nor the names of its
 *    contributors may be used to endorse or promote products derived
 *    from this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
 * "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
 * LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
 * A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
 * OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
 * SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
 * LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
 * DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
 * THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
 * OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */
if (typeof define !== 'function') {
    var define = require('amdefine')(module, require);
}
define(function (require, exports, module) {

  var base64 = require('./base64');

  // A single base 64 digit can contain 6 bits of data. For the base 64 variable
  // length quantities we use in the source map spec, the first bit is the sign,
  // the next four bits are the actual value, and the 6th bit is the
  // continuation bit. The continuation bit tells us whether there are more
  // digits in this value following this digit.
  //
  //   Continuation
  //   |    Sign
  //   |    |
  //   V    V
  //   101011

  var VLQ_BASE_SHIFT = 5;

  // binary: 100000
  var VLQ_BASE = 1 << VLQ_BASE_SHIFT;

  // binary: 011111
  var VLQ_BASE_MASK = VLQ_BASE - 1;

  // binary: 100000
  var VLQ_CONTINUATION_BIT = VLQ_BASE;

  /**
   * Converts from a two-complement value to a value where the sign bit is
   * is placed in the least significant bit.  For example, as decimals:
   *   1 becomes 2 (10 binary), -1 becomes 3 (11 binary)
   *   2 becomes 4 (100 binary), -2 becomes 5 (101 binary)
   */
  function toVLQSigned(aValue) {
    return aValue < 0
      ? ((-aValue) << 1) + 1
      : (aValue << 1) + 0;
  }

  /**
   * Converts to a two-complement value from a value where the sign bit is
   * is placed in the least significant bit.  For example, as decimals:
   *   2 (10 binary) becomes 1, 3 (11 binary) becomes -1
   *   4 (100 binary) becomes 2, 5 (101 binary) becomes -2
   */
  function fromVLQSigned(aValue) {
    var isNegative = (aValue & 1) === 1;
    var shifted = aValue >> 1;
    return isNegative
      ? -shifted
      : shifted;
  }

  /**
   * Returns the base 64 VLQ encoded value.
   */
  exports.encode = function base64VLQ_encode(aValue) {
    var encoded = "";
    var digit;

    var vlq = toVLQSigned(aValue);

    do {
      digit = vlq & VLQ_BASE_MASK;
      vlq >>>= VLQ_BASE_SHIFT;
      if (vlq > 0) {
        // There are still more digits in this value, so we must make sure the
        // continuation bit is marked.
        digit |= VLQ_CONTINUATION_BIT;
      }
      encoded += base64.encode(digit);
    } while (vlq > 0);

    return encoded;
  };

  /**
   * Decodes the next base 64 VLQ value from the given string and returns the
   * value and the rest of the string.
   */
  exports.decode = function base64VLQ_decode(aStr) {
    var i = 0;
    var strLen = aStr.length;
    var result = 0;
    var shift = 0;
    var continuation, digit;

    do {
      if (i >= strLen) {
        throw new Error("Expected more digits in base 64 VLQ value.");
      }
      digit = base64.decode(aStr.charAt(i++));
      continuation = !!(digit & VLQ_CONTINUATION_BIT);
      digit &= VLQ_BASE_MASK;
      result = result + (digit << shift);
      shift += VLQ_BASE_SHIFT;
    } while (continuation);

    return {
      value: fromVLQSigned(result),
      rest: aStr.slice(i)
    };
  };

});

},{"./base64":79,"amdefine":22}],79:[function(require,module,exports){
/* -*- Mode: js; js-indent-level: 2; -*- */
/*
 * Copyright 2011 Mozilla Foundation and contributors
 * Licensed under the New BSD license. See LICENSE or:
 * http://opensource.org/licenses/BSD-3-Clause
 */
if (typeof define !== 'function') {
    var define = require('amdefine')(module, require);
}
define(function (require, exports, module) {

  var charToIntMap = {};
  var intToCharMap = {};

  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
    .split('')
    .forEach(function (ch, index) {
      charToIntMap[ch] = index;
      intToCharMap[index] = ch;
    });

  /**
   * Encode an integer in the range of 0 to 63 to a single base 64 digit.
   */
  exports.encode = function base64_encode(aNumber) {
    if (aNumber in intToCharMap) {
      return intToCharMap[aNumber];
    }
    throw new TypeError("Must be between 0 and 63: " + aNumber);
  };

  /**
   * Decode a single base 64 digit to an integer.
   */
  exports.decode = function base64_decode(aChar) {
    if (aChar in charToIntMap) {
      return charToIntMap[aChar];
    }
    throw new TypeError("Not a valid base 64 digit: " + aChar);
  };

});

},{"amdefine":22}],80:[function(require,module,exports){
/* -*- Mode: js; js-indent-level: 2; -*- */
/*
 * Copyright 2011 Mozilla Foundation and contributors
 * Licensed under the New BSD license. See LICENSE or:
 * http://opensource.org/licenses/BSD-3-Clause
 */
if (typeof define !== 'function') {
    var define = require('amdefine')(module, require);
}
define(function (require, exports, module) {

  /**
   * Recursive implementation of binary search.
   *
   * @param aLow Indices here and lower do not contain the needle.
   * @param aHigh Indices here and higher do not contain the needle.
   * @param aNeedle The element being searched for.
   * @param aHaystack The non-empty array being searched.
   * @param aCompare Function which takes two elements and returns -1, 0, or 1.
   */
  function recursiveSearch(aLow, aHigh, aNeedle, aHaystack, aCompare) {
    // This function terminates when one of the following is true:
    //
    //   1. We find the exact element we are looking for.
    //
    //   2. We did not find the exact element, but we can return the next
    //      closest element that is less than that element.
    //
    //   3. We did not find the exact element, and there is no next-closest
    //      element which is less than the one we are searching for, so we
    //      return null.
    var mid = Math.floor((aHigh - aLow) / 2) + aLow;
    var cmp = aCompare(aNeedle, aHaystack[mid], true);
    if (cmp === 0) {
      // Found the element we are looking for.
      return aHaystack[mid];
    }
    else if (cmp > 0) {
      // aHaystack[mid] is greater than our needle.
      if (aHigh - mid > 1) {
        // The element is in the upper half.
        return recursiveSearch(mid, aHigh, aNeedle, aHaystack, aCompare);
      }
      // We did not find an exact match, return the next closest one
      // (termination case 2).
      return aHaystack[mid];
    }
    else {
      // aHaystack[mid] is less than our needle.
      if (mid - aLow > 1) {
        // The element is in the lower half.
        return recursiveSearch(aLow, mid, aNeedle, aHaystack, aCompare);
      }
      // The exact needle element was not found in this haystack. Determine if
      // we are in termination case (2) or (3) and return the appropriate thing.
      return aLow < 0
        ? null
        : aHaystack[aLow];
    }
  }

  /**
   * This is an implementation of binary search which will always try and return
   * the next lowest value checked if there is no exact hit. This is because
   * mappings between original and generated line/col pairs are single points,
   * and there is an implicit region between each of them, so a miss just means
   * that you aren't on the very start of a region.
   *
   * @param aNeedle The element you are looking for.
   * @param aHaystack The array that is being searched.
   * @param aCompare A function which takes the needle and an element in the
   *     array and returns -1, 0, or 1 depending on whether the needle is less
   *     than, equal to, or greater than the element, respectively.
   */
  exports.search = function search(aNeedle, aHaystack, aCompare) {
    return aHaystack.length > 0
      ? recursiveSearch(-1, aHaystack.length, aNeedle, aHaystack, aCompare)
      : null;
  };

});

},{"amdefine":22}],81:[function(require,module,exports){
/* -*- Mode: js; js-indent-level: 2; -*- */
/*
 * Copyright 2011 Mozilla Foundation and contributors
 * Licensed under the New BSD license. See LICENSE or:
 * http://opensource.org/licenses/BSD-3-Clause
 */
if (typeof define !== 'function') {
    var define = require('amdefine')(module, require);
}
define(function (require, exports, module) {

  var util = require('./util');
  var binarySearch = require('./binary-search');
  var ArraySet = require('./array-set').ArraySet;
  var base64VLQ = require('./base64-vlq');

  /**
   * A SourceMapConsumer instance represents a parsed source map which we can
   * query for information about the original file positions by giving it a file
   * position in the generated source.
   *
   * The only parameter is the raw source map (either as a JSON string, or
   * already parsed to an object). According to the spec, source maps have the
   * following attributes:
   *
   *   - version: Which version of the source map spec this map is following.
   *   - sources: An array of URLs to the original source files.
   *   - names: An array of identifiers which can be referrenced by individual mappings.
   *   - sourceRoot: Optional. The URL root from which all sources are relative.
   *   - sourcesContent: Optional. An array of contents of the original source files.
   *   - mappings: A string of base64 VLQs which contain the actual mappings.
   *   - file: The generated file this source map is associated with.
   *
   * Here is an example source map, taken from the source map spec[0]:
   *
   *     {
   *       version : 3,
   *       file: "out.js",
   *       sourceRoot : "",
   *       sources: ["foo.js", "bar.js"],
   *       names: ["src", "maps", "are", "fun"],
   *       mappings: "AA,AB;;ABCDE;"
   *     }
   *
   * [0]: https://docs.google.com/document/d/1U1RGAehQwRypUTovF1KRlpiOFze0b-_2gc6fAH0KY0k/edit?pli=1#
   */
  function SourceMapConsumer(aSourceMap) {
    var sourceMap = aSourceMap;
    if (typeof aSourceMap === 'string') {
      sourceMap = JSON.parse(aSourceMap.replace(/^\)\]\}'/, ''));
    }

    var version = util.getArg(sourceMap, 'version');
    var sources = util.getArg(sourceMap, 'sources');
    // Sass 3.3 leaves out the 'names' array, so we deviate from the spec (which
    // requires the array) to play nice here.
    var names = util.getArg(sourceMap, 'names', []);
    var sourceRoot = util.getArg(sourceMap, 'sourceRoot', null);
    var sourcesContent = util.getArg(sourceMap, 'sourcesContent', null);
    var mappings = util.getArg(sourceMap, 'mappings');
    var file = util.getArg(sourceMap, 'file', null);

    // Once again, Sass deviates from the spec and supplies the version as a
    // string rather than a number, so we use loose equality checking here.
    if (version != this._version) {
      throw new Error('Unsupported version: ' + version);
    }

    // Pass `true` below to allow duplicate names and sources. While source maps
    // are intended to be compressed and deduplicated, the TypeScript compiler
    // sometimes generates source maps with duplicates in them. See Github issue
    // #72 and bugzil.la/889492.
    this._names = ArraySet.fromArray(names, true);
    this._sources = ArraySet.fromArray(sources, true);

    this.sourceRoot = sourceRoot;
    this.sourcesContent = sourcesContent;
    this._mappings = mappings;
    this.file = file;
  }

  /**
   * Create a SourceMapConsumer from a SourceMapGenerator.
   *
   * @param SourceMapGenerator aSourceMap
   *        The source map that will be consumed.
   * @returns SourceMapConsumer
   */
  SourceMapConsumer.fromSourceMap =
    function SourceMapConsumer_fromSourceMap(aSourceMap) {
      var smc = Object.create(SourceMapConsumer.prototype);

      smc._names = ArraySet.fromArray(aSourceMap._names.toArray(), true);
      smc._sources = ArraySet.fromArray(aSourceMap._sources.toArray(), true);
      smc.sourceRoot = aSourceMap._sourceRoot;
      smc.sourcesContent = aSourceMap._generateSourcesContent(smc._sources.toArray(),
                                                              smc.sourceRoot);
      smc.file = aSourceMap._file;

      smc.__generatedMappings = aSourceMap._mappings.slice()
        .sort(util.compareByGeneratedPositions);
      smc.__originalMappings = aSourceMap._mappings.slice()
        .sort(util.compareByOriginalPositions);

      return smc;
    };

  /**
   * The version of the source mapping spec that we are consuming.
   */
  SourceMapConsumer.prototype._version = 3;

  /**
   * The list of original sources.
   */
  Object.defineProperty(SourceMapConsumer.prototype, 'sources', {
    get: function () {
      return this._sources.toArray().map(function (s) {
        return this.sourceRoot ? util.join(this.sourceRoot, s) : s;
      }, this);
    }
  });

  // `__generatedMappings` and `__originalMappings` are arrays that hold the
  // parsed mapping coordinates from the source map's "mappings" attribute. They
  // are lazily instantiated, accessed via the `_generatedMappings` and
  // `_originalMappings` getters respectively, and we only parse the mappings
  // and create these arrays once queried for a source location. We jump through
  // these hoops because there can be many thousands of mappings, and parsing
  // them is expensive, so we only want to do it if we must.
  //
  // Each object in the arrays is of the form:
  //
  //     {
  //       generatedLine: The line number in the generated code,
  //       generatedColumn: The column number in the generated code,
  //       source: The path to the original source file that generated this
  //               chunk of code,
  //       originalLine: The line number in the original source that
  //                     corresponds to this chunk of generated code,
  //       originalColumn: The column number in the original source that
  //                       corresponds to this chunk of generated code,
  //       name: The name of the original symbol which generated this chunk of
  //             code.
  //     }
  //
  // All properties except for `generatedLine` and `generatedColumn` can be
  // `null`.
  //
  // `_generatedMappings` is ordered by the generated positions.
  //
  // `_originalMappings` is ordered by the original positions.

  SourceMapConsumer.prototype.__generatedMappings = null;
  Object.defineProperty(SourceMapConsumer.prototype, '_generatedMappings', {
    get: function () {
      if (!this.__generatedMappings) {
        this.__generatedMappings = [];
        this.__originalMappings = [];
        this._parseMappings(this._mappings, this.sourceRoot);
      }

      return this.__generatedMappings;
    }
  });

  SourceMapConsumer.prototype.__originalMappings = null;
  Object.defineProperty(SourceMapConsumer.prototype, '_originalMappings', {
    get: function () {
      if (!this.__originalMappings) {
        this.__generatedMappings = [];
        this.__originalMappings = [];
        this._parseMappings(this._mappings, this.sourceRoot);
      }

      return this.__originalMappings;
    }
  });

  /**
   * Parse the mappings in a string in to a data structure which we can easily
   * query (the ordered arrays in the `this.__generatedMappings` and
   * `this.__originalMappings` properties).
   */
  SourceMapConsumer.prototype._parseMappings =
    function SourceMapConsumer_parseMappings(aStr, aSourceRoot) {
      var generatedLine = 1;
      var previousGeneratedColumn = 0;
      var previousOriginalLine = 0;
      var previousOriginalColumn = 0;
      var previousSource = 0;
      var previousName = 0;
      var mappingSeparator = /^[,;]/;
      var str = aStr;
      var mapping;
      var temp;

      while (str.length > 0) {
        if (str.charAt(0) === ';') {
          generatedLine++;
          str = str.slice(1);
          previousGeneratedColumn = 0;
        }
        else if (str.charAt(0) === ',') {
          str = str.slice(1);
        }
        else {
          mapping = {};
          mapping.generatedLine = generatedLine;

          // Generated column.
          temp = base64VLQ.decode(str);
          mapping.generatedColumn = previousGeneratedColumn + temp.value;
          previousGeneratedColumn = mapping.generatedColumn;
          str = temp.rest;

          if (str.length > 0 && !mappingSeparator.test(str.charAt(0))) {
            // Original source.
            temp = base64VLQ.decode(str);
            mapping.source = this._sources.at(previousSource + temp.value);
            previousSource += temp.value;
            str = temp.rest;
            if (str.length === 0 || mappingSeparator.test(str.charAt(0))) {
              throw new Error('Found a source, but no line and column');
            }

            // Original line.
            temp = base64VLQ.decode(str);
            mapping.originalLine = previousOriginalLine + temp.value;
            previousOriginalLine = mapping.originalLine;
            // Lines are stored 0-based
            mapping.originalLine += 1;
            str = temp.rest;
            if (str.length === 0 || mappingSeparator.test(str.charAt(0))) {
              throw new Error('Found a source and line, but no column');
            }

            // Original column.
            temp = base64VLQ.decode(str);
            mapping.originalColumn = previousOriginalColumn + temp.value;
            previousOriginalColumn = mapping.originalColumn;
            str = temp.rest;

            if (str.length > 0 && !mappingSeparator.test(str.charAt(0))) {
              // Original name.
              temp = base64VLQ.decode(str);
              mapping.name = this._names.at(previousName + temp.value);
              previousName += temp.value;
              str = temp.rest;
            }
          }

          this.__generatedMappings.push(mapping);
          if (typeof mapping.originalLine === 'number') {
            this.__originalMappings.push(mapping);
          }
        }
      }

      this.__generatedMappings.sort(util.compareByGeneratedPositions);
      this.__originalMappings.sort(util.compareByOriginalPositions);
    };

  /**
   * Find the mapping that best matches the hypothetical "needle" mapping that
   * we are searching for in the given "haystack" of mappings.
   */
  SourceMapConsumer.prototype._findMapping =
    function SourceMapConsumer_findMapping(aNeedle, aMappings, aLineName,
                                           aColumnName, aComparator) {
      // To return the position we are searching for, we must first find the
      // mapping for the given position and then return the opposite position it
      // points to. Because the mappings are sorted, we can use binary search to
      // find the best mapping.

      if (aNeedle[aLineName] <= 0) {
        throw new TypeError('Line must be greater than or equal to 1, got '
                            + aNeedle[aLineName]);
      }
      if (aNeedle[aColumnName] < 0) {
        throw new TypeError('Column must be greater than or equal to 0, got '
                            + aNeedle[aColumnName]);
      }

      return binarySearch.search(aNeedle, aMappings, aComparator);
    };

  /**
   * Returns the original source, line, and column information for the generated
   * source's line and column positions provided. The only argument is an object
   * with the following properties:
   *
   *   - line: The line number in the generated source.
   *   - column: The column number in the generated source.
   *
   * and an object is returned with the following properties:
   *
   *   - source: The original source file, or null.
   *   - line: The line number in the original source, or null.
   *   - column: The column number in the original source, or null.
   *   - name: The original identifier, or null.
   */
  SourceMapConsumer.prototype.originalPositionFor =
    function SourceMapConsumer_originalPositionFor(aArgs) {
      var needle = {
        generatedLine: util.getArg(aArgs, 'line'),
        generatedColumn: util.getArg(aArgs, 'column')
      };

      var mapping = this._findMapping(needle,
                                      this._generatedMappings,
                                      "generatedLine",
                                      "generatedColumn",
                                      util.compareByGeneratedPositions);

      if (mapping) {
        var source = util.getArg(mapping, 'source', null);
        if (source && this.sourceRoot) {
          source = util.join(this.sourceRoot, source);
        }
        return {
          source: source,
          line: util.getArg(mapping, 'originalLine', null),
          column: util.getArg(mapping, 'originalColumn', null),
          name: util.getArg(mapping, 'name', null)
        };
      }

      return {
        source: null,
        line: null,
        column: null,
        name: null
      };
    };

  /**
   * Returns the original source content. The only argument is the url of the
   * original source file. Returns null if no original source content is
   * availible.
   */
  SourceMapConsumer.prototype.sourceContentFor =
    function SourceMapConsumer_sourceContentFor(aSource) {
      if (!this.sourcesContent) {
        return null;
      }

      if (this.sourceRoot) {
        aSource = util.relative(this.sourceRoot, aSource);
      }

      if (this._sources.has(aSource)) {
        return this.sourcesContent[this._sources.indexOf(aSource)];
      }

      var url;
      if (this.sourceRoot
          && (url = util.urlParse(this.sourceRoot))) {
        // XXX: file:// URIs and absolute paths lead to unexpected behavior for
        // many users. We can help them out when they expect file:// URIs to
        // behave like it would if they were running a local HTTP server. See
        // https://bugzilla.mozilla.org/show_bug.cgi?id=885597.
        var fileUriAbsPath = aSource.replace(/^file:\/\//, "");
        if (url.scheme == "file"
            && this._sources.has(fileUriAbsPath)) {
          return this.sourcesContent[this._sources.indexOf(fileUriAbsPath)]
        }

        if ((!url.path || url.path == "/")
            && this._sources.has("/" + aSource)) {
          return this.sourcesContent[this._sources.indexOf("/" + aSource)];
        }
      }

      throw new Error('"' + aSource + '" is not in the SourceMap.');
    };

  /**
   * Returns the generated line and column information for the original source,
   * line, and column positions provided. The only argument is an object with
   * the following properties:
   *
   *   - source: The filename of the original source.
   *   - line: The line number in the original source.
   *   - column: The column number in the original source.
   *
   * and an object is returned with the following properties:
   *
   *   - line: The line number in the generated source, or null.
   *   - column: The column number in the generated source, or null.
   */
  SourceMapConsumer.prototype.generatedPositionFor =
    function SourceMapConsumer_generatedPositionFor(aArgs) {
      var needle = {
        source: util.getArg(aArgs, 'source'),
        originalLine: util.getArg(aArgs, 'line'),
        originalColumn: util.getArg(aArgs, 'column')
      };

      if (this.sourceRoot) {
        needle.source = util.relative(this.sourceRoot, needle.source);
      }

      var mapping = this._findMapping(needle,
                                      this._originalMappings,
                                      "originalLine",
                                      "originalColumn",
                                      util.compareByOriginalPositions);

      if (mapping) {
        return {
          line: util.getArg(mapping, 'generatedLine', null),
          column: util.getArg(mapping, 'generatedColumn', null)
        };
      }

      return {
        line: null,
        column: null
      };
    };

  SourceMapConsumer.GENERATED_ORDER = 1;
  SourceMapConsumer.ORIGINAL_ORDER = 2;

  /**
   * Iterate over each mapping between an original source/line/column and a
   * generated line/column in this source map.
   *
   * @param Function aCallback
   *        The function that is called with each mapping.
   * @param Object aContext
   *        Optional. If specified, this object will be the value of `this` every
   *        time that `aCallback` is called.
   * @param aOrder
   *        Either `SourceMapConsumer.GENERATED_ORDER` or
   *        `SourceMapConsumer.ORIGINAL_ORDER`. Specifies whether you want to
   *        iterate over the mappings sorted by the generated file's line/column
   *        order or the original's source/line/column order, respectively. Defaults to
   *        `SourceMapConsumer.GENERATED_ORDER`.
   */
  SourceMapConsumer.prototype.eachMapping =
    function SourceMapConsumer_eachMapping(aCallback, aContext, aOrder) {
      var context = aContext || null;
      var order = aOrder || SourceMapConsumer.GENERATED_ORDER;

      var mappings;
      switch (order) {
      case SourceMapConsumer.GENERATED_ORDER:
        mappings = this._generatedMappings;
        break;
      case SourceMapConsumer.ORIGINAL_ORDER:
        mappings = this._originalMappings;
        break;
      default:
        throw new Error("Unknown order of iteration.");
      }

      var sourceRoot = this.sourceRoot;
      mappings.map(function (mapping) {
        var source = mapping.source;
        if (source && sourceRoot) {
          source = util.join(sourceRoot, source);
        }
        return {
          source: source,
          generatedLine: mapping.generatedLine,
          generatedColumn: mapping.generatedColumn,
          originalLine: mapping.originalLine,
          originalColumn: mapping.originalColumn,
          name: mapping.name
        };
      }).forEach(aCallback, context);
    };

  exports.SourceMapConsumer = SourceMapConsumer;

});

},{"./array-set":77,"./base64-vlq":78,"./binary-search":80,"./util":84,"amdefine":22}],82:[function(require,module,exports){
/* -*- Mode: js; js-indent-level: 2; -*- */
/*
 * Copyright 2011 Mozilla Foundation and contributors
 * Licensed under the New BSD license. See LICENSE or:
 * http://opensource.org/licenses/BSD-3-Clause
 */
if (typeof define !== 'function') {
    var define = require('amdefine')(module, require);
}
define(function (require, exports, module) {

  var base64VLQ = require('./base64-vlq');
  var util = require('./util');
  var ArraySet = require('./array-set').ArraySet;

  /**
   * An instance of the SourceMapGenerator represents a source map which is
   * being built incrementally. To create a new one, you must pass an object
   * with the following properties:
   *
   *   - file: The filename of the generated source.
   *   - sourceRoot: An optional root for all URLs in this source map.
   */
  function SourceMapGenerator(aArgs) {
    this._file = util.getArg(aArgs, 'file');
    this._sourceRoot = util.getArg(aArgs, 'sourceRoot', null);
    this._sources = new ArraySet();
    this._names = new ArraySet();
    this._mappings = [];
    this._sourcesContents = null;
  }

  SourceMapGenerator.prototype._version = 3;

  /**
   * Creates a new SourceMapGenerator based on a SourceMapConsumer
   *
   * @param aSourceMapConsumer The SourceMap.
   */
  SourceMapGenerator.fromSourceMap =
    function SourceMapGenerator_fromSourceMap(aSourceMapConsumer) {
      var sourceRoot = aSourceMapConsumer.sourceRoot;
      var generator = new SourceMapGenerator({
        file: aSourceMapConsumer.file,
        sourceRoot: sourceRoot
      });
      aSourceMapConsumer.eachMapping(function (mapping) {
        var newMapping = {
          generated: {
            line: mapping.generatedLine,
            column: mapping.generatedColumn
          }
        };

        if (mapping.source) {
          newMapping.source = mapping.source;
          if (sourceRoot) {
            newMapping.source = util.relative(sourceRoot, newMapping.source);
          }

          newMapping.original = {
            line: mapping.originalLine,
            column: mapping.originalColumn
          };

          if (mapping.name) {
            newMapping.name = mapping.name;
          }
        }

        generator.addMapping(newMapping);
      });
      aSourceMapConsumer.sources.forEach(function (sourceFile) {
        var content = aSourceMapConsumer.sourceContentFor(sourceFile);
        if (content) {
          generator.setSourceContent(sourceFile, content);
        }
      });
      return generator;
    };

  /**
   * Add a single mapping from original source line and column to the generated
   * source's line and column for this source map being created. The mapping
   * object should have the following properties:
   *
   *   - generated: An object with the generated line and column positions.
   *   - original: An object with the original line and column positions.
   *   - source: The original source file (relative to the sourceRoot).
   *   - name: An optional original token name for this mapping.
   */
  SourceMapGenerator.prototype.addMapping =
    function SourceMapGenerator_addMapping(aArgs) {
      var generated = util.getArg(aArgs, 'generated');
      var original = util.getArg(aArgs, 'original', null);
      var source = util.getArg(aArgs, 'source', null);
      var name = util.getArg(aArgs, 'name', null);

      this._validateMapping(generated, original, source, name);

      if (source && !this._sources.has(source)) {
        this._sources.add(source);
      }

      if (name && !this._names.has(name)) {
        this._names.add(name);
      }

      this._mappings.push({
        generatedLine: generated.line,
        generatedColumn: generated.column,
        originalLine: original != null && original.line,
        originalColumn: original != null && original.column,
        source: source,
        name: name
      });
    };

  /**
   * Set the source content for a source file.
   */
  SourceMapGenerator.prototype.setSourceContent =
    function SourceMapGenerator_setSourceContent(aSourceFile, aSourceContent) {
      var source = aSourceFile;
      if (this._sourceRoot) {
        source = util.relative(this._sourceRoot, source);
      }

      if (aSourceContent !== null) {
        // Add the source content to the _sourcesContents map.
        // Create a new _sourcesContents map if the property is null.
        if (!this._sourcesContents) {
          this._sourcesContents = {};
        }
        this._sourcesContents[util.toSetString(source)] = aSourceContent;
      } else {
        // Remove the source file from the _sourcesContents map.
        // If the _sourcesContents map is empty, set the property to null.
        delete this._sourcesContents[util.toSetString(source)];
        if (Object.keys(this._sourcesContents).length === 0) {
          this._sourcesContents = null;
        }
      }
    };

  /**
   * Applies the mappings of a sub-source-map for a specific source file to the
   * source map being generated. Each mapping to the supplied source file is
   * rewritten using the supplied source map. Note: The resolution for the
   * resulting mappings is the minimium of this map and the supplied map.
   *
   * @param aSourceMapConsumer The source map to be applied.
   * @param aSourceFile Optional. The filename of the source file.
   *        If omitted, SourceMapConsumer's file property will be used.
   */
  SourceMapGenerator.prototype.applySourceMap =
    function SourceMapGenerator_applySourceMap(aSourceMapConsumer, aSourceFile) {
      // If aSourceFile is omitted, we will use the file property of the SourceMap
      if (!aSourceFile) {
        aSourceFile = aSourceMapConsumer.file;
      }
      var sourceRoot = this._sourceRoot;
      // Make "aSourceFile" relative if an absolute Url is passed.
      if (sourceRoot) {
        aSourceFile = util.relative(sourceRoot, aSourceFile);
      }
      // Applying the SourceMap can add and remove items from the sources and
      // the names array.
      var newSources = new ArraySet();
      var newNames = new ArraySet();

      // Find mappings for the "aSourceFile"
      this._mappings.forEach(function (mapping) {
        if (mapping.source === aSourceFile && mapping.originalLine) {
          // Check if it can be mapped by the source map, then update the mapping.
          var original = aSourceMapConsumer.originalPositionFor({
            line: mapping.originalLine,
            column: mapping.originalColumn
          });
          if (original.source !== null) {
            // Copy mapping
            if (sourceRoot) {
              mapping.source = util.relative(sourceRoot, original.source);
            } else {
              mapping.source = original.source;
            }
            mapping.originalLine = original.line;
            mapping.originalColumn = original.column;
            if (original.name !== null && mapping.name !== null) {
              // Only use the identifier name if it's an identifier
              // in both SourceMaps
              mapping.name = original.name;
            }
          }
        }

        var source = mapping.source;
        if (source && !newSources.has(source)) {
          newSources.add(source);
        }

        var name = mapping.name;
        if (name && !newNames.has(name)) {
          newNames.add(name);
        }

      }, this);
      this._sources = newSources;
      this._names = newNames;

      // Copy sourcesContents of applied map.
      aSourceMapConsumer.sources.forEach(function (sourceFile) {
        var content = aSourceMapConsumer.sourceContentFor(sourceFile);
        if (content) {
          if (sourceRoot) {
            sourceFile = util.relative(sourceRoot, sourceFile);
          }
          this.setSourceContent(sourceFile, content);
        }
      }, this);
    };

  /**
   * A mapping can have one of the three levels of data:
   *
   *   1. Just the generated position.
   *   2. The Generated position, original position, and original source.
   *   3. Generated and original position, original source, as well as a name
   *      token.
   *
   * To maintain consistency, we validate that any new mapping being added falls
   * in to one of these categories.
   */
  SourceMapGenerator.prototype._validateMapping =
    function SourceMapGenerator_validateMapping(aGenerated, aOriginal, aSource,
                                                aName) {
      if (aGenerated && 'line' in aGenerated && 'column' in aGenerated
          && aGenerated.line > 0 && aGenerated.column >= 0
          && !aOriginal && !aSource && !aName) {
        // Case 1.
        return;
      }
      else if (aGenerated && 'line' in aGenerated && 'column' in aGenerated
               && aOriginal && 'line' in aOriginal && 'column' in aOriginal
               && aGenerated.line > 0 && aGenerated.column >= 0
               && aOriginal.line > 0 && aOriginal.column >= 0
               && aSource) {
        // Cases 2 and 3.
        return;
      }
      else {
        throw new Error('Invalid mapping: ' + JSON.stringify({
          generated: aGenerated,
          source: aSource,
          original: aOriginal,
          name: aName
        }));
      }
    };

  /**
   * Serialize the accumulated mappings in to the stream of base 64 VLQs
   * specified by the source map format.
   */
  SourceMapGenerator.prototype._serializeMappings =
    function SourceMapGenerator_serializeMappings() {
      var previousGeneratedColumn = 0;
      var previousGeneratedLine = 1;
      var previousOriginalColumn = 0;
      var previousOriginalLine = 0;
      var previousName = 0;
      var previousSource = 0;
      var result = '';
      var mapping;

      // The mappings must be guaranteed to be in sorted order before we start
      // serializing them or else the generated line numbers (which are defined
      // via the ';' separators) will be all messed up. Note: it might be more
      // performant to maintain the sorting as we insert them, rather than as we
      // serialize them, but the big O is the same either way.
      this._mappings.sort(util.compareByGeneratedPositions);

      for (var i = 0, len = this._mappings.length; i < len; i++) {
        mapping = this._mappings[i];

        if (mapping.generatedLine !== previousGeneratedLine) {
          previousGeneratedColumn = 0;
          while (mapping.generatedLine !== previousGeneratedLine) {
            result += ';';
            previousGeneratedLine++;
          }
        }
        else {
          if (i > 0) {
            if (!util.compareByGeneratedPositions(mapping, this._mappings[i - 1])) {
              continue;
            }
            result += ',';
          }
        }

        result += base64VLQ.encode(mapping.generatedColumn
                                   - previousGeneratedColumn);
        previousGeneratedColumn = mapping.generatedColumn;

        if (mapping.source) {
          result += base64VLQ.encode(this._sources.indexOf(mapping.source)
                                     - previousSource);
          previousSource = this._sources.indexOf(mapping.source);

          // lines are stored 0-based in SourceMap spec version 3
          result += base64VLQ.encode(mapping.originalLine - 1
                                     - previousOriginalLine);
          previousOriginalLine = mapping.originalLine - 1;

          result += base64VLQ.encode(mapping.originalColumn
                                     - previousOriginalColumn);
          previousOriginalColumn = mapping.originalColumn;

          if (mapping.name) {
            result += base64VLQ.encode(this._names.indexOf(mapping.name)
                                       - previousName);
            previousName = this._names.indexOf(mapping.name);
          }
        }
      }

      return result;
    };

  SourceMapGenerator.prototype._generateSourcesContent =
    function SourceMapGenerator_generateSourcesContent(aSources, aSourceRoot) {
      return aSources.map(function (source) {
        if (!this._sourcesContents) {
          return null;
        }
        if (aSourceRoot) {
          source = util.relative(aSourceRoot, source);
        }
        var key = util.toSetString(source);
        return Object.prototype.hasOwnProperty.call(this._sourcesContents,
                                                    key)
          ? this._sourcesContents[key]
          : null;
      }, this);
    };

  /**
   * Externalize the source map.
   */
  SourceMapGenerator.prototype.toJSON =
    function SourceMapGenerator_toJSON() {
      var map = {
        version: this._version,
        file: this._file,
        sources: this._sources.toArray(),
        names: this._names.toArray(),
        mappings: this._serializeMappings()
      };
      if (this._sourceRoot) {
        map.sourceRoot = this._sourceRoot;
      }
      if (this._sourcesContents) {
        map.sourcesContent = this._generateSourcesContent(map.sources, map.sourceRoot);
      }

      return map;
    };

  /**
   * Render the source map being generated to a string.
   */
  SourceMapGenerator.prototype.toString =
    function SourceMapGenerator_toString() {
      return JSON.stringify(this);
    };

  exports.SourceMapGenerator = SourceMapGenerator;

});

},{"./array-set":77,"./base64-vlq":78,"./util":84,"amdefine":22}],83:[function(require,module,exports){
/* -*- Mode: js; js-indent-level: 2; -*- */
/*
 * Copyright 2011 Mozilla Foundation and contributors
 * Licensed under the New BSD license. See LICENSE or:
 * http://opensource.org/licenses/BSD-3-Clause
 */
if (typeof define !== 'function') {
    var define = require('amdefine')(module, require);
}
define(function (require, exports, module) {

  var SourceMapGenerator = require('./source-map-generator').SourceMapGenerator;
  var util = require('./util');

  /**
   * SourceNodes provide a way to abstract over interpolating/concatenating
   * snippets of generated JavaScript source code while maintaining the line and
   * column information associated with the original source code.
   *
   * @param aLine The original line number.
   * @param aColumn The original column number.
   * @param aSource The original source's filename.
   * @param aChunks Optional. An array of strings which are snippets of
   *        generated JS, or other SourceNodes.
   * @param aName The original identifier.
   */
  function SourceNode(aLine, aColumn, aSource, aChunks, aName) {
    this.children = [];
    this.sourceContents = {};
    this.line = aLine === undefined ? null : aLine;
    this.column = aColumn === undefined ? null : aColumn;
    this.source = aSource === undefined ? null : aSource;
    this.name = aName === undefined ? null : aName;
    if (aChunks != null) this.add(aChunks);
  }

  /**
   * Creates a SourceNode from generated code and a SourceMapConsumer.
   *
   * @param aGeneratedCode The generated code
   * @param aSourceMapConsumer The SourceMap for the generated code
   */
  SourceNode.fromStringWithSourceMap =
    function SourceNode_fromStringWithSourceMap(aGeneratedCode, aSourceMapConsumer) {
      // The SourceNode we want to fill with the generated code
      // and the SourceMap
      var node = new SourceNode();

      // The generated code
      // Processed fragments are removed from this array.
      var remainingLines = aGeneratedCode.split('\n');

      // We need to remember the position of "remainingLines"
      var lastGeneratedLine = 1, lastGeneratedColumn = 0;

      // The generate SourceNodes we need a code range.
      // To extract it current and last mapping is used.
      // Here we store the last mapping.
      var lastMapping = null;

      aSourceMapConsumer.eachMapping(function (mapping) {
        if (lastMapping === null) {
          // We add the generated code until the first mapping
          // to the SourceNode without any mapping.
          // Each line is added as separate string.
          while (lastGeneratedLine < mapping.generatedLine) {
            node.add(remainingLines.shift() + "\n");
            lastGeneratedLine++;
          }
          if (lastGeneratedColumn < mapping.generatedColumn) {
            var nextLine = remainingLines[0];
            node.add(nextLine.substr(0, mapping.generatedColumn));
            remainingLines[0] = nextLine.substr(mapping.generatedColumn);
            lastGeneratedColumn = mapping.generatedColumn;
          }
        } else {
          // We add the code from "lastMapping" to "mapping":
          // First check if there is a new line in between.
          if (lastGeneratedLine < mapping.generatedLine) {
            var code = "";
            // Associate full lines with "lastMapping"
            do {
              code += remainingLines.shift() + "\n";
              lastGeneratedLine++;
              lastGeneratedColumn = 0;
            } while (lastGeneratedLine < mapping.generatedLine);
            // When we reached the correct line, we add code until we
            // reach the correct column too.
            if (lastGeneratedColumn < mapping.generatedColumn) {
              var nextLine = remainingLines[0];
              code += nextLine.substr(0, mapping.generatedColumn);
              remainingLines[0] = nextLine.substr(mapping.generatedColumn);
              lastGeneratedColumn = mapping.generatedColumn;
            }
            // Create the SourceNode.
            addMappingWithCode(lastMapping, code);
          } else {
            // There is no new line in between.
            // Associate the code between "lastGeneratedColumn" and
            // "mapping.generatedColumn" with "lastMapping"
            var nextLine = remainingLines[0];
            var code = nextLine.substr(0, mapping.generatedColumn -
                                          lastGeneratedColumn);
            remainingLines[0] = nextLine.substr(mapping.generatedColumn -
                                                lastGeneratedColumn);
            lastGeneratedColumn = mapping.generatedColumn;
            addMappingWithCode(lastMapping, code);
          }
        }
        lastMapping = mapping;
      }, this);
      // We have processed all mappings.
      // Associate the remaining code in the current line with "lastMapping"
      // and add the remaining lines without any mapping
      addMappingWithCode(lastMapping, remainingLines.join("\n"));

      // Copy sourcesContent into SourceNode
      aSourceMapConsumer.sources.forEach(function (sourceFile) {
        var content = aSourceMapConsumer.sourceContentFor(sourceFile);
        if (content) {
          node.setSourceContent(sourceFile, content);
        }
      });

      return node;

      function addMappingWithCode(mapping, code) {
        if (mapping === null || mapping.source === undefined) {
          node.add(code);
        } else {
          node.add(new SourceNode(mapping.originalLine,
                                  mapping.originalColumn,
                                  mapping.source,
                                  code,
                                  mapping.name));
        }
      }
    };

  /**
   * Add a chunk of generated JS to this source node.
   *
   * @param aChunk A string snippet of generated JS code, another instance of
   *        SourceNode, or an array where each member is one of those things.
   */
  SourceNode.prototype.add = function SourceNode_add(aChunk) {
    if (Array.isArray(aChunk)) {
      aChunk.forEach(function (chunk) {
        this.add(chunk);
      }, this);
    }
    else if (aChunk instanceof SourceNode || typeof aChunk === "string") {
      if (aChunk) {
        this.children.push(aChunk);
      }
    }
    else {
      throw new TypeError(
        "Expected a SourceNode, string, or an array of SourceNodes and strings. Got " + aChunk
      );
    }
    return this;
  };

  /**
   * Add a chunk of generated JS to the beginning of this source node.
   *
   * @param aChunk A string snippet of generated JS code, another instance of
   *        SourceNode, or an array where each member is one of those things.
   */
  SourceNode.prototype.prepend = function SourceNode_prepend(aChunk) {
    if (Array.isArray(aChunk)) {
      for (var i = aChunk.length-1; i >= 0; i--) {
        this.prepend(aChunk[i]);
      }
    }
    else if (aChunk instanceof SourceNode || typeof aChunk === "string") {
      this.children.unshift(aChunk);
    }
    else {
      throw new TypeError(
        "Expected a SourceNode, string, or an array of SourceNodes and strings. Got " + aChunk
      );
    }
    return this;
  };

  /**
   * Walk over the tree of JS snippets in this node and its children. The
   * walking function is called once for each snippet of JS and is passed that
   * snippet and the its original associated source's line/column location.
   *
   * @param aFn The traversal function.
   */
  SourceNode.prototype.walk = function SourceNode_walk(aFn) {
    var chunk;
    for (var i = 0, len = this.children.length; i < len; i++) {
      chunk = this.children[i];
      if (chunk instanceof SourceNode) {
        chunk.walk(aFn);
      }
      else {
        if (chunk !== '') {
          aFn(chunk, { source: this.source,
                       line: this.line,
                       column: this.column,
                       name: this.name });
        }
      }
    }
  };

  /**
   * Like `String.prototype.join` except for SourceNodes. Inserts `aStr` between
   * each of `this.children`.
   *
   * @param aSep The separator.
   */
  SourceNode.prototype.join = function SourceNode_join(aSep) {
    var newChildren;
    var i;
    var len = this.children.length;
    if (len > 0) {
      newChildren = [];
      for (i = 0; i < len-1; i++) {
        newChildren.push(this.children[i]);
        newChildren.push(aSep);
      }
      newChildren.push(this.children[i]);
      this.children = newChildren;
    }
    return this;
  };

  /**
   * Call String.prototype.replace on the very right-most source snippet. Useful
   * for trimming whitespace from the end of a source node, etc.
   *
   * @param aPattern The pattern to replace.
   * @param aReplacement The thing to replace the pattern with.
   */
  SourceNode.prototype.replaceRight = function SourceNode_replaceRight(aPattern, aReplacement) {
    var lastChild = this.children[this.children.length - 1];
    if (lastChild instanceof SourceNode) {
      lastChild.replaceRight(aPattern, aReplacement);
    }
    else if (typeof lastChild === 'string') {
      this.children[this.children.length - 1] = lastChild.replace(aPattern, aReplacement);
    }
    else {
      this.children.push(''.replace(aPattern, aReplacement));
    }
    return this;
  };

  /**
   * Set the source content for a source file. This will be added to the SourceMapGenerator
   * in the sourcesContent field.
   *
   * @param aSourceFile The filename of the source file
   * @param aSourceContent The content of the source file
   */
  SourceNode.prototype.setSourceContent =
    function SourceNode_setSourceContent(aSourceFile, aSourceContent) {
      this.sourceContents[util.toSetString(aSourceFile)] = aSourceContent;
    };

  /**
   * Walk over the tree of SourceNodes. The walking function is called for each
   * source file content and is passed the filename and source content.
   *
   * @param aFn The traversal function.
   */
  SourceNode.prototype.walkSourceContents =
    function SourceNode_walkSourceContents(aFn) {
      for (var i = 0, len = this.children.length; i < len; i++) {
        if (this.children[i] instanceof SourceNode) {
          this.children[i].walkSourceContents(aFn);
        }
      }

      var sources = Object.keys(this.sourceContents);
      for (var i = 0, len = sources.length; i < len; i++) {
        aFn(util.fromSetString(sources[i]), this.sourceContents[sources[i]]);
      }
    };

  /**
   * Return the string representation of this source node. Walks over the tree
   * and concatenates all the various snippets together to one string.
   */
  SourceNode.prototype.toString = function SourceNode_toString() {
    var str = "";
    this.walk(function (chunk) {
      str += chunk;
    });
    return str;
  };

  /**
   * Returns the string representation of this source node along with a source
   * map.
   */
  SourceNode.prototype.toStringWithSourceMap = function SourceNode_toStringWithSourceMap(aArgs) {
    var generated = {
      code: "",
      line: 1,
      column: 0
    };
    var map = new SourceMapGenerator(aArgs);
    var sourceMappingActive = false;
    var lastOriginalSource = null;
    var lastOriginalLine = null;
    var lastOriginalColumn = null;
    var lastOriginalName = null;
    this.walk(function (chunk, original) {
      generated.code += chunk;
      if (original.source !== null
          && original.line !== null
          && original.column !== null) {
        if(lastOriginalSource !== original.source
           || lastOriginalLine !== original.line
           || lastOriginalColumn !== original.column
           || lastOriginalName !== original.name) {
          map.addMapping({
            source: original.source,
            original: {
              line: original.line,
              column: original.column
            },
            generated: {
              line: generated.line,
              column: generated.column
            },
            name: original.name
          });
        }
        lastOriginalSource = original.source;
        lastOriginalLine = original.line;
        lastOriginalColumn = original.column;
        lastOriginalName = original.name;
        sourceMappingActive = true;
      } else if (sourceMappingActive) {
        map.addMapping({
          generated: {
            line: generated.line,
            column: generated.column
          }
        });
        lastOriginalSource = null;
        sourceMappingActive = false;
      }
      chunk.split('').forEach(function (ch) {
        if (ch === '\n') {
          generated.line++;
          generated.column = 0;
        } else {
          generated.column++;
        }
      });
    });
    this.walkSourceContents(function (sourceFile, sourceContent) {
      map.setSourceContent(sourceFile, sourceContent);
    });

    return { code: generated.code, map: map };
  };

  exports.SourceNode = SourceNode;

});

},{"./source-map-generator":82,"./util":84,"amdefine":22}],84:[function(require,module,exports){
/* -*- Mode: js; js-indent-level: 2; -*- */
/*
 * Copyright 2011 Mozilla Foundation and contributors
 * Licensed under the New BSD license. See LICENSE or:
 * http://opensource.org/licenses/BSD-3-Clause
 */
if (typeof define !== 'function') {
    var define = require('amdefine')(module, require);
}
define(function (require, exports, module) {

  /**
   * This is a helper function for getting values from parameter/options
   * objects.
   *
   * @param args The object we are extracting values from
   * @param name The name of the property we are getting.
   * @param defaultValue An optional value to return if the property is missing
   * from the object. If this is not specified and the property is missing, an
   * error will be thrown.
   */
  function getArg(aArgs, aName, aDefaultValue) {
    if (aName in aArgs) {
      return aArgs[aName];
    } else if (arguments.length === 3) {
      return aDefaultValue;
    } else {
      throw new Error('"' + aName + '" is a required argument.');
    }
  }
  exports.getArg = getArg;

  var urlRegexp = /([\w+\-.]+):\/\/((\w+:\w+)@)?([\w.]+)?(:(\d+))?(\S+)?/;
  var dataUrlRegexp = /^data:.+\,.+/;

  function urlParse(aUrl) {
    var match = aUrl.match(urlRegexp);
    if (!match) {
      return null;
    }
    return {
      scheme: match[1],
      auth: match[3],
      host: match[4],
      port: match[6],
      path: match[7]
    };
  }
  exports.urlParse = urlParse;

  function urlGenerate(aParsedUrl) {
    var url = aParsedUrl.scheme + "://";
    if (aParsedUrl.auth) {
      url += aParsedUrl.auth + "@"
    }
    if (aParsedUrl.host) {
      url += aParsedUrl.host;
    }
    if (aParsedUrl.port) {
      url += ":" + aParsedUrl.port
    }
    if (aParsedUrl.path) {
      url += aParsedUrl.path;
    }
    return url;
  }
  exports.urlGenerate = urlGenerate;

  function join(aRoot, aPath) {
    var url;

    if (aPath.match(urlRegexp) || aPath.match(dataUrlRegexp)) {
      return aPath;
    }

    if (aPath.charAt(0) === '/' && (url = urlParse(aRoot))) {
      url.path = aPath;
      return urlGenerate(url);
    }

    return aRoot.replace(/\/$/, '') + '/' + aPath;
  }
  exports.join = join;

  /**
   * Because behavior goes wacky when you set `__proto__` on objects, we
   * have to prefix all the strings in our set with an arbitrary character.
   *
   * See https://github.com/mozilla/source-map/pull/31 and
   * https://github.com/mozilla/source-map/issues/30
   *
   * @param String aStr
   */
  function toSetString(aStr) {
    return '$' + aStr;
  }
  exports.toSetString = toSetString;

  function fromSetString(aStr) {
    return aStr.substr(1);
  }
  exports.fromSetString = fromSetString;

  function relative(aRoot, aPath) {
    aRoot = aRoot.replace(/\/$/, '');

    var url = urlParse(aRoot);
    if (aPath.charAt(0) == "/" && url && url.path == "/") {
      return aPath.slice(1);
    }

    return aPath.indexOf(aRoot + '/') === 0
      ? aPath.substr(aRoot.length + 1)
      : aPath;
  }
  exports.relative = relative;

  function strcmp(aStr1, aStr2) {
    var s1 = aStr1 || "";
    var s2 = aStr2 || "";
    return (s1 > s2) - (s1 < s2);
  }

  /**
   * Comparator between two mappings where the original positions are compared.
   *
   * Optionally pass in `true` as `onlyCompareGenerated` to consider two
   * mappings with the same original source/line/column, but different generated
   * line and column the same. Useful when searching for a mapping with a
   * stubbed out mapping.
   */
  function compareByOriginalPositions(mappingA, mappingB, onlyCompareOriginal) {
    var cmp;

    cmp = strcmp(mappingA.source, mappingB.source);
    if (cmp) {
      return cmp;
    }

    cmp = mappingA.originalLine - mappingB.originalLine;
    if (cmp) {
      return cmp;
    }

    cmp = mappingA.originalColumn - mappingB.originalColumn;
    if (cmp || onlyCompareOriginal) {
      return cmp;
    }

    cmp = strcmp(mappingA.name, mappingB.name);
    if (cmp) {
      return cmp;
    }

    cmp = mappingA.generatedLine - mappingB.generatedLine;
    if (cmp) {
      return cmp;
    }

    return mappingA.generatedColumn - mappingB.generatedColumn;
  };
  exports.compareByOriginalPositions = compareByOriginalPositions;

  /**
   * Comparator between two mappings where the generated positions are
   * compared.
   *
   * Optionally pass in `true` as `onlyCompareGenerated` to consider two
   * mappings with the same generated line and column, but different
   * source/name/original line and column the same. Useful when searching for a
   * mapping with a stubbed out mapping.
   */
  function compareByGeneratedPositions(mappingA, mappingB, onlyCompareGenerated) {
    var cmp;

    cmp = mappingA.generatedLine - mappingB.generatedLine;
    if (cmp) {
      return cmp;
    }

    cmp = mappingA.generatedColumn - mappingB.generatedColumn;
    if (cmp || onlyCompareGenerated) {
      return cmp;
    }

    cmp = strcmp(mappingA.source, mappingB.source);
    if (cmp) {
      return cmp;
    }

    cmp = mappingA.originalLine - mappingB.originalLine;
    if (cmp) {
      return cmp;
    }

    cmp = mappingA.originalColumn - mappingB.originalColumn;
    if (cmp) {
      return cmp;
    }

    return strcmp(mappingA.name, mappingB.name);
  };
  exports.compareByGeneratedPositions = compareByGeneratedPositions;

});

},{"amdefine":22}]},{},[12])(12)
});