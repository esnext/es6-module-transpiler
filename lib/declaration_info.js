/* jshint node:true, undef:true, unused:true */

var recast = require('recast');
var types = recast.types;
var n = types.namedTypes;

/**
 * Represents information about a declaration that creates a local binding
 * represented by `identifier`. For example, given that `declaration` is the
 * following variable declaration:
 *
 *   var a = 1;
 *
 * Then `identifier` references the `a` node in the variable declaration's
 * first declarator. Likewise, given that `declaration` is this function
 * declaration:
 *
 *   function add(a, b) {}
 *
 * Then `identifier` references the `add` node, the declaration's `id`.
 *
 * @constructor
 * @param {Node} declaration
 * @param {Identifier} identifier
 */
function DeclarationInfo(declaration, identifier) {
  /**
   * @type {Node}
   * @name DeclarationInfo#declaration
   */
  this.declaration = declaration;
  /**
   * @type {Identifier}
   * @name DeclarationInfo#identifier
   */
  this.identifier = identifier;
}

/**
 * Get the declaration info for the given identifier path, if the identifier is
 * actually part of a declaration.
 *
 * @param {NodePath} identifierPath
 * @return {?DeclarationInfo}
 */
DeclarationInfo.forIdentifierPath = function(identifierPath) {
  if (n.VariableDeclarator.check(identifierPath.parent.node)) {
    return new DeclarationInfo(
      identifierPath.parent.parent.node,
      identifierPath.node
    );
  } else if (n.ClassDeclaration.check(identifierPath.parent.node)) {
    return new DeclarationInfo(
      identifierPath.parent.node,
      identifierPath.node
    );
  } else if (n.FunctionDeclaration.check(identifierPath.parent.node)) {
    return new DeclarationInfo(
      identifierPath.parent.node,
      identifierPath.node
    );
  } else if (n.ImportSpecifier.check(identifierPath.parent.node)) {
    return new DeclarationInfo(
      identifierPath.parent.parent.node,
      identifierPath.node
    );
  } else if (n.ImportNamespaceSpecifier.check(identifierPath.parent.node)) {
    return new DeclarationInfo(
      identifierPath.parent.parent.node,
      identifierPath.node
    );
  } else if (n.ImportDefaultSpecifier.check(identifierPath.parent.node)) {
    return new DeclarationInfo(
      identifierPath.parent.parent.node,
      identifierPath.node
    );
  } else {
    return null;
  }
};

module.exports = DeclarationInfo;
