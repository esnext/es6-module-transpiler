/* jshint node:true, undef:true, unused:true */

var assert = require('assert');
var recast = require('recast');
var types = recast.types;
var n = types.namedTypes;
var b = types.builders;
var astUtil = require('ast-util');

var utils = require('./utils');
var sourcePosition = utils.sourcePosition;
var Replacement = require('./replacement');

/**
 * Replaces references to local bindings created by `mod`'s imports
 * with references to the original value in the source module.
 *
 * @constructor
 * @param {Formatter} formatter
 */
function Rewriter(formatter) {
  Object.defineProperties(this, {
    formatter: {
      value: formatter
    }
  });
}

/**
 * Rewrites references to all imported and exported bindings according to the
 * rules from this rewriter's formatter. For example, this module:
 *
 *   import { sin, cos } from './math';
 *   import fib from './math/fib';
 *
 *   assert.equal(sin(0), 0);
 *   assert.equal(cos(0), 1);
 *   assert.equal(fib(1), 1);
 *
 * has its references to the imported bindings `sin`, `cos`, and `fib`
 * rewritten to reference the source module:
 *
 *   assert.equal(math$$.sin(0), 0);
 *   assert.equal(math$$.cos(0), 1);
 *   assert.equal(math$fib$$.fib(1), 1);
 *
 * @param {Array.<Module>} modules
 */
Rewriter.prototype.rewrite = function(modules) {
  var replacements = [];

  // FIXME: This is just here to ensure that all imports and exports know where
  // they came from. We need this because after we re-write the declarations
  // will not be there anymore and we'll need to ensure they're cached up front.
  modules.forEach(function(mod) {
    [mod.exports, mod.imports].forEach(function(declarations) {
      declarations.declarations.forEach(function(declaration) {
        declaration.specifiers.forEach(function(specifier) {
          return specifier.importSpecifier;
        });
      });
    });
  });

  var self = this;

  for (var i = 0, length = modules.length; i < length; i++) {
    var mod = modules[i];
    types.traverse(mod.ast.program, function() {
      var replacement = self.processNodePath(mod, this);
      if (replacement) {
        replacements.push(replacement);
      }
    });
  }

  replacements.forEach(function(replacement) {
    if (replacement.replace) {
      replacement.replace();
    } else {
      var path = replacement.shift();
      path.replace.apply(path, replacement);
    }
  });
};

/**
 * Determines what, if anything, to replace the given nodePath's node with by
 * delegating to this rewriter's formatter.
 *
 * @private
 * @param {Module} mod
 * @param {ast-types.NodePath} nodePath
 * @return {Array.<ast-types.Node>}
 */
Rewriter.prototype.processNodePath = function(mod, nodePath) {
  var node = nodePath.node;
  var formatter = this.formatter;
  var exportReference;

  if (astUtil.isReference(nodePath)) {
    exportReference = this.getExportReferenceForReference(mod, nodePath);
    if (exportReference) {
      return Replacement.swaps(nodePath, exportReference);
    }
  } else if (n.AssignmentExpression.check(node)) {
    /**
     * We need to ensure that the LHS of this assignment is not an imported
     * binding. If it is, we throw a "compile"-time error since this is not
     * allowed by the spec (see section 12.14.1, Assignment Operators /
     * Static Semantics: Early Errors).
     */
    if (n.Identifier.check(node.left)) {
      var lhsName = node.left.name;
      var lhsDeclarationScope = nodePath.scope.lookup(lhsName);
      if (lhsDeclarationScope) {
        var lhsDeclarationPaths = lhsDeclarationScope.getBindings()[lhsName];
        assert.ok(
          lhsDeclarationPaths.length === 1,
          'expected exactly one declaration for `' + lhsName +
          '`, found ' + lhsDeclarationPaths.length
        );
        var lhsDeclarationPath = lhsDeclarationPaths[0];
        if (n.ImportSpecifier.check(lhsDeclarationPath.parent.node)) {
          throw new SyntaxError(
            'Cannot reassign imported binding `' + lhsName +
            '` at ' + sourcePosition(mod, node)
          );
        }
      }
    }
  } else if (n.VariableDeclaration.check(node) && nodePath.scope.isGlobal) {
    return formatter.processVariableDeclaration(mod, nodePath);
  } else if (n.FunctionDeclaration.check(node) && n.Program.check(nodePath.parent.node)) {
    return formatter.processFunctionDeclaration(mod, nodePath);
  } else if (n.ExportDeclaration.check(node)) {
    if (node.default) {
      /**
       * Default exports do not create bindings, so we can safely turn these
       * into expressions that do something with the exported value.
       *
       * Make sure that the exported value is replaced if it is a reference
       * to an imported binding. For example:
       *
       *   import { foo } from './foo';
       *   export default foo;
       *
       * Might become:
       *
       *   mod$$.default = foo$$.foo;
       */
      var declaration = node.declaration;
      var declarationPath = nodePath.get('declaration');
      if (astUtil.isReference(declarationPath)) {
        exportReference = this.getExportReferenceForReference(mod, declarationPath);
        if (exportReference) {
          declaration = exportReference;
        }
      }
      return Replacement.swaps(nodePath, formatter.defaultExport(mod, declaration));
    } else {
      return formatter.processExportDeclaration(mod, nodePath);
    }
  } else if (n.ImportDeclaration.check(node)) {
    return formatter.processImportDeclaration(mod, nodePath);
  } else {
    return null;
  }
};

/**
 * @private
 */
Rewriter.prototype.getExportReferenceForReference = function(mod, referencePath) {
  if (n.ExportSpecifier.check(referencePath.parent.node) && !referencePath.parent.node.default) {
    // Do not rewrite non-default export specifiers.
    return null;
  }

  /**
   * We need to replace references to variables that are imported or
   * exported with the correct export expression. The export expression
   * should be named for the original export for a variable.
   *
   * That is, imports must be followed to their export. If that exported
   * value came from an import then repeat the process until you find a
   * declaration of the exported value.
   */
  var exportSpecifier = mod.exports.findSpecifierByName(referencePath.node.name);
  if (exportSpecifier && exportSpecifier.declaration.source && exportSpecifier.node !== referencePath.parent.node) {
    // This is a direct export from another module, e.g. `export { foo } from
    // 'foo'`. There are no local bindings created by this, so there is no
    // associated export for this reference and no need to rewrite it.
    return null;
  }

  return this.formatter.exportedReference(mod, referencePath) ||
    this.formatter.importedReference(mod, referencePath) ||
    this.formatter.localReference(mod, referencePath);

  if (!rewrite) {
  }

  return rewrite;
};

module.exports = Rewriter;
