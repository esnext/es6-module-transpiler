/* jshint esnext:true */

import { x } from './exporter';

/* error: type=SyntaxError message="Cannot reassign imported binding `x` at importer.js:6:1" */
x = 10;
