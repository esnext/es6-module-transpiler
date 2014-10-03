var compileModules = require('broccoli-es6-module-transpiler');
module.exports = compileModules('editor', {
  formatter: 'bundle',
  output: 'editor.js'
});