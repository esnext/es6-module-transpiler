{ shouldCompileGlobals, shouldRaise } = require './spec_helper'

describe 'Compiler (toGlobals with CoffeeScript)', ->
  it 'generates a single export if `export default` is used', ->
    shouldCompileGlobals """
      class jQuery

      export default jQuery
    """, """
      ((exports) ->
        "use strict"
        class jQuery

        exports.jQuery = jQuery
      )(window)
    """, coffee: yes

  it "generates an export object if `export foo` is used", ->
    shouldCompileGlobals """
      class jQuery

      export jQuery
    """, """
      ((exports) ->
        "use strict"
        class jQuery

        exports.jQuery = jQuery
      )(window)
    """, coffee: yes

  it "uses a single window export if `export foo` is used with the :into option", ->
    shouldCompileGlobals """
      get = ->
      set = ->

      export get
      export set
    """, """
      ((exports) ->
        "use strict"
        get = ->
        set = ->

        exports.get = get
        exports.set = set
      )(window.Ember = {})
    """, into: 'Ember', coffee: yes

  it "uses a single window export if `export default Expression` is used with the :into option", ->
    shouldCompileGlobals """
      get = ->
      set = ->

      export default { get: get, set: set }
    """, """
      ((exports) ->
        "use strict"
        get = ->
        set = ->

        exports.Ember = { get: get, set: set }
      )(window)
    """, into: 'Ember', coffee: yes

  it "generates an export object if `export { foo, bar }` is used", ->
    shouldCompileGlobals """
      get = ->
      set = ->

      export { get, set }
    """, """
      ((exports) ->
        "use strict"
        get = ->
        set = ->

        exports.get = get
        exports.set = set
      )(window)
    """, coffee: yes

  it "uses a single window export if `export { foo, bar }` is used with the :into option", ->
    shouldCompileGlobals """
      get = ->
      set = ->

      export { get, set }
    """, """
      ((exports) ->
        "use strict"
        get = ->
        set = ->

        exports.get = get
        exports.set = set
      )(window.Ember = {})
    """, into: 'Ember', coffee: yes

  it "raises if both `export default` and `export foo` are used", ->
    shouldRaise """
      export { get, set }
      export default Ember
    """, "You cannot use both `export default` and `export` in the same module", coffee: yes

  it 'converts `import { foo } from "bar"` using a map to globals', ->
    shouldCompileGlobals """
      import { View } from "ember"
    """, """
      ((Ember) ->
        "use strict"
        View = Ember.View
      )(window.Ember)
    """, imports: { ember: 'Ember' }, coffee: yes

  it 'converts `import { get, set } from "ember" using a map to globals`', ->
    shouldCompileGlobals """
      import { get, set } from "ember"
    """, """
      ((Ember) ->
        "use strict"
        get = Ember.get
        set = Ember.set
      )(window.Ember)
    """, imports: { ember: 'Ember' }, coffee: yes

  it "support single quotes in import from", ->
    shouldCompileGlobals """
      import { get, set } from 'ember'
    """, """
      ((Ember) ->
        "use strict"
        get = Ember.get
        set = Ember.set
      )(window.Ember)
    """, imports: { ember: 'Ember' }, coffee: yes

  it 'converts `import { get, set } from "ember" using a map to globals` with exports', ->
    shouldCompileGlobals """
      import { get, set } from "ember"

      export { get, set }
    """, """
      ((exports, Ember) ->
        "use strict"
        get = Ember.get
        set = Ember.set

        exports.get = get
        exports.set = set
      )(window.DS = {}, window.Ember)
    """, imports: { ember: 'Ember' }, into: 'DS', coffee: yes

  it 'converts `import foo from "bar"`', ->
    shouldCompileGlobals """
    import _ from "underscore"
    """, """
      ((_) ->
        "use strict"
      )(window._)
    """, imports: { underscore: '_' }, coffee: yes

  it 'supports single quotes in import x from y', ->
    shouldCompileGlobals """
      import undy from 'underscore';
    """, """
      ((undy) ->
        "use strict"
      )(window._)
    """, imports: { underscore: '_' }, coffee: yes

  it "supports anonymous modules", ->
    shouldCompileGlobals """
      import undy from "underscore"
    """, """
      ((undy) ->
        "use strict"
      )(window._)
    """, anonymous: true, imports: { underscore: '_' }, coffee: yes

  it 'can re-export a subset of another module', ->
    shouldCompileGlobals """
      export { join, extname } from "path"
    """, """
      ((exports, __reexport1__) ->
        "use strict"
        exports.join = __reexport1__.join
        exports.extname = __reexport1__.extname
      )(window.jQuery = {}, window.path)
    """, anonymous: true, into: 'jQuery', imports: { path: 'path' }, coffee: yes
