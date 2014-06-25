/* jshint esnext:true */

import { a, b, incr } from './exporter';

assert.equal(a, 1);
assert.equal(b, 2);
incr();
assert.equal(a, 2);
assert.equal(b, 3);
