/* jshint esnext:true */

import * as exp from './exporter';

/* error: type=SyntaxError message="Cannot reassign imported binding `foo` at importer.js:6:1" */
exp.foo = 2;