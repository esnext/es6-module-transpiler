import { parse as esparse } from 'esprima';

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
    this.walk(esparse(script, {range: true, comment: true}));
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

    if (node.body && node.body.length > 0) {
      node.body.forEach(function(child) {
        child.parent = node;
        this.walk(child);
      }.bind(this));
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
      throw new Error('expected one specifier for default import, got '+specifiers.length);
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
}

export default Parser;
