import { parse as esparse } from 'esprima';

const LITERAL = 'Literal';

class Parser {
  constructor(script) {
    this.parse(script);
  }

  parse(script) {
    this.imports = [];
    this.exports = [];
    this.exportDefault = undefined;
    this.walk(esparse(script, {range: true}));
  }

  walk(node) {
    if (node.type) {
      console.log(node.type);
      var processor = this['process'+node.type];
      if (processor) {
        var result = processor.call(this, node);
        if (result === false) {
          return;
        }
      }
    }

    if (node.body) {
      node.body.forEach(function(child) {
        child.parent = node;
        this.walk(child);
      }.bind(this));
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

      case 'default':
        this.processDefaultImportDeclaration(node);
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
    if (node.default) {
      this.exportDefault = node;
    } else {
      this.exports.push(node);
    }
  }
}

export default Parser;
