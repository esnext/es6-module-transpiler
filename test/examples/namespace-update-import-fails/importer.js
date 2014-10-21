/* jshint esnext:true */

import * as exp from './exporter';

/* error: type=SyntaxError message="Cannot reassign imported binding of namespace `exp` at importer.js:6:1" */
exp['foo']++;