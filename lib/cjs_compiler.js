import AbstractCompiler from './abstract_compiler';
import SourceModifier from './source_modifier';

class CJSCompiler extends AbstractCompiler {
  stringify() {
    var string = this.string.toString();  // string is actually a node buffer
    this.source = new SourceModifier(string);

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

  doNamedImport(name, dependencyName, alias) {
    return `var ${alias} = require("${dependencyName}").${name};\n`;
  }

  doExportSpecifier(name, reexport) {
    if (reexport) {
      return `exports.${name} = require("${reexport}").${name};\n`;
    }
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
    var replacement = "";

    for (var specifier of import_.specifiers) {
      var alias = specifier.name ? specifier.name.name : specifier.id.name;
      replacement += this.doNamedImport(specifier.id.name, dependencyName, alias);
    }
    return replacement;
  }

}

export default CJSCompiler;
