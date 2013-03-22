(function() {
  "use strict";

  var AMDCompiler, CJSCompiler, Compiler, EXPORT, EXPORT_AS, EXPORT_FUNCTION, GlobalsCompiler, IMPORT, IMPORT_AS;

  AMDCompiler = require("./amd_compiler");

  CJSCompiler = require("./cjs_compiler");

  GlobalsCompiler = require("./globals_compiler");

  EXPORT = /^\s*export\s+(.*?)\s*(;)?\s*$/;

  EXPORT_AS = /^\s*export\s*=\s*(.*?)\s*(;)?\s*$/;

  EXPORT_FUNCTION = /^\s*export\s+function\s+(\w+)\s*(\(.*)$/;

  IMPORT = /^\s*import\s+(.*)\s+from\s+(?:"([^"]+?)"|'([^']+?)')\s*(;)?\s*$/;

  IMPORT_AS = /^\s*import\s+(?:"([^"]+?)"|'([^']+?)')\s*as\s+(.*?)\s*(;)?\s*$/;

  Compiler = (function() {

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
      this.importAs = {};
      this.exports = {};
      this.exportAs = null;
      this.lines = [];
      this.id = 0;
      this.parse();
    }

    Compiler.prototype.parse = function() {
      var line, _i, _len, _ref;
      _ref = this.string.split('\n');
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        line = _ref[_i];
        this.parseLine(line);
      }
      return null;
    };

    Compiler.prototype.parseLine = function(line) {
      var match;
      if (match = this.matchLine(line, EXPORT_AS)) {
        return this.processExportAs(match);
      } else if (match = this.matchLine(line, EXPORT_FUNCTION)) {
        return this.processExportFunction(match);
      } else if (match = this.matchLine(line, EXPORT)) {
        return this.processExport(match);
      } else if (match = this.matchLine(line, IMPORT_AS)) {
        return this.processImportAs(match);
      } else if (match = this.matchLine(line, IMPORT)) {
        return this.processImport(match);
      } else {
        return this.processLine(line);
      }
    };

    Compiler.prototype.matchLine = function(line, pattern) {
      var match;
      match = line.match(pattern);
      if (match && !this.options.coffee && !match[match.length - 1]) {
        return null;
      }
      return match;
    };

    Compiler.prototype.processExportAs = function(match) {
      return this.exportAs = match[1];
    };

    Compiler.prototype.processExport = function(match) {
      var ex, exports, _i, _len, _ref, _results;
      exports = match[1];
      if (exports[0] === '{' && exports[exports.length - 1] === '}') {
        exports = exports.slice(1, -1);
      }
      _ref = exports.split(/\s*,\s*/);
      _results = [];
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        ex = _ref[_i];
        ex = ex.trim();
        _results.push(this.exports[ex] = ex);
      }
      return _results;
    };

    Compiler.prototype.processExportFunction = function(match) {
      var body, id, name;
      name = match[1];
      body = match[2];
      id = "__export" + (++this.id) + "__";
      this.lines.push("var " + id + " = function " + name + body);
      return this.exports[name] = id;
    };

    Compiler.prototype.processImportAs = function(match) {
      return this.importAs[match[1] || match[2]] = match[3];
    };

    Compiler.prototype.processImport = function(match) {
      var importNames, name, pattern;
      pattern = match[1];
      if (pattern[0] === '{' && pattern[pattern.length - 1] === '}') {
        pattern = pattern.slice(1, -1);
      }
      importNames = (function() {
        var _i, _len, _ref, _results;
        _ref = pattern.split(/\s*,\s*/);
        _results = [];
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          name = _ref[_i];
          _results.push(name.trim());
        }
        return _results;
      })();
      return this.imports[match[2] || match[3]] = importNames;
    };

    Compiler.prototype.processLine = function(line) {
      return this.lines.push(line);
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

    return Compiler;

  })();

  module.exports = Compiler;

}).call(this);
