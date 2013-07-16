"use strict";
var AbstractCompiler = require("./abstract_compiler");

var __hasProp = {}.hasOwnProperty, __indexOf = [].indexOf || function(item) { for (var i = 0, l = this.length; i < l; i++) { if (i in this && this[i] === item) return i; } return -1; };

class CJSCompiler extends AbstractCompiler {
  stringify() {
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
        }) : req;
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
  };
}


module.exports = CJSCompiler;