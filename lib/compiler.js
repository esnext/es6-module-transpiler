(function() {
  "use strict";

  var AMDCompiler, CJSCompiler, COMMENT_CS_TOGGLE, COMMENT_END, COMMENT_START, Compiler, EXPORT, EXPORT_DEFAULT, EXPORT_FUNCTION, EXPORT_VAR, GlobalsCompiler, IMPORT, IMPORT_AS, RE_EXPORT, Unique, getNames;

  AMDCompiler = require("./amd_compiler");

  CJSCompiler = require("./cjs_compiler");

  GlobalsCompiler = require("./globals_compiler");

  Unique = require("./utils").Unique;

  EXPORT = /^\s*export\s+(.*?)\s*(;)?\s*$/;

  EXPORT_DEFAULT = /^\s*export\s*default\s*(.*?)\s*(;)?\s*$/;

  EXPORT_FUNCTION = /^\s*export\s+function\s+(\w+)\s*(\(.*)$/;

  EXPORT_VAR = /^\s*export\s+var\s+(\w+)\s*=\s*(.*)$/;

  IMPORT = /^\s*import\s+(.*)\s+from\s+(?:"([^"]+?)"|'([^']+?)')\s*(;)?\s*$/;

  IMPORT_AS = /^\s*(.*)\s+as\s+(.*)\s*$/;

  RE_EXPORT = /^export\s+({.*})\s+from\s+(?:"([^"]+?)"|'([^']+?)')\s*(;)?\s*$/;

  COMMENT_START = new RegExp("/\\*");

  COMMENT_END = new RegExp("\\*/");

  COMMENT_CS_TOGGLE = /^###/;

  getNames = function(string) {
    var name, _i, _len, _ref, _results;
    if (string[0] === '{' && string[string.length - 1] === '}') {
      _ref = string.slice(1, -1).split(',');
      _results = [];
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        name = _ref[_i];
        _results.push(name.trim());
      }
      return _results;
    } else {
      return [string.trim()];
    }
  };

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
      if (!this.inBlockComment) {
        if (match = this.matchLine(line, EXPORT_DEFAULT)) {
          return this.processExportDefault(match);
        } else if (match = this.matchLine(line, EXPORT_FUNCTION)) {
          return this.processExportFunction(match);
        } else if (match = this.matchLine(line, EXPORT_VAR)) {
          return this.processExportVar(match);
        } else if (match = this.matchLine(line, RE_EXPORT)) {
          return this.processReexport(match);
        } else if (match = this.matchLine(line, EXPORT)) {
          return this.processExport(match);
        } else if (match = this.matchLine(line, IMPORT)) {
          return this.processImport(match);
        } else if (match = this.matchLine(line, this.commentStart)) {
          return this.processEnterComment(line);
        } else {
          return this.processLine(line);
        }
      } else {
        if (match = this.matchLine(line, this.commentEnd)) {
          return this.processExitComment(line);
        } else {
          return this.processLine(line);
        }
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

    Compiler.prototype.processExportDefault = function(match) {
      return this.exportDefault = match[1];
    };

    Compiler.prototype.processExport = function(match) {
      var ex, _i, _len, _ref, _results;
      _ref = getNames(match[1]);
      _results = [];
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        ex = _ref[_i];
        _results.push(this.exports[ex] = ex);
      }
      return _results;
    };

    Compiler.prototype.processExportFunction = function(match) {
      var body, name;
      name = match[1];
      body = match[2];
      this.lines.push("function " + name + body);
      return this.exports[name] = name;
    };

    Compiler.prototype.processExportVar = function(match) {
      var name, value;
      name = match[1];
      value = match[2];
      this.lines.push("var " + name + " = " + value);
      return this.exports[name] = name;
    };

    Compiler.prototype.processImport = function(match) {
      var asMatch, importSpecifiers, imports, name, pattern, _i, _len;
      pattern = match[1];
      if (pattern[0] === '{' && pattern[pattern.length - 1] === '}') {
        pattern = pattern.slice(1, -1);
        importSpecifiers = (function() {
          var _i, _len, _ref, _results;
          _ref = pattern.split(/\s*,\s*/);
          _results = [];
          for (_i = 0, _len = _ref.length; _i < _len; _i++) {
            name = _ref[_i];
            _results.push(name.trim());
          }
          return _results;
        })();
        imports = {};
        for (_i = 0, _len = importSpecifiers.length; _i < _len; _i++) {
          name = importSpecifiers[_i];
          if (asMatch = name.match(IMPORT_AS)) {
            imports[asMatch[1]] = asMatch[2];
          } else {
            imports[name] = name;
          }
        }
        return this.imports[match[2] || match[3]] = imports;
      } else {
        return this.importDefault[match[2] || match[3]] = match[1];
      }
    };

    Compiler.prototype.processReexport = function(match) {
      var importLocal, importPath, name, names, _i, _len, _results;
      names = getNames(match[1]);
      importPath = match[2] || match[3];
      importLocal = this.reExportUnique.next();
      this.importDefault[importPath] = importLocal;
      _results = [];
      for (_i = 0, _len = names.length; _i < _len; _i++) {
        name = names[_i];
        _results.push(this.exports[name] = "" + importLocal + "." + name);
      }
      return _results;
    };

    Compiler.prototype.processLine = function(line) {
      return this.lines.push(line);
    };

    Compiler.prototype.processEnterComment = function(line) {
      if (!this.matchLine(line, COMMENT_END)) {
        this.inBlockComment = true;
      }
      return this.lines.push(line);
    };

    Compiler.prototype.processExitComment = function(line) {
      this.inBlockComment = false;
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
