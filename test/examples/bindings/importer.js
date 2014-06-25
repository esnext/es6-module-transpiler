/* jshint esnext:true */

import { count, incr } from './exporter';

assert.equal(count, 0);
incr();
assert.equal(count, 1);
