/* jshint esnext:true */

function foo() {
  /* error: type=SyntaxError message="Unexpected non-top level ImportDeclaration found at index.js:5:3" */
  import foo from './index';
}