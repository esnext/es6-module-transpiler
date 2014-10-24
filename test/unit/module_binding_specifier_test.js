var assert = require('assert');
var Container = require('../../lib/container');
var Module = require('../../lib/module');
var TestFormatter = require('../support/test_formatter').TestFormatter;
var TestResolver = require('../support/test_resolver').TestResolver;

describe('ModuleBindingSpecifier', function() {
  describe('#terminalExportSpecifier', function() {
    var sources;
    var container;
    var specifier;

    beforeEach(function() {
      container = new Container({
        formatter: new TestFormatter(),
        resolvers: [new TestResolver(sources)]
      });

      specifier = getExportSpecifier('root.js', 'a');
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
        sources = { 'root.js': 'export var a = 1;' };
      });

      it('is the export itself', function() {
        assert.strictEqual(specifier.terminalExportSpecifier, specifier);
      });
    });

    context('when the export is a function declaration', function() {
      before(function() {
        sources = { 'root.js': 'export function a() {}' };
      });

      it('is the export itself', function() {
        assert.strictEqual(specifier.terminalExportSpecifier, specifier);
      });
    });

    context('when the export binds an import by name from another module', function() {
      before(function() {
        sources = {
          'root.js': 'import { a } from "middle.js";\nexport { a };',
          'middle.js': 'import { a } from "leaf.js";\nexport { a };',
          'leaf.js': 'export var a = 1;'
        };
      });

      it('follows the trail of imports until it finds the original', function() {
        var leafA = getExportSpecifier('leaf.js', 'a');
        assert.strictEqual(
          specifier.terminalExportSpecifier,
          leafA,
          'expected ' + specifier.terminalExportSpecifier + ' to equal ' + leafA
        );
      });
    });

    context('when the export binds an import through a batch export', function() {
      before(function() {
        sources = {
          'root.js': 'import { a } from "middle.js";\nexport { a };',
          'middle.js': 'export * from "leaf.js";',
          'leaf.js': 'export var a = 1;'
        };
      });

      it('follows the trail of imports until it finds the original', function() {
        var leafA = getExportSpecifier('leaf.js', 'a');
        assert.strictEqual(
          specifier.terminalExportSpecifier,
          leafA,
          'expected ' + specifier.terminalExportSpecifier + ' to equal ' + leafA
        );
      });
    });
  });
});