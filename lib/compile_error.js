(function() {
  "use strict";

  var CompileError,
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  CompileError = (function(_super) {

    __extends(CompileError, _super);

    function CompileError() {
      return CompileError.__super__.constructor.apply(this, arguments);
    }

    return CompileError;

  })(Error);

  module.exports = CompileError;

}).call(this);
