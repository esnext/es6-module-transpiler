"use strict";
var foo = (function() {
  var moduleInstanceObject = Object.create ? Object.create(null) : {};
  var imported = require("foo");
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
