"use strict";
var __dependency1__ = require("foo");
var foo = __dependency1__;
var __dependency2__ = require("bar");
var bar = __dependency2__.__default__;

var baz = "baz";
var qux = "qux";

exports.__default__ = baz;
exports.qux = qux;
