// Copyright 2012 Traceur Authors.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/**
 * The traceur runtime.
 */
(function(global) {
  'use strict';

  var $create = Object.create;
  var $defineProperty = Object.defineProperty;
  var $freeze = Object.freeze;
  var $getOwnPropertyNames = Object.getOwnPropertyNames;
  var $getPrototypeOf = Object.getPrototypeOf;
  var $hasOwnProperty = Object.prototype.hasOwnProperty;

  function nonEnum(value) {
    return {
      configurable: true,
      enumerable: false,
      value: value,
      writable: true
    };
  }

  var method = nonEnum;

  function polyfillString(String) {
    // Harmony String Extras
    // http://wiki.ecmascript.org/doku.php?id=harmony:string_extras
    Object.defineProperties(String.prototype, {
      startsWith: method(function(s) {
       return this.lastIndexOf(s, 0) === 0;
      }),
      endsWith: method(function(s) {
        var t = String(s);
        var l = this.length - t.length;
        return l >= 0 && this.indexOf(t, l) === l;
      }),
      contains: method(function(s) {
        return this.indexOf(s) !== -1;
      }),
      toArray: method(function() {
        return this.split('');
      })
    });

    // 15.5.3.4 String.raw ( callSite, ...substitutions)
    $defineProperty(String, 'raw', {
      value: function(callsite) {
        var raw = callsite.raw;
        var len = raw.length >>> 0;  // ToUint
        if (len === 0)
          return '';
        var s = '';
        var i = 0;
        while (true) {
          s += raw[i];
          if (i + 1 === len)
            return s;
          s += arguments[++i];
        }
      },
      configurable: true,
      enumerable: false,
      writable: true
    });
  }

  var counter = 0;

  /**
   * Generates a new unique string.
   * @return {string}
   */
  function newUniqueString() {
    return '__$' + Math.floor(Math.random() * 1e9) + '$' + ++counter + '$__';
  }

  var nameRe = /^__\$(?:\d+)\$(?:\d+)\$__$/;

  var internalStringValueName = newUniqueString();

  /**
   * Creates a new private name object.
   * @param {string=} string Optional string used for toString.
   * @constructor
   */
  function Name(string) {
    if (!string)
      string = newUniqueString();
    $defineProperty(this, internalStringValueName, {value: newUniqueString()});

    function toString() {
      return string;
    }
    $freeze(toString);
    $freeze(toString.prototype);
    var toStringDescr = method(toString);
    $defineProperty(this, 'toString', toStringDescr);

    this.public = $freeze($create(null, {
      toString: method($freeze(function toString() {
        return string;
      }))
    }));
    $freeze(this.public.toString.prototype);

    $freeze(this);
  };
  $freeze(Name);
  $freeze(Name.prototype);

  function assertName(val) {
    if (!NameModule.isName(val))
      throw new TypeError(val + ' is not a Name');
    return val;
  }

  // Private name.

  // Collection getters and setters
  var elementDeleteName = new Name();
  var elementGetName = new Name();
  var elementSetName = new Name();

  // HACK: We should use runtime/modules/std/name.js or something like that.
  var NameModule = $freeze({
    Name: function(str) {
      return new Name(str);
    },
    isName: function(x) {
      return x instanceof Name;
    },
    elementGet: elementGetName,
    elementSet: elementSetName,
    elementDelete: elementDeleteName
  });

  var filter = Array.prototype.filter.call.bind(Array.prototype.filter);

  // Override getOwnPropertyNames to filter out private name keys.
  function getOwnPropertyNames(object) {
    return filter($getOwnPropertyNames(object), function(str) {
      return !nameRe.test(str);
    });
  }

  // Override Object.prototpe.hasOwnProperty to always return false for
  // private names.
  function hasOwnProperty(name) {
    if (NameModule.isName(name) || nameRe.test(name))
      return false;
    return $hasOwnProperty.call(this, name);
  }

  function elementDelete(object, name) {
    if (traceur.options.trapMemberLookup &&
        hasPrivateNameProperty(object, elementDeleteName)) {
      return getProperty(object, elementDeleteName).call(object, name);
    }
    return deleteProperty(object, name);
  }

  function elementGet(object, name) {
    if (traceur.options.trapMemberLookup &&
        hasPrivateNameProperty(object, elementGetName)) {
      return getProperty(object, elementGetName).call(object, name);
    }
    return getProperty(object, name);
  }

  function elementHas(object, name) {
    // Should we allow trapping this too?
    return has(object, name);
  }

  function elementSet(object, name, value) {
    if (traceur.options.trapMemberLookup &&
        hasPrivateNameProperty(object, elementSetName)) {
      getProperty(object, elementSetName).call(object, name, value);
    } else {
      setProperty(object, name, value);
    }
    return value;
  }

  function assertNotName(s) {
    if (nameRe.test(s))
      throw Error('Invalid access to private name');
  }

  function deleteProperty(object, name) {
    if (NameModule.isName(name))
      return delete object[name[internalStringValueName]];
    if (nameRe.test(name))
      return true;
    return delete object[name];
  }

  function getProperty(object, name) {
    if (NameModule.isName(name))
      return object[name[internalStringValueName]];
    if (nameRe.test(name))
      return undefined;
    return object[name];
  }

  function hasPrivateNameProperty(object, name) {
    return name[internalStringValueName] in Object(object);
  }

  function has(object, name) {
    if (NameModule.isName(name) || nameRe.test(name))
      return false;
    return name in Object(object);
  }

  // This is a bit simplistic.
  // http://wiki.ecmascript.org/doku.php?id=strawman:refactoring_put#object._get_set_property_built-ins
  function setProperty(object, name, value) {
    if (NameModule.isName(name)) {
      var descriptor = $getPropertyDescriptor(object,
                                              [name[internalStringValueName]]);
      if (descriptor)
        object[name[internalStringValueName]] = value;
      else
        $defineProperty(object, name[internalStringValueName], nonEnum(value));
    } else {
      assertNotName(name);
      object[name] = value;
    }
  }

  function defineProperty(object, name, descriptor) {
    if (NameModule.isName(name)) {
      // Private names should never be enumerable.
      if (descriptor.enumerable) {
        descriptor = Object.create(descriptor, {
          enumerable: {value: false}
        });
      }
      $defineProperty(object, name[internalStringValueName], descriptor);
    } else {
      assertNotName(name);
      $defineProperty(object, name, descriptor);
    }
  }

  function $getPropertyDescriptor(obj, name) {
    while (obj !== null) {
      var result = Object.getOwnPropertyDescriptor(obj, name);
      if (result)
        return result;
      obj = $getPrototypeOf(obj);
    }
    return undefined;
  }

  function getPropertyDescriptor(obj, name) {
    if (NameModule.isName(name))
      return undefined;
    assertNotName(name);
    return $getPropertyDescriptor(obj, name);
  }

  function polyfillObject(Object) {
    $defineProperty(Object, 'defineProperty', {value: defineProperty});
    $defineProperty(Object, 'deleteProperty', method(deleteProperty));
    $defineProperty(Object, 'getOwnPropertyNames',
                    {value: getOwnPropertyNames});
    $defineProperty(Object, 'getProperty', method(getProperty));
    $defineProperty(Object, 'getPropertyDescriptor',
                    method(getPropertyDescriptor));
    $defineProperty(Object, 'has', method(has));
    $defineProperty(Object, 'setProperty', method(setProperty));
    $defineProperty(Object.prototype, 'hasOwnProperty',
                    {value: hasOwnProperty});

    // Object.is

    // Unlike === this returns true for (NaN, NaN) and false for (0, -0).
    function is(left, right) {
      if (left === right)
        return left !== 0 || 1 / left === 1 / right;
      return left !== left && right !== right;
    }

    $defineProperty(Object, 'is', method(is));
  }

  // Iterators.
  var iteratorName = new Name('iterator');

  var IterModule = {
    get iterator() {
      return iteratorName;
    }
    // TODO: Implement the rest of @iter and move it to a different file that
    // gets compiled.
  };

  function getIterator(collection) {
    return getProperty(collection, iteratorName).call(collection);
  }

  function returnThis() {
    return this;
  }

  function addIterator(object) {
    // Generator instances are iterable.
    setProperty(object, iteratorName, returnThis);
    return object;
  }

  function polyfillArray(Array) {
    // Make arrays iterable.
    defineProperty(Array.prototype, IterModule.iterator, method(function() {
      var index = 0;
      var array = this;
      return {
        next: function() {
          if (index < array.length) {
            return array[index++];
          }
          throw StopIterationLocal;
        }
      };
    }));
  }

  // Generators: GeneratorReturn
  var GeneratorReturnLocal;

  function setGeneratorReturn(GeneratorReturn, global) {
    switch (typeof GeneratorReturn) {
      case 'function':
        // StopIterationLocal instanceof GeneratorReturnLocal means we probably
        // want to maintain that invariant when we change GeneratorReturnLocal.
        if (typeof GeneratorReturnLocal === 'function' &&
            StopIterationLocal instanceof GeneratorReturnLocal) {
          GeneratorReturnLocal = GeneratorReturn;
          setStopIteration(undefined, global);
          return;
        }
        GeneratorReturnLocal = GeneratorReturn;
        return;
      case 'undefined':
        GeneratorReturnLocal = function(v) {
          this.value = v;
        };
        GeneratorReturnLocal.prototype = {
          toString: function() {
            return '[object GeneratorReturn ' + this.value + ']';
          }
        };
        return;
      default:
        throw new TypeError('constructor function required');
    }
  }

  setGeneratorReturn();

  // Generators: StopIteration
  var StopIterationLocal;

  function isStopIteration(x) {
    return x === StopIterationLocal || x instanceof GeneratorReturnLocal;
  }

  function setStopIteration(StopIteration, global) {
    switch (typeof StopIteration) {
      case 'object':
        StopIterationLocal = StopIteration;
        break;
      case 'undefined':
        StopIterationLocal = new GeneratorReturnLocal();
        StopIterationLocal.toString = function() {
          return '[object StopIteration]';
        };
        break;
      default:
        throw new TypeError('invalid StopIteration type.');
    }
    if (global)
      global.StopIteration = StopIteration;
  }

  setStopIteration(global.StopIteration, global);

  /**
   * @param {Function} canceller
   * @constructor
   */
  function Deferred(canceller) {
    this.canceller_ = canceller;
    this.listeners_ = [];
  }

  function notify(self) {
    while (self.listeners_.length > 0) {
      var current = self.listeners_.shift();
      var currentResult = undefined;
      try {
        try {
          if (self.result_[1]) {
            if (current.errback)
              currentResult = current.errback.call(undefined, self.result_[0]);
          } else {
            if (current.callback)
              currentResult = current.callback.call(undefined, self.result_[0]);
          }
          current.deferred.callback(currentResult);
        } catch (err) {
          current.deferred.errback(err);
        }
      } catch (unused) {}
    }
  }

  function fire(self, value, isError) {
    if (self.fired_)
      throw new Error('already fired');

    self.fired_ = true;
    self.result_ = [value, isError];
    notify(self);
  }

  Deferred.prototype = {
    fired_: false,
    result_: undefined,

    createPromise: function() {
      return {then: this.then.bind(this), cancel: this.cancel.bind(this)};
    },

    callback: function(value) {
      fire(this, value, false);
    },

    errback: function(err) {
      fire(this, err, true);
    },

    then: function(callback, errback) {
      var result = new Deferred(this.cancel.bind(this));
      this.listeners_.push({
        deferred: result,
        callback: callback,
        errback: errback
      });
      if (this.fired_)
        notify(this);
      return result.createPromise();
    },

    cancel: function() {
      if (this.fired_)
        throw new Error('already finished');
      var result;
      if (this.canceller_) {
        result = this.canceller_(this);
        if (!result instanceof Error)
          result = new Error(result);
      } else {
        result = new Error('cancelled');
      }
      if (!this.fired_) {
        this.result_ = [result, true];
        notify(this);
      }
    }
  };

  var modules = $freeze({
    get '@name'() {
      return NameModule;
    },
    get '@iter'() {
      return IterModule;
    }
  });

  // TODO(arv): Don't export this.
  global.Deferred = Deferred;

  function setupGlobals(global) {
    polyfillString(global.String);
    polyfillObject(global.Object);
    polyfillArray(global.Array);
  }

  setupGlobals(global);

  // Return the runtime namespace.
  var runtime = {
    Deferred: Deferred,
    GeneratorReturn: GeneratorReturnLocal,
    setGeneratorReturn: setGeneratorReturn,
    StopIteration: StopIterationLocal,
    setStopIteration: setStopIteration,
    isStopIteration: isStopIteration,
    addIterator: addIterator,
    assertName: assertName,
    createName: NameModule.Name,
    deleteProperty: deleteProperty,
    elementDelete: elementDelete,
    elementGet: elementGet,
    elementHas: elementHas,
    elementSet: elementSet,
    getIterator: getIterator,
    getProperty: getProperty,
    setProperty: setProperty,
    setupGlobals: setupGlobals,
    has: has,
    modules: modules,
  };

  // This file is sometimes used without traceur.js.
  if (typeof traceur !== 'undefined')
    traceur.setRuntime(runtime);
  else
    global.traceur = {runtime: runtime};

})(typeof global !== 'undefined' ? global : this);

(function(e){if("function"==typeof bootstrap)bootstrap("moduletranspiler",e);else if("object"==typeof exports)module.exports=e();else if("function"==typeof define&&define.amd)define(e);else if("undefined"!=typeof ses){if(!ses.ok())return;ses.makeModuleTranspiler=e}else"undefined"!=typeof window?window.ModuleTranspiler=e():global.ModuleTranspiler=e()})(function(){var define,ses,bootstrap,module,exports;
return (function(e,t,n){function i(n,s){if(!t[n]){if(!e[n]){var o=typeof require=="function"&&require;if(!s&&o)return o(n,!0);if(r)return r(n,!0);throw new Error("Cannot find module '"+n+"'")}var u=t[n]={exports:{}};e[n][0].call(u.exports,function(t){var r=e[n][1][t];return i(r?r:t)},u,u.exports)}return t[n].exports}var r=typeof require=="function"&&require;for(var s=0;s<n.length;s++)i(n[s]);return i})({1:[function(require,module,exports){
"use strict";
var Compiler = require("./compiler");
var CLI = require("./cli");
exports.Compiler = Compiler;
exports.CLI = CLI;


},{"./cli":3,"./compiler":2}],4:[function(require,module,exports){
// nothing to see here... no file methods for the browser

},{}],5:[function(require,module,exports){
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
            if (ev.source === window && ev.data === 'process-tick') {
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

process.binding = function (name) {
    throw new Error('process.binding is not supported');
}

// TODO(shtylman)
process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};

},{}],6:[function(require,module,exports){
(function(process){function filter (xs, fn) {
    var res = [];
    for (var i = 0; i < xs.length; i++) {
        if (fn(xs[i], i, xs)) res.push(xs[i]);
    }
    return res;
}

// resolves . and .. elements in a path array with directory names there
// must be no slashes, empty elements, or device names (c:\) in the array
// (so also no leading and trailing slashes - it does not distinguish
// relative and absolute paths)
function normalizeArray(parts, allowAboveRoot) {
  // if the path tries to go above the root, `up` ends up > 0
  var up = 0;
  for (var i = parts.length; i >= 0; i--) {
    var last = parts[i];
    if (last == '.') {
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

// Regex to split a filename into [*, dir, basename, ext]
// posix version
var splitPathRe = /^(.+\/(?!$)|\/)?((?:.+?)?(\.[^.]*)?)$/;

// path.resolve([from ...], to)
// posix version
exports.resolve = function() {
var resolvedPath = '',
    resolvedAbsolute = false;

for (var i = arguments.length; i >= -1 && !resolvedAbsolute; i--) {
  var path = (i >= 0)
      ? arguments[i]
      : process.cwd();

  // Skip empty and invalid entries
  if (typeof path !== 'string' || !path) {
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
var isAbsolute = path.charAt(0) === '/',
    trailingSlash = path.slice(-1) === '/';

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
exports.join = function() {
  var paths = Array.prototype.slice.call(arguments, 0);
  return exports.normalize(filter(paths, function(p, index) {
    return p && typeof p === 'string';
  }).join('/'));
};


exports.dirname = function(path) {
  var dir = splitPathRe.exec(path)[1] || '';
  var isWindows = false;
  if (!dir) {
    // No dirname
    return '.';
  } else if (dir.length === 1 ||
      (isWindows && dir.length <= 3 && dir.charAt(1) === ':')) {
    // It is just a slash or a drive letter with a slash
    return dir;
  } else {
    // It is a full dirname, strip trailing slash
    return dir.substring(0, dir.length - 1);
  }
};


exports.basename = function(path, ext) {
  var f = splitPathRe.exec(path)[2] || '';
  // TODO: make this comparison case-insensitive on windows?
  if (ext && f.substr(-1 * ext.length) === ext) {
    f = f.substr(0, f.length - ext.length);
  }
  return f;
};


exports.extname = function(path) {
  return splitPathRe.exec(path)[3] || '';
};

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

})(require("__browserify_process"))
},{"__browserify_process":5}],2:[function(require,module,exports){
"use strict";
var AMDCompiler = require("./amd_compiler");
var CJSCompiler = require("./cjs_compiler");
var GlobalsCompiler = require("./globals_compiler");
var Unique = require("./utils").Unique;
var EXPORT = /^\s*export\s+(.*?)\s*(;)?\s*$/;
var EXPORT_DEFAULT = /^\s*export\s*default\s*(.*?)\s*(;)?\s*$/;
var EXPORT_FUNCTION = /^\s*export\s+function\s+(\w+)\s*(\(.*)$/;
var EXPORT_VAR = /^\s*export\s+var\s+(\w+)\s*=\s*(.*)$/;
var IMPORT = /^\s*import\s+(.*)\s+from\s+(?:"([^"]+?)"|'([^']+?)')\s*(;)?\s*$/;
var IMPORT_AS = /^\s*(.*)\s+as\s+(.*)\s*$/;
var RE_EXPORT = /^export\s+({.*})\s+from\s+(?:"([^"]+?)"|'([^']+?)')\s*(;)?\s*$/;
var COMMENT_START = new RegExp("/\\*");
var COMMENT_END = new RegExp("\\*/");
var COMMENT_CS_TOGGLE = /^###/;
function getNames(string) {
  var name, _i, _len, _ref, _results;
  if (string[0] === '{' && string[string.length - 1] === '}') {
    return string.slice(1, - 1).split(',').map(function(name) {
      return name.trim();
    });
  } else {
    return [string.trim()];
  }
}
function Compiler(string, moduleName, options) {
  if (moduleName == null) {
    moduleName = null;
  }
  if (options == null) {
    options = {};
  }
  this.string = string;
  this.moduleName = moduleName;
  this.options = options;
  this.imports = {};
  this.importDefault = {};
  this.exports = {};
  this.exportDefault = null;
  this.lines = [];
  this.id = 0;
  this.inBlockComment = false;
  this.reExportUnique = new Unique('reexport');
  if (!this.options.coffee) {
    this.commentStart = COMMENT_START;
    this.commentEnd = COMMENT_END;
  } else {
    this.commentStart = COMMENT_CS_TOGGLE;
    this.commentEnd = COMMENT_CS_TOGGLE;
  }
  this.parse();
}
Compiler.prototype.parse = function() {
  this.string.split('\n').forEach(this.parseLine.bind(this));
};
Compiler.prototype.parseLine = function(line) {
  var match;
  if (!this.inBlockComment) {
    if (match = this.matchLine(line, EXPORT_DEFAULT)) {
      this.processExportDefault(match);
    } else if (match = this.matchLine(line, EXPORT_FUNCTION)) {
      this.processExportFunction(match);
    } else if (match = this.matchLine(line, EXPORT_VAR)) {
      this.processExportVar(match);
    } else if (match = this.matchLine(line, RE_EXPORT)) {
      this.processReexport(match);
    } else if (match = this.matchLine(line, EXPORT)) {
      this.processExport(match);
    } else if (match = this.matchLine(line, IMPORT)) {
      this.processImport(match);
    } else if (match = this.matchLine(line, this.commentStart)) {
      this.processEnterComment(line);
    } else {
      this.processLine(line);
    }
  } else {
    if (match = this.matchLine(line, this.commentEnd)) {
      this.processExitComment(line);
    } else {
      this.processLine(line);
    }
  }
};
Compiler.prototype.matchLine = function(line, pattern) {
  var match = line.match(pattern);
  if (match && !this.options.coffee && !match[match.length - 1]) {
    return null;
  }
  return match;
};
Compiler.prototype.processExportDefault = function(match) {
  this.exportDefault = match[1];
};
Compiler.prototype.processExport = function(match) {
  var self = this;
  getNames(match[1]).forEach(function(ex) {
    self.exports[ex] = ex;
  });
};
Compiler.prototype.processExportFunction = function(match) {
  var body, name;
  name = match[1];
  body = match[2];
  this.lines.push('function ' + name + body);
  this.exports[name] = name;
};
Compiler.prototype.processExportVar = function(match) {
  var name, value;
  name = match[1];
  value = match[2];
  this.lines.push('var ' + name + ' = ' + value);
  this.exports[name] = name;
};
Compiler.prototype.processImport = function(match) {
  var asMatch, importSpecifiers, imports, name, pattern;
  pattern = match[1];
  if (pattern[0] === '{' && pattern[pattern.length - 1] === '}') {
    pattern = pattern.slice(1, - 1);
    importSpecifiers = pattern.split(/\s*,\s*/).map(function(name) {
      return name.trim();
    });
    imports = {};
    importSpecifiers.forEach(function(name) {
      if (asMatch = name.match(IMPORT_AS)) {
        imports[asMatch[1]] = asMatch[2];
      } else {
        imports[name] = name;
      }
    });
    this.imports[match[2] || match[3]] = imports;
  } else {
    this.importDefault[match[2] || match[3]] = match[1];
  }
};
Compiler.prototype.processReexport = function(match) {
  var names = getNames(match[1]), importPath = match[2] || match[3], importLocal = this.reExportUnique.next(), self = this;
  this.importDefault[importPath] = importLocal;
  names.forEach(function(name) {
    self.exports[name] = "" + importLocal + "." + name;
  });
};
Compiler.prototype.processLine = function(line) {
  this.lines.push(line);
};
Compiler.prototype.processEnterComment = function(line) {
  if (!this.matchLine(line, COMMENT_END)) {
    this.inBlockComment = true;
  }
  this.lines.push(line);
};
Compiler.prototype.processExitComment = function(line) {
  this.inBlockComment = false;
  this.lines.push(line);
};
Compiler.prototype.toAMD = function() {
  return new AMDCompiler(this, this.options).stringify();
};
Compiler.prototype.toCJS = function() {
  return new CJSCompiler(this, this.options).stringify();
};
Compiler.prototype.toGlobals = function() {
  return new GlobalsCompiler(this, this.options).stringify();
};
module.exports = Compiler;


},{"./amd_compiler":7,"./cjs_compiler":9,"./globals_compiler":8,"./utils":10}],10:[function(require,module,exports){
"use strict";
var $__getDescriptors = function(object) {
  var descriptors = {}, name, names = Object.getOwnPropertyNames(object);
  for (var i = 0; i < names.length; i++) {
    var name = names[i];
    descriptors[name] = Object.getOwnPropertyDescriptor(object, name);
  }
  return descriptors;
}, $__createClassNoExtends = function(object, staticObject) {
  var ctor = object.constructor;
  Object.defineProperty(object, 'constructor', {enumerable: false});
  ctor.prototype = object;
  Object.defineProperties(ctor, $__getDescriptors(staticObject));
  return ctor;
};
function isEmpty(object) {
  for (var foo in object) {
    if (Object.prototype.hasOwnProperty.call(object, foo)) {
      return false;
    }
  }
  return true;
}
var Unique = function() {
  'use strict';
  var $Unique = ($__createClassNoExtends)({
    constructor: function(prefix) {
      this.prefix = prefix;
      this.index = 1;
    },
    next: function() {
      return ['__', this.prefix, this.index++, '__'].join('');
    }
  }, {});
  return $Unique;
}();
exports.isEmpty = isEmpty;
exports.Unique = Unique;


},{}],7:[function(require,module,exports){
"use strict";
var $__superDescriptor = function(proto, name) {
  if (!proto) throw new TypeError('super is null');
  return Object.getPropertyDescriptor(proto, name);
}, $__superCall = function(self, proto, name, args) {
  var descriptor = $__superDescriptor(proto, name);
  if (descriptor) {
    if ('value'in descriptor) return descriptor.value.apply(self, args);
    if (descriptor.get) return descriptor.get.call(self).apply(self, args);
  }
  throw new TypeError("Object has no method '" + name + "'.");
}, $__getProtoParent = function(superClass) {
  if (typeof superClass === 'function') {
    var prototype = superClass.prototype;
    if (Object(prototype) === prototype || prototype === null) return superClass.prototype;
  }
  if (superClass === null) return null;
  throw new TypeError();
}, $__getDescriptors = function(object) {
  var descriptors = {}, name, names = Object.getOwnPropertyNames(object);
  for (var i = 0; i < names.length; i++) {
    var name = names[i];
    descriptors[name] = Object.getOwnPropertyDescriptor(object, name);
  }
  return descriptors;
}, $__createClass = function(object, staticObject, protoParent, superClass, hasConstructor) {
  var ctor = object.constructor;
  if (typeof superClass === 'function') ctor.__proto__ = superClass;
  if (!hasConstructor && protoParent === null) ctor = object.constructor = function() {};
  var descriptors = $__getDescriptors(object);
  descriptors.constructor.enumerable = false;
  ctor.prototype = Object.create(protoParent, descriptors);
  Object.defineProperties(ctor, $__getDescriptors(staticObject));
  return ctor;
};
var AbstractCompiler = require("./abstract_compiler");
var path = require("path");
var isEmpty = require("./utils").isEmpty;
var AMDCompiler = function($__super) {
  'use strict';
  var $__proto = $__getProtoParent($__super);
  var $AMDCompiler = ($__createClass)({
    constructor: function() {
      $__superCall(this, $__proto, "constructor", arguments);
    },
    stringify: function() {
      var _this = this;
      return this.build(function(s) {
        var dependency, i, preamble, wrapperArgs, _ref1;
        _ref1 = _this.buildPreamble(_this.dependencyNames), wrapperArgs = _ref1[0], preamble = _ref1[1];
        if (!isEmpty(_this.exports)) {
          _this.dependencyNames.push('exports');
          wrapperArgs.push('__exports__');
        }
        for (i in _this.dependencyNames) {
          dependency = _this.dependencyNames[i];
          if (/^\./.test(dependency)) {
            _this.dependencyNames[i] = path.join(_this.moduleName, '..', dependency).replace(/[\\]/g, '/');
          }
        }
        return s.line(function() {
          return s.call('define', function(arg) {
            if (_this.moduleName) {
              arg(s.print(_this.moduleName));
            }
            arg(s["break"]);
            arg(s.print(_this.dependencyNames));
            arg(s["break"]);
            return arg(function() {
              return s["function"](wrapperArgs, function() {
                var exportName, exportValue, _ref2;
                s.useStrict();
                if (preamble) {
                  s.append(preamble);
                }
                s.append.apply(s, _this.lines);
                _ref2 = _this.exports;
                for (exportName in _ref2) {
                  exportValue = _ref2[exportName];
                  s.line("__exports__." + exportName + " = " + exportValue);
                }
                if (_this.exportDefault) {
                  return s.line("return " + _this.exportDefault);
                }
              });
            });
          });
        });
      });
    }
  }, {}, $__proto, $__super, false);
  return $AMDCompiler;
}(AbstractCompiler);
module.exports = AMDCompiler;


},{"./abstract_compiler":11,"./utils":10,"path":6}],9:[function(require,module,exports){
"use strict";
var $__superDescriptor = function(proto, name) {
  if (!proto) throw new TypeError('super is null');
  return Object.getPropertyDescriptor(proto, name);
}, $__superCall = function(self, proto, name, args) {
  var descriptor = $__superDescriptor(proto, name);
  if (descriptor) {
    if ('value'in descriptor) return descriptor.value.apply(self, args);
    if (descriptor.get) return descriptor.get.call(self).apply(self, args);
  }
  throw new TypeError("Object has no method '" + name + "'.");
}, $__getProtoParent = function(superClass) {
  if (typeof superClass === 'function') {
    var prototype = superClass.prototype;
    if (Object(prototype) === prototype || prototype === null) return superClass.prototype;
  }
  if (superClass === null) return null;
  throw new TypeError();
}, $__getDescriptors = function(object) {
  var descriptors = {}, name, names = Object.getOwnPropertyNames(object);
  for (var i = 0; i < names.length; i++) {
    var name = names[i];
    descriptors[name] = Object.getOwnPropertyDescriptor(object, name);
  }
  return descriptors;
}, $__createClass = function(object, staticObject, protoParent, superClass, hasConstructor) {
  var ctor = object.constructor;
  if (typeof superClass === 'function') ctor.__proto__ = superClass;
  if (!hasConstructor && protoParent === null) ctor = object.constructor = function() {};
  var descriptors = $__getDescriptors(object);
  descriptors.constructor.enumerable = false;
  ctor.prototype = Object.create(protoParent, descriptors);
  Object.defineProperties(ctor, $__getDescriptors(staticObject));
  return ctor;
};
var AbstractCompiler = require("./abstract_compiler");
var __hasProp = {}.hasOwnProperty, __indexOf = [].indexOf || function(item) {
  for (var i = 0, l = this.length; i < l; i++) {
    if (i in this && this[i] === item) return i;
  }
  return - 1;
};
var CJSCompiler = function($__super) {
  'use strict';
  var $__proto = $__getProtoParent($__super);
  var $CJSCompiler = ($__createClass)({
    constructor: function() {
      $__superCall(this, $__proto, "constructor", arguments);
    },
    stringify: function() {
      var _this = this;
      return this.build(function(s) {
        var alias, dependency, deps, doImport, exportName, exportValue, import_, name, variables, _ref1, _ref2, _ref3, _results;
        doImport = function(name, import_, prop) {
          var req, rhs;
          if (prop == null) {
            prop = null;
          }
          req = function() {
            return s.call('require', [s.print(import_)]);
          };
          rhs = prop ? (function() {
            return s.prop(req, prop);
          }): req;
          return s["var"](name, rhs);
        };
        s.useStrict();
        deps = s.unique('dependency');
        _ref1 = _this.importDefault;
        for (import_ in _ref1) {
          if (!__hasProp.call(_ref1, import_)) continue;
          name = _ref1[import_];
          doImport(name, import_);
        }
        _ref2 = _this.imports;
        for (import_ in _ref2) {
          if (!__hasProp.call(_ref2, import_)) continue;
          variables = _ref2[import_];
          if (Object.keys(variables).length === 1) {
            name = Object.keys(variables)[0];
            doImport(variables[name], import_, name);
          } else {
            dependency = deps.next();
            doImport(dependency, import_);
            for (name in variables) {
              if (!__hasProp.call(variables, name)) continue;
              alias = variables[name];
              if (name === 'default') {
                s["var"](alias, "" + dependency);
              } else {
                s["var"](alias, "" + dependency + "." + name);
              }
            }
          }
        }
        s.append.apply(s, _this.lines);
        if (_this.exportDefault) {
          s.line("module.exports = " + _this.exportDefault);
        }
        _ref3 = _this.exports;
        _results = [];
        for (exportName in _ref3) {
          exportValue = _ref3[exportName];
          _results.push(s.line("exports." + exportName + " = " + exportValue));
        }
        return _results;
      });
    }
  }, {}, $__proto, $__super, false);
  return $CJSCompiler;
}(AbstractCompiler);
module.exports = CJSCompiler;


},{"./abstract_compiler":11}],8:[function(require,module,exports){
(function(){"use strict";
var $__superDescriptor = function(proto, name) {
  if (!proto) throw new TypeError('super is null');
  return Object.getPropertyDescriptor(proto, name);
}, $__superCall = function(self, proto, name, args) {
  var descriptor = $__superDescriptor(proto, name);
  if (descriptor) {
    if ('value'in descriptor) return descriptor.value.apply(self, args);
    if (descriptor.get) return descriptor.get.call(self).apply(self, args);
  }
  throw new TypeError("Object has no method '" + name + "'.");
}, $__getProtoParent = function(superClass) {
  if (typeof superClass === 'function') {
    var prototype = superClass.prototype;
    if (Object(prototype) === prototype || prototype === null) return superClass.prototype;
  }
  if (superClass === null) return null;
  throw new TypeError();
}, $__getDescriptors = function(object) {
  var descriptors = {}, name, names = Object.getOwnPropertyNames(object);
  for (var i = 0; i < names.length; i++) {
    var name = names[i];
    descriptors[name] = Object.getOwnPropertyDescriptor(object, name);
  }
  return descriptors;
}, $__createClass = function(object, staticObject, protoParent, superClass, hasConstructor) {
  var ctor = object.constructor;
  if (typeof superClass === 'function') ctor.__proto__ = superClass;
  if (!hasConstructor && protoParent === null) ctor = object.constructor = function() {};
  var descriptors = $__getDescriptors(object);
  descriptors.constructor.enumerable = false;
  ctor.prototype = Object.create(protoParent, descriptors);
  Object.defineProperties(ctor, $__getDescriptors(staticObject));
  return ctor;
};
var AbstractCompiler = require("./abstract_compiler");
var isEmpty = require("./utils").isEmpty;
var __hasProp = {}.hasOwnProperty, __indexOf = [].indexOf || function(item) {
  for (var i = 0, l = this.length; i < l; i++) {
    if (i in this && this[i] === item) return i;
  }
  return - 1;
};
var GlobalsCompiler = function($__super) {
  'use strict';
  var $__proto = $__getProtoParent($__super);
  var $GlobalsCompiler = ($__createClass)({
    constructor: function() {
      $__superCall(this, $__proto, "constructor", arguments);
    },
    stringify: function() {
      var _this = this;
      return this.build(function(s) {
        var alias, args, globalImport, into, locals, name, passedArgs, receivedArgs, wrapper, _i, _len, _ref, _ref1;
        passedArgs = [];
        receivedArgs = [];
        locals = {};
        into = _this.options.into || _this.exportDefault;
        if (!isEmpty(_this.exports) || _this.exportDefault) {
          passedArgs.push(_this.exportDefault ? s.global: into ? "" + s.global + "." + into + " = {}": s.global);
          receivedArgs.push('exports');
        }
        _ref = _this.dependencyNames;
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          name = _ref[_i];
          globalImport = _this.options.imports[name];
          passedArgs.push("" + s.global + "." + globalImport);
          if (name in _this.importDefault) {
            receivedArgs.push(_this.importDefault[name]);
          } else {
            receivedArgs.push(globalImport);
            _ref1 = _this.imports[name];
            for (name in _ref1) {
              if (!__hasProp.call(_ref1, name)) continue;
              alias = _ref1[name];
              locals[alias] = "" + globalImport + "." + name;
            }
          }
        }
        wrapper = function() {
          return s["function"](receivedArgs, function() {
            var exportName, exportValue, lhs, rhs, _ref2, _results;
            s.useStrict();
            for (lhs in locals) {
              if (!__hasProp.call(locals, lhs)) continue;
              rhs = locals[lhs];
              s["var"](lhs, rhs);
            }
            s.append.apply(s, _this.lines);
            if (_this.exportDefault) {
              return s.set("exports." + into, _this.exportDefault);
            } else {
              _ref2 = _this.exports;
              _results = [];
              for (exportName in _ref2) {
                exportValue = _ref2[exportName];
                _results.push(s.set("exports." + exportName, exportValue));
              }
              return _results;
            }
          });
        };
        args = function(arg) {
          var passedArg, _j, _len1, _results;
          _results = [];
          for (_j = 0, _len1 = passedArgs.length; _j < _len1; _j++) {
            passedArg = passedArgs[_j];
            _results.push(arg(passedArg));
          }
          return _results;
        };
        return s.line(function() {
          return s.call(wrapper, args);
        });
      });
    }
  }, {}, $__proto, $__super, false);
  return $GlobalsCompiler;
}(AbstractCompiler);
module.exports = GlobalsCompiler;


})()
},{"./abstract_compiler":11,"./utils":10}],3:[function(require,module,exports){
(function(process){"use strict";
var $__getDescriptors = function(object) {
  var descriptors = {}, name, names = Object.getOwnPropertyNames(object);
  for (var i = 0; i < names.length; i++) {
    var name = names[i];
    descriptors[name] = Object.getOwnPropertyDescriptor(object, name);
  }
  return descriptors;
}, $__createClassNoExtends = function(object, staticObject) {
  var ctor = object.constructor;
  Object.defineProperty(object, 'constructor', {enumerable: false});
  ctor.prototype = object;
  Object.defineProperties(ctor, $__getDescriptors(staticObject));
  return ctor;
};
var optimist = require("optimist");
var fs = require("fs");
var path = require("path");
var Compiler = require("./compiler");
var CLI = function() {
  'use strict';
  var $CLI = ($__createClassNoExtends)({
    constructor: function(stdin, stdout, fs_) {
      this.stdin = stdin != null ? stdin: process.stdin;
      this.stdout = stdout != null ? stdout: process.stdout;
      this.fs = fs_ != null ? fs_: fs;
    },
    start: function(argv) {
      var filename, options, _i, _len, _ref;
      options = this.parseArgs(argv);
      if (options.help) {
        this.argParser(argv).showHelp();
        return;
      }
      if (options.stdio) {
        this.processStdio(options);
      } else {
        _ref = options._;
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          filename = _ref[_i];
          this.processPath(filename, options);
        }
      }
      return null;
    },
    parseArgs: function(argv) {
      var args, global, imports, pair, requirePath, _i, _len, _ref, _ref1;
      args = this.argParser(argv).argv;
      if (args.imports) {
        imports = {};
        _ref = args.imports.split(',');
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          pair = _ref[_i];
          _ref1 = pair.split(':'), requirePath = _ref1[0], global = _ref1[1];
          imports[requirePath] = global;
        }
        args.imports = imports;
      }
      if (args.global) {
        args.into = args.global;
      }
      return args;
    },
    argParser: function(argv) {
      return optimist(argv).usage('compile-modules usage:\n\n  Using files:\n    compile-modules INPUT --to DIR [--anonymous] [--type TYPE] [--imports PATH:GLOBAL]\n\n  Using stdio:\n    compile-modules --stdio [--coffee] [--type TYPE] [--imports PATH:GLOBAL] (--module-name MOD|--anonymous)').options({
        type: {
          "default": 'amd',
          describe: 'The type of output (one of "amd", "cjs", or "globals")'
        },
        to: {describe: 'A directory in which to write the resulting files'},
        imports: {describe: 'A list of path:global pairs, comma separated (e.g. jquery:$,ember:Ember)'},
        anonymous: {
          "default": false,
          type: 'boolean',
          describe: 'Do not include a module name'
        },
        'module-name': {
          describe: 'The name of the outputted module',
          alias: 'm'
        },
        stdio: {
          "default": false,
          type: 'boolean',
          alias: 's',
          describe: 'Use stdin and stdout to process a file'
        },
        coffee: {
          "default": false,
          type: 'boolean',
          describe: 'Process stdin as CoffeeScript (requires --stdio)'
        },
        global: {describe: 'When the type is `globals`, the name of the global to export into'},
        help: {
          "default": false,
          type: 'boolean',
          alias: 'h',
          describe: 'Shows this help message'
        }
      }).check(function(args) {
        var _ref;
        return (_ref = args.type) === 'amd' || _ref === 'cjs' || _ref === 'globals';
      }).check(function(args) {
        return !(args.anonymous && args.m);
      }).check(function(args) {
        if (args.stdio && args.type === 'amd') {
          return args.anonymous || args.m || false;
        } else {
          return true;
        }
      }).check(function(args) {
        return !(args.coffee && !args.stdio);
      }).check(function(args) {
        return args.stdio || args.to || args.help;
      }).check(function(args) {
        if (args.imports) {
          return args.type === 'globals';
        } else {
          return true;
        }
      });
    },
    processStdio: function(options) {
      var input, _this = this;
      input = '';
      this.stdin.resume();
      this.stdin.setEncoding('utf8');
      this.stdin.on('data', function(data) {
        return input += data;
      });
      return this.stdin.on('end', function() {
        var output;
        output = _this._compile(input, options.m, options.type, options);
        return _this.stdout.write(output);
      });
    },
    processPath: function(filename, options) {
      var _this = this;
      return this.fs.stat(filename, function(err, stat) {
        if (err) {
          console.error(err.message);
          return process.exit(1);
        } else if (stat.isDirectory()) {
          return _this.processDirectory(filename, options);
        } else {
          return _this.processFile(filename, options);
        }
      });
    },
    processDirectory: function(dirname, options) {
      var _this = this;
      return this.fs.readdir(dirname, function(err, children) {
        var child, _i, _len, _results;
        if (err) {
          console.error(err.message);
          process.exit(1);
        }
        _results = [];
        for (_i = 0, _len = children.length; _i < _len; _i++) {
          child = children[_i];
          _results.push(_this.processPath(path.join(dirname, child), options));
        }
        return _results;
      });
    },
    processFile: function(filename, options) {
      var _this = this;
      return this.fs.readFile(filename, 'utf8', function(err, input) {
        var ext, moduleName, output, outputFilename;
        ext = path.extname(filename);
        if (!options.anonymous) {
          moduleName = path.join(path.dirname(filename), path.basename(filename, ext)).replace(/[\\]/g, '/');
        }
        output = _this._compile(input, moduleName, options.type, {
          coffee: ext === '.coffee',
          imports: options.imports
        });
        outputFilename = path.join(options.to, filename).replace(/[\\]/g, '/');
        _this._mkdirp(path.dirname(outputFilename));
        return _this.fs.writeFile(outputFilename, output, 'utf8', function(err) {
          if (err) {
            console.error(err.message);
            return process.exit(1);
          }
        });
      });
    },
    _compile: function(input, moduleName, type, options) {
      var compiler, method;
      type = {
        amd: 'AMD',
        cjs: 'CJS',
        globals: 'Globals'
      }[type];
      compiler = new Compiler(input, moduleName, options);
      method = "to" + type;
      return compiler[method]();
    },
    _mkdirp: function(directory) {
      var prefix;
      if (this.fs.existsSync(directory)) {
        return;
      }
      prefix = path.dirname(directory);
      if (prefix !== '.' && prefix !== '/') {
        this._mkdirp(prefix);
      }
      return this.fs.mkdirSync(directory);
    }
  }, {});
  return $CLI;
}();
CLI.start = function(argv, stdin, stdout, fs_) {
  if (stdin == null) {
    stdin = process.stdin;
  }
  if (stdout == null) {
    stdout = process.stdout;
  }
  if (fs_ == null) {
    fs_ = fs;
  }
  return new this(stdin, stdout, fs_).start(argv);
};
module.exports = CLI;


})(require("__browserify_process"))
},{"./compiler":2,"__browserify_process":5,"fs":4,"optimist":12,"path":6}],11:[function(require,module,exports){
"use strict";
var $__getDescriptors = function(object) {
  var descriptors = {}, name, names = Object.getOwnPropertyNames(object);
  for (var i = 0; i < names.length; i++) {
    var name = names[i];
    descriptors[name] = Object.getOwnPropertyDescriptor(object, name);
  }
  return descriptors;
}, $__createClassNoExtends = function(object, staticObject) {
  var ctor = object.constructor;
  Object.defineProperty(object, 'constructor', {enumerable: false});
  ctor.prototype = object;
  Object.defineProperties(ctor, $__getDescriptors(staticObject));
  return ctor;
};
var CompileError = require("./compile_error");
var JavaScriptBuilder = require("./java_script_builder");
var CoffeeScriptBuilder = require("./coffee_script_builder");
var isEmpty = require("./utils").isEmpty;
var __hasProp = {}.hasOwnProperty, __indexOf = [].indexOf || function(item) {
  for (var i = 0, l = this.length; i < l; i++) {
    if (i in this && this[i] === item) return i;
  }
  return - 1;
};
var AbstractCompiler = function() {
  'use strict';
  var $AbstractCompiler = ($__createClassNoExtends)({
    constructor: function(compiler, options) {
      var name, _ref, _ref1;
      this.compiler = compiler;
      this.exports = compiler.exports;
      this.exportDefault = compiler.exportDefault;
      this.imports = compiler.imports;
      this.importDefault = compiler.importDefault;
      this.moduleName = compiler.moduleName;
      this.lines = compiler.lines;
      this.options = options;
      this.dependencyNames = [];
      _ref = this.imports;
      for (name in _ref) {
        if (!__hasProp.call(_ref, name)) continue;
        if (__indexOf.call(this.dependencyNames, name) < 0) {
          this.dependencyNames.push(name);
        }
      }
      _ref1 = this.importDefault;
      for (name in _ref1) {
        if (!__hasProp.call(_ref1, name)) continue;
        if (__indexOf.call(this.dependencyNames, name) < 0) {
          this.dependencyNames.push(name);
        }
      }
      this.assertValid();
    },
    assertValid: function() {
      if (this.exportDefault && !isEmpty(this.exports)) {
        throw new CompileError("You cannot use both `export default` and `export` in the same module");
      }
    },
    buildPreamble: function(names) {
      var args, preamble, _this = this;
      args = [];
      preamble = this.build(function(s) {
        var dependency, deps, name, number, _i, _len, _results;
        number = 0;
        deps = s.unique('dependency');
        _results = [];
        for (_i = 0, _len = names.length; _i < _len; _i++) {
          name = names[_i];
          if (name in _this.importDefault) {
            _results.push(args.push(_this.importDefault[name]));
          } else {
            dependency = deps.next();
            args.push(dependency);
            _results.push(_this.buildImportsForPreamble(s, _this.imports[name], dependency));
          }
        }
        return _results;
      });
      return [args, preamble];
    },
    build: function(fn) {
      var builder;
      if (this.options.coffee) {
        builder = new CoffeeScriptBuilder();
      } else {
        builder = new JavaScriptBuilder();
      }
      fn(builder);
      return builder.toString();
    },
    buildImportsForPreamble: function(builder, imports_, dependencyName) {
      var alias, name, _results;
      _results = [];
      for (name in imports_) {
        if (!__hasProp.call(imports_, name)) continue;
        alias = imports_[name];
        _results.push(builder["var"](alias, function() {
          return builder.prop(dependencyName, name);
        }));
      }
      return _results;
    }
  }, {});
  return $AbstractCompiler;
}();
module.exports = AbstractCompiler;


},{"./coffee_script_builder":15,"./compile_error":13,"./java_script_builder":14,"./utils":10}],13:[function(require,module,exports){
"use strict";
var $__superDescriptor = function(proto, name) {
  if (!proto) throw new TypeError('super is null');
  return Object.getPropertyDescriptor(proto, name);
}, $__superCall = function(self, proto, name, args) {
  var descriptor = $__superDescriptor(proto, name);
  if (descriptor) {
    if ('value'in descriptor) return descriptor.value.apply(self, args);
    if (descriptor.get) return descriptor.get.call(self).apply(self, args);
  }
  throw new TypeError("Object has no method '" + name + "'.");
}, $__getProtoParent = function(superClass) {
  if (typeof superClass === 'function') {
    var prototype = superClass.prototype;
    if (Object(prototype) === prototype || prototype === null) return superClass.prototype;
  }
  if (superClass === null) return null;
  throw new TypeError();
}, $__getDescriptors = function(object) {
  var descriptors = {}, name, names = Object.getOwnPropertyNames(object);
  for (var i = 0; i < names.length; i++) {
    var name = names[i];
    descriptors[name] = Object.getOwnPropertyDescriptor(object, name);
  }
  return descriptors;
}, $__createClass = function(object, staticObject, protoParent, superClass, hasConstructor) {
  var ctor = object.constructor;
  if (typeof superClass === 'function') ctor.__proto__ = superClass;
  if (!hasConstructor && protoParent === null) ctor = object.constructor = function() {};
  var descriptors = $__getDescriptors(object);
  descriptors.constructor.enumerable = false;
  ctor.prototype = Object.create(protoParent, descriptors);
  Object.defineProperties(ctor, $__getDescriptors(staticObject));
  return ctor;
};
var CompileError = function($__super) {
  'use strict';
  var $__proto = $__getProtoParent($__super);
  var $CompileError = ($__createClass)({constructor: function() {
      $__superCall(this, $__proto, "constructor", arguments);
    }}, {}, $__proto, $__super, false);
  return $CompileError;
}(Error);
module.exports = CompileError;


},{}],12:[function(require,module,exports){
(function(process){var path = require('path');
var wordwrap = require('wordwrap');

/*  Hack an instance of Argv with process.argv into Argv
    so people can do
        require('optimist')(['--beeble=1','-z','zizzle']).argv
    to parse a list of args and
        require('optimist').argv
    to get a parsed version of process.argv.
*/

var inst = Argv(process.argv.slice(2));
Object.keys(inst).forEach(function (key) {
    Argv[key] = typeof inst[key] == 'function'
        ? inst[key].bind(inst)
        : inst[key];
});

var exports = module.exports = Argv;
function Argv (args, cwd) {
    var self = {};
    if (!cwd) cwd = process.cwd();
    
    self.$0 = process.argv
        .slice(0,2)
        .map(function (x) {
            var b = rebase(cwd, x);
            return x.match(/^\//) && b.length < x.length
                ? b : x
        })
        .join(' ')
    ;
    
    if (process.env._ != undefined && process.argv[1] == process.env._) {
        self.$0 = process.env._.replace(
            path.dirname(process.execPath) + '/', ''
        );
    }
    
    var flags = { bools : {}, strings : {} };
    
    self.boolean = function (bools) {
        if (!Array.isArray(bools)) {
            bools = [].slice.call(arguments);
        }
        
        bools.forEach(function (name) {
            flags.bools[name] = true;
        });
        
        return self;
    };
    
    self.string = function (strings) {
        if (!Array.isArray(strings)) {
            strings = [].slice.call(arguments);
        }
        
        strings.forEach(function (name) {
            flags.strings[name] = true;
        });
        
        return self;
    };
    
    var aliases = {};
    self.alias = function (x, y) {
        if (typeof x === 'object') {
            Object.keys(x).forEach(function (key) {
                self.alias(key, x[key]);
            });
        }
        else if (Array.isArray(y)) {
            y.forEach(function (yy) {
                self.alias(x, yy);
            });
        }
        else {
            var zs = (aliases[x] || []).concat(aliases[y] || []).concat(x, y);
            aliases[x] = zs.filter(function (z) { return z != x });
            aliases[y] = zs.filter(function (z) { return z != y });
        }
        
        return self;
    };
    
    var demanded = {};
    self.demand = function (keys) {
        if (typeof keys == 'number') {
            if (!demanded._) demanded._ = 0;
            demanded._ += keys;
        }
        else if (Array.isArray(keys)) {
            keys.forEach(function (key) {
                self.demand(key);
            });
        }
        else {
            demanded[keys] = true;
        }
        
        return self;
    };
    
    var usage;
    self.usage = function (msg, opts) {
        if (!opts && typeof msg === 'object') {
            opts = msg;
            msg = null;
        }
        
        usage = msg;
        
        if (opts) self.options(opts);
        
        return self;
    };
    
    function fail (msg) {
        self.showHelp();
        if (msg) console.error(msg);
        process.exit(1);
    }
    
    var checks = [];
    self.check = function (f) {
        checks.push(f);
        return self;
    };
    
    var defaults = {};
    self.default = function (key, value) {
        if (typeof key === 'object') {
            Object.keys(key).forEach(function (k) {
                self.default(k, key[k]);
            });
        }
        else {
            defaults[key] = value;
        }
        
        return self;
    };
    
    var descriptions = {};
    self.describe = function (key, desc) {
        if (typeof key === 'object') {
            Object.keys(key).forEach(function (k) {
                self.describe(k, key[k]);
            });
        }
        else {
            descriptions[key] = desc;
        }
        return self;
    };
    
    self.parse = function (args) {
        return Argv(args).argv;
    };
    
    self.option = self.options = function (key, opt) {
        if (typeof key === 'object') {
            Object.keys(key).forEach(function (k) {
                self.options(k, key[k]);
            });
        }
        else {
            if (opt.alias) self.alias(key, opt.alias);
            if (opt.demand) self.demand(key);
            if (typeof opt.default !== 'undefined') {
                self.default(key, opt.default);
            }
            
            if (opt.boolean || opt.type === 'boolean') {
                self.boolean(key);
            }
            if (opt.string || opt.type === 'string') {
                self.string(key);
            }
            
            var desc = opt.describe || opt.description || opt.desc;
            if (desc) {
                self.describe(key, desc);
            }
        }
        
        return self;
    };
    
    var wrap = null;
    self.wrap = function (cols) {
        wrap = cols;
        return self;
    };
    
    self.showHelp = function (fn) {
        if (!fn) fn = console.error;
        fn(self.help());
    };
    
    self.help = function () {
        var keys = Object.keys(
            Object.keys(descriptions)
            .concat(Object.keys(demanded))
            .concat(Object.keys(defaults))
            .reduce(function (acc, key) {
                if (key !== '_') acc[key] = true;
                return acc;
            }, {})
        );
        
        var help = keys.length ? [ 'Options:' ] : [];
        
        if (usage) {
            help.unshift(usage.replace(/\$0/g, self.$0), '');
        }
        
        var switches = keys.reduce(function (acc, key) {
            acc[key] = [ key ].concat(aliases[key] || [])
                .map(function (sw) {
                    return (sw.length > 1 ? '--' : '-') + sw
                })
                .join(', ')
            ;
            return acc;
        }, {});
        
        var switchlen = longest(Object.keys(switches).map(function (s) {
            return switches[s] || '';
        }));
        
        var desclen = longest(Object.keys(descriptions).map(function (d) { 
            return descriptions[d] || '';
        }));
        
        keys.forEach(function (key) {
            var kswitch = switches[key];
            var desc = descriptions[key] || '';
            
            if (wrap) {
                desc = wordwrap(switchlen + 4, wrap)(desc)
                    .slice(switchlen + 4)
                ;
            }
            
            var spadding = new Array(
                Math.max(switchlen - kswitch.length + 3, 0)
            ).join(' ');
            
            var dpadding = new Array(
                Math.max(desclen - desc.length + 1, 0)
            ).join(' ');
            
            var type = null;
            
            if (flags.bools[key]) type = '[boolean]';
            if (flags.strings[key]) type = '[string]';
            
            if (!wrap && dpadding.length > 0) {
                desc += dpadding;
            }
            
            var prelude = '  ' + kswitch + spadding;
            var extra = [
                type,
                demanded[key]
                    ? '[required]'
                    : null
                ,
                defaults[key] !== undefined
                    ? '[default: ' + JSON.stringify(defaults[key]) + ']'
                    : null
                ,
            ].filter(Boolean).join('  ');
            
            var body = [ desc, extra ].filter(Boolean).join('  ');
            
            if (wrap) {
                var dlines = desc.split('\n');
                var dlen = dlines.slice(-1)[0].length
                    + (dlines.length === 1 ? prelude.length : 0)
                
                body = desc + (dlen + extra.length > wrap - 2
                    ? '\n'
                        + new Array(wrap - extra.length + 1).join(' ')
                        + extra
                    : new Array(wrap - extra.length - dlen + 1).join(' ')
                        + extra
                );
            }
            
            help.push(prelude + body);
        });
        
        help.push('');
        return help.join('\n');
    };
    
    Object.defineProperty(self, 'argv', {
        get : parseArgs,
        enumerable : true,
    });
    
    function parseArgs () {
        var argv = { _ : [], $0 : self.$0 };
        Object.keys(flags.bools).forEach(function (key) {
            setArg(key, defaults[key] || false);
        });
        
        function setArg (key, val) {
            var num = Number(val);
            var value = typeof val !== 'string' || isNaN(num) ? val : num;
            if (flags.strings[key]) value = val;
            
            setKey(argv, key.split('.'), value);
            
            (aliases[key] || []).forEach(function (x) {
                argv[x] = argv[key];
            });
        }
        
        for (var i = 0; i < args.length; i++) {
            var arg = args[i];
            
            if (arg === '--') {
                argv._.push.apply(argv._, args.slice(i + 1));
                break;
            }
            else if (arg.match(/^--.+=/)) {
                // Using [\s\S] instead of . because js doesn't support the
                // 'dotall' regex modifier. See:
                // http://stackoverflow.com/a/1068308/13216
                var m = arg.match(/^--([^=]+)=([\s\S]*)$/);
                setArg(m[1], m[2]);
            }
            else if (arg.match(/^--no-.+/)) {
                var key = arg.match(/^--no-(.+)/)[1];
                setArg(key, false);
            }
            else if (arg.match(/^--.+/)) {
                var key = arg.match(/^--(.+)/)[1];
                var next = args[i + 1];
                if (next !== undefined && !next.match(/^-/)
                && !flags.bools[key]
                && (aliases[key] ? !flags.bools[aliases[key]] : true)) {
                    setArg(key, next);
                    i++;
                }
                else if (/^(true|false)$/.test(next)) {
                    setArg(key, next === 'true');
                    i++;
                }
                else {
                    setArg(key, true);
                }
            }
            else if (arg.match(/^-[^-]+/)) {
                var letters = arg.slice(1,-1).split('');
                
                var broken = false;
                for (var j = 0; j < letters.length; j++) {
                    if (letters[j+1] && letters[j+1].match(/\W/)) {
                        setArg(letters[j], arg.slice(j+2));
                        broken = true;
                        break;
                    }
                    else {
                        setArg(letters[j], true);
                    }
                }
                
                if (!broken) {
                    var key = arg.slice(-1)[0];
                    
                    if (args[i+1] && !args[i+1].match(/^-/)
                    && !flags.bools[key]
                    && (aliases[key] ? !flags.bools[aliases[key]] : true)) {
                        setArg(key, args[i+1]);
                        i++;
                    }
                    else if (args[i+1] && /true|false/.test(args[i+1])) {
                        setArg(key, args[i+1] === 'true');
                        i++;
                    }
                    else {
                        setArg(key, true);
                    }
                }
            }
            else {
                var n = Number(arg);
                argv._.push(flags.strings['_'] || isNaN(n) ? arg : n);
            }
        }
        
        Object.keys(defaults).forEach(function (key) {
            if (!(key in argv)) {
                argv[key] = defaults[key];
                if (key in aliases) {
                    argv[aliases[key]] = defaults[key];
                }
            }
        });
        
        if (demanded._ && argv._.length < demanded._) {
            fail('Not enough non-option arguments: got '
                + argv._.length + ', need at least ' + demanded._
            );
        }
        
        var missing = [];
        Object.keys(demanded).forEach(function (key) {
            if (!argv[key]) missing.push(key);
        });
        
        if (missing.length) {
            fail('Missing required arguments: ' + missing.join(', '));
        }
        
        checks.forEach(function (f) {
            try {
                if (f(argv) === false) {
                    fail('Argument check failed: ' + f.toString());
                }
            }
            catch (err) {
                fail(err)
            }
        });
        
        return argv;
    }
    
    function longest (xs) {
        return Math.max.apply(
            null,
            xs.map(function (x) { return x.length })
        );
    }
    
    return self;
};

// rebase an absolute path to a relative one with respect to a base directory
// exported for tests
exports.rebase = rebase;
function rebase (base, dir) {
    var ds = path.normalize(dir).split('/').slice(1);
    var bs = path.normalize(base).split('/').slice(1);
    
    for (var i = 0; ds[i] && ds[i] == bs[i]; i++);
    ds.splice(0, i); bs.splice(0, i);
    
    var p = path.normalize(
        bs.map(function () { return '..' }).concat(ds).join('/')
    ).replace(/\/$/,'').replace(/^$/, '.');
    return p.match(/^[.\/]/) ? p : './' + p;
};

function setKey (obj, keys, value) {
    var o = obj;
    keys.slice(0,-1).forEach(function (key) {
        if (o[key] === undefined) o[key] = {};
        o = o[key];
    });
    
    var key = keys[keys.length - 1];
    if (o[key] === undefined || typeof o[key] === 'boolean') {
        o[key] = value;
    }
    else if (Array.isArray(o[key])) {
        o[key].push(value);
    }
    else {
        o[key] = [ o[key], value ];
    }
}

})(require("__browserify_process"))
},{"__browserify_process":5,"path":6,"wordwrap":16}],16:[function(require,module,exports){
var wordwrap = module.exports = function (start, stop, params) {
    if (typeof start === 'object') {
        params = start;
        start = params.start;
        stop = params.stop;
    }
    
    if (typeof stop === 'object') {
        params = stop;
        start = start || params.start;
        stop = undefined;
    }
    
    if (!stop) {
        stop = start;
        start = 0;
    }
    
    if (!params) params = {};
    var mode = params.mode || 'soft';
    var re = mode === 'hard' ? /\b/ : /(\S+\s+)/;
    
    return function (text) {
        var chunks = text.toString()
            .split(re)
            .reduce(function (acc, x) {
                if (mode === 'hard') {
                    for (var i = 0; i < x.length; i += stop - start) {
                        acc.push(x.slice(i, i + stop - start));
                    }
                }
                else acc.push(x)
                return acc;
            }, [])
        ;
        
        return chunks.reduce(function (lines, rawChunk) {
            if (rawChunk === '') return lines;
            
            var chunk = rawChunk.replace(/\t/g, '    ');
            
            var i = lines.length - 1;
            if (lines[i].length + chunk.length > stop) {
                lines[i] = lines[i].replace(/\s+$/, '');
                
                chunk.split(/\n/).forEach(function (c) {
                    lines.push(
                        new Array(start + 1).join(' ')
                        + c.replace(/^\s+/, '')
                    );
                });
            }
            else if (chunk.match(/\n/)) {
                var xs = chunk.split(/\n/);
                lines[i] += xs.shift();
                xs.forEach(function (c) {
                    lines.push(
                        new Array(start + 1).join(' ')
                        + c.replace(/^\s+/, '')
                    );
                });
            }
            else {
                lines[i] += chunk;
            }
            
            return lines;
        }, [ new Array(start + 1).join(' ') ]).join('\n');
    };
};

wordwrap.soft = wordwrap;

wordwrap.hard = function (start, stop) {
    return wordwrap(start, stop, { mode : 'hard' });
};

},{}],14:[function(require,module,exports){
"use strict";
var $__superDescriptor = function(proto, name) {
  if (!proto) throw new TypeError('super is null');
  return Object.getPropertyDescriptor(proto, name);
}, $__superCall = function(self, proto, name, args) {
  var descriptor = $__superDescriptor(proto, name);
  if (descriptor) {
    if ('value'in descriptor) return descriptor.value.apply(self, args);
    if (descriptor.get) return descriptor.get.call(self).apply(self, args);
  }
  throw new TypeError("Object has no method '" + name + "'.");
}, $__getProtoParent = function(superClass) {
  if (typeof superClass === 'function') {
    var prototype = superClass.prototype;
    if (Object(prototype) === prototype || prototype === null) return superClass.prototype;
  }
  if (superClass === null) return null;
  throw new TypeError();
}, $__getDescriptors = function(object) {
  var descriptors = {}, name, names = Object.getOwnPropertyNames(object);
  for (var i = 0; i < names.length; i++) {
    var name = names[i];
    descriptors[name] = Object.getOwnPropertyDescriptor(object, name);
  }
  return descriptors;
}, $__createClass = function(object, staticObject, protoParent, superClass, hasConstructor) {
  var ctor = object.constructor;
  if (typeof superClass === 'function') ctor.__proto__ = superClass;
  if (!hasConstructor && protoParent === null) ctor = object.constructor = function() {};
  var descriptors = $__getDescriptors(object);
  descriptors.constructor.enumerable = false;
  ctor.prototype = Object.create(protoParent, descriptors);
  Object.defineProperties(ctor, $__getDescriptors(staticObject));
  return ctor;
};
var ScriptBuilder = require("./script_builder");
var JavaScriptBuilder = function($__super) {
  'use strict';
  var $__proto = $__getProtoParent($__super);
  var $JavaScriptBuilder = ($__createClass)({
    constructor: function() {
      $__superCall(this, $__proto, "constructor", []);
      this.eol = ';';
      this['var'] = (function(lhs, rhs) {
        return this.line('var ' + this.capture(lhs) + ' = ' + this.capture(rhs));
      }).bind(this);
    },
    _functionHeader: function(args) {
      return "function(" + (args.join(', ')) + ") {";
    },
    _functionTail: function() {
      return '}';
    }
  }, {}, $__proto, $__super, true);
  return $JavaScriptBuilder;
}(ScriptBuilder);
module.exports = JavaScriptBuilder;


},{"./script_builder":17}],15:[function(require,module,exports){
"use strict";
var $__superDescriptor = function(proto, name) {
  if (!proto) throw new TypeError('super is null');
  return Object.getPropertyDescriptor(proto, name);
}, $__superCall = function(self, proto, name, args) {
  var descriptor = $__superDescriptor(proto, name);
  if (descriptor) {
    if ('value'in descriptor) return descriptor.value.apply(self, args);
    if (descriptor.get) return descriptor.get.call(self).apply(self, args);
  }
  throw new TypeError("Object has no method '" + name + "'.");
}, $__getProtoParent = function(superClass) {
  if (typeof superClass === 'function') {
    var prototype = superClass.prototype;
    if (Object(prototype) === prototype || prototype === null) return superClass.prototype;
  }
  if (superClass === null) return null;
  throw new TypeError();
}, $__getDescriptors = function(object) {
  var descriptors = {}, name, names = Object.getOwnPropertyNames(object);
  for (var i = 0; i < names.length; i++) {
    var name = names[i];
    descriptors[name] = Object.getOwnPropertyDescriptor(object, name);
  }
  return descriptors;
}, $__createClass = function(object, staticObject, protoParent, superClass, hasConstructor) {
  var ctor = object.constructor;
  if (typeof superClass === 'function') ctor.__proto__ = superClass;
  if (!hasConstructor && protoParent === null) ctor = object.constructor = function() {};
  var descriptors = $__getDescriptors(object);
  descriptors.constructor.enumerable = false;
  ctor.prototype = Object.create(protoParent, descriptors);
  Object.defineProperties(ctor, $__getDescriptors(staticObject));
  return ctor;
}, $__toObject = function(value) {
  if (value == null) throw TypeError();
  return Object(value);
}, $__spread = function() {
  var rv = [], k = 0;
  for (var i = 0; i < arguments.length; i++) {
    var value = $__toObject(arguments[i]);
    for (var j = 0; j < value.length; j++) {
      rv[k++] = value[j];
    }
  }
  return rv;
};
var ScriptBuilder = require("./script_builder");
var CoffeeScriptBuilder = function($__super) {
  'use strict';
  var $__proto = $__getProtoParent($__super);
  var $CoffeeScriptBuilder = ($__createClass)({
    constructor: function() {
      $__superCall(this, $__proto, "constructor", []);
      this.eol = '';
      this['var'] = (function(lhs, rhs) {
        return this.set(lhs, rhs);
      }).bind(this);
    },
    _prepareArgsForCall: function(args) {
      var arg, _i, _len;
      args = $__superCall(this, $__proto, "_prepareArgsForCall", $__spread(args)).slice();
      for (_i = 0, _len = args.length; _i < _len; _i++) {
        arg = args[_i];
        if (arg === this["break"]) {
          if (args[args.length - 1] !== this["break"]) {
            args.push(this["break"]);
          }
          break;
        }
      }
      return args;
    },
    _functionHeader: function(args) {
      if (args.length) {
        return "(" + (args.join(', ')) + ") ->";
      } else {
        return '->';
      }
    }
  }, {}, $__proto, $__super, true);
  return $CoffeeScriptBuilder;
}(ScriptBuilder);
module.exports = CoffeeScriptBuilder;


},{"./script_builder":17}],17:[function(require,module,exports){
(function(){"use strict";
var $__getDescriptors = function(object) {
  var descriptors = {}, name, names = Object.getOwnPropertyNames(object);
  for (var i = 0; i < names.length; i++) {
    var name = names[i];
    descriptors[name] = Object.getOwnPropertyDescriptor(object, name);
  }
  return descriptors;
}, $__createClassNoExtends = function(object, staticObject) {
  var ctor = object.constructor;
  Object.defineProperty(object, 'constructor', {enumerable: false});
  ctor.prototype = object;
  Object.defineProperties(ctor, $__getDescriptors(staticObject));
  return ctor;
}, $__toObject = function(value) {
  if (value == null) throw TypeError();
  return Object(value);
};
var $__2;
var Unique = require("./utils").Unique;
var BREAK, INDENT, OUTDENT, ScriptBuilder, __slice = [].slice;
INDENT = {indent: true};
OUTDENT = {outdent: true};
BREAK = {"break": true};
var ScriptBuilder = function() {
  'use strict';
  var $ScriptBuilder = ($__createClassNoExtends)({
    constructor: function() {
      this.buffer = [];
      this['break'] = BREAK;
      this.global = 'window';
      this['function'] = function(args, body) {
        this.append(this._functionHeader(args));
        this.indent();
        body();
        this.outdent();
        if (this._functionTail != null) {
          this.append(this._functionTail());
        }
      };
    },
    useStrict: function() {
      this.line('"use strict"');
    },
    set: function(lhs, rhs) {
      this.line("" + (this.capture(lhs)) + " = " + (this.capture(rhs)));
    },
    call: function(fn, args) {
      var arg, end, i, indented, result, _i, _len;
      fn = this._wrapCallable(fn);
      args = this._prepareArgsForCall(args);
      end = args.length - 1;
      while (args[end] === BREAK) {
        end--;
      }
      result = "" + fn + "(";
      indented = false;
      for (i = _i = 0, _len = args.length; _i < _len; i = ++_i) {
        arg = args[i];
        if (arg === BREAK) {
          this.append(result);
          if (!indented) {
            indented = true;
            this.indent();
          }
          result = '';
        } else {
          result += arg;
          if (i < end) {
            result += ',';
            if (args[i + 1] !== BREAK) {
              result += ' ';
            }
          }
        }
      }
      result += ')';
      this.append(result);
      if (indented) {
        return this.outdent();
      }
    },
    _prepareArgsForCall: function(args) {
      var result, _this = this;
      if (typeof args === 'function') {
        result = [];
        args(function(arg) {
          return result.push(_this.capture(arg));
        });
        args = result;
      }
      return args;
    },
    _wrapCallable: function(fn) {
      var functionCalled, functionImpl, result, _this = this;
      if (typeof fn !== 'function') {
        return fn;
      }
      functionImpl = this["function"];
      functionCalled = false;
      this["function"] = function() {
        var args;
        args = 1 <= arguments.length ? __slice.call(arguments, 0): [];
        functionCalled = true;
        return functionImpl.call.apply(functionImpl, [_this].concat(__slice.call(args)));
      };
      result = this.capture(fn);
      this["function"] = functionImpl;
      if (functionCalled) {
        result = "(" + result + (this._functionTail != null ? '': '\n') + ")";
      }
      return result;
    },
    print: function(value) {
      return JSON.stringify(this.capture(value));
    },
    prop: function(object, prop) {
      this.append("" + (this.capture(object)) + "." + (this.capture(prop)));
    },
    unique: function(prefix) {
      return new Unique(prefix);
    },
    line: function(code) {
      this.append(this.capture(code) + this.eol);
    },
    append: function() {
      for (var code = [], $__1 = 0; $__1 < arguments.length; $__1++) code[$__1] = arguments[$__1];
      ($__2 = this.buffer).push.apply($__2, $__toObject(code));
    },
    indent: function() {
      this.buffer.push(INDENT);
    },
    outdent: function() {
      this.buffer.push(OUTDENT);
    },
    capture: function(fn) {
      var buffer, result;
      if (typeof fn !== 'function') {
        return fn;
      }
      buffer = this.buffer;
      this.buffer = [];
      fn();
      result = this.toString();
      this.buffer = buffer;
      return result;
    },
    toString: function() {
      var chunk, indent, line, result, _i, _j, _len, _len1, _ref, _ref1;
      indent = 0;
      result = [];
      _ref = this.buffer;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        chunk = _ref[_i];
        if (chunk === INDENT) {
          indent++;
        } else if (chunk === OUTDENT) {
          indent--;
        } else {
          _ref1 = chunk.split('\n');
          for (_j = 0, _len1 = _ref1.length; _j < _len1; _j++) {
            line = _ref1[_j];
            if (/^\s*$/.test(line)) {
              result.push(line);
            } else {
              result.push((new Array(indent + 1)).join('  ') + line);
            }
          }
        }
      }
      return result.join('\n');
    }
  }, {});
  return $ScriptBuilder;
}();
module.exports = ScriptBuilder;


})()
},{"./utils":10}]},{},[1])(1)
});
;