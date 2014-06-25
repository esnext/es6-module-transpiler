/* jshint esnext:true */

/* error: type=SyntaxError message="expected one declaration for `a`, at importer.js:7:14 but found 2" */
import { a } from './exporter';
import { a } from './exporter';

assert.equal(a, 1);