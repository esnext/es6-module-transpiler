/* jshint esnext:true */

/* error: type=SyntaxError message="expected one declaration for `a`, at importer.js:5:14 but found 2" */
import { a, a } from './exporter';
assert.equal(a, 1);