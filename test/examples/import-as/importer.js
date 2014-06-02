/* jshint esnext:true */

import { a as b, b as a, default as def } from './exporter';

assert.equal(b, 'a');
assert.equal(a, 'b');
assert.equal(def, 'DEF');
