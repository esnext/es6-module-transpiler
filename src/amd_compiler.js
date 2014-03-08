var CJSCompiler = require('./cjs_compiler');
var SourceModifier = require('./source_modifier');
var string = require('./utils').string;

const INIT_EXPORTS = (`
  var __es6_module__ = {}, __imports__ = [];

  module.exports = {
    __es6_module__: __es6_module__
  };

`);


class AMDCompiler extends CJSCompiler {
  stringify() {
    var string = this.string.toString();  // string is actually a node buffer
    this.source = new SourceModifier(string);

    this.prelude = [];
    this.moduleImports = {};

    this.buildImports();
    this.buildExports();
    this.buildRewriteImports();

    var out = this.amdWrapper();

    out += INIT_EXPORTS;

    for (var source of this.prelude) {
      out += source + "\n";
    }

    for (var name in this.moduleImports) {
      if (Object.prototype.hasOwnProperty.call(this.moduleImports, name)) {
        out += this.moduleImports[name] + "\n";
      }
    }

    out += this.indentLines("    ");
    out += "\n  });";

    return out;
  }

  amdWrapper() {
    var optionalName = '';
    if (this.moduleName) {
      optionalName = `'${this.moduleName}',`;
    }
    return string.ltrim(string.unindent(`
     define(${optionalName}function(require, exports, module) {
    `));
  }

  ensureInModuleImports(name) {
    if (this.moduleImports[name]) {
      return;
    }

    this.moduleImports[name] = string.ltrim(string.unindent(`
      __imports__['${name}'] = require('${name}');
    `));
  }
}

module.exports = AMDCompiler;
