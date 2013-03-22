(function() {
  "use strict";

  var AbstractCompiler, CoffeeScriptBuilder, CompileError, JavaScriptBuilder, isEmpty,
    __hasProp = {}.hasOwnProperty,
    __indexOf = [].indexOf || function(item) { for (var i = 0, l = this.length; i < l; i++) { if (i in this && this[i] === item) return i; } return -1; };

  CompileError = require("./compile_error");

  JavaScriptBuilder = require("./java_script_builder");

  CoffeeScriptBuilder = require("./coffee_script_builder");

  isEmpty = require("./utils").isEmpty;

  AbstractCompiler = (function() {

    function AbstractCompiler(compiler, options) {
      var name, _ref, _ref1;
      this.compiler = compiler;
      this.exports = compiler.exports;
      this.exportAs = compiler.exportAs;
      this.imports = compiler.imports;
      this.importAs = compiler.importAs;
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
      _ref1 = this.importAs;
      for (name in _ref1) {
        if (!__hasProp.call(_ref1, name)) continue;
        if (__indexOf.call(this.dependencyNames, name) < 0) {
          this.dependencyNames.push(name);
        }
      }
      this.assertValid();
    }

    AbstractCompiler.prototype.assertValid = function() {
      if (this.exportAs && !isEmpty(this.exports)) {
        throw new CompileError("You cannot use both `export =` and `export` in the same module");
      }
    };

    AbstractCompiler.prototype.buildPreamble = function(names) {
      var args, preamble,
        _this = this;
      args = [];
      preamble = this.build(function(s) {
        var dependency, deps, name, number, _i, _len, _results;
        number = 0;
        deps = s.unique('dependency');
        _results = [];
        for (_i = 0, _len = names.length; _i < _len; _i++) {
          name = names[_i];
          if (name in _this.importAs) {
            _results.push(args.push(_this.importAs[name]));
          } else {
            dependency = deps.next();
            args.push(dependency);
            _results.push(_this.buildImportsForPreamble(s, _this.imports[name], dependency));
          }
        }
        return _results;
      });
      return [args, preamble];
    };

    AbstractCompiler.prototype.build = function(fn) {
      var builder;
      if (this.options.coffee) {
        builder = new CoffeeScriptBuilder();
      } else {
        builder = new JavaScriptBuilder();
      }
      fn(builder);
      return builder.toString();
    };

    AbstractCompiler.prototype.buildImportsForPreamble = function(builder, imports_, dependencyName) {
      var import_, _i, _len, _results;
      _results = [];
      for (_i = 0, _len = imports_.length; _i < _len; _i++) {
        import_ = imports_[_i];
        _results.push(builder["var"](import_, function() {
          return builder.prop(dependencyName, import_);
        }));
      }
      return _results;
    };

    return AbstractCompiler;

  })();

  module.exports = AbstractCompiler;

}).call(this);
