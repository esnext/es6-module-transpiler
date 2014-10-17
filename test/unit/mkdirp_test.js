var assert = require('assert');
var mkdirpSync = require('../../lib/utils').mkdirpSync;

describe('mkdirpSync', function() {
  var calls;
  var fs = {
    existsSync: function(path) {
      calls.push(['existsSync', path]);
      return path === '/' || path === '/path' || path === 'path';
    },

    mkdirSync: function(path) {
      calls.push(['mkdirSync', path]);
    }
  };

  beforeEach(function() {
    calls = [];
  });

  context('given absolute paths', function() {
    it('checks each path component, making the ones that do not exist', function() {
      mkdirpSync('/path/to/some/dir', { fs: fs });
      assert.deepEqual(
        calls,
        [
          ['existsSync', '/path'],
          ['existsSync', '/path/to'],
          ['mkdirSync', '/path/to'],
          ['existsSync', '/path/to/some'],
          ['mkdirSync', '/path/to/some'],
          ['existsSync', '/path/to/some/dir'],
          ['mkdirSync', '/path/to/some/dir']
        ]
      );
    });
  });

  context('given relative paths', function() {
    it('checks each path component, making the ones that do not exist', function() {
      mkdirpSync('path/to/some/dir', { fs: fs });
      assert.deepEqual(
        calls,
        [
          ['existsSync', 'path'],
          ['existsSync', 'path/to'],
          ['mkdirSync', 'path/to'],
          ['existsSync', 'path/to/some'],
          ['mkdirSync', 'path/to/some'],
          ['existsSync', 'path/to/some/dir'],
          ['mkdirSync', 'path/to/some/dir']
        ]
      );
    });
  });
});