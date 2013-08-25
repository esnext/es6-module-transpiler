import CompileError from './compile_error';
import { isEmpty, array, forEach } from './utils';

class AbstractCompiler {
  constructor(compiler, options) {
    this.compiler = compiler;

    this.exports = compiler.exports;
    this.exportDefault = compiler.exportDefault;
    this.imports = compiler.imports;
    this.directives = compiler.directives;

    this.moduleName = compiler.moduleName;
    this.lines = compiler.lines;
    this.string = compiler.string;

    this.options = options;
    this.dependencyNames = array.uniq(this.imports.map(function(import_) {
      return import_.source.value;
    }));

    this.seen = {};
    this.seenIdx = 1;
  }

  buildImports() {
    var imports = this.imports,
        moduleImports = this.moduleImports,
        source  = this.source;

    for (var idx = 0; idx < imports.length; idx++) {
      var import_ = imports[idx],
          replacement = "",
          dependencyName = import_.source.value,
          dependencyIdentifier;
      
      if (import_.type === "ModuleDeclaration" && import_.source.type === "Literal") {
        [dependencyName, replacement ] = this.doCache(dependencyName, import_.range);
        replacement += this.doModuleImport(import_.id.name, dependencyName);
      } else if (import_.type === "ImportDeclaration") {
        if (import_.kind === "default") {
          // var name = __dependencyX__;
          [dependencyName, replacement ] = this.doCache(dependencyName, import_.range);
          var specifier = import_.specifiers[0];
          replacement += this.doDefaultImport(specifier.id.name, dependencyName);
        } else if (import_.kind === "named") {
          // var one = __dependencyX__.one;
          // var two = __dependencyX__.two;
          [dependencyName, replacement ] = this.doCache(dependencyName, import_.range);
          replacement += this.doImportSpecifiers(import_, dependencyName);
        } else if (import_.kind === undefined) {
          replacement += this.doBareImport(import_.source.value);
        }
      }
      source.replace(import_.range[0], import_.range[1], replacement);
    }
  }

  doCache(dependencyName, range) {
    var dependencyIdentifier,
        replacement = "";

    if (!this.seen[dependencyName]) {
      dependencyIdentifier = this.seen[dependencyName] = `__dependency${this.seenIdx}__`;
      this.seenIdx += 1;

      if (this.doUnseenImport) {
        replacement = this.doUnseenImport(dependencyName, dependencyIdentifier);
      }
    } else {
      dependencyIdentifier = this.seen[dependencyName];
    }

    return [dependencyIdentifier, replacement];
  }

  buildExports() {
    var source        = this.source,
        exports_      = this.exports;

    for (var export_ of exports_) {
      var replacement = "",
          name;
      
      if (export_.default) {
        source.replace(export_.range[0],
                       export_.declaration.range[0] - 1, 
                       this.doDefaultExport());
      } else if (export_.specifiers) {
        for (var specifier of export_.specifiers) {
          replacement += this.doExportSpecifier(specifier.id.name);
        }
        source.replace(export_.range[0], export_.range[1], replacement);
      } else if (export_.declaration) {

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

  parseDirectives() {
    var directives = this.directives;
    for (var directive of directives) {
      this.source.replace(directive.range[0], directive.range[1], "");
    }
  }
}

export default AbstractCompiler;
