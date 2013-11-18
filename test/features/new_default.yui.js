YUI.add("new_default", function(Y, NAME, __imports__, __exports__) {
    "use strict";
    var foo = __imports__["foo"];
    var bar = __imports__["bar"]["default"];

    var baz = "baz";
    var qux = "qux";

    __exports__["default"] = baz;
    __exports__.qux = qux;
    return __exports__;
}, "@VERSION@", {"es":true,"requires":["foo","bar"]});