import AbstractCompiler from './abstract_compiler';
import SourceModifier from './source_modifier';

class CJSCompiler extends AbstractCompiler {
  stringify() {
    var string = this.string.toString();  // string is actually a node buffer
    this.source = new SourceModifier(string);

    this.parseDirectives();
    this.buildImports();
    this.buildExports();

    var out = `"use strict";\n`;
    out += this.source.toString();
    out = out.trim();
    console.log(out);
    return out;
  }

  doModuleImport(name, dependencyName, idx) {
    return `var ${name} = require("${dependencyName}");\n`;
  }

  doBareImport(name) {
    return `require("${name}");`;
  }

  doDefaultImport(name, dependencyName, idx) {
    return `var ${name} = require("${dependencyName}").__default__;\n`;
  }

  doNamedImport(name, dependencyName, idx, alias) {
    return `var ${alias} = __dependency${idx+1}__.${name};\n`;
  }

  doSingleNamedImport(name, dependencyName, alias) {
    return `var ${alias} = require("${dependencyName}").${name};\n`;
  }

  doExportSpecifier(name) {
    return `exports.${name} = ${name};\n`;
  }

  doExportDeclaration(name) {
    return `\nexports.${name} = ${name};`;
  }

  doDefaultExport() {
    return "exports.__default__ = ";
  }

  doImportSpecifiers(import_, idx) {
    var dependencyName = import_.source.value;

    // import {foo} from "x";
    // -> var foo = require("x").foo;
    if (import_.specifiers.length === 1) {
      var specifier = import_.specifiers[0];
      var alias = specifier.name ? specifier.name.name : specifier.id.name;
      return this.doSingleNamedImport(specifier.id.name, dependencyName, alias);
    }

    // import {foo, bar} from "x";
    // -> var __dependencyX__ = require("x");
    var replacement = "";
    replacement += `var __dependency${idx+1}__ = require("${dependencyName}");\n`
    dependencyName = `__dependency${idx+1}__`;

    for (var specifier of import_.specifiers) {
      var alias = specifier.name ? specifier.name.name : specifier.id.name;
      replacement += this.doNamedImport(specifier.id.name, dependencyName, idx, alias);
    }
    return replacement;
  }

}

export default CJSCompiler;
