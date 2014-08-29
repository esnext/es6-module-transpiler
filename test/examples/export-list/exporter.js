/* jshint esnext:true */

var a = 1;
var b = 2;

function incr() {
  var c = a++; // Capture `a++` to force us to use a temporary variable.
  b++;
}

export { a, b, incr };
