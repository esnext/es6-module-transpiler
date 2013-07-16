"use strict";
var Unique = require("./utils").Unique;

var BREAK, INDENT, OUTDENT, ScriptBuilder,
  __slice = [].slice;

INDENT = {
  indent: true
};

OUTDENT = {
  outdent: true
};

BREAK = {
  "break": true
};

class ScriptBuilder {
  constructor() {
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
  }

  useStrict() {
    this.line('"use strict"');
  }

  set(lhs, rhs) {
    this.line("" + (this.capture(lhs)) + " = " + (this.capture(rhs)));
  }

  call(fn, args) {
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
  };

  _prepareArgsForCall(args) {
    var result,
      _this = this;
    if (typeof args === 'function') {
      result = [];
      args(function(arg) {
        return result.push(_this.capture(arg));
      });
      args = result;
    }
    return args;
  }

  _wrapCallable(fn) {
    var functionCalled, functionImpl, result,
      _this = this;
    if (typeof fn !== 'function') {
      return fn;
    }
    functionImpl = this["function"];
    functionCalled = false;
    this["function"] = function() {
      var args;
      args = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
      functionCalled = true;
      return functionImpl.call.apply(functionImpl, [_this].concat(__slice.call(args)));
    };
    result = this.capture(fn);
    this["function"] = functionImpl;
    if (functionCalled) {
      result = "(" + result + (this._functionTail != null ? '' : '\n') + ")";
    }
    return result;
  }

  print(value) {
    return JSON.stringify(this.capture(value));
  }

  prop(object, prop) {
    this.append("" + (this.capture(object)) + "." + (this.capture(prop)));
  }

  unique(prefix) {
    return new Unique(prefix);
  }

  line(code) {
    this.append(this.capture(code) + this.eol);
  }

  append(...code) {
    this.buffer.push(...code);
  }

  indent() {
    this.buffer.push(INDENT);
  }

  outdent() {
    this.buffer.push(OUTDENT);
  }

  capture(fn) {
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
  }

  toString() {
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
}


module.exports = ScriptBuilder;