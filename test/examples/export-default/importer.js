/* jshint esnext:true */

import value from './exporter';
import { change } from './exporter';
assert.equal(value, 42);

change();
assert.equal(
  value,
  42,
  'default export should not be bound'
);
