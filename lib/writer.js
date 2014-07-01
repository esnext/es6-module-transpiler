/* jshint node:true, undef:true, unused:true */

var assert = require('assert');
var recast = require('recast');
var fs = require('fs');
var Path = require('path');
var mkdirp = require('mkdirp');

function Writer(target) {
  this.target = target;
}

Writer.prototype.write = function(files) {
  var target = this.target;

  switch (files.length) {
    case 0:
      throw new Error('expected at least one file to write, got zero');

    case 1:
      // We got a single file, so `target` should refer to either a file or a
      // directory, but only if the file has a name.
      var isDirectory = false;
      try {
        isDirectory = fs.statSync(target).isDirectory();
      } catch (ex) {}

      assert.ok(
        !isDirectory || files[0].filename,
        'unable to determine filename for output to directory: ' + target
      );
      this.writeFile(
        files[0],
        isDirectory ? Path.resolve(target, files[0].filename) : target
      );
      break;

    default:
      // We got multiple files to output, so `target` should be a directory or
      // not exist (so we can create it).
      var self = this;
      files.forEach(function(file) {
        self.writeFile(file, Path.resolve(target, file.filename));
      });
      break;
  }
};

Writer.prototype.writeFile = function(file, filename) {
  var sourceMapFilename = filename + '.map';

  var rendered = recast.print(file, {
      sourceMapName: Path.basename(filename)
  });

  var code = rendered.code;
  assert.ok(filename, 'missing filename for file: ' + code);

  mkdirp.sync(Path.dirname(filename));

  if (rendered.map) {
    code += '\n\n//# sourceMappingURL=' + Path.basename(sourceMapFilename);

    fs.writeFileSync(
      sourceMapFilename,
      JSON.stringify(rendered.map),
      { encoding: 'utf8' }
    );
  }

  fs.writeFileSync(filename, code, { encoding: 'utf8' });
};

module.exports = Writer;
