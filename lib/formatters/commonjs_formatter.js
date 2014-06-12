/* jshint node:true, undef:true, unused:true */

var assert = require('assert');

var recast = require('recast');
var types = recast.types;
var n = types.namedTypes;
var b = types.builders;

var Replacement = require('../replacement');

/**
 * The 'commonjs' setting for referencing exports aims to produce code that can
 * be used in environments using the CommonJS module system, such as Node.js.
 *
 * @constructor
 */
function CommonJSFormatter() {}

/**
 * Returns an expression which globally references the export named by
 * `identifier` for the given module `mod`. For example:
 *
 *    // rsvp/defer.js, export default
 *    rsvp$defer$$.default
 *
 *    // rsvp/utils.js, export function isFunction
 *    rsvp$utils$$.isFunction
 *
 * @param {Module} mod
 * @param {ast-types.Identifier} identifier
 * @return {ast-types.MemberExpression}
 */
CommonJSFormatter.prototype.reference = function(mod, identifier) {
  return b.memberExpression(
    b.identifier(mod.id),
    n.Identifier.check(identifier) ? identifier : b.identifier(identifier),
    false
  );
};

/**
 * Process a variable declaration found at the top level of the module. Since
 * we do not need to rewrite exported variables, we can leave variable
 * declarations alone.
 *
 * @param {Module} mod
 * @param {ast-types.NodePath} nodePath
 * @return {?Array.<ast-types.Node>}
 */
CommonJSFormatter.prototype.processVariableDeclaration = function(/* mod, nodePath */) {
  return null;
};

/**
 * Process a variable declaration found at the top level of the module. Since
 * we do not need to rewrite exported functions, we can leave function
 * declarations alone.
 *
 * @param {Module} mod
 * @param {ast-types.NodePath} nodePath
 * @returns {Array.<ast-types.Node>}
 */
CommonJSFormatter.prototype.processFunctionDeclaration = function(mod, nodePath) {
  return null;
};

/**
 * Because exported references are captured via a closure as part of a getter
 * on the `exports` object, there's no need to rewrite local references to
 * exported values. For example, `value` in this example can stay as is:
 *
 *   // a.js
 *   export var value = 1;
 *
 * @param {Module} mod
 * @param {ast-types.NodePath} referencePath
 * @return {ast-types.Expression}
 */
CommonJSFormatter.prototype.exportedReference = function(/* mod, referencePath */) {
  return null;
};

/**
 * Gets a reference to an imported binding by getting the value from the
 * required module on demand. For example, this module:
 *
 *   // b.js
 *   import { value } from './a';
 *   console.log(value);
 *
 * Would be rewritten to look something like this:
 *
 *   var a$$ = require('./a');
 *   console.log(a$$.value):
 *
 * If the given reference does not refer to an imported binding then no
 * rewriting is required and `null` will be returned.
 *
 * @param {Module} mod
 * @param {ast-types.NodePath} referencePath
 * @return {?ast-types.Expression}
 */
CommonJSFormatter.prototype.importedReference = function(mod, referencePath) {
  var specifier = mod.imports.findSpecifierForReference(referencePath);

  if (specifier) {
    return this.reference(
      specifier.declaration.source,
      specifier.from
    );
  } else {
    return null;
  }
};

/**
 * We do not need to rewrite references to local declarations.
 *
 * @param {Module} mod
 * @param {ast-types.NodePath} referencePath
 * @returns {?ast-types.Node}
 */
CommonJSFormatter.prototype.localReference = function(mod, referencePath) {
  return null;
};

/**
 * @param {Module} mod
 * @param {ast-types.Expression} declaration
 * @return {ast-types.Statement}
 */
CommonJSFormatter.prototype.defaultExport = function(mod, declaration) {
  return b.expressionStatement(
    b.assignmentExpression(
      '=',
      b.memberExpression(
        b.identifier('exports'),
        b.identifier('default'),
        false
      ),
      declaration
    )
  );
};

/**
 * Replaces non-default exports. For declarations we simply remove the `export`
 * keyword. For export declarations that just specify bindings, e.g.
 *
 *   export { a, b };
 *
 * we remove them entirely since they'll be handled when we define properties on
 * the `exports` object.
 *
 * @param {Module} mod
 * @param {ast-types.NodePath} nodePath
 * @return {?Replacement}
 */
