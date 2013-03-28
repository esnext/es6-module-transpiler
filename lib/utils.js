(function() {
  "use strict";

  var isEmpty;

  isEmpty = function(object) {
    var foo;
    for (foo in object) {
      return false;
    }
    return true;
  };

  exports.isEmpty = isEmpty;

}).call(this);
