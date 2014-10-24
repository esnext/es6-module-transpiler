/* jshint esnext:true */

import { count, incr } from './second';

assert.strictEqual(count, 0);
incr();
assert.strictEqual(count, 1);
