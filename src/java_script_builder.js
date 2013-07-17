import ScriptBuilder from './script_builder';

class JavaScriptBuilder extends ScriptBuilder {
  get eol() {
    return ';';
  }

  'var'(lhs, rhs) {
    this.line('var ' + this.capture(lhs) + ' = ' + this.capture(rhs));
  }

  _functionHeader(args) {
    return "function(" + (args.join(', ')) + ") {";
  }

  _functionTail() {
    return '}';
  }
}

export default JavaScriptBuilder;
