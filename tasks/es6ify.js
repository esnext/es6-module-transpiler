function transpile(grunt, file) {
  var es6ify = require('es6ify'),
      fs     = require('fs'),
      path   = require('path'),
      done   = this.async();

  grunt.file.mkdir(path.dirname(file.dest));
  var output = fs.createWriteStream(file.dest, 'utf8');

  grunt.util.async.forEachSeries(file.src, function(src, next) {
    var input = fs.createReadStream(src, 'utf8');
    output.once('finish', next);
    input.pipe(es6ify(src)).pipe(output);
  }, done);
}

module.exports = function(grunt) {
  grunt.registerMultiTask('es6ify', 'Transpiles scripts written using ES6 to ES5.', function() {
    this.files.forEach(transpile.bind(this, grunt));
  });
};
