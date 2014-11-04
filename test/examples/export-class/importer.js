/* jshint esnext:true */

import { Foo } from './exporter';

assert.strictEqual(new Foo().constructor, Foo);
