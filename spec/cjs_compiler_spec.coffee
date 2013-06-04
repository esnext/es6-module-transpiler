{ shouldCompileCJS, shouldRaise } = require './spec_helper'

describe "Compiler (toCJS)", ->
  it 'generates a single export if `export =` is used', ->
    shouldCompileCJS """
      var jQuery = function() { };

      export = jQuery;
    """, """
      "use strict";
      var jQuery = function() { };

      module.exports = jQuery;
    """

  it 'generates an export object if `export foo` is used', ->
    shouldCompileCJS """
      var jQuery = function() { };

      export jQuery;
    """, """
      "use strict";
      var jQuery = function() { };

      exports.jQuery = jQuery;
    """

  it 'generates an export object if `export function foo` is used', ->
    shouldCompileCJS """
      export function jQuery() { };
    """, """
      "use strict";
      function jQuery() { };
      exports.jQuery = jQuery;
    """

  it 'generates an export object if `export var foo` is used', ->
    shouldCompileCJS """
      export var jQuery = function() { };
    """, """
      "use strict";
      var jQuery = function() { };
      exports.jQuery = jQuery;
    """

  it 'generates an export object if `export { foo, bar }` is used', ->
    shouldCompileCJS """
      var get = function() { };
      var set = function() { };

      export { get, set };
    """, """
      "use strict";
      var get = function() { };
      var set = function() { };

      exports.get = get;
      exports.set = set;
    """

  it 'raises if both `export =` and `export foo` is used', ->
    shouldRaise """
      export { get, set };
      export = Ember;
    """, "You cannot use both `export =` and `export` in the same module"

  it 'converts `import foo from "bar"`', ->
    shouldCompileCJS """
      import View from "ember";
    """, """
      "use strict";
      var View = require("ember").View;
    """

  it 'converts `import { get, set } from "ember"', 
    shouldCompileCJS """
      import { get, set } from "ember";
    """, """
      "use strict";
      var __dependency1__ = require("ember");
      var get = __dependency1__.get;
      var set = __dependency1__.set;
    """

  it 'support single quotes in import from', ->
    shouldCompileCJS """
      import { get, set } from 'ember';
    """, """
      "use strict";
      var __dependency1__ = require("ember");
      var get = __dependency1__.get;
      var set = __dependency1__.set;
    """

  it 'converts `import "bar" as foo`', ->
    shouldCompileCJS """
      import "underscore" as _;
    """, """
      "use strict";
      var _ = require("underscore");
    """

  it 'supports single quotes in import as', ->
    shouldCompileCJS """
      import 'underscore' as undy;
    """, """
      "use strict";
      var undy = require("underscore");
    """

  it 'supports anonymous modules', ->
    shouldCompileCJS """
      import "underscore" as undy;
    """, """
      "use strict";
      var undy = require("underscore");
    """
