/* jshint esnext:true, undef:true, unused:true */

module things from './exporter';

// has the right keys
assert.deepEqual(Object.keys(things).sort(), ['count', 'incr']);

// can't add keys
assert.throws(function() {
  things.iAmNotReal = 1;
}, TypeError);

// can't replace keys
assert.throws(function() {
  things.count = 3;
});

// bindings work
assert.equal(things.count, 1);
things.incr();
assert.equal(things.count, 2);
