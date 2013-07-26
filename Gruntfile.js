function config(name) {
  return require('./tasks/options/' + name);
}

module.exports = function(grunt) {
  var path = require('path');

  // Load node modules providing grunt tasks.
  require('matchdep').filterDev('grunt-*').forEach(grunt.loadNpmTasks);

  grunt.initConfig({
    clean      : config('clean'),
    transpile  : config('transpile'),
    browserify : config('browserify'),
    es6ify     : config('es6ify'),
    concat     : config('concat'),
    uglify     : config('uglify'),

    simplemocha : config('simplemocha'),
    features    : config('features')
  });

  // Load local tasks.
  grunt.task.loadTasks('./tasks');

  // This is really only here for illustrative purposes and can't be used as-is
  // because of https://github.com/thlorenz/es6ify/issues/3.
  //
  // grunt.registerTask('build',
  //   ['clean', 'transpile', 'es6ify', 'browserify', 'concat', 'uglify']);

  grunt.registerTask('test', ['features', 'simplemocha']);

  grunt.registerTask('default', ['test']);
};
