/* jshint node:true, undef:true, unused:true */

var assert = require('assert');
var recast = require('recast');
var types = recast.types;
var n = types.namedTypes;
var b = types.builders;
var util = require('ast-util');

var extend = require('../utils').extend;
var compatMemberExpression = require('../utils').compatMemberExpression;
var Replacement = require('../replacement');
var Formatter = require('./formatter');

/**
 * The 'commonjs' setting for referencing exports aims to produce code that can
 * be used in environments using the CommonJS module system, such as Node.js.
 *
 * @constructor
 */
function CommonJSFormatter() {
  Formatter.call(this);
}
extend(CommonJSFormatter, Formatter);

/**
 * Convert a list of ordered modules into a list of files.
 *
 * @param {Module[]} modules Modules in execution order.
 * @return {File[]}
 */
CommonJSFormatter.prototype.build = function(modules) {
  var self = this;
  return modules.map(function(mod) {
    var body = mod.ast.program.body;

    var requiresDeclaration = self.buildRequires(mod);
    var earlyExportsStatement = self.buildEarlyExports(mod);
    var lateExports = self.buildLateExports(mod);

    if (requiresDeclaration) {
      body.unshift(requiresDeclaration);
    }

    if (earlyExportsStatement) {
      body.unshift(earlyExportsStatement);
    }

    body.unshift(b.expressionStatement(b.literal('use strict')));

    if (lateExports) {
      body.push(lateExports);
    }

    mod.ast.filename = mod.relativePath;
    return mod.ast;
  });
};

/**
 * Process all export bindings which may be exported before any module code is
 * actually run, i.e. function declarations.
 *
 * @param {Module} mod
 * @returns {?AST.Statement}
 * @private
 */
CommonJSFormatter.prototype.buildEarlyExports = function(mod) {
  var assignments = [];
  var exportObject = b.identifier('exports');

  this.forEachExportBinding(mod, function(specifier, name) {
    if (!n.FunctionDeclaration.check(specifier.declaration.node.declaration)) {
      // Only function declarations are handled as early exports.
      return;
    }

    assignments.push(b.assignmentExpression(
      '=',
      compatMemberExpression(
        exportObject,
        name
      ),
      b.identifier(specifier.from)
    ));
  });

  if (assignments.length > 0) {
    return b.expressionStatement(
      b.sequenceExpression(assignments)
    );
  } else {
    return null;
  }
};

/**
 * Process all export bindings which were not exported at the beginning of the
 * module, i.e. everything except function declarations.
 *
 * @param {Module} mod
 * @returns {?AST.Statement}
 * @private
 */
CommonJSFormatter.prototype.buildLateExports = function(mod) {
  var self = this;
  var assignments = [];
  var exportObject = b.identifier('exports');

  this.forEachExportBinding(mod, function(specifier, name) {
    if (n.FunctionDeclaration.check(specifier.declaration.node.declaration)) {
      // Function declarations are handled as early exports.
      return;
    }

    var from;

    if (specifier.importSpecifier) {
      if (n.ImportNamespaceSpecifier.check(specifier.importSpecifier.node)) {
        from = b.identifier(specifier.importSpecifier.declaration.source.id)
      } else {
        from = self.reference(
          specifier.importSpecifier.declaration.source,
          specifier.importSpecifier.from
        );
      }
    } else if (specifier.declaration.source) {
      from = self.reference(
        specifier.declaration.source,
        specifier.name
      );
    } else {
      from = b.identifier(specifier.from);
    }

    assignments.push(b.assignmentExpression(
      '=',
      compatMemberExpression(
        exportObject,
        name
      ),
      from
    ));
  });

  if (assignments.length > 0) {
    return b.expressionStatement(
      b.sequenceExpression(assignments)
    );
  } else {
    return null;
  }
};

/**
 * Iterates over each exported binding and calls `iterator` with its specifier.
 *
 * @param {Module} mod
 * @param {function(ModuleBindingSpecifier, string)} iterator
 * @private
 */
CommonJSFormatter.prototype.forEachExportBinding = function(mod, iterator) {
  mod.exports.names.forEach(function(name) {
    var specifier = mod.exports.findSpecifierByName(name);

    assert.ok(
      specifier,
        'no export specifier found for export name `' +
        name + '` from ' + mod.relativePath
    );

    if (!specifier.from) {
      // Default exports are handled elsewhere.
      return;
    }

    iterator(specifier, name);
  });
};

/**
 * Build a series of requires based on the imports (and exports with sources)
 * in the given module.
 *
 * @private
 * @param {Module} mod
 * @return {?AST.VariableDeclaration}
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
    return null;
  }
};

/**
 * @override
 *
 *   ```js
 *   export default <FunctionDeclaration|ClassDeclaration>
 *   // or
 *   export default <declaration|expression>;
 *   ```
 */
CommonJSFormatter.prototype.defaultExport = function(mod, declaration) {
  if (n.FunctionDeclaration.check(declaration) ||
      n.ClassDeclaration.check(declaration)) {
    // export default function foo () {}
    // -> becomes:
    // function foo () {}
    // export['default'] = foo;
    return [
      declaration,
      b.expressionStatement(b.assignmentExpression(
        '=',
        b.memberExpression(
          b.identifier('exports'),
          b.literal('default'),
          true
        ),
        declaration.id
      ))
    ];
  }
  return b.expressionStatement(b.assignmentExpression(
    '=',
    b.memberExpression(
      b.identifier('exports'),
      b.literal('default'),
      true
    ),
    declaration
  ));
};

