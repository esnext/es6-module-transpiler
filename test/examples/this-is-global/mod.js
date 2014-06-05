/* jshint esnext:true */

assert.strictEqual(
  this,
  global,
  '`this` (keys=' + Object.keys(this) + ') does not equal ' +
  '`global` (keys=' + Object.keys(global) + ')'
);