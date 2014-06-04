/* jshint node:true, undef:true, unused:true */

var assert = require('assert');

var recast = require('recast');
var types = recast.types;
var b = types.builders;
var n = types.namedTypes;

var Replacement = require('../replacement');
var utils = require('../utils');
var IFFE = utils.IFFE;
var sourcePosition = utils.sourcePosition;
var sort = require('../sorting').sort;


/**
 * The variable class of export strategies concatenate all modules together,
 * isolating their local variables. All exports and imports are rewritten to
 * reference variables in a shared parent scope. For example, given these
 * modules:
 *
 *   // a.js
 *   import { b } from './b';
 *
 *   // b.js
 *   export var b = 3;
 *
 * The final output will be a single file looking something like this:
 *
 *   (function() {
 *     // variable declarations here
 *
 *     (function() {
 *       // b.js, sets variables declared above
 *     })();
 *
 *     (function() {
 *       // a.js, references variables declared above
 *     })();
 *   })();
 *
 * @constructor
 */
function VariableFormatterBase() {}

/**
 * This hook is called by the container before it converts its modules. We use
 * it to ensure all of the imports are included because we need to know about
 * them at compile time.
 *
 * @param {Container} container
 */
VariableFormatterBase.prototype.beforeConvert = function(container) {
  container.findImportedModules();
};

/**
 * Returns an expression which globally references the export named by
 * `identifier` for the given module `mod`.
 *
 * @param {Module} mod
 * @param {ast-types.Identifier|string} identifier
 * @return {ast-types.MemberExpression}
 */
VariableFormatterBase.prototype.reference = function(/* mod, identifier */) {
  throw new Error('#reference must be implemented in subclasses');
};

/**
 * Process a variable declaration found at the top level of the module. We need
 * to ensure that exported variables are rewritten appropriately, so we may
 * need to rewrite some or all of this variable declaration. For example:
 *
 *   var a = 1, b, c = 3;
 *   ...
 *   export { a, b };
 *
 * We turn those being exported into assignments as needed, e.g.
 *
 *   var c = 3;
 *   mod$$a = 1;
 *
 * @param {Module} mod
 * @param {ast-types.NodePath} nodePath
 * @return {?Replacement}
 */
VariableFormatterBase.prototype.processVariableDeclaration = function(mod, nodePath) {
  var exports = mod.exports;
  var node = nodePath.node;
  var self = this;
  var declarators = [];
  var assignments = [];
  var exportSpecifier;

  node.declarations.forEach(function(declarator) {
    exportSpecifier = exports.findSpecifierByName(declarator.id.name);
    if (exportSpecifier) {
      // This variable is exported, turn it into a normal assignment.
      if (declarator.init) {
        // But only if we have something to assign with.
        assignments.push(
          b.assignmentExpression(
            '=',
            self.reference(mod, declarator.id),
            declarator.init
          )
        );
      }
    } else {
      // This variable is not exported, so keep it.
      declarators.push(declarator);
    }
  });

  // Don't bother replacing it if we kept all declarators.
  if (node.declarations.length === declarators.length) {
    return null;
  }

  var nodes = [];

  // Do we need a variable declaration at all?
  if (declarators.length > 0) {
    nodes.push(
      b.variableDeclaration(node.kind, declarators)
    );
  }

  // Do we have any assignments to add?
  if (assignments.length > 0) {
    nodes.push(b.expressionStatement(
      b.sequenceExpression(assignments)
    ));
  }
  return Replacement.swaps(nodePath, nodes);
};

/**
 * Appends an assignment after a function declaration if that function is exported. For example,
 *
 *   function foo() {}
 *   // ...
 *   export { foo };
 *
 * Becomes e.g.
 *
 *   function foo() {}
 *   mod$$foo = foo;
 *
 * @param {Module} mod
 * @param {ast-types.NodePath} nodePath
 * @return {?Replacement}
 */
