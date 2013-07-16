"use strict";
var ScriptBuilder = require("./script_builder");

class JavaScriptBuilder extends ScriptBuilder {
  constructor() {
    super();
    this.eol = ';';
    this['var'] = (lhs, rhs) => this.line('var ' + this.capture(lhs) + ' = ' + this.capture(rhs));
  }

  _functionHeader(args) {
    return "function(" + (args.join(', ')) + ") {";
  }

  _functionTail() {
    return '}';
  }
}


module.exports = JavaScriptBuilder;