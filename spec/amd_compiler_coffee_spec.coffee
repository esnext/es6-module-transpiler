{ shouldCompileAMD, shouldRaise } = require './spec_helper'

describe 'Compiler (toAMD for CoffeeScript)', ->
  it 'generates a single export if `export = ` is used', ->
    shouldCompileAMD """
      class jQuery

      export = jQuery
    """, """
      define("jquery",
        [],
        ->
          "use strict"
          class jQuery

          return jQuery
        )
    """, coffee: yes

  it 'generates an export object if `export foo` is used', ->
    shouldCompileAMD """
      class jQuery

      export jQuery
    """, """
      define("jquery",
        ["exports"],
        (__exports__) ->
          "use strict"
          class jQuery

          __exports__.jQuery = jQuery
        )
    """, coffee: yes

  it 'generates an export object if `export { foo, bar }` is used', ->
    shouldCompileAMD """
      get = ->
      set = ->

      export { get, set }
    """, """
      define("jquery",
        ["exports"],
        (__exports__) ->
          "use strict"
          get = ->
          set = ->

          __exports__.get = get
          __exports__.set = set
        )
    """, coffee: yes

  it 'raises if both `export =` and `export foo` is used', ->
    shouldRaise """
      export { get, set }
      export = Ember
    """, "You cannot use both `export =` and `export` in the same module", coffee: yes

  it 'ignores statements within block comments', ->
    shouldCompileAMD """
      get = ->
      set = ->
      foo = ->

      ###
      export { get, set }
      ###

      export { get, foo }
    """, """
      define("jquery",
        ["exports"],
        (__exports__) ->
          "use strict"
          get = ->
          set = ->
          foo = ->

          ###
          export { get, set }
          ###

          __exports__.get = get
          __exports__.foo = foo
        )
    """, coffee: yes
