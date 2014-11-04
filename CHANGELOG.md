<style type="text/css">
.release-date {
  font-size: 60%;
  color: #666;
}
</style>

# Release Notes

## v0.9.1 <span class="release-date">(2014-11-03)</span>

* Clarify README to indicate that ES6 module syntax is now stable.
* Add `Container#transform` to get transformed code without writing to the file system.

## v0.9.0 <span class="release-date">(2014-10-22)</span>

* Add support for namespace imports (e.g. `import * as foo from 'foo'`).

## v0.8.3 <span class="release-date">(2014-10-17)</span>

* Fixed internal helper `mkdirpSync` that could cause `Container#write` to fail on some machines.

## v0.8.2 <span class="release-date">(2014-10-15)</span>

* Fixed bundle formatter renaming of function or class declarations in export default. Previously they were not properly renamed to prevent collision with other modules.

## v0.8.1 <span class="release-date">(2014-10-15)</span>

* Fixed bundle formatter rewriting identifiers inside named function expressions if the identifier shared a name with a module-scope binding. For example, in this code sample the `a` in `return a` would be rewritten as `mod$$a` when it should have remained `a` (the [fix](https://github.com/benjamn/ast-types/pull/68) was in ast-types).

```js
// mod.js
var a;
var fn = function f() { var a; return a; };
```

## v0.8.0 <span class="release-date">(2014-09-30)</span>

* Simplify the CommonJS formatter output to use ES3.

## v0.7.0 <span class="release-date">(2014-09-30)</span>

* Use a common base class for all built-in formatters.
* Various internal cleanups.

## v0.6.2 <span class="release-date">(2014-08-20)</span>

* Prevent all instances of export reassignment, not just those at the top level.

## v0.6.1 <span class="release-date">(2014-08-20)</span>

* Reference a custom fork of esprima.
* Allow resolvers to set the `Module#src` property to prevent direct file system access.

## v0.6.0 <span class="release-date">(2014-07-28)</span>

* Add support for source maps.
* Allow formatters to handle export reassignment.
* Update recast to v0.6.6.

## v0.5.1 <span class="release-date">(2014-06-25)</span>

* Fix the file list to be included in npm.

## v0.5.0 <span class="release-date">(2014-06-24)</span>

* Completely re-written using [recast](https://github.com/benjamn/recast).
* Removed YUI support, to be re-added as a plugin.
* Removed AMD support, to be re-added as a plugin.
* Added "bundle" formatter for concatenating all modules together.
* Assert on various invalid module syntax usage.

## v0.4.0 <span class="release-date">(2014-04-03)</span>

* Remove trailing whitespace after AMD define (#93)
* (**breaking**) Default to anonymous modules for AMD output (use `--infer-name` flag for old behavior). Replaces `--anonymous` flag.

## v0.3.6 <span class="release-date">(2013-12-16)</span>

* Rebuilt & republished to fix regression on quoting `static` property (sorry!)

## v0.3.5 <span class="release-date">(2013-12-01)</span>

* Fixed incorrect module path strings in CJS output (#82)

## v0.3.4 <span class="release-date">(2013-11-19)</span>

* CJS: Build a module object when using `module foo from "foo"` for better forward-compatibility.
* Added YUI transpiler, lovingly created & maintained by the YUI team
* Fixed `'static'` keyword not being quoted in Esprima, causing issues in some JS runtimes

## v0.3.3 <span class="release-date">(2013-10-25)</span>

* Fix syntax error in CommonJS output with default imports and `compatFix` option

## v0.3.2 <span class="release-date">(2013-10-18)</span>

* Fixes path resolution on the command line (thanks rpflorence!)

## v0.3.1 <span class="release-date">(2013-10-17)</span>

* Use a working commit for Esprima

## v0.3.0 <span class="release-date">(2013-10-16)</span>

This is a **major, breaking version**. See TRANSITION.md for information on upgrading your code.

* Rewrote the transpiler using Esprima
* Support default exports and named exports in the same module
  * Default export now exports to `moduleObject.default`, see TRANSITION.md for details
* Fixed multiline export parsing
* Added support for `module` keyword (i.e. `module foo from "foo"`)
* Added support for `import "foo";` form
* fixed the `--anonymous` flag with the CLI for recursive transpiling (#20)
* Removed relative pathing for AMD resolution & direct CoffeeScript transpilation (see TRANSITION.md)

## v0.2.0 <span class="release-date">(2013-07-08)</span>

* added support for default export (`export default jQuery`)
* added support for default import (`import $ from "jquery"`)
* added support for re-exporting properties (`export { ajax } from "jquery"`)
* removed support for `export =` syntax (use `export default`)
* removed support for `import "jquery" as $` (use `import $ from "jquery"`)

## v0.1.3 <span class="release-date">(2013-06-21)</span>

* fixed: import/export statements within block comments are now ignored
* added support for `export var foo = …`
* added support for `export function foo() { … }`

## v0.1.2 <span class="release-date">(2013-03-07)</span>

* use Grunt for building the project
* fixed: use local variables for imports

## v0.1.1 <span class="release-date">(2013-02-24)</span>

* fixed: add missing `--global` option to CLI
* documentation and clarifications of examples

## v0.1.0 <span class="release-date">(2013-02-11)</span>

* initial release
