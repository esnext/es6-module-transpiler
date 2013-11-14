import AbstractCompiler from './abstract_compiler';
import SourceModifier from './source_modifier';

class YUICompiler extends AbstractCompiler {
  stringify() {
    var string = this.string.toString();  // string is actually a node buffer
    this.source = new SourceModifier(string);

    this.map = [];
    var out = this.buildPreamble(this.exports.length > 0);

    // build* mutates this.source
    this.buildImports();
    this.buildExports();

    out += this.indentLines("    ");
    out += "\n    return __exports__ || Y;";
    out += "\n}, ";
    out += `"@VERSION@", `;
    out += this.buildMetas();
    out += ");";

    return out;
  }

  buildPreamble(hasExports) {
    var out = "",
        dependencyNames = this.dependencyNames,
        idx;

    out += "YUI.add(";
    out += `"${this.moduleName}", `;
    out += "function(Y, NAME";

    for (idx = 0; idx < dependencyNames.length; idx++) {
      out += ", ";
      out += `__dependency${idx+1}__`;
      this.map[dependencyNames[idx]] = idx+1;
    }

    out += ", __exports__) {\n";

    out += '    "use strict";\n';

    if (hasExports) out += "    __exports__ = {};\n";

    return out;
  }

  buildMetas() {
    return JSON.stringify({ es: true, requires: this.dependencyNames });
  }

  doModuleImport(name, dependencyName, idx) {
    return `var ${name} = __dependency${this.map[dependencyName]}__;\n`;
  }

  doBareImport(name) {
    return "";
  }

  doDefaultImport(name, dependencyName, idx) {
    if (this.options.compatFix === true) {
      return `var ${name} = __dependency${this.map[dependencyName]}__["default"] || __dependency${this.map[dependencyName]}__;\n`;
    } else {
      return `var ${name} = __dependency${this.map[dependencyName]}__["default"];\n`;
    }
  }

  doNamedImport(name, dependencyName, alias) {
    return `var ${alias} = __dependency${this.map[dependencyName]}__.${name};\n`;
  }

  doExportSpecifier(name, reexport) {
    if (reexport) {
      return `__exports__.${name} = __dependency${this.map[reexport]}__.${name};\n`;
    }
    return `__exports__.${name} = ${name};\n`;
  }

  doExportDeclaration(name) {
    return `\n__exports__.${name} = ${name};`;
  }

  doDefaultExport() {
    return `__exports__["default"] = `;
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

export default YUICompiler;
