(function() {
  "use strict";

  var AMDCompiler, AbstractCompiler, isEmpty, path,
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  AbstractCompiler = require("./abstract_compiler");

  path = require("path");

  isEmpty = require("./utils").isEmpty;

  AMDCompiler = (function(_super) {

    __extends(AMDCompiler, _super);

    function AMDCompiler() {
      return AMDCompiler.__super__.constructor.apply(this, arguments);
    }

    AMDCompiler.prototype.stringify = function() {
      var _this = this;
      return this.build(function(s) {
        var dependency, i, preamble, wrapperArgs, _ref;
        _ref = _this.buildPreamble(_this.dependencyNames), wrapperArgs = _ref[0], preamble = _ref[1];
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
                var exportName, exportValue, _ref1;
                s.useStrict();
                if (preamble) {
                  s.append(preamble);
                }
                s.append.apply(s, _this.lines);
                _ref1 = _this.exports;
                for (exportName in _ref1) {
                  exportValue = _ref1[exportName];
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

  module.exports = AMDCompiler;

}).call(this);