VariableFormatterBase.prototype.processFunctionDeclaration = function(mod, nodePath) {
  var exports = mod.exports;
  var node = nodePath.node;
  var exportSpecifier = exports.findSpecifierByName(node.id.name);

  // No need for an assignment to an export if it isn't exported.
  if (!exportSpecifier) {
    return null;
  }

  // Add an assignment, e.g. `mod$$foo = foo`.
  var assignment = b.expressionStatement(
    b.assignmentExpression(
      '=',
      this.reference(mod, exportSpecifier.name),
      node.id
    )
  );

  return Replacement.adds(nodePath, assignment);
};

/**
 * Replaces non-default exports. Since we mostly rewrite references we may need
 * to deconstruct variable declarations. Exported bindings do not need to be
 * replaced with actual statements since they only control reference rewrites.
 *
 * @param {Module} mod
 * @param {ast-types.NodePath} nodePath
 * @return {?Replacement}
 */
VariableFormatterBase.prototype.processExportDeclaration = function(mod, nodePath) {
  var node = nodePath.node;
  var self = this;
  if (n.FunctionDeclaration.check(node.declaration)) {
    /**
     * Function exports are declarations and so should not be
     * re-assignable, so we can safely turn remove the `export` keyword and
     * add an assignment. For example:
     *
     *   export function add(a, b) { return a + b; }
     *
     * Becomes:
     *
     *   function add(a, b) { return a + b; }
     *   mod$$.add = add;
     */
    return Replacement.swaps(
      nodePath,
      [
        node.declaration,
        b.expressionStatement(
          b.assignmentExpression(
            '=',
            this.reference(mod, node.declaration.id),
            node.declaration.id
          )
        )
      ]
    );
  } else if (n.VariableDeclaration.check(node.declaration)) {
    /**
     * Variable exports can be re-assigned, so we need to rewrite the
     * names. For example:
     *
     *   export var a = 1, b = 2;
     *
     * Becomes:
     *
     *   mod$$.a = 1, mod$$.b = 2;
     */
    return Replacement.swaps(
      nodePath,
      b.expressionStatement(
        b.sequenceExpression(
          node.declaration.declarations.reduce(function(assignments, declarator) {
            if (declarator.init) {
              assignments.push(
                b.assignmentExpression(
                  '=',
                  self.reference(mod, declarator.id),
                  declarator.init
                )
              );
            }
            return assignments;
          }, [])
        )
      )
    );
  } else if (node.declaration) {
    throw new Error('unexpected export style, found a declaration of type: ' + node.declaration.type);
  } else {
    /**
     * For exports with a named specifier list we handle them by re-writing
     * their declaration (if it's in this module) and their references, so
     * the export declaration can be safely removed.
     */
    return Replacement.removes(nodePath);
  }
};

/**
 * Since import declarations only control how we rewrite references we can just
 * remove them -- they don't turn into any actual statements.
 *
 * @param {Module} mod
 * @param {ast-types.NodePath} nodePath
 * @return {?Replacement}
 */
VariableFormatterBase.prototype.processImportDeclaration = function(mod, nodePath) {
  return Replacement.removes(nodePath);
};

/**
 * Module declarations do create a local binding by creating an object with
 * getters for each of the imported module's exports.
 *
 * @param {Module} mod
 * @param {ast-types.NodePath} nodePath
 * @return {?Replacement}
 */
VariableFormatterBase.prototype.processModuleDeclaration = function(mod, nodePath) {
  var moduleDeclaration;
  for (var i = 0, length = mod.imports.declarations.length; i < length; i++) {
    var declaration = mod.imports.declarations[i];
    if (declaration.node === nodePath.node) {
      moduleDeclaration = declaration;
    }
  }
  assert.ok(
    moduleDeclaration,
    'expected a module declaration for ' + sourcePosition(nodePath.node)
  );

  var self = this;
  return Replacement.swaps(nodePath, [b.variableDeclaration(
    'var',
    [b.variableDeclarator(
      moduleDeclaration.id,
      b.callExpression(
        b.memberExpression(
          b.identifier('Object'),
          b.identifier('seal'),
          false
        ),
        [
          b.objectExpression(
            moduleDeclaration.source.exports.names.map(function(name) {
              return b.property('get', b.identifier(name), b.functionExpression(
                null,
                [],
                b.blockStatement([
                  b.returnStatement(
                    self.reference(moduleDeclaration.source, b.identifier(name))
                  )
                ])
              ));
            })
          )
        ]
      )
    )]
  )]);
};

