/* jshint node:true, undef:true, unused:true */

var recast = require('recast');
var types = recast.types;
var b = types.builders;
var n = types.namedTypes;

var Replacement = require('../replacement');
var utils = require('../utils');
var IIFE = utils.IIFE;
var extend = utils.extend;
var sort = require('../sorting').sort;
var Formatter = require('./formatter');


/**
 * The 'bundle' formatter aims to increase the compressibility of the generated
 * source, especially by tools such as Google Closure Compiler or UglifyJS.
 * For example, given these modules:
 *
 *   ```js
 *   // a.js
 *   import { b } from './b';
 *   console.log(b);
 *
 *   // b.js
 *   export var b = 3;
 *   export var b2 = 6;
 *   ```
 *
 * The final output will be a single file looking something like this:
 *
 *   ```js
 *   (function() {
 *     "use strict";
 *     // b.js
 *     var b$$b = 3;
 *     var b$$b2 = 6;
 *
 *     // a.js
 *     console.log(b$$b);
 *   }).call(this);
 *   ```
 *
 * @constructor
 */
function BundleFormatter() {
  Formatter.call(this);
}
extend(BundleFormatter, Formatter);

/**
 * This hook is called by the container before it converts its modules. We use
 * it to ensure all of the imports are included because we need to know about
 * them at compile time.
 *
 * @param {Container} container
 */
BundleFormatter.prototype.beforeConvert = function(container) {
  container.findImportedModules();

  // Cache all the import and export specifier names.
  container.getModules().forEach(function(mod) {
    [mod.imports, mod.exports].forEach(function(bindingList) {
      bindingList.declarations.forEach(function (declaration) {
        declaration.specifiers.forEach(function (specifier) {
          specifier.name;
        });
      });
    });
  });
};

/**
 * @override
 */
BundleFormatter.prototype.build = function(modules) {
  modules = sort(modules);
  return [b.file(b.program([b.expressionStatement(IIFE(
    b.expressionStatement(b.literal('use strict')),
      this.buildNamespaceImportObjects(modules),
      modules.length === 1 ?
      modules[0].ast.program.body :
      modules.reduce(function(statements, mod) {
        return statements.concat(mod.ast.program.body);
      }, [])
  ))]))];
};

/**
 * Builds a variable declaration that contains declarations of all the namespace
 * objects required by `import * as foo from 'foo'` statements.
 *
 * @private
 * @param {Module[]} modules
 * @return {?AST.VariableDeclaration}
 */
BundleFormatter.prototype.buildNamespaceImportObjects = function(modules) {
  var self = this;
  var namespaceImportedModules = [];

  // Collect all the modules imported using a namespace import declaration.
  modules.forEach(function(mod) {
    mod.imports.namespaceImports.forEach(function(namespaceImportDeclaration) {
      var namespaceImportedModule = namespaceImportDeclaration.source;
      if (namespaceImportedModules.indexOf(namespaceImportedModule) < 0) {
        namespaceImportedModules.push(namespaceImportedModule);
      }
    });
  });

  if (namespaceImportedModules.length === 0) {
    return null;
  }

  /**
   * Builds a variable declarator for the given module whose initial value is an
   * object with properties for each export from the module being imported. For
   * example, given a module "foo" with exports "a" and "b" this object will be
   * created:
   *
   *   foo$$ = {
   *     get a() {
   *       return foo$$a;
   *     },
   *
   *     get b() {
   *       return foo$$b;
   *     }
   *   }
   *
   * @param {Module} mod
   * @returns {AST.VariableDeclarator}
   */
  function createDeclaratorForModule(mod) {
    return b.variableDeclarator(
      b.identifier(mod.id),
      b.objectExpression(
        mod.exports.declarations.reduce(function(props, exportDeclaration) {
          exportDeclaration.specifiers.forEach(function(specifier) {
            props.push(createGetterForSpecifier(mod, specifier));
          });

          return props;
        }, [])
      )
    );
  }

  /**
   * Builds a getter property for retrieving the value of the given export
   * specifier at the time it is accessed. For example, given a module "foo"
   * with export specifier "a" this property will be created:
   *
   *   get a() {
   *     return foo$$a;
   *   }
   *
   * @param {Module} mod
   * @param {ExportSpecifier} specifier
   * @returns {AST.Property}
   */
  function createGetterForSpecifier(mod, specifier) {
    return b.property(
      'get',
      b.identifier(specifier.name),
      b.functionExpression(
        null,
        [],
        b.blockStatement([
          b.returnStatement(self.reference(mod, specifier.name))
        ])
      )
    );
  }

  return b.variableDeclaration(
    'var',
    namespaceImportedModules.map(createDeclaratorForModule)
  );
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
BundleFormatter.prototype.defaultExport = function(mod, declaration) {
  if (n.FunctionDeclaration.check(declaration) ||
      n.ClassDeclaration.check(declaration)) {
    // export default function foo () {}
    // -> becomes:
    // function <moduleName>foo () {}
    // var <moduleName>default = <moduleName>foo;
    var renamedDeclaration = Object.create(declaration);
    renamedDeclaration.id = this.reference(mod, declaration.id);
    return [
      renamedDeclaration,
      b.variableDeclaration(
        'var',
        [b.variableDeclarator(
          this.reference(mod, 'default'),
          this.reference(mod, declaration.id)
        )]
      )
    ];
  }
  return b.variableDeclaration(
    'var',
    [b.variableDeclarator(
      this.reference(mod, 'default'),
      declaration
    )]
  );
};

/**
 * Get a reference to the original exported value referenced in `mod` at
 * `referencePath`. If the given reference path does not correspond to an
 * export, we do not need to rewrite the reference. For example, since `value`
 * is not exported it does not need to be rewritten:
 *
 *   ```js
 *   // a.js
 *   var value = 99;
 *   console.log(value);
 *   ```
 *
 * If `value` was exported then we would need to rewrite it:
 *
 *   ```js
 *   // a.js
 *   export var value = 3;
 *   console.log(value);
 *   ```
 *
 * In this case we re-write both `value` references to something like
 * `a$$value`. The tricky part happens when we re-export an imported binding:
 *
 *   ```js
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
 *   ```
 *
 * The `value` reference in a.js will be rewritten as something like `a$$value`
 * as expected. The `value` reference in c.js will not be rewritten as
 * `b$$value` despite the fact that it is imported from b.js. This is because
 * we must follow the binding through to its import from a.js. Thus, our
 * `value` references will both be rewritten to `a$$value` to ensure they
 * match.
 *
 * @override
 */
BundleFormatter.prototype.exportedReference = function(mod, referencePath) {
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
 * `referencePath`. This is very similar to BundleFormatter#exportedReference
 * in its approach.
 *
 * @override
 */
BundleFormatter.prototype.importedReference = function(mod, referencePath) {
  var specifier = mod.imports.findSpecifierForReference(referencePath);

  if (!specifier) {
    return null;
  }

  if (specifier.from) {
    specifier = specifier.terminalExportSpecifier;
    if (n.ImportNamespaceSpecifier.check(specifier.node)) {
      // Reference the built namespace object, e.g. mod$$.
      return b.identifier(specifier.declaration.source.id);
    }
    return this.reference(specifier.module, specifier.name);
  } else {
    return b.identifier(specifier.declaration.source.id);
  }
};

/**
 * If the given reference has a local declaration at the top-level then we must
 * rewrite that reference to have a module-scoped name.
 *
 * @param {Module} mod
 * @param {NodePath} referencePath
 * @return {?Node}
 */
BundleFormatter.prototype.localReference = function(mod, referencePath) {
  var scope = referencePath.scope.lookup(referencePath.node.name);
  if (scope && scope.isGlobal) {
    return this.reference(mod, referencePath.node);
  } else {
    return null;
  }
};

/**
 * Replaces non-default exports. Exported bindings do not need to be
 * replaced with actual statements since they only control how local references
 * are renamed within the module.
 *
 * @override
 */
BundleFormatter.prototype.processExportDeclaration = function(mod, nodePath) {
  var node = nodePath.node;
  if (n.FunctionDeclaration.check(node.declaration)) {
    return Replacement.swaps(
      // drop `export`
      nodePath, node.declaration
    ).and(
      // transform the function
      this.processFunctionDeclaration(mod, nodePath.get('declaration'))
    );
  } else if (n.ClassDeclaration.check(node.declaration)) {
    return Replacement.swaps(
      // drop `export`
      nodePath, node.declaration
    ).and(
      // transform the class
      this.processClassDeclaration(mod, nodePath.get('declaration'))
    );
  } else if (n.VariableDeclaration.check(node.declaration)) {
    return Replacement.swaps(
      // drop `export`
      nodePath, node.declaration
    ).and(
      // transform the variables
      this.processVariableDeclaration(mod, nodePath.get('declaration'))
    );
  } else if (node.declaration) {
    throw new Error(
        'unexpected export style, found a declaration of type: ' +
        node.declaration.type
    );
  } else {
    /**
     * This node looks like this:
     *
     *   ```js
     *   export { foo, bar };
     *   ```
     *
     * Which means that it has no value in the generated code as its only
     * function is to control how imports are rewritten.
     */
    return Replacement.removes(nodePath);
  }
};

/**
 * Since named export reassignment is just a local variable, we can ignore it.
 * e.g.
 *
 *   ```js
 *   export var foo = 1;
 *   foo = 2;
 *   ```
 *
 * @override
 */
BundleFormatter.prototype.processExportReassignment = function(mod, nodePath) {
  return null;
};

/**
 * Rename the top-level function declaration to a unique name.
 *
 *   ```js
 *   function foo() {}
 *   ```
 *
 * Becomes e.g.
 *
 *   ```js
 *   function mod$$foo() {}
 *   ```
 *
 * @override
 */
BundleFormatter.prototype.processFunctionDeclaration = function(mod, nodePath) {
  return Replacement.swaps(
    nodePath.get('id'),
    this.reference(mod, nodePath.node.id)
  );
};

/**
 * Rename the top-level class declaration to a unique name.
 *
 *   ```js
 *   class Foo {}
 *   ```
 *
 * Becomes e.g.
 *
 *   ```js
 *   class mod$$Foo {}
 *   ```
 *
 * @override
 */
BundleFormatter.prototype.processClassDeclaration = function(mod, nodePath) {
  return Replacement.swaps(
    nodePath.get('id'),
    this.reference(mod, nodePath.node.id)
  );
};

/**
 * Since import declarations only control how we rewrite references we can just
 * remove them -- they don't turn into any actual statements.
 *
 * @override
 */
BundleFormatter.prototype.processImportDeclaration = function(mod, nodePath) {
  return Replacement.removes(nodePath);
};

/**
 * Process a variable declaration found at the top level of the module. We need
 * to ensure that exported variables are rewritten appropriately, so we may
 * need to rewrite some or all of this variable declaration. For example:
 *
 *   ```js
 *   var a = 1, b, c = 3;
 *   ...
 *   export { a, b };
 *   ```
 *
 * We turn those being exported into assignments as needed, e.g.
 *
 *   ```js
 *   var c = 3;
 *   mod$$a = 1;
 *   ```
 *
 * @override
 */
BundleFormatter.prototype.processVariableDeclaration = function(mod, nodePath) {
  var self = this;
  return Replacement.map(
    nodePath.get('declarations'),
    function(declaratorPath) {
      return Replacement.swaps(
        declaratorPath.get('id'),
        self.reference(mod, declaratorPath.get('id').node)
      );
    }
  );
};

/**
 * Returns an expression which globally references the export named by
 * `identifier` for the given module `mod`. For example:
 *
 *   ```js
 *   // rsvp/defer.js, export default
 *   rsvp$defer$$default
 *
 *   // rsvp/utils.js, export function isFunction
 *   rsvp$utils$$isFunction
 *   ```
 *
 * @param {Module} mod
 * @param {Identifier|string} identifier
 * @return {Identifier}
 * @private
 */
BundleFormatter.prototype.reference = function(mod, identifier) {
  return b.identifier(
    mod.id + (n.Identifier.check(identifier) ? identifier.name : identifier)
  );
};

module.exports = BundleFormatter;
