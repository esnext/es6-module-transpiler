(function() {
  "use strict";

  var AMDCompiler, AbstractCompiler,
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  AbstractCompiler = require("./abstract_compiler");

  AMDCompiler = (function(_super) {

    __extends(AMDCompiler, _super);

    function AMDCompiler() {
      return AMDCompiler.__super__.constructor.apply(this, arguments);
    }

    AMDCompiler.prototype.stringify = function() {
      var _this = this;
      return this.build(function(s) {
        var preamble, wrapperArgs, _ref;
        _ref = _this.buildPreamble(_this.dependencyNames), wrapperArgs = _ref[0], preamble = _ref[1];
        if (_this.exports.length !== 0) {
          _this.dependencyNames.push('exports');
          wrapperArgs.push('__exports__');
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
                var export_, _i, _len, _ref1;
                s.useStrict();
                if (preamble) {
                  s.append(preamble);
                }
                s.append.apply(s, _this.lines);
                _ref1 = _this.exports;
                for (_i = 0, _len = _ref1.length; _i < _len; _i++) {
                  export_ = _ref1[_i];
                  s.line("__exports__." + export_ + " = " + export_);
                }
                if (_this.exportAs) {
                  return s.line("return " + _this.exportAs);
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
