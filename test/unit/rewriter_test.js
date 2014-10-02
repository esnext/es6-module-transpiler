var Container = require('../../lib/container');
var Module = require('../../lib/module');
var Rewriter = require('../../lib/rewriter');
var TestFormatter = require('../support/test_formatter').TestFormatter;
var TestResolver = require('../support/test_resolver').TestResolver;
var assert = require('assert');

describe('Rewriter', function() {
  describe('#rewrite', function() {
    context('when a module has no imports or exports', function() {
      it('does not traverse the module at all', function() {
        var formatter = new TestFormatter();
        var container = new Container({
          formatter: formatter,
          resolvers: [new TestResolver({
            'a.js': 'var foo = 1\nfunction bar() {}'
          })]
        });

        var a = container.getModule('a.js');
        var rewriter = new Rewriter(formatter);
        rewriter.rewrite(container.getModules());

        assert.strictEqual(formatter.processedExportDeclarationCount, 0);
        assert.strictEqual(formatter.processedFunctionDeclarationCount, 0);
        assert.strictEqual(formatter.processedVariableDeclarationCount, 0);
      });
    });
  });
});