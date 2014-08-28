/* jshint node:true, undef:true, unused:true */

var recast = require('recast');

/** @typedef [NodePath, AST.Node[]] */
var ReplacementPair;

/**
 * Represents a replacement of a node path with zero or more nodes.
 *
 * @constructor
 * @param {NodePath=} nodePath
 * @param {AST.Node[]=} nodes
 */
function Replacement(nodePath, nodes) {
  /**
   * @private
   * @type {ReplacementPair[]}
   */
  this.queue = [];
  if (nodePath && nodes) {
    this.queue.push([nodePath, nodes]);
  }
}

/**
 * Performs the replacement.
 */
Replacement.prototype.replace = function() {
  for (var i = 0, length = this.queue.length; i < length; i++) {
    var item = this.queue[i];
    item[0].replace.apply(item[0], item[1]);
  }
};

/**
 * Incorporates the replacements from the given Replacement into this one.
 *
 * @param {Replacement} anotherReplacement
 */
Replacement.prototype.and = function(anotherReplacement) {
  this.queue.push.apply(this.queue, anotherReplacement.queue);
  return this;
};

/**
 * Constructs a Replacement that, when run, will remove the node from the AST.
 *
 * @param {NodePath} nodePath
 * @return {Replacement}
 */
Replacement.removes = function(nodePath) {
  return new Replacement(nodePath, []);
};

/**
 * Constructs a Replacement that, when run, will insert the given nodes after
 * the one in nodePath.
 *
 * @param {NodePath} nodePath
 * @param {AST.Node[]} nodes
 * @return {Replacement}
 */
Replacement.adds = function(nodePath, nodes) {
  return new Replacement(nodePath, [nodePath.node].concat(nodes));
};

/**
 * Constructs a Replacement that, when run, swaps the node in nodePath with the
 * given node or nodes.
 *
 * @param {NodePath} nodePath
 * @param {AST.Node|AST.Node[]} nodes
 */
Replacement.swaps = function(nodePath, nodes) {
  if (!Array.isArray(nodes)) {
    nodes = [nodes];
  }
  return new Replacement(nodePath, nodes);
};

Replacement.map = function(nodePaths, callback) {
  var result = new Replacement();

  nodePaths.each(function(nodePath) {
    var replacement = callback(nodePath);
    if (replacement) {
      result.and(replacement);
    }
  });

  return result;
};

module.exports = Replacement;
