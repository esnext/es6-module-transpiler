import AbstractCompiler from './abstract_compiler';
import path from 'path';
import SourceModifier from './source_modifier';

class AMDCompiler extends AbstractCompiler {
  stringify() {
    var string = this.string.toString();  // string is actually a node buffer
    this.source = new SourceModifier(string);

    var out = this.buildPreamble(this.exports.length > 0);

    // build* mutates this.source
    this.parseDirectives();
    this.buildImports();
    this.buildExports();

    var innerLines = this.source.toString().split("\n");
    var inner = innerLines.reduce(function(acc, item) {
      if (item === "") return acc + "\n"
      return acc + "    " + item + "\n";
    }, "");

    out += inner.replace(/\s+$/, "");

    out += "\n  });";

    console.log(out);
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
      }
      if (!(idx === dependencyNames.length - 1)) out += ", ";
    }

    out += ") {\n";

    out += '    "use strict";\n';

    return out;
  }

  buildImports() {
    var imports = this.imports,
        moduleImports = this.moduleImports,
        source  = this.source;

    for (var idx = 0; idx < imports.length; idx++) {
      var import_ = imports[idx],
          replacement = "";

      if (import_.type === "ModuleDeclaration" && import_.source.type === "Literal") {
        replacement = `var ${import_.id.name} = __dependency${idx+1}__;\n`;
      } else if (import_.type === "ImportDeclaration") {
        if (import_.kind === "default") {
          // var name = __dependencyX__;
          var specifier = import_.specifiers[0];
          replacement = `var ${specifier.id.name} = __dependency${idx+1}__.__default__;\n`;
        } else if (import_.kind === "named") {
          // var one = __dependencyX__.one;
          // var two = __dependencyX__.two;
          for (var specifier of import_.specifiers) {
            var alias = specifier.name ? specifier.name.name : specifier.id.name;
            replacement += `var ${alias} = __dependency${idx+1}__.${specifier.id.name};\n`;
          }
        }
      }
      source.replace(import_.range[0], import_.range[1], replacement);
    }
  }

  buildExports() {
    var source        = this.source,
        exports_      = this.exports,
        exportDefault = this.exportDefault;

    for (var export_ of exports_) {
      var replacement = "";
      if (export_.specifiers) {
        for (var specifier of export_.specifiers) {
          replacement += `__exports__.${specifier.id.name} = ${specifier.id.name};\n`;
        }
        source.replace(export_.range[0], export_.range[1], replacement);
      } else if (export_.declaration) {

        if (export_.declaration.type === "VariableDeclaration") {
          var name = export_.declaration.declarations[0].id.name;
          var exportedName = export_.default ? "__default__" : name;

          // remove the "export" keyword
          source.replace(export_.range[0], export_.declaration.range[0] -1, "");

          // add a new line
          replacement = `\n__exports__.${exportedName} = ${name};`;
          source.replace(export_.range[1], export_.range[1], replacement);
        } else if (export_.declaration.type === "FunctionDeclaration") {
          var name = export_.declaration.id.name;
          var exportedName = export_.default ? "__default__" : name;

          source.replace(export_.range[0], export_.declaration.range[0] - 1, "");

          replacement = `\n__exports__.${exportedName} = ${name};`;
          source.replace(export_.range[1] + 1, export_.range[1] + 1, replacement);
        } else if (export_.declaration.type === "Identifier") {
          var name = export_.declaration.name;
          var exportedName = export_.default ? "__default__" : name;

          replacement = `__exports__.${exportedName} = ${name};`;
          source.replace(export_.range[0], export_.range[1] - 1, replacement);
        }

      }
    }
  }

  parseDirectives() {
    var directives = this.directives;
    for (var directive of directives) {
      this.source.replace(directive.range[0], directive.range[1], "");
    }
  }
}

export default AMDCompiler;