/**
 * Because exported references are captured via a closure as part of a getter
 * on the `exports` object, there's no need to rewrite local references to
 * exported values. For example, `value` in this example can stay as is:
 *
 *   // a.js
 *   export var value = 1;
 *
 * @override
 */
CommonJSFormatter.prototype.exportedReference = function(mod, referencePath) {
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
 * @override
 */
CommonJSFormatter.prototype.importedReference = function(mod, referencePath) {
  var specifier = mod.imports.findSpecifierForReference(referencePath);

  if (!specifier) {
    return null;
  }

  if (specifier.from) {
    // import { value } from './a';
    // import a from './a';
    return this.reference(
      specifier.declaration.source,
      specifier.from
    );
  } else {
    // import * as a from './a'
    return b.identifier(specifier.declaration.source.id);
  }
};

/**
 * We do not need to rewrite references to local declarations.
 *
 * @override
 */
CommonJSFormatter.prototype.localReference = function(mod, referencePath) {
  return null;
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
 * @override
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
 * We explicitly disallow reassignment because we cannot propagate changes to
 * importing modules as we would in ES5, e.g. these are both disallowed:
 *
 * export var foo = 1;
 * foo = 2;
 *
 * export var bar = 1;
 * bar++;
 *
 * @override
 */
CommonJSFormatter.prototype.processExportReassignment = function(mod, nodePath) {
  var node = nodePath.node;
  var exportName;

  if (n.AssignmentExpression.check(node)) {
    exportName = node.left.name;
  } else if (n.UpdateExpression.check(node)) {
    exportName = node.argument.name;
  } else {
    throw new Error('unexpected export reassignment type: ' + node.type);
  }


  if (n.UpdateExpression.check(node) && !node.prefix) {
    /**
     * The result of `a++` is the value of `a` before it is incremented, so we
     * can't just use the result as the new value for `exports.a`. The question
     * is whether we need to preserve the result of `a++` or not. In this case,
     * we do:
     *
     *   ```js
     *   foo(a++);
     *   ```
     *
     * But in this case we don't, since the result is ignored:
     *
     *   ```js
     *   a++;
     *   ```
     */

    if (n.ExpressionStatement.check(nodePath.parent.node)) {
      // The result is ignored here, so `a++` can become `a++, exports.a = a`.
      return Replacement.swaps(
        nodePath,
        b.sequenceExpression([
          node,
          b.assignmentExpression(
            '=',
            compatMemberExpression(
              b.identifier('exports'),
              exportName
            ),
            b.identifier(exportName)
          )
        ])
      );
    } else {
      // The result is used here, so we need a temporary variable to store it.
      var result = util.injectVariable(nodePath.scope, util.uniqueIdentifier(nodePath.scope));

      return Replacement.swaps(
        nodePath,
        b.sequenceExpression([
          b.assignmentExpression(
            '=',
            result,
            node
          ),
          b.assignmentExpression(
            '=',
            compatMemberExpression(
              b.identifier('exports'),
              exportName
            ),
            b.identifier(exportName)
          ),
          result
        ])
      );
    }
  }

  /**
   * We can use the result of the update/assignment as-is in this case, e.g.
   *
   *   ```js
   *   foo(++a);
   *   b = 9;
   *   ```
   *
   * Can become:
   *
   *   ```js
   *   foo(exports.a = ++a);
   *   exports.b = b = 9;
   *   ```
   */
  return Replacement.swaps(
    nodePath,
    b.assignmentExpression(
      '=',
      compatMemberExpression(
        b.identifier('exports'),
        exportName
      ),
      node
    )
  );
};

/**
 * Process a function declaration found at the top level of the module. Since
 * we do not need to rewrite exported functions, we can leave function
 * declarations alone.
 *
 * @override
 */
CommonJSFormatter.prototype.processFunctionDeclaration = function(mod, nodePath) {
  return null;
};

/**
 * Process a class declaration found at the top level of the module. Since
 * we do not need to rewrite exported classes, we can leave class
 * declarations alone.
 *
 * @override
 */
CommonJSFormatter.prototype.processClassDeclaration = function(mod, nodePath) {
  return null;
};

/**
 * Since import declarations only control how we rewrite references we can just
 * remove them -- they don't turn into any actual statements.
 *
 * @override
 */
CommonJSFormatter.prototype.processImportDeclaration = function(mod, nodePath) {
  return Replacement.removes(nodePath);
};

/**
 * Process a variable declaration found at the top level of the module. Since
 * we do not need to rewrite exported variables, we can leave variable
 * declarations alone.
 *
 * @override
 */
CommonJSFormatter.prototype.processVariableDeclaration = function(mod, nodePath) {
  return null;
};

/**
 * Returns an expression which globally references the export named by
 * `identifier` for the given module `mod`. For example:
 *
 *    // rsvp/defer.js, export default
 *    rsvp$defer$$['default']
 *
 *    // rsvp/utils.js, export function isFunction
 *    rsvp$utils$$.isFunction
 *
 * @param {Module} mod
 * @param {Identifier} identifier
 * @return {MemberExpression}
 * @private
 */
CommonJSFormatter.prototype.reference = function(mod, identifier) {
  return compatMemberExpression(
    b.identifier(mod.id),
    identifier
  );
};

module.exports = CommonJSFormatter;
