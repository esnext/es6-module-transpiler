/* jshint node:true, undef:true, unused:true */

/**
 * Represents a replacement of a node path with zero or more nodes.
 *
 * @constructor
 * @param {ast-types.NodePath} nodePath
 * @param {Array.<ast-types.Node>} nodes
 */
function Replacement(nodePath, nodes) {
  this.nodePath = nodePath;
  this.nodes = nodes;
}

/**
 * Performs the replacement.
 */
Replacement.prototype.replace = function() {
  this.nodePath.replace.apply(this.nodePath, this.nodes);
};

/**
 * Constructs a Replacement that, when run, will remove the node from the AST.
 *
 * @param {ast-types.NodePath} nodePath
 * @returns {Replacement}
 */
Replacement.removes = function(nodePath) {
  return new Replacement(nodePath, []);
};

/**
 * Constructs a Replacement that, when run, will insert the given nodes after
 * the one in nodePath.
 *
 * @param {ast-types.NodePath} nodePath
 * @param {Array.<ast-types.Node>} nodes
 * @returns {Replacement}
 */
Replacement.adds = function(nodePath, nodes) {
  return new Replacement(nodePath, [nodePath.node].concat(nodes));
};

/**
 * Constructs a Replacement that, when run, swaps the node in nodePath with the
 * given node or nodes.
 *
 * @param {ast-types.NodePath} nodePath
 * @param {ast-types.Node|Array.<ast-types.Node>} nodes
 */
Replacement.swaps = function(nodePath, nodes) {
  if ({}.toString.call(nodes) !== '[object Array]') {
    nodes = [nodes];
  }
  return new Replacement(nodePath, nodes);
};

module.exports = Replacement;
