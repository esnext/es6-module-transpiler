{ shouldCompileCJS, shouldRaise } = require './spec_helper'

describe "Compiler (toCJS)", ->
  it 'generates a single export if `export default` is used', ->
    shouldCompileCJS """
      var jQuery = function() { };

      export default jQuery;
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

  it 'raises if both `export default` and `export foo` are used', ->
    shouldRaise """
      export { get, set };
      export default Ember;
    """, "You cannot use both `export default` and `export` in the same module"

  it 'converts `import { get, set } from "ember"', ->
    shouldCompileCJS """
      import { get, set } from "ember";
    """, """
      "use strict";
      var __dependency1__ = require("ember");
      var get = __dependency1__.get;
      var set = __dependency1__.set;
    """

  it 'support single quotes in import {x, y} from z', ->
    shouldCompileCJS """
      import { get, set } from 'ember';
    """, """
      "use strict";
      var __dependency1__ = require("ember");
      var get = __dependency1__.get;
      var set = __dependency1__.set;
    """

  it 'converts `import foo from "bar"`', ->
    shouldCompileCJS """
      import _ from "underscore";
    """, """
      "use strict";
      var _ = require("underscore");
    """

  it 'supports single quotes in import x from y', ->
    shouldCompileCJS """
      import undy from 'underscore';
    """, """
      "use strict";
      var undy = require("underscore");
    """

  it 'supports import { x as y } from "foo"', ->
    shouldCompileCJS """
      import { View as EmView } from 'ember';
    """, """
      "use strict";
      var EmView = require("ember").View;
    """

  it 'supports import { default as foo } from "foo"', ->
    shouldCompileCJS """
      import { View as EmView, default as Ember } from 'ember';
    """, """
      "use strict";
      var __dependency1__ = require("ember");
      var EmView = __dependency1__.View;
      var Ember = __dependency1__;
    """

  it 'can re-export a subset of another module', ->
    shouldCompileCJS """
      export { ajax, makeArray } from "jquery";
    """, """
      "use strict";
      var __reexport1__ = require("jquery");
      exports.ajax = __reexport1__.ajax;
      exports.makeArray = __reexport1__.makeArray;
    """
