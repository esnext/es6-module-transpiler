{ parseOptions, optionsShouldBeInvalid, shouldRunCLI } = require './spec_helper'

describe 'CLI', ->
  it 'defaults to using AMD type', ->
    expect(parseOptions('--stdio --anonymous').type).toEqual('amd')

  it 'fails on unknown types', ->
    optionsShouldBeInvalid '--stdio --type foogle'

  it 'fails when stdio and AMD are used and the module name is not given and not anonymous', ->
    optionsShouldBeInvalid '--stdio --type amd'

  it 'fails when both anonymous and module name are set', ->
    optionsShouldBeInvalid '--stdio --anonymous --module-name foo'

  it 'fails when coffee is set without stdio', ->
    optionsShouldBeInvalid '--stdio --coffee'

  it 'fails when stdio is not used and to is missing', ->
    optionsShouldBeInvalid '--type amd'

  it 'can read from stdin and write to stdout', ->
    shouldRunCLI ['-s', '-m', 'mymodule'], """
      import $ from "jQuery";
    """, """
      define("mymodule",
        ["jQuery"],
        function($) {
          "use strict";
        });
    """

  it 'can create anonymous modules if desired', ->
    shouldRunCLI ['-s', '--anonymous'], """
      import $ from "jQuery";
    """, """
      define(
        ["jQuery"],
        function($) {
          "use strict";
        });
    """

  it 'can process CoffeeScript', ->
    shouldRunCLI ['-s', '--coffee', '-m', 'caret'], """
      import $ from "jQuery";

      $.fn.caret = ->
    """, """
      define("caret",
        ["jQuery"],
        ($) ->
          "use strict"

          $.fn.caret = ->
        )
    """

  it 'can output using a different type', ->
    shouldRunCLI ['-s', '--type', 'cjs'], """
      import $ from "jQuery";

      $.fn.caret = {};
    """, """
      "use strict";
      var $ = require("jQuery");

      $.fn.caret = {};
    """

  it 'will read and write to files in the appropriate directory', ->
    shouldRunCLI ['--to', 'out', 'lib/test.js'],
      'lib/test.js':
        read: """
          import $ from "jQuery";
        """
      'out':
        mkdir: yes
      'out/lib':
        mkdir: yes
      'out/lib/test.js':
        write: """
          define("lib/test",
            ["jQuery"],
            function($) {
              "use strict";
            });
        """

  it 'will automatically process as CoffeeScript based on the filename', ->
    shouldRunCLI ['--to', 'out', 'lib/test.coffee'],
      'lib/test.coffee':
        read: """
          import $ from "jQuery";
        """
      'out':
        mkdir: yes
      'out/lib':
        mkdir: yes
      'out/lib/test.coffee':
        write: """
          define("lib/test",
            ["jQuery"],
            ($) ->
              "use strict"
            )
        """

  it 'will not attempt to create directories that already exist', ->
    shouldRunCLI ['--to', 'out', 'lib/test.coffee'],
      'lib/test.coffee':
        read: """
          import $ from "jQuery";
        """
      'out':
        exists: yes
      'out/lib':
        mkdir: yes
      'out/lib/test.coffee':
        write: """
          define("lib/test",
            ["jQuery"],
            ($) ->
              "use strict"
            )
        """

  it 'recursively processes directories', ->
    shouldRunCLI ['--to', 'out', 'lib'],
      'lib':
        contents: ['a', 'b.js']
      'lib/a':
        contents: ['test.js']
      'lib/b.js':
        read: ""
      'lib/a/test.js':
        read: ""
      'out':
        exists: yes
      'out/lib':
        exists: yes
      'out/lib/a':
        exists: yes
      'out/lib/b.js':
        write: """
          define("lib/b",
            [],
            function() {
              "use strict";

            });
        """
      'out/lib/a/test.js':
        write: """
          define("lib/a/test",
            [],
            function() {
              "use strict";

            });
        """

  it 'can take a map of imports on the command line', ->
    shouldRunCLI ['--to', 'out', '--type', 'globals', '--imports', 'jquery:jQuery,ember:Ember', 'lib/test.js'],
      'lib/test.js':
        read: """
          import { View } from 'ember';
          import $ from "jquery";
        """
      'out':
        mkdir: yes
      'out/lib':
        mkdir: yes
      'out/lib/test.js':
        write: """
          (function(Ember, $) {
            "use strict";
            var View = Ember.View;
          })(window.Ember, window.jQuery);
        """

  it 'can specify the global to use for exports', ->
    shouldRunCLI ['-s', '--type', 'globals', '--global', 'Ember'], """
      var get = function(){}, set = function(){};
      export { get, set };
    """, """
      (function(exports) {
        "use strict";
        var get = function(){}, set = function(){};
        exports.get = get;
        exports.set = set;
      })(window.Ember = {});
    """
