import AbstractCompiler from './abstract_compiler';
import SourceModifier from './source_modifier';

class AMDCompiler extends AbstractCompiler {
  stringify() {
    var string = this.string.toString();  // string is actually a node buffer
    this.source = new SourceModifier(string);

    this.map = [];
    var out = this.buildPreamble(this.exports.length > 0);

    // build* mutates this.source
    this.buildImports();
    this.buildExports();

    var innerLines = this.source.toString().split("\n");
    var inner = innerLines.reduce(function(acc, item) {
      if (item === "") return acc + "\n"
      return acc + "    " + item + "\n";
    }, "");

    out += inner.replace(/\s+$/, "");

    out += "\n  });";

    return out;
  }

  buildPreamble(hasExports) {
    var out = "",
        dependencyNames = this.dependencyNames;

    if (hasExports) dependencyNames.push("exports");

    out += "define(";
    if (this.moduleName) out += `"${this.moduleName}", `;
    out += "\n  [";

    // build preamble
    var idx;
    for (idx = 0; idx < dependencyNames.length; idx++) {
      var name = dependencyNames[idx];
      out += `"${name}"`;
      if (!(idx === dependencyNames.length - 1)) out += ",";
    }

    out += "],\n  function(";

    for (idx = 0; idx < dependencyNames.length; idx++) {
      if (dependencyNames[idx] === "exports") {
        out += "__exports__";
      } else {
        out += `__dependency${idx+1}__`;
        this.map[dependencyNames[idx]] = idx+1;
      }
      if (!(idx === dependencyNames.length - 1)) out += ", ";
    }

    out += ") {\n";

    out += '    "use strict";\n';

    return out;
  }

  doModuleImport(name, dependencyName, idx) {
    return `var ${name} = __dependency${this.map[dependencyName]}__;\n`;
  }

  doBareImport(name) {
    return "";
  }

  doDefaultImport(name, dependencyName, idx) {
    if (this.options.compatFix === true) {
      return `var ${name} = __dependency${this.map[dependencyName]}__.__default__ || __dependency${this.map[dependencyName]}__;\n`;
    } else {
      return `var ${name} = __dependency${this.map[dependencyName]}__.__default__;\n`;
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
    return "__exports__['default'] = ";
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

export default AMDCompiler;
