/**
 * Determines the execution order of the given modules. This function resolves
 * cycles by preserving the order in which the modules are visited.
 *
 * @param {Module[]} modules
 * @return {Module[]}
 */
function sort(modules) {
  var result = [];
  var state = {};

  modules.forEach(function(mod) {
    visit(mod, result, state);
  });

  return result;
}
exports.sort = sort;

/**
 * Visits the given module, adding it to `result` after visiting all of the
 * modules it imports, recursively. The `state` argument is private and maps
 * module ids to the current visit state.
 *
 * @private
 * @param {Module} mod
 * @param {Module[]} result
 * @param {Object.<string,string>} state
 */
function visit(mod, result, state) {
  if (state[mod.id] === 'added') {
    // already in the list, ignore it
    return;
  }
  if (state[mod.id] === 'seen') {
    // cycle found, just ignore it
    return;
  }
  state[mod.id] = 'seen';
  mod.imports.modules.forEach(function(mod) {
    visit(mod, result, state);
  });
  state[mod.id] = 'added';
  result.push(mod);
}
