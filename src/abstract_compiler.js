var CompileError = require('./compile_error');
var array = require('./utils').array;

class AbstractCompiler {
  constructor(compiler, options) {
    this.compiler = compiler;

    this.exports = compiler.parsed.exports;
    this.exportDefault = compiler.parsed.exportDefault;
    this.imports = compiler.parsed.imports;
    this.directives = compiler.parsed.irectives;

    this.importedIdentifiers = compiler.parsed.importedIdentifiers;
    this.importsToRewrite = compiler.parsed.importsToRewrite;

    this.moduleName = compiler.moduleName;
    this.lines = compiler.lines;
    this.string = compiler.string;

    this.options = options;

    var allDependencies = this.imports.concat(this.exports.filter(function(export_) {
      return export_.source !== null;
    }));

    this.dependencyNames = array.uniq(allDependencies.map(function(dep) {
      return dep.source.value;
    }));
  }

  buildImports() {
    var imports = this.imports,
        moduleImports = this.moduleImports,
        source  = this.source;

    for (var idx = 0; idx < imports.length; idx++) {
      var import_ = imports[idx],
          replacement = "";

      var dependencyName = import_.source.value;

      if (import_.type === "ModuleDeclaration" && import_.source.type === "Literal") {
        replacement = this.doModuleImport(import_.id.name, dependencyName, idx);
      } else if (import_.type === "ImportDeclaration") {
        if (import_.kind === "default") {
          // var name = __dependencyX__;
          var specifier = import_.specifiers[0];
          replacement = this.doDefaultImport(specifier.id.name, dependencyName, idx);
        } else if (import_.kind === "named") {
          // var one = __dependencyX__.one;
          // var two = __dependencyX__.two;
          replacement = this.doImportSpecifiers(import_, idx);
        } else if (import_.kind === undefined) {
          replacement = this.doBareImport(import_.source.value);
        }
      }
      source.replace(import_.range[0], import_.range[1], replacement);
    }
  }

  buildExports() {
    var source        = this.source,
        exports_      = this.exports;

    for (var export_ of exports_) {
      var replacement = "";
      
      if (export_.default) {
        var identifier = export_.declaration.name || null;
        source.replace(export_.range[0],
                       export_.declaration.range[0] - 1, 
                       this.doDefaultExport(identifier));
      } else if (export_.specifiers) {
        var reexport;
        if (export_.source) {
          reexport = export_.source.value;
        }
        for (var specifier of export_.specifiers) {
          replacement += this.doExportSpecifier(specifier.id.name, reexport);
        }
        source.replace(export_.range[0], export_.range[1], replacement);
      } else if (export_.declaration) {

        var name;

        if (export_.declaration.type === "VariableDeclaration") {
          name = export_.declaration.declarations[0].id.name;

          // remove the "export" keyword
          source.replace(export_.range[0], export_.declaration.range[0] -1, "");
          // add a new line
          replacement = this.doExportDeclaration(name);
          source.replace(export_.range[1], export_.range[1], replacement);
        } else if (export_.declaration.type === "FunctionDeclaration") {
          name = export_.declaration.id.name;

          source.replace(export_.range[0], export_.declaration.range[0] - 1, "");

          replacement = this.doExportDeclaration(name);
          source.replace(export_.range[1] + 1, export_.range[1] + 1, replacement);
        } else if (export_.declaration.type === "Identifier") {
          name = export_.declaration.name;

          replacement = this.doExportDeclaration(name);
          source.replace(export_.range[0], export_.range[1] - 1, replacement);
        }

      }
    }
  }

  buildRewriteImports() {
    for (var name in this.importsToRewrite) {
      var node = this.importsToRewrite[name];
      var replacement = this.rewriteImportedIdentifier(node);
      this.source.replace(node.range[0], node.range[1] - 1, replacement);
    }
  }

  indentLines(indent = "  ") {
    var innerLines = this.source.toString().split("\n");
    var inner = innerLines.reduce(function(acc, item) {
      if (item === "") return acc + "\n";
      return acc + indent + item + "\n";
    }, "");

    return inner.replace(/\s+$/, "");
  }
}

module.exports = AbstractCompiler;
