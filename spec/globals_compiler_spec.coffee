{ shouldCompileGlobals, shouldRaise } = require './spec_helper'

describe 'Compiler (toGlobals)', ->
  it 'generates a single export if `export =` is used', ->
    shouldCompileGlobals """
      var jQuery = function() { };

      export = jQuery;
    """, """
      (function(exports) {
        "use strict";
        var jQuery = function() { };

        exports.jQuery = jQuery;
      })(window);
    """

  it "generates an export object if `export foo` is used", ->
    shouldCompileGlobals """
      var jQuery = function() { };

      export jQuery;
    """, """
      (function(exports) {
        "use strict";
        var jQuery = function() { };

        exports.jQuery = jQuery;
      })(window);
    """

  it 'generates an export object if `export function foo` is used', ->
    shouldCompileGlobals """
      export function jQuery() { };
    """, """
      (function(exports) {
        "use strict";
        function jQuery() { };
        exports.jQuery = jQuery;
      })(window);
    """

  it 'generates an export object if `export var foo` is used', ->
    shouldCompileGlobals """
      export var jQuery = function() { };
    """, """
      (function(exports) {
        "use strict";
        var jQuery = function() { };
        exports.jQuery = jQuery;
      })(window);
    """

  it "uses a single window export if `export foo` is used with the :into option", ->
    shouldCompileGlobals """
      var get = function() {};
      var set = function() {};

      export get;
      export set;
    """, """
      (function(exports) {
        "use strict";
        var get = function() {};
        var set = function() {};

        exports.get = get;
        exports.set = set;
      })(window.Ember = {});
    """, into: 'Ember'

  it "uses a single window export if `export = Expression` is used with the :into option", ->
    shouldCompileGlobals """
      var get = function() {};
      var set = function() {};

      export = { get: get, set: set };
    """, """
      (function(exports) {
        "use strict";
        var get = function() {};
        var set = function() {};

        exports.Ember = { get: get, set: set };
      })(window);
    """, into: 'Ember'

  it "generates an export object if `export { foo, bar }` is used", ->
    shouldCompileGlobals """
      var get = function() { };
      var set = function() { };

      export { get, set };
    """, """
      (function(exports) {
        "use strict";
        var get = function() { };
        var set = function() { };

        exports.get = get;
        exports.set = set;
      })(window);
    """

  it "uses a single window export if `export { foo, bar }` is used with the :into option", ->
    shouldCompileGlobals """
      var get = function() { };
      var set = function() { };

      export { get, set };
    """, """
      (function(exports) {
        "use strict";
        var get = function() { };
        var set = function() { };

        exports.get = get;
        exports.set = set;
      })(window.Ember = {});
    """, into: 'Ember'

  it "raises if both `export =` and `export foo` is used", ->
    shouldRaise """
      export { get, set };
      export = Ember;
    """, "You cannot use both `export =` and `export` in the same module"

  it 'converts `import foo from "bar"` using a map to globals', ->
    shouldCompileGlobals """
      import View from "ember";
    """, """
      (function(Ember) {
        "use strict";
        var View = Ember.View;
      })(window.Ember);
    """, imports: { ember: 'Ember' }

  it 'converts `import { get, set } from "ember" using a map to globals`', ->
    shouldCompileGlobals """
      import { get, set } from "ember";
    """, """
      (function(Ember) {
        "use strict";
        var get = Ember.get;
        var set = Ember.set;
      })(window.Ember);
    """, imports: { ember: 'Ember' }

  it "support single quotes in import from", ->
    shouldCompileGlobals """
      import { get, set } from 'ember';
    """, """
      (function(Ember) {
        "use strict";
        var get = Ember.get;
        var set = Ember.set;
      })(window.Ember);
    """, imports: { ember: 'Ember' }

  it 'converts `import { get, set } from "ember" using a map to globals` with exports', ->
    shouldCompileGlobals """
      import { get, set } from "ember";

      export { get, set };
    """, """
      (function(exports, Ember) {
        "use strict";
        var get = Ember.get;
        var set = Ember.set;

        exports.get = get;
        exports.set = set;
      })(window.DS = {}, window.Ember);
    """, imports: { ember: 'Ember' }, into: 'DS'

  it 'converts `import "bar" as foo`', ->
    shouldCompileGlobals """
      import "underscore" as _;
    """, """
      (function(_) {
        "use strict";
      })(window._);
    """, imports: { underscore: '_' }

  it "supports single quotes in import as", ->
    shouldCompileGlobals """
      import 'underscore' as undy;
    """, """
      (function(undy) {
        "use strict";
      })(window._);
    """, imports: { underscore: '_' }

  it "supports anonymous modules", ->
    shouldCompileGlobals """
      import "underscore" as undy;
    """, """
      (function(undy) {
        "use strict";
      })(window._);
    """, anonymous: true, imports: { underscore: '_' }
