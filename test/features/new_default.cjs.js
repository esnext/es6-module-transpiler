"use strict";
function __es6_transpiler_warn__(warning) {
  if (typeof console === 'undefined') {
  } else if (typeof console.warn === "function") {
    console.warn(warning);
  } else if (typeof console.log === "function") {
    console.log(warning);
  }
}
function __es6_transpiler_build_module_object__(name, imported) {
  var moduleInstanceObject = Object.create ? Object.create(null) : {};
  if (typeof imported === "function") {
    __es6_transpiler_warn__("imported module '"+name+"' exported a function - this may not work as expected");
  }
  for (var key in imported) {
    if (Object.prototype.hasOwnProperty.call(imported, key)) {
      moduleInstanceObject[key] = imported[key];
    }
  }
  if (Object.freeze) {
    Object.freeze(moduleInstanceObject);
  }
  return moduleInstanceObject;
}
var foo = __es6_transpiler_build_module_object__("foo", require("foo"));
var bar = require("bar")["default"];

var baz = "baz";
var qux = "qux";

exports["default"] = baz;
exports.qux = qux;