CommonJSFormatter.prototype.processExportDeclaration = function(mod, nodePath) {
  var node = nodePath.node;

  if (n.FunctionDeclaration.check(node.declaration)) {
    return Replacement.swaps(nodePath, node.declaration);
  } else if (n.VariableDeclaration.check(node.declaration)) {
    return Replacement.swaps(nodePath, node.declaration);
  } else if (n.ClassDeclaration.check(node.declaration)) {
    return Replacement.swaps(nodePath, node.declaration);
  } else if (node.declaration) {
    throw new Error('unexpected export style, found a declaration of type: ' + node.declaration.type);
  } else {
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
CommonJSFormatter.prototype.processImportDeclaration = function(mod, nodePath) {
  return Replacement.removes(nodePath);
};

/**
 * Convert a list of ordered modules into a list of files.
 *
 * @param {Array.<Module>} modules Modules in execution order.
 * @return {Array.<ast-types.File}
 */
CommonJSFormatter.prototype.build = function(modules) {
  var self = this;
  return modules.map(function(mod) {
    var body = mod.ast.program.body;
    body.unshift(
      b.expressionStatement(b.literal('use strict')),
      self.buildRequires(mod)
    );
    body.push(self.buildExports(mod));
    mod.ast.filename = mod.relativePath;
    return mod.ast;
  });
};

/**
 * Build a series of requires based on the imports (and exports with sources)
 * in the given module.
 *
 * @private
 * @param {Module} mod
 * @return {ast-types.VariableDeclaration}
 */
CommonJSFormatter.prototype.buildRequires = function(mod) {
  var declarators = [];
  var requiredModules = [];

  [mod.imports, mod.exports].forEach(function(declarations) {
    declarations.modules.forEach(function(sourceModule) {
      if (requiredModules.indexOf(sourceModule) >= 0) {
        return;
      }
      requiredModules.push(sourceModule);

      var matchingDeclaration;
      declarations.declarations.some(function(declaration) {
        if (declaration.source === sourceModule) {
          matchingDeclaration = declaration;
          return true;
        }
      });

      assert.ok(
        matchingDeclaration,
        'no matching declaration for source module: ' + sourceModule.relativePath
      );

      // `(import|export) { ... } from 'math'` -> `math$$ = require('math')`
      declarators.push(b.variableDeclarator(
        b.identifier(sourceModule.id),
        b.callExpression(
          b.identifier('require'),
          [b.literal(matchingDeclaration.sourcePath)]
        )
      ));
    });
  });

  if (declarators.length > 0) {
    return b.variableDeclaration('var', declarators);
  } else {
    return b.emptyStatement();
  }
};

/**
 * @private
 * @param {Module} mod
 * @return {ast-types.Statement}
 */
CommonJSFormatter.prototype.buildExports = function(mod) {
  var self = this;
  var properties = [];

  mod.exports.names.forEach(function(name) {
    var specifier = mod.exports.findSpecifierByName(name);

    assert.ok(
      specifier,
      'no export specifier found for export name `' +
      name + '` from ' + mod.relativePath
    );

    if (!specifier.from) {
      return;
    }

    var from =
      specifier.importSpecifier ?
        self.reference(
          specifier.importSpecifier.declaration.source,
          specifier.importSpecifier.from
        ) :
      specifier.declaration.source ?
        self.reference(
          specifier.declaration.source,
          specifier.name
        ) :
        b.identifier(specifier.from);

    properties.push(b.property(
      'init',
      b.identifier(name),
      b.objectExpression([
        // Simulate named export bindings with a getter.
        b.property(
          'init',
          b.identifier('get'),
          b.functionExpression(
            null,
            [],
            b.blockStatement([b.returnStatement(from)])
          )
        ),
        b.property(
          'init',
          b.identifier('enumerable'),
          b.literal(true)
        )
      ])
    ));
  });

  var exportObject = b.identifier('exports');

  if (properties.length > 0) {
    exportObject = b.callExpression(
      b.memberExpression(
        b.identifier('Object'),
        b.identifier('defineProperties'),
        false
      ),
      [
        exportObject,
        b.objectExpression(properties)
      ]
    );
  }

  return b.expressionStatement(
    b.callExpression(
      b.memberExpression(
        b.identifier('Object'),
        b.identifier('seal'),
        false
      ),
      [exportObject]
    )
  );
};

module.exports = CommonJSFormatter;