/**
 * Get a reference to the original exported value referenced in `mod` at
 * `referencePath`. If the given reference path does not correspond to an
 * export, we do not need to rewrite the reference. For example, since `value`
 * is not exported it does not need to be rewritten:
 *
 *   // a.js
 *   var value = 99;
 *   console.log(value);
 *
 * If `value` was exported then we would need to rewrite it:
 *
 *   // a.js
 *   export var value = 3;
 *   console.log(value);
 *
 * In this case we re-write both `value` references to something like
 * `a$$value`. The tricky part happens when we re-export an imported binding:
 *
 *   // a.js
 *   export var value = 11;
 *
 *   // b.js
 *   import { value } from './a';
 *   export { value };
 *
 *   // c.js
 *   import { value } from './b';
 *   console.log(value);
 *
 * The `value` reference in a.js will be rewritten as something like `a$$value`
 * as expected. The `value` reference in c.js will not be rewritten as
 * `b$$value` despite the fact that it is imported from b.js. This is because
 * we must follow the binding through to its import from a.js. Thus, our
 * `value` references will both be rewritten to `a$$value` to ensure they
 * match.
 *
 * @param {Module} mod
 * @param {ast-types.NodePath} referencePath
 * @return {ast-types.Expression}
 */
VariableFormatterBase.prototype.exportedReference = function(mod, referencePath) {
  var specifier = mod.exports.findSpecifierForReference(referencePath);
  if (specifier) {
    specifier = specifier.terminalExportSpecifier;
    return this.reference(specifier.module, specifier.name);
  } else {
    return null;
  }
};

/**
 * Get a reference to the original exported value referenced in `mod` at
 * `referencePath`. This is very similar to {#exportedReference} in its
 * approach.
 *
 * @param {Module} mod
 * @param {ast-types.NodePath} referencePath
 * @return {ast-types.Expression}
 * @see {#exportedReference}
 */
VariableFormatterBase.prototype.importedReference = function(mod, referencePath) {
  var specifier = mod.imports.findSpecifierForReference(referencePath);
  if (specifier) {
    specifier = specifier.terminalExportSpecifier;
    return this.reference(specifier.module, specifier.name);
  } else {
    return null;
  }
};

/**
 * Convert a list of ordered modules into a list of files.
 *
 * @param {Array.<Module>} modules Modules in execution order.
 * @return {Array.<ast-types.File}
 */
VariableFormatterBase.prototype.build = function(modules) {
  modules = sort(modules);
  return [b.file(b.program([b.expressionStatement(IFFE(
    b.expressionStatement(b.literal('use strict')),
    this.variableDeclaration(modules),
    modules.length === 1 ?
      modules[0].ast.program.body :
      modules.map(function(mod) {
        return b.expressionStatement(IFFE(mod.ast.program.body));
      })
  ))]))];
};

/**
 * @param {Module} mod
 * @param {ast-types.Expression} declaration
 * @return {ast-types.Statement}
 */
VariableFormatterBase.prototype.defaultExport = function(mod, declaration) {
  return b.expressionStatement(
    b.assignmentExpression(
      '=',
      this.reference(mod, 'default'),
      declaration
    )
  );
};

/**
 * Returns a declaration for the exports for the given modules. In this case,
 * this is always just the the module objects (e.g. `var rsvp$defer$$ = {};`).
 *
 * @param {Array.<Module>} modules
 * @return {ast-types.VariableDeclaration}
 */
VariableFormatterBase.prototype.variableDeclaration = function(modules) {
  var declarators = [];

  modules.forEach(function(mod) {
    if (mod.exports.names.length > 0) {
      declarators.push(
        b.variableDeclarator(b.identifier(mod.id), b.objectExpression([]))
      );
    }
  });

  if (declarators.length > 0) {
    return b.variableDeclaration('var', declarators);
  } else {
    return b.emptyStatement();
  }
};

module.exports = VariableFormatterBase;
