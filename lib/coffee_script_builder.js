"use strict";
var ScriptBuilder = require("./script_builder");

class CoffeeScriptBuilder extends ScriptBuilder {
  constructor() {
    super();
    this.eol = '';
    this['var'] = (lhs, rhs) => this.set(lhs, rhs);
  }

  _prepareArgsForCall(args) {
    var arg, _i, _len;
    args = super._prepareArgsForCall(...args).slice();
    for (_i = 0, _len = args.length; _i < _len; _i++) {
      arg = args[_i];
      if (arg === this["break"]) {
        if (args[args.length - 1] !== this["break"]) {
          args.push(this["break"]);
        }
        break;
      }
    }
    return args;
  };

  _functionHeader(args) {
    if (args.length) {
      return "(" + (args.join(', ')) + ") ->";
    } else {
      return '->';
    }
  };
}


module.exports = CoffeeScriptBuilder;