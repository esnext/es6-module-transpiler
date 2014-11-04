var Container = require('../../lib/container');
var Module = require('../../lib/module');
var Path = require('path');
var TestFormatter = require('../support/test_formatter').TestFormatter;
var TestResolver = require('../support/test_resolver').TestResolver;
var assert = require('assert');
var fs = require('fs');
var tmp = require('tmp');

describe('Container', function() {
  describe('#write', function() {
    it('allows multiple calls but only converts once', function(done) {
      var buildCallCount = 0;
      var source = 'var a = 1;';
      var formatter = new TestFormatter();

      /**
       * This formatter only exists to count the number of times #build is
       * called and create a result of the right data structure.
       *
       * @param {Module[]} modules
       * @returns {File[]}
       */
      formatter.build = function(modules) {
        buildCallCount++;
        return TestFormatter.prototype.build.call(this, modules);
      };

      var container = new Container({
        formatter: formatter,
        resolvers: [new TestResolver({
          'a.js': source
        })]
      });

      // Ensure we have a module to write at all.
      container.getModule('a.js');

      tmp.dir(function(err, path) {
        if (err) { return done(err); }

        // Write the contents to a temporary directory.
        container.write(path);
        assert.strictEqual(buildCallCount, 1);

        // Ensure that the written file contains the original code.
        var a1 = fs.readFileSync(Path.join(path, 'a.js'), 'utf8');
        assert.ok(
          a1.indexOf(source) === 0,
          'expected written source to start with original source, but was: ' + a1
        );

        tmp.dir(function(err, path2) {
          if (err) { return done(err); }
          assert.notStrictEqual(path, path2);

          // Write to yet another temporary directory with the same container.
          container.write(path2);
          assert.strictEqual(buildCallCount, 1);

          // Ensure that the written file contains the original code.
          var a2 = fs.readFileSync(Path.join(path2, 'a.js'), 'utf8');
          assert.ok(
            a2.indexOf(source) === 0,
            'expected written source to start with original source, but was: ' + a2
          );

          done();
        });
      });
    });

    it('freezes the container, effectively preventing adding new modules', function(done) {
      var container = new Container({
        formatter: new TestFormatter(),
        resolvers: [new TestResolver()]
      });

      container.getModule('a.js');

      tmp.dir(function(err, path) {
        if (err) { return done(err); }

        container.write(path);

        try {
          container.getModule('b.js');
          assert.fail('expected an exception');
        } catch (ex) {
          assert.strictEqual(
            'container has already converted contained modules and cannot add new module: b.js',
            ex.message
          );
        }

        done();
      });
    });
  });

  describe('#transform', function() {
    var formatter = new TestFormatter();
    var source = 'export var a = 1;';
    var container = new Container({
      formatter: formatter,
      resolvers: [new TestResolver({
        'a.js': source
      })]
    });

    // Ensure we have a module to write at all.
    container.getModule('a.js');

    var files = container.transform();
    assert.strictEqual(files.length, 1);
    assert.strictEqual(files[0].filename, 'a.js');
    assert.strictEqual(files[0].code, source);
    assert.strictEqual(typeof files[0].map, 'object');
  });
});
