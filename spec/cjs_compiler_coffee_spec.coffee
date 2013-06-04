{ shouldCompileCJS, shouldRaise } = require './spec_helper'

describe "Compiler (toCJS for CoffeeScript)", ->
  it 'generates a single export if `export =` is used', ->
    shouldCompileCJS """
      class jQuery

      export = jQuery
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

  it 'raises if both `export =` and `export foo` is used', ->
    shouldRaise """
      export { get, set }
      export = Ember
    """, "You cannot use both `export =` and `export` in the same module", coffee: yes

  it 'converts `import foo from "bar"`', ->
    shouldCompileCJS """
      import View from "ember"
    """, """
      "use strict"
      View = require("ember").View
    """, coffee: yes

  it 'converts `import { get, set } from "ember"', 
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

  it 'converts `import "bar" as foo`', ->
    shouldCompileCJS """
      import "underscore" as _
    """, """
      "use strict"
      _ = require("underscore")
    """, coffee: yes

  it 'supports single quotes in import as', ->
    shouldCompileCJS """
      import 'underscore' as undy
    """, """
      "use strict"
      undy = require("underscore")
    """, coffee: yes

  it 'supports anonymous modules', ->
    shouldCompileCJS """
      import "underscore" as undy
    """, """
      "use strict"
      undy = require("underscore")
    """, coffee: yes
