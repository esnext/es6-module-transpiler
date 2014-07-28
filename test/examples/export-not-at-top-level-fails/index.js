/* jshint esnext:true */

function foo() {
  /* error: type=SyntaxError message="Unexpected non-top level ExportDeclaration found at index.js:5:3" */
  export { foo };
}
