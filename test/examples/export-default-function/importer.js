/* jshint esnext:true */

import fn1 from './exporter';

import { default as fn2 } from './exporter';

assert.equal(fn1(), 1);
assert.equal(fn2(), 1);
