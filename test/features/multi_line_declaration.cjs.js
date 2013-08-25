"use strict";
exports.__default__ = function() {
  return "foo";
}

exports.__default__ = 1 + 2;

var __dependency1__ = require("foo");
var foo = __dependency1__.foo;
