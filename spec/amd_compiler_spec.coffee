describe 'Compiler (toAMD)', ->
  it 'generates a single export if `export = ` is used', ->
    shouldCompileAMD """
      var jQuery = function() { };

      export = jQuery;
    """, """
      define("jquery",
        [],
        function() {
          "use strict";
          var jQuery = function() { };

          return jQuery;
        });
    """

  it 'generates an export object if `export foo` is used', ->
    shouldCompileAMD """
      var jQuery = function() { };

      export jQuery;
    """, """
      define("jquery",
        ["exports"],
        function(__exports__) {
          "use strict";
          var jQuery = function() { };

          __exports__.jQuery = jQuery;
        });
    """

  it 'generates an export object if `export function foo` is used', ->
    shouldCompileAMD """
      export function jQuery() { };
    """, """
      define("jquery",
        ["exports"],
        function(__exports__) {
          "use strict";
          function jQuery() { };
          __exports__.jQuery = jQuery;
        });
    """

  it 'generates an export object if `export var foo` is used', ->
    shouldCompileAMD """
      export var jQuery = function() { };
    """, """
      define("jquery",
        ["exports"],
        function(__exports__) {
          "use strict";
          var __export1__ = function() { };
          __exports__.jQuery = __export1__;
        });
    """

  it 'generates an export object if `export { foo, bar }` is used', ->
    shouldCompileAMD """
      var get = function() { };
      var set = function() { };

      export { get, set };
    """, """
      define("jquery",
        ["exports"],
        function(__exports__) {
          "use strict";
          var get = function() { };
          var set = function() { };

          __exports__.get = get;
          __exports__.set = set;
        });
    """

  it 'raises if both `export =` and `export foo` is used', ->
    shouldRaise """
      export { get, set };
      export = Ember;
    """, "You cannot use both `export =` and `export` in the same module"

  it 'imports using local variables', ->
    shouldCompileAMD """
      import { async } from "rsvp";
    """, """
      define("jquery",
        ["rsvp"],
        function(__dependency1__) {
          "use strict";
          var async = __dependency1__.async;
        });
    """
