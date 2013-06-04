{ shouldCompileAMD, shouldRaise, shouldRunCLI } = require './spec_helper'

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
          var jQuery = function() { };
          __exports__.jQuery = jQuery;
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

  it 'ignores import statements within block comments', ->
    shouldCompileAMD """
      import { async } from "rsvp";
      /* import { foo } from "foo";
      import { bazz } from "bazz";
      import { bar } from "bar";
      import { buzz } from "buzz"; */
    """, """
      define("jquery",
        ["rsvp"],
        function(__dependency1__) {
          "use strict";
          var async = __dependency1__.async;
          /* import { foo } from "foo";
          import { bazz } from "bazz";
          import { bar } from "bar";
          import { buzz } from "buzz"; */
        });
    """

  it 'names modules and modifies import statements if a relative path is defined', ->
    shouldRunCLI ['--to', 'out', 'lib'],
      'lib':
        contents: ['foo', 'foo.js']
      'lib/foo':
        contents: ['bar.js', 'baz.js']
      'lib/foo.js':
        read: """
          import "./foo/bar" as bar;
        """
      'lib/foo/bar.js':
        read: """
          import "./baz" as baz;
        """
      'lib/foo/baz.js':
        read: ""
      'out':
        exists: yes
      'out/lib':
        exists: yes
      'out/lib/foo':
        exists: yes
      'out/lib/foo.js':
        write: """
          define("lib/foo",
            ["lib/foo/bar"],
            function(bar) {
              "use strict";
            });
        """
      'out/lib/foo/bar.js':
        write: """
          define("lib/foo/bar",
            ["lib/foo/baz"],
            function(baz) {
              "use strict";
            });
        """
      'out/lib/foo/baz.js':
        write: """
          define("lib/foo/baz",
            [],
            function() {
              "use strict";

            });
        """
