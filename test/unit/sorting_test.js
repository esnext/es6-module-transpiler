var sort = require('../../lib/sorting').sort;
var Module = require('../../lib/module');
var Container = require('../../lib/container');
var assert = require('assert');
var util = require('util');

function assertArraysEqual(a, b) {
  var message = 'expected ' + util.inspect(a) + ' to equal ' + util.inspect(b);
  assert.ok(a.length === b.length, message);

  for (var i = 0, length = a.length; i < length; i++) {
    assert.ok(a[i] === b[i], message);
  }
}

describe('sort', function() {
  it('returns an empty list given an empty list', function() {
    assertArraysEqual(sort([]), []);
  });

  it('returns a list of a single module given a single module', function() {
    var mod = { id: 'testmod', imports: { modules: [] } };
    assertArraysEqual(sort([mod]), [mod]);
  });

  it('properly orders a linear set of modules', function() {
    var a = { id: 'a', imports: { modules: [] } };
    var b = { id: 'b', imports: { modules: [a] } };
    var c = { id: 'c', imports: { modules: [b] } };

    assertArraysEqual(sort([b, a, c]), [a, b, c]);
  });

  it('properly orders a tree of modules', function() {
    var b = { id: 'b', imports: { modules: [] } };
    var c = { id: 'c', imports: { modules: [] } };
    var a = { id: 'a', imports: { modules: [b, c] } };

    assertArraysEqual(sort([b, a, c]), [b, c, a]);
    assertArraysEqual(sort([c, a, b]), [c, b, a]);
  });

  it('properly orders a DAG of modules', function() {
    var a = { id: 'a', imports: { modules: [] } };
    var b = { id: 'b', imports: { modules: [] } };
    var c = { id: 'c', imports: { modules: [] } };

    a.imports.modules.push(b, c);
    b.imports.modules.push(c);

    assertArraysEqual(sort([a, b, c]), [c, b, a]);
    assertArraysEqual(sort([b, a, c]), [c, b, a]);
  });

  it('orders a simple cyclic graph by last-required', function() {
    var a = { id: 'a', imports: { modules: [] } };
    var b = { id: 'b', imports: { modules: [] } };

    a.imports.modules.push(b);
    b.imports.modules.push(a);

    assertArraysEqual(sort([a, b]), [b, a]);
    assertArraysEqual(sort([b, a]), [a, b]);
  });

  it('orders a complex cyclic graph by last-required', function() {
    var a = { id: 'a', imports: { modules: [] } };
    var b = { id: 'b', imports: { modules: [a] } };
    var c = { id: 'c', imports: { modules: [b] } };
    var d = { id: 'd', imports: { modules: [c] } };

    a.imports.modules.push(d);

    assertArraysEqual(sort([b, c, d, a]), [c, d, a, b]);
    assertArraysEqual(sort([b, c, a, d]), [c, d, a, b]);
    assertArraysEqual(sort([c, d, a, b]), [d, a, b, c]);
    assertArraysEqual(sort([c, b, a, d]), [d, a, b, c]);
  });
});