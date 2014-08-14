/* jshint esnext:true */

import { x } from './exporter';

(function() {
    for(var x = 0; x < 1; x++){}
    for(var x = 0; x < 1; x++){}
});

/* error: type=SyntaxError message="Cannot reassign imported binding `x` at importer.js:11:1" */
x = 10;
