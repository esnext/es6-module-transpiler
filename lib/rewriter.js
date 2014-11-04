/* jshint node:true, undef:true, unused:true */

var assert = require('assert');
var recast = require('recast');
var types = recast.types;
var n = types.namedTypes;
var b = types.builders;
var astUtil = require('ast-util');

var utils = require('./utils');
var extend = utils.extend;
var sourcePosition = utils.sourcePosition;
var Replacement = require('./replacement');

/**
 * Replaces references to local bindings created by `mod`'s imports
 * with references to the original value in the source module.
 *
 * @constructor
 * @param {Formatter} formatter
 * @extends types.PathVisitor
 */
function Rewriter(formatter) {
  types.PathVisitor.call(this);

  Object.defineProperties(this, {
    formatter: {
      value: formatter
    }
  });
}
extend(Rewriter, types.PathVisitor);

/**
 * Rewrites references to all imported and exported bindings according to the
 * rules from this rewriter's formatter. For example, this module:
 *
 *   ```js
 *   import { sin, cos } from './math';
 *   import fib from './math/fib';
 *
 *   assert.equal(sin(0), 0);
 *   assert.equal(cos(0), 1);
 *   assert.equal(fib(1), 1);
 *   ```
 *
 * has its references to the imported bindings `sin`, `cos`, and `fib`
 * rewritten to reference the source module:
 *
 *   ```js
 *   assert.equal(math$$.sin(0), 0);
 *   assert.equal(math$$.cos(0), 1);
 *   assert.equal(math$fib$$.fib(1), 1);
 *   ```
 *
 * @param {Module[]} modules
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

  this.replacements = replacements;
  for (var i = 0, length = modules.length; i < length; i++) {
    var mod = modules[i];
    if (mod.exports.declarations.length > 0 || mod.imports.declarations.length > 0) {
      this.currentModule = mod;
      types.visit(mod.ast.program, this);
    } else {
      types.visit(mod.ast.program, new DeclarationLinterVisitor(mod));
    }
  }
  this.currentModule = null;
  this.replacements = null;

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
 * Process all identifiers looking for references to variables in scope.
 *
 * @param {NodePath} nodePath
 * @return {boolean}
 * @private
 */
Rewriter.prototype.visitIdentifier = function(nodePath) {
  if (astUtil.isReference(nodePath)) {
    var exportReference = this.getExportReferenceForReference(this.currentModule, nodePath);
    if (exportReference) {
      this.replacements.push(Replacement.swaps(nodePath, exportReference));
    }
  }

  return false;
};

/**
 * Process all variable declarations looking for top-level exported variables.
 *
 * @param {NodePath} nodePath
 * @private
 */
Rewriter.prototype.visitVariableDeclaration = function(nodePath) {
  if (nodePath.scope.isGlobal) {
    var replacement = this.formatter.processVariableDeclaration(this.currentModule, nodePath);
    if (replacement) {
      this.replacements.push(replacement);
    }
  }

  this.traverse(nodePath);
};

/**
 * We need to ensure that the LHS of this assignment is not an imported binding.
 * If it is, we throw a "compile"-time error since this is not allowed by the
 * spec (see section 12.14.1, Assignment Operators / Static Semantics: Early
 * Errors).
 *
 * @param {NodePath} nodePath
 * @private
 */
Rewriter.prototype.visitAssignmentExpression = function(nodePath) {
  this.assertImportIsNotReassigned(this.currentModule, nodePath.get('left'));
  if (this.currentModule.exports.findDeclarationForReference(nodePath.get('left'))) {
    var replacement = this.formatter.processExportReassignment(this.currentModule, nodePath);
    if (replacement) {
      this.replacements.push(replacement);
    }
  }

  this.traverse(nodePath);
};

/**
 * Process all top-level function declarations in case they need to be processed.
 *
 * @param {NodePath} nodePath
 * @private
 */
Rewriter.prototype.visitFunctionDeclaration = function(nodePath) {
  if (n.Program.check(nodePath.parent.node)) {
    var replacement = this.formatter.processFunctionDeclaration(this.currentModule, nodePath);
    if (replacement) {
      this.replacements.push(replacement);
    }
  }

  this.traverse(nodePath);
};

/**
 * Process all top-level class declarations in case they need to be processed.
 *
 * @param {NodePath} nodePath
 * @private
 */
Rewriter.prototype.visitClassDeclaration = function(nodePath) {
  if (n.Program.check(nodePath.parent.node)) {
    var replacement = this.formatter.processClassDeclaration(this.currentModule, nodePath);
    if (replacement) {
      this.replacements.push(replacement);
    }
  }

  this.traverse(nodePath);
};

/**
 * Look for all export declarations so we can rewrite them.
 *
 * @param {NodePath} nodePath
 * @private
 */
Rewriter.prototype.visitExportDeclaration = function(nodePath) {
  assertStatementIsTopLevel(this.currentModule, nodePath);

  var replacement;
  if (nodePath.node.default) {
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
    var declaration = nodePath.node.declaration;
    var declarationPath = nodePath.get('declaration');
    if (astUtil.isReference(declarationPath)) {
      var exportReference = this.getExportReferenceForReference(this.currentModule, declarationPath);
      if (exportReference) {
        declaration = exportReference;
      }
    }
    replacement = Replacement.swaps(nodePath, this.formatter.defaultExport(this.currentModule, declaration));
  } else {
    replacement = this.formatter.processExportDeclaration(this.currentModule, nodePath);
  }

  if (replacement) {
    this.replacements.push(replacement);
  }

  this.traverse(nodePath);
};

/**
 * Process import declarations so they can be rewritten.
 *
 * @param {NodePath} nodePath
 * @private
 */
Rewriter.prototype.visitImportDeclaration = function(nodePath) {
  assertStatementIsTopLevel(this.currentModule, nodePath);
  var replacement = this.formatter.processImportDeclaration(this.currentModule, nodePath);
  if (replacement) {
    this.replacements.push(replacement);
  }

  this.traverse(nodePath);
};

/**
 * Process update expressions (e.g. `a++`) so we can re-write modifications to
 * exported variables.
 *
 * @param {NodePath} nodePath
 * @private
 */
Rewriter.prototype.visitUpdateExpression = function(nodePath) {
  this.assertImportIsNotReassigned(this.currentModule, nodePath.get('argument'));
  if (this.currentModule.exports.findDeclarationForReference(nodePath.get('argument'))) {
    var replacement = this.formatter.processExportReassignment(this.currentModule, nodePath);
    if (replacement) {
      this.replacements.push(replacement);
    }
  }

  this.traverse(nodePath);
};

/**
 * We need to ensure that reference updates (i.e. `ref =`, `ref++`) are not
 * allowed for imported bindings. If it is, we throw a "compile"-time error
 * since this is not allowed by the spec (see section 12.14.1, Assignment
 * Operators / Static Semantics: Early Errors).
 *
 * @private
 * @param {Module} mod
 * @param {Identifier} nodePath
 */
Rewriter.prototype.assertImportIsNotReassigned = function(mod, nodePath) {
  var declarationPath;
  var identifierPath;
  var bindingDescription;

  if (n.Identifier.check(nodePath.node)) {
    // Do we have a named import…
    //
    //   import { foo } from 'foo';
    //
    // …that we then try to assign or update?
    //
    //   foo++;
    //   foo = 1;
    //
    declarationPath = mod.imports.findDeclarationForReference(nodePath);
    if (!declarationPath || !n.ImportSpecifier.check(declarationPath.parent.node)) {
      return;
    }

    bindingDescription = '`' + declarationPath.node.name + '`';
  } else if (n.MemberExpression.check(nodePath.node)) {
    // Do we have a namespace import…
    //
    //   import * as foo from 'foo';
    //
    // …with a property that we then try to assign or update?
    //
    //   foo.a++;
    //   foo.a = 1;
    //   foo['a'] = 1;
    //
    var objectPath = nodePath.get('object');

    if (!n.Identifier.check(objectPath.node)) {
      return;
    }

    declarationPath = mod.imports.findDeclarationForReference(objectPath);
    if (!declarationPath || !n.ImportNamespaceSpecifier.check(declarationPath.parent.node)) {
      return;
    }

    var propertyPath = nodePath.get('property');
    if (n.Identifier.check(propertyPath.node)) {
      bindingDescription = '`' + propertyPath.node.name + '`';
    } else {
      bindingDescription = 'of namespace `' + objectPath.node.name + '`';
    }
  } else {
    return;
  }

  throw new SyntaxError(
    'Cannot reassign imported binding ' + bindingDescription +
    ' at ' + sourcePosition(mod, nodePath.node)
  );
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
};

/**
 * Traverses ASTs only checking for invalid import/export declaration semantics.
 *
 * @constructor
 * @extends types.PathVisitor
 * @param {Module} mod
 * @private
 */
function DeclarationLinterVisitor(mod) {
  this.module = mod;
  types.PathVisitor.call(this);
}
extend(DeclarationLinterVisitor, types.PathVisitor);

/**
 * Checks that the import declaration is at the top level.
 *
 * @param {NodePath} nodePath
 */
DeclarationLinterVisitor.prototype.visitImportDeclaration = function(nodePath) {
  assertStatementIsTopLevel(this.module, nodePath);
};

/**
 * Checks that the export declaration is at the top level.
 *
 * @param {NodePath} nodePath
 */
DeclarationLinterVisitor.prototype.visitExportDeclaration = function(nodePath) {
  assertStatementIsTopLevel(this.module, nodePath);
};

/**
 * We need to ensure that all imports/exports are only at the top level. Esprima
 * should perhaps take care of this for us, but it does not.
 *
 * @param {Module} mod
 * @param {NodePath} nodePath
 * @private
 */
function assertStatementIsTopLevel(mod, nodePath) {
  if (!nodePath.scope.isGlobal) {
    throw new SyntaxError(
      'Unexpected non-top level ' + nodePath.node.type +
      ' found at ' + sourcePosition(mod, nodePath.node)
    );
  }
}

module.exports = Rewriter;
