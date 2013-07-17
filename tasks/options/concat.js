module.exports = {
  dist: {
    src: [
      // FIXME: This one really ought to be require('es6ify').runtime.
      // See https://github.com/thlorenz/es6ify/issues/3.
      'node_modules/es6ify/node_modules/node-traceur/src/runtime/runtime.js',
      'tmp/es6-module-transpiler.es5.js'
    ],
    dest: 'dist/es6-module-transpiler.js'
  }
};
