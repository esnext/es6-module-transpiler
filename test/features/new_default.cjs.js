"use strict";
var foo = (function() {
  var moduleInstanceObject = Object.create ? Object.create(null) : {};
  var imported = require("foo");
  if (typeof imported === 'function' && typeof console !== 'undefined') {
    var warning = "imported module 'foo' exported a function - this may not work as expected";
    if (typeof console.warn === 'function') {
      console.warn(warning);
    } else if (typeof console.log === 'function') {
      console.log(warning);
    }
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
}).call(this);
var bar = require("bar")["default"];

var baz = "baz";
var qux = "qux";

exports["default"] = baz;
exports.qux = qux;
