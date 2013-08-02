import { Unique, forEach, string } from './utils';

var INDENT = {},
    OUTDENT = {},
    BREAK = {};

class ScriptBuilder {
  constructor() {
    this.buffer = [];
  }

  get linebreak() {
    return BREAK;
  }

  get global() {
    return 'window';
  }

  useStrict() {
    this.line('"use strict"');
  }

  set_(lhs, rhs) {
    this.line("" + (this.capture(lhs)) + " = " + (this.capture(rhs)));
  }

  func(args, body) {
    this.append(this._functionHeader(args));
    this.indent();
    body();
    this.outdent();
    if (this._functionTail != null) {
      this.append(this._functionTail());
    }
  }

  call(fn, args) {
    var end, indented, result;
    fn = this._wrapCallable(fn);
    args = this._prepareArgsForCall(args);

    end = args.length - 1;
    while (args[end] === BREAK) {
      end--;
    }

    result = "" + fn + "(";
    indented = false;
    for (var i = 0; i < args.length; i++) {
      var arg = args[i];
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
      this.outdent();
    }
  }

  _prepareArgsForCall(args) {
    if (typeof args === 'function') {
      var result = [];
      args(arg => result.push(this.capture(arg)));
      args = result;
    }

    return args;
  }

  _wrapCallable(fn) {
    if (typeof fn !== 'function') { return fn; }

    var functionImpl = this.func,
        functionCalled = false,
        self = this;

    this.func = function(...args) {
      functionCalled = true;
      return functionImpl.apply(self, args);
    };

    var result = this.capture(fn);

    this.func = functionImpl;
    if (functionCalled) {
      result = '(' + result + (this._functionTail != null ? '' : '\n') + ')';
    }

    return result;
  }

  print(value) {
    return JSON.stringify(this.capture(value));
  }

  prop(object, prop_) {
    this.append("" + (this.capture(object)) + "." + (this.capture(prop_)));
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
    if (typeof fn !== 'function') { return fn; }

    // reinit buffer
    var buffer = this.buffer;
    this.buffer = [];

    // add to buffer
    fn();

    // capture and restore buffer
    var result = this.toString();
    this.buffer = buffer;

    return result;
  }


  toString() {
    var indent = 0,
        result = [];

    forEach(this.buffer, function(chunk) {
      if (chunk === INDENT) {
        indent++;
      } else if (chunk === OUTDENT) {
        indent--;
      } else {
        result.push(...string.indent(chunk.split('\n'), indent));
      }
    });

    return result.join('\n');
  }
}

export default ScriptBuilder;
