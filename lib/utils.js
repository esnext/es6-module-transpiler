(function() {
  "use strict";

  var Unique, isEmpty;

  isEmpty = function(object) {
    var foo;
    for (foo in object) {
      return false;
    }
    return true;
  };

  Unique = (function() {

    function Unique(prefix) {
      this.prefix = prefix;
      this.index = 1;
    }

    Unique.prototype.next = function() {
      return "__" + this.prefix + (this.index++) + "__";
    };

    return Unique;

  })();

  exports.isEmpty = isEmpty;

  exports.Unique = Unique;

}).call(this);
