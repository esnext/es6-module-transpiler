/* jshint esnext:true */

function foo() {
  /* error: type=Error message="Line 5: Unexpected reserved word" */
  import foo from './index';
}
