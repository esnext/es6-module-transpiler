import { a } from './exporter';

var getA = function getA() {
  var a = 2;
  return a;
};

assert.strictEqual(a, 1);
assert.strictEqual(getA(), 2);