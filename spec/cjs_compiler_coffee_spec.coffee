{ shouldCompileCJS, shouldRaise } = require './spec_helper'

describe "Compiler (toCJS for CoffeeScript)", ->
  it 'generates a single export if `export default` is used', ->
    shouldCompileCJS """
      class jQuery

      export default jQuery
    """, """
      "use strict"
      class jQuery

      module.exports = jQuery
    """, coffee: yes

  it 'generates an export object if `export foo` is used', ->
    shouldCompileCJS """
      class jQuery

      export jQuery
    """, """
      "use strict"
      class jQuery

      exports.jQuery = jQuery
    """, coffee: yes

  it 'generates an export object if `export { foo, bar }` is used', ->
    shouldCompileCJS """
      get = ->
      set = ->

      export { get, set }
    """, """
      "use strict"
      get = ->
      set = ->

      exports.get = get
      exports.set = set
    """, coffee: yes

  it 'raises if both `export default` and `export foo` are used', ->
    shouldRaise """
      export { get, set }
      export default Ember
    """, "You cannot use both `export default` and `export` in the same module", coffee: yes

  it 'converts `import { foo } from "bar"`', ->
    shouldCompileCJS """
      import { View } from "ember"
    """, """
      "use strict"
      View = require("ember").View
    """, coffee: yes

  it 'converts `import { get, set } from "ember"', ->
    shouldCompileCJS """
      import { get, set } from "ember"
    """, """
      "use strict"
      __dependency1__ = require("ember")
      get = __dependency1__.get
      set = __dependency1__.set
    """, coffee: yes

  it 'support single quotes in import from', ->
    shouldCompileCJS """
      import { get, set } from 'ember'
    """, """
      "use strict"
      __dependency1__ = require("ember")
      get = __dependency1__.get
      set = __dependency1__.set
    """, coffee: yes

  it 'converts `import foo from "bar"`', ->
    shouldCompileCJS """
      import _ from "underscore";
    """, """
      "use strict"
      _ = require("underscore")
    """, coffee: yes

  it 'supports single quotes in import x from y', ->
    shouldCompileCJS """
      import undy from 'underscore';
    """, """
      "use strict"
      undy = require("underscore")
    """, coffee: yes

  it 'supports anonymous modules', ->
    shouldCompileCJS """
      import undy from "underscore"
    """, """
      "use strict"
      undy = require("underscore")
    """, coffee: yes

  it 'can re-export a subset of another module', ->
    shouldCompileCJS """
      export { ajax, makeArray } from "jquery"
    """, """
      "use strict"
      __reexport1__ = require("jquery")
      exports.ajax = __reexport1__.ajax
      exports.makeArray = __reexport1__.makeArray
    """, coffee: yes
