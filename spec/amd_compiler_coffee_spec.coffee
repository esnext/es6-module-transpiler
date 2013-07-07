{ shouldCompileAMD, shouldRaise } = require './spec_helper'

describe 'Compiler (toAMD for CoffeeScript)', ->
  it 'generates a single export if `export default ` is used', ->
    shouldCompileAMD """
      class jQuery

      export default jQuery
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

  it 'raises if both `export default` and `export foo` are used', ->
    shouldRaise """
      export { get, set }
      export default Ember
    """, "You cannot use both `export default` and `export` in the same module", coffee: yes

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

  it 'can re-export a subset of another module', ->
    shouldCompileAMD """
      export { join, extname } from "path"
    """, """
      define("jquery",
        ["path","exports"],
        (__reexport1__, __exports__) ->
          "use strict"
          __exports__.join = __reexport1__.join
          __exports__.extname = __reexport1__.extname
        )
    """, coffee: yes
