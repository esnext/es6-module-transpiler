/* jshint esnext:true */

import * as foo from './exporter';

assert.equal(foo['default'], 'DEF');
assert.equal(foo.b, 'b');
assert.equal(foo.a, 'a');
