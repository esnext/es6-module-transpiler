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

    'qunit-runner' : config('qunit-runner'),
    connect        : config('connect'),
    qunit          : config('qunit'),
    watch          : config('watch')
  });

  // Load local tasks.
  grunt.task.loadTasks('./tasks');

  grunt.registerTask('build',
    ['clean', 'transpile', 'browserify', 'concat', 'uglify']);

  grunt.registerTask('develop',
    ['build', 'qunit-runner', 'connect', 'watch']);

  grunt.registerTask('test', ['qunit-runner', 'qunit']);

  grunt.registerTask('default', ['build']);
};
