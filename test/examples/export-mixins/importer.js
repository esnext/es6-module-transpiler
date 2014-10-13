import foo, { bar } from './exporter';

assert.equal(foo, 1);
assert.equal(bar, 2);
