/* jshint esnext:true */

import { a } from './exporter';

/* error: type=SyntaxError message="Cannot reassign imported binding `a` at importer.js:6:1" */
a++;