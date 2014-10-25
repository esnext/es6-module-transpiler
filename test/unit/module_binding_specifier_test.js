var assert = require('assert');
var Container = require('../../lib/container');
var Module = require('../../lib/module');
var TestFormatter = require('../support/test_formatter').TestFormatter;
var TestResolver = require('../support/test_resolver').TestResolver;

describe('ModuleBindingSpecifier', function() {
  describe('#terminalExportSpecifier', function() {
    var sources;
    var container;

    beforeEach(function() {
      container = new Container({
        formatter: new TestFormatter(),
        resolvers: [new TestResolver(sources)]
      });
    });

    function getExportSpecifier(modulePath, exportedName) {
      var mod = container.getModule(modulePath);
      var specifier = mod.exports.findSpecifierByName(exportedName);
      if (!specifier) {
        throw new Error('unable to find export `' + exportedName + '` in module: ' + modulePath);
      }
      return specifier;
    }

    context('when the export is a variable declaration', function() {
      before(function() {
        sources = { 'index.js': 'export var a = 1;' };
      });

      it('is the export itself', function() {
        var specifier = getExportSpecifier('index.js', 'a');
        assert.strictEqual(specifier.terminalExportSpecifier, specifier);
      });
    });

    context('when the export is a function declaration', function() {
      before(function() {
        sources = { 'index.js': 'export function a() {}' };
      });

      it('is the export itself', function() {
        var specifier = getExportSpecifier('index.js', 'a');
        assert.strictEqual(specifier.terminalExportSpecifier, specifier);
      });
    });

    context('when the export binds an import by name from another module', function() {
      before(function() {
        sources = {
          'index.js': 'import { a } from "middle.js";\nexport { a };',
          'middle.js': 'import { a } from "root.js";\nexport { a };',
          'root.js': 'export var a = 1;'
        };
      });

      it('follows the trail of imports until it finds the original', function() {
        var rootA = getExportSpecifier('root.js', 'a');
        var specifier = getExportSpecifier('index.js', 'a');
        assert.strictEqual(
          specifier.terminalExportSpecifier,
          rootA,
          'expected ' + specifier.terminalExportSpecifier + ' to equal ' + rootA
        );
      });
    });

    context('when the export directly re-exports a binding by name from another module', function() {
      before(function() {
        sources = {
          'index.js': 'import { a } from "middle.js";\nexport { a };',
          'middle.js': 'export { a } from "root.js";',
          'root.js': 'export var a = 1;'
        };
      });

      it('follows the trail of imports until it finds the original', function() {
        var rootA = getExportSpecifier('root.js', 'a');
        var specifier = getExportSpecifier('index.js', 'a');
        assert.strictEqual(
          specifier.terminalExportSpecifier,
          rootA,
          'expected ' + specifier.terminalExportSpecifier + ' to equal ' + rootA
        );
      });
    });

    xcontext('when the export binds an import through a batch export', function() {
      before(function() {
        sources = {
          'index.js': 'import { a } from "middle.js";\nexport { a };',
          'middle.js': 'export * from "root.js";',
          'root.js': 'export var a = 1;'
        };
      });

      it('follows the trail of imports until it finds the original', function() {
        var rootA = getExportSpecifier('root.js', 'a');
        var specifier = getExportSpecifier('index.js', 'a');
        assert.strictEqual(
          getExportSpecifier('index.js', 'a').terminalExportSpecifier,
          rootA,
          'expected ' + specifier.terminalExportSpecifier + ' to equal ' + rootA
        );
      });
    });
  });
});