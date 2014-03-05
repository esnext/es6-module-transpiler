// A. Create a new object that will contain the names ES6 module exports. We create it immediately so that
// it will work across cycles.
var es6Out = {};

// B. Assign it immediately to module.exports so other files that try to require this file will see it
// right away.
module.exports = {
  __es6_module__: es6Out
};


// C. Require another module, and check to see whether it has an ES6 module on it. Because the other module
// also created its ES6 module eagerly, this module will be able to get a handle on an empty copy of the
// soon-to-be-filled-in ES6 modules in the cycle case.
var _b = require("./b"), es6Module = _b.__es6_module__, b;

// D. If we find an ES6 module, save it off for future use. Otherwise, use the regular node module.
if (es6Module) {
  b = es6Module;
} else {
  b = _b;
}

var exports = function() {
  // E. Rewrite bindings that came off of `import` statements to lazily get their values from the module.
  console.log("In a. bar = " + b.bar);
};

var foo = 'foo';

// F. Fill in the ES6 module, including default export to point at the exports function.
es6Out.default = exports;
es6Out.foo = foo;

// G. Stick the ES6 module onto the standard-looking node export.
exports.__es6_module__ = es6Out;

// H. Replace the temporary module.exports with the standard-looking node export.
module.exports = exports;
