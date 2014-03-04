var AbstractCompiler = require('./abstract_compiler');
var SourceModifier = require('./source_modifier');
var string = require('./utils').string;

const SAFE_WARN_NAME = "__es6_transpiler_warn__";
const SAFE_WARN_SOURCE = string.ltrim(string.unindent(`
  function ${SAFE_WARN_NAME}(warning) {
    if (typeof console === 'undefined') {
    } else if (typeof console.warn === "function") {
      console.warn(warning);
    } else if (typeof console.log === "function") {
      console.log(warning);
    }
  }`));

const MODULE_OBJECT_BUILDER_NAME = "__es6_transpiler_build_module_object__";
const MODULE_OBJECT_BUILDER_SOURCE = string.ltrim(string.unindent(`
  function ${MODULE_OBJECT_BUILDER_NAME}(name, imported) {
    var moduleInstanceObject = Object.create ? Object.create(null) : {};
    if (typeof imported === "function") {
      ${SAFE_WARN_NAME}("imported module '"+name+"' exported a function - this may not work as expected");
    }
    for (var key in imported) {
      if (Object.prototype.hasOwnProperty.call(imported, key)) {
        moduleInstanceObject[key] = imported[key];
      }
    }
    if (Object.freeze) {
      Object.freeze(moduleInstanceObject);
    }
    return moduleInstanceObject;
  }`));

class CJSCompiler extends AbstractCompiler {
  stringify() {
    var string = this.string.toString();  // string is actually a node buffer
    this.source = new SourceModifier(string);
    this.prelude = [];

    this.buildImports();
    this.buildExports();

    var out = `"use strict";\n`;
    for (var source of this.prelude) {
      out += source + "\n";
    }
    out += this.source.toString();
    out = out.trim();
    return out;
  }

  doModuleImport(name, dependencyName, idx) {
    this.ensureHasModuleObjectBuilder();
    // NOTE: Don't be tempted to move `require("${dependencyName}")` into the builder.
    // This require call is here so that browserify and the like will be able
    // to statically analyze the file's requirements.
    return `var ${name} = ${MODULE_OBJECT_BUILDER_NAME}("${name}", require("${dependencyName}"));\n`;
  }

  ensureHasModuleObjectBuilder() {
    this.ensureHasSafeWarn();
    this.ensureInPrelude(MODULE_OBJECT_BUILDER_NAME, MODULE_OBJECT_BUILDER_SOURCE);
  }

  ensureHasSafeWarn() {
    this.ensureInPrelude(SAFE_WARN_NAME, SAFE_WARN_SOURCE);
  }

  ensureInPrelude(name, source) {
    if (!this.prelude[name]) {
      this.prelude[name] = true;
      this.prelude.push(source);
    }
  }

  doBareImport(name) {
    return `require("${name}");`;
  }

  doDefaultImport(name, dependencyName, idx) {
    if (this.options.compatFix === true) {
      return `var ${name} = require("${dependencyName}")["default"] || require("${dependencyName}");\n`;
    } else {
      return `var ${name} = require("${dependencyName}")["default"];\n`;
    }
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
    return `exports["default"] = `;
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

module.exports = CJSCompiler;
