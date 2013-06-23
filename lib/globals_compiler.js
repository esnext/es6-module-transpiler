(function() {
  "use strict";

  var AbstractCompiler, GlobalsCompiler, isEmpty,
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  AbstractCompiler = require("./abstract_compiler");

  isEmpty = require("./utils").isEmpty;

  GlobalsCompiler = (function(_super) {

    __extends(GlobalsCompiler, _super);

    function GlobalsCompiler() {
      return GlobalsCompiler.__super__.constructor.apply(this, arguments);
    }

    GlobalsCompiler.prototype.stringify = function() {
      var _this = this;
      return this.build(function(s) {
        var alias, args, globalImport, into, locals, name, passedArgs, receivedArgs, wrapper, _i, _len, _ref, _ref1;
        passedArgs = [];
        receivedArgs = [];
        locals = {};
        into = _this.options.into || _this.exportDefault;
        if (!isEmpty(_this.exports) || _this.exportDefault) {
          passedArgs.push(_this.exportDefault ? s.global : into ? "" + s.global + "." + into + " = {}" : s.global);
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
    };

    return GlobalsCompiler;

  })(AbstractCompiler);

  module.exports = GlobalsCompiler;

}).call(this);
