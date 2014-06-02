/* jshint node:true, undef:true, unused:true */

var assert = require('assert');

var utils = require('./utils');
var memo = utils.memo;
var sourcePosition = utils.sourcePosition;

/**
 * Represents a list of bindings for the given module. This corresponds to the
 * shared functionality from `ExportsList` and `ImportsList` from the ES6 spec.
 *
 * @abstract
 * @constructor
 * @param {Module} mod
 */
function ModuleBindingList(mod) {
  Object.defineProperties(this, {
    _nodes: {
      value: []
    },

    module: {
      value: mod
    }
  });
}

/**
 * Add all the binding declarations from the given scope body. Generally this
 * should be the Program node's `body` property, an array of statements.
 *
 * @param {ast-types.Program} program
 */
ModuleBindingList.prototype.readProgram = function(program) {
  var body = program.body;
  for (var i = 0; i < body.length; i++) {
    if (this.isMatchingBinding(body[i])) {
      this.addDeclaration(body[i]);
    }
  }
};

/**
 * Adds a declaration to the list.
 *
 * @private
 * @param {ast-types.ImportDeclaration|ast-types.ExportDeclaration} node
 */
ModuleBindingList.prototype.addDeclaration = function(node) {
  assert.ok(
    this.isMatchingBinding(node),
    'expected node to be an declaration, but got ' +
    (node && node.type)
  );
  this._nodes.push(node);

  // reset the cache
  delete this.declarations;
  delete this.specifiers;
  delete this.modules;
};

/**
 * Gets the module scope.
 *
 * @type {ast-types.Scope}
 * @property scope
 */
memo(ModuleBindingList.prototype, 'moduleScope', function() {
  return this.module.scope;
});

/**
 * Gets all the modules referenced by the declarations in this list.
 *
 * @type {Array.<Module>}
 * @property modules
 */
memo(ModuleBindingList.prototype, 'modules', function() {
  var modules = [];

  this.declarations.forEach(function(declaration) {
    if (declaration.source && modules.indexOf(declaration.source) < 0) {
      modules.push(declaration.source);
    }
  });

  return modules;
});

/**
 * Finds the specifier that creates the local binding given by `name`, if one
 * exists. Otherwise `null` is returned.
 *
 * @private
 * @param {string} name
 * @return {?ModuleBindingSpecifier}
 */
ModuleBindingList.prototype.findSpecifierByName = function(name) {
  for (var i = 0, length = this.declarations.length; i < length; i++) {
    var specifier = this.declarations[i].findSpecifierByName(name);
    if (specifier) { return specifier; }
  }

  return null;
};

/**
 * @private
 * @param {ast-types.Identifier} identifier
 * @return {?ModuleBindingSpecifier}
 */
ModuleBindingList.prototype.findSpecifierByIdentifier = function(identifier) {
  for (var i = 0, length = this.declarations.length; i < length; i++) {
    var specifier = this.declarations[i].findSpecifierByIdentifier(identifier);
    if (specifier && specifier.identifier === identifier) {
      return specifier;
    }
  }

  return null;
};

/**
 * @param {ast-types.NodePath} referencePath
 * @return {?ModuleBindingSpecifier}
 */
ModuleBindingList.prototype.findSpecifierForReference = function(referencePath) {
  var declaration = this.findDeclarationForReference(referencePath);

  if (!declaration) {
    return null;
  }

  var specifier = this.findSpecifierByIdentifier(declaration.node);
  assert.ok(
    specifier,
    'no specifier found for `' + referencePath.node.name + '`! this should not happen!'
  );
  return specifier;
};

/**
 * @private
 */
ModuleBindingList.prototype.findDeclarationForReference = function(referencePath) {
  // Check names to avoid traversing scopes for all references.
  if (this.names.indexOf(referencePath.node.name) < 0) {
    return null;
  }

  var node = referencePath.node;
  var declaringScope = referencePath.scope.lookup(node.name);
  assert.ok(
    declaringScope,
    '`' + node.name + '` at ' + sourcePosition(this.module, node) +
    ' cannot be bound if it is not declared'
  );

  // Bindings are at the top level, so if this isn't then it's shadowing.
  if (!declaringScope.isGlobal) {
    return null;
  }

  var declarations = declaringScope.getBindings()[node.name];
  assert.ok(
    declarations && declarations.length === 1,
    'expected one declaration for `' + node.name +
    '`, at ' + sourcePosition(this.module, node) +
    ' but found ' + (declarations ? declarations.length : 'none')
  );

  return declarations[0];
};

/**
 * Generate a string representing this object to aid debugging.
 *
 * @return {string}
 */
ModuleBindingList.prototype.inspect = function() {
  var result = '#<' + this.constructor.name;

  result += ' module=' + this.module.relativePath;

  if (this.declarations.length > 0) {
    result += ' declarations=' + this.declarations.map(function(imp) {
      return imp.inspect();
    }).join(', ');
  }

  result += '>';
  return result;
};

/**
 * @alias {#inspect}
 */
ModuleBindingList.prototype.toString = ModuleBindingList.prototype.inspect;

/**
 * Contains a list of declarations.
 *
 * @type {Array.<(Import|Export)>}
 * @property declarations
 */
memo(ModuleBindingList.prototype, 'declarations', function() {
  var self = this;

  return this._nodes.map(function(child) {
    return self.declarationForNode(child);
  });
});

/**
 * Contains a combined list of names for all the declarations contained in this
 * list.
 *
 * @type {Array.<string>}
 * @property names
 */
memo(ModuleBindingList.prototype, 'names', function() {
  return this.declarations.reduce(function(names, decl) {
    return names.concat(decl.specifiers.map(function(specifier) {
      return specifier.name;
    }));
  }, []);
});

module.exports = ModuleBindingList;
