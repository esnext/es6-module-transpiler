// This works the same way as the description in a.js

// export boilerplate
var es6Out = {};
module.exports = {
  __es6_module__: es6Out
};
 
// imports
var _a = require("./a");
var es6Module = _a.__es6_module__;

var a;
if (es6Module) {
  a = es6Module;
} else {
  a = _a;
}
 
// exports again
var exports = function() {
  console.log('In b. foo = ' + a.foo);
};
 
var bar = 'bar';
 
es6Out.default = exports;
es6Out.bar = bar;
 
exports.__es6_module__ = es6Out;
module.exports = exports;
