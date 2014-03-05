var falafel = require('../lib/falafel');

const LITERAL = 'Literal';

class Parser {
  constructor(script) {
    this.parse(script);
  }

  parse(script) {
    this.imports = [];
    this.exports = [];
    this.directives = [];
    this.exportDefault = undefined;

    this.importedIdentifiers = {};
    this.importsToRewrite = [];

    falafel(script, {range: true, comment: true}, this.walk.bind(this));
  }

  walk(node) {
    if (node.type) {
      var processor = this['process'+node.type];
      if (processor) {
        var result = processor.call(this, node);
        if (result === false) {
          return;
        }
      }
    }

    // directives have to be top-level
    if (node.comments && node.type === "Program") {
      for (var comment of node.comments) {
        if (comment.value.indexOf("transpile:") !== -1) {
          this.directives.push(comment);
        }
      }
    }
  }

  processImportDeclaration(node) {
    var {kind, source} = node;

    if (source.type !== LITERAL || typeof source.value !== 'string') {
      throw new Error('invalid module source: '+source.value);
    }

    for (var specifier of node.specifiers) {
      var alias = specifier.name ? specifier.name.name : specifier.id.name;

      if ( kind === 'default' ) {
        this.importedIdentifiers[alias] = { name: 'default', moduleName: source.value};
      } else {
        this.importedIdentifiers[alias] = { name: specifier.id.name, moduleName: source.value};
      }
    }

    switch (kind) {
      case 'named':
        this.processNamedImportDeclaration(node);
        break;

      case "default":
        this.processDefaultImportDeclaration(node);
        break;

      // bare import (i.e. `import "foo";`)
      case undefined:
        this.processNamedImportDeclaration(node);
        break;

      default:
        throw new Error('unknown import kind: '+kind);
    }
  }

  processNamedImportDeclaration(node) {
    this.imports.push(node);
  }

  processDefaultImportDeclaration(node) {
    if (node.specifiers.length !== 1) {
      throw new Error('expected one specifier for default import, got '+node.specifiers.length);
    }

    this.imports.push(node);
  }

  processExportDeclaration(node) {
    if (!node.declaration && !node.specifiers) {
      throw new Error('expected declaration or specifiers after `export` keyword');
    }
    this.exports.push(node);
  }

  processModuleDeclaration(node) {
    this.imports.push(node);
  }

  processIdentifier(node) {
    var parent = node.parent;

    if (parent && (parent.type === 'ImportSpecifier' || parent.type === 'ExportSpecifier')) {
      // this should be taken care of by processImportDeclaration
      return;
    }

    if ( node.name in this.importedIdentifiers ) {
      // TODO: Check scope, prevent rewriting shaowed variables
      this.importsToRewrite.push(node);
    }
  }
}

module.exports = Parser;
