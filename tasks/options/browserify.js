module.exports = {
  dist: {
    src: 'tmp/transpiled/index.js',
    dest: 'tmp/es6-module-transpiler.es5.js',
    options: {
      transform: [function(file) {
        return require('es6ify')(file);
      }],
      standalone: 'ModuleTranspiler'
    }
  }
};
