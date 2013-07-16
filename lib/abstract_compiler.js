"use strict";
var CompileError = require("./compile_error");
var JavaScriptBuilder = require("./java_script_builder");
var CoffeeScriptBuilder = require("./coffee_script_builder");
var isEmpty = require("./utils").isEmpty;

var __hasProp = {}.hasOwnProperty, __indexOf = [].indexOf || function(item) { for (var i = 0, l = this.length; i < l; i++) { if (i in this && this[i] === item) return i; } return -1; };

class AbstractCompiler {
  constructor(compiler, options) {
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
  }

  assertValid() {
    if (this.exportDefault && !isEmpty(this.exports)) {
      throw new CompileError("You cannot use both `export default` and `export` in the same module");
    }
  }

  buildPreamble(names) {
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
  }

  build(fn) {
    var builder;
    if (this.options.coffee) {
      builder = new CoffeeScriptBuilder();
    } else {
      builder = new JavaScriptBuilder();
    }
    fn(builder);
    return builder.toString();
  }

  buildImportsForPreamble(builder, imports_, dependencyName) {
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
}


module.exports = AbstractCompiler;