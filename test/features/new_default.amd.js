define(
  ["foo","bar","exports"],
  function(__dependency1__, __dependency2__, __exports__) {
    "use strict";
    var foo = __dependency1__;
    var bar = __dependency2__.__default__;

    var baz = "baz";
    var qux = "qux";

    __exports__['default'] = baz;
    __exports__.qux = qux;
  });
