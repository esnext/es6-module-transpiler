import AbstractCompiler from './abstract_compiler';
import { isEmpty } from './utils';
import path from 'path';

var AMDCompiler, _ref,
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

AMDCompiler = (function(_super) {
  __extends(AMDCompiler, _super);

  function AMDCompiler() {
    _ref = AMDCompiler.__super__.constructor.apply(this, arguments);
    return _ref;
  }

  AMDCompiler.prototype.stringify = function() {
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
  };

  return AMDCompiler;

})(AbstractCompiler);

export default AMDCompiler;
