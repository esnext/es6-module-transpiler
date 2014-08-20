/* jshint esnext:true */

import { x } from './exporter';

export function foo () {
  var x = 1;
}
export function bar () {
  /* error: type=SyntaxError message="Cannot reassign imported binding `x` at importer.js:10:3" */
  x = 1;
}
