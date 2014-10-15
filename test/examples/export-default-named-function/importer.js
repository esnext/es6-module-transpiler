import foo, { callsFoo } from './exporter';

assert.strictEqual(foo(), 1);
assert.strictEqual(callsFoo(), 1);