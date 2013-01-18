describe 'CLI', ->
  it 'defaults to using AMD type', ->
    expect(parseOptions('').type).toEqual('amd')

  it 'fails on unknown types', ->
    optionsShouldBeInvalid '--type foogle'

  it 'fails when stdio and AMD are used and the module name is not given and not anonymous', ->
    optionsShouldBeInvalid '--stdio --type amd'

  it 'fails when both anonymous and module name are set', ->
    optionsShouldBeInvalid '--anonymous --module-name foo'

  it 'fails when coffee is set without stdio', ->
    optionsShouldBeInvalid '--coffee'

  it 'can read from stdin and write to stdout', ->
    shouldRunCLI ['-s', '-m', 'mymodule'], """
      import "jQuery" as $;
    """, """
      define("mymodule",
        ["jQuery"],
        function($) {
          "use strict";
        });
    """

  it 'can create anonymous modules if desired', ->
    shouldRunCLI ['-s', '--anonymous'], """
      import "jQuery" as $;
    """, """
      define(
        ["jQuery"],
        function($) {
          "use strict";
        });
    """

  it 'can process CoffeeScript', ->
    shouldRunCLI ['-s', '--coffee', '-m', 'caret'], """
      import "jQuery" as $

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
      import "jQuery" as $;

      $.fn.caret = {};
    """, """
      "use strict";
      var $ = require("jQuery");

      $.fn.caret = {};
    """
