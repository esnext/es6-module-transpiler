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
    concat     : config('concat'),
    uglify     : config('uglify'),

    simplemocha : config('simplemocha'),
    features    : config('features')
  });

  // Load local tasks.
  grunt.task.loadTasks('./tasks');

  grunt.registerTask('build',
    ['clean', 'transpile', 'browserify', 'concat', 'uglify']);

  grunt.registerTask('test', ['features', 'simplemocha']);

  grunt.registerTask('default', ['build']);
};
