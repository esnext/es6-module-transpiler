/* jshint esnext:true */

import { a, getb } from './a';
import { b, geta } from './b';

assert.equal(geta(), 1);
assert.equal(a, 1);
assert.equal(getb(), 2);
assert.equal(b, 2);
