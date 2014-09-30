# CHANGELOG

## v0.8.0 (Tuesday, September 30, 2014)

* Simplify the CommonJS formatter output to use ES3.

## v0.7.0 (Tuesday, September 30, 2014)

* Use a common base class for all built-in formatters.
* Various internal cleanups.

## v0.6.2 (Wednesday, August 20, 2014)

* Prevent all instances of export reassignment, not just those at the top level.

## v0.6.1 (Wednesday, August 20, 2014)

* Reference a custom fork of esprima.
* Allow resolvers to set the `Module#src` property to prevent direct file system access.

## v0.6.0 (Monday, July 28, 2014)

* Add support for source maps.
* Allow formatters to handle export reassignment.
* Update recast to v0.6.6.

## v0.5.1 (Wednesday, June 25, 2014)

* Fix the file list to be included in npm.

## v0.5.0 (Tuesday, June 24, 2014)

* Completely re-written using [recast](https://github.com/benjamn/recast).
* Removed YUI support, to be re-added as a plugin.
* Removed AMD support, to be re-added as a plugin.
* Added "bundle" formatter for concatenating all modules together.
* Assert on various invalid module syntax usage.

## v0.4.0 (Thursday, April 3, 2014)

* Remove trailing whitespace after AMD define (#93)
* (**breaking**) Default to anonymous modules for AMD output (use `--infer-name` flag for old behavior). Replaces `--anonymous` flag.

## v0.3.6 (Monday, December 16, 2013)

* Rebuilt & republished to fix regression on quoting `static` property (sorry!)

## v0.3.5 (Sunday, December 1, 2013)

* Fixed incorrect module path strings in CJS output (#82)

## v0.3.4 (Tuesday, November 19, 2013)

* CJS: Build a module object when using `module foo from "foo"` for better forward-compatibility.
* Added YUI transpiler, lovingly created & maintained by the YUI team
* Fixed `'static'` keyword not being quoted in Esprima, causing issues in some JS runtimes

## v0.3.3 (Friday, October 25, 2013)

* Fix syntax error in CommonJS output with default imports and `compatFix` option

## v0.3.2 (Friday, October 18, 2013)

* Fixes path resolution on the command line (thanks rpflorence!)

## v0.3.1 (Thursday, October 17, 2013)

* Use a working commit for Esprima

## v0.3.0 (Wednesday, October 16, 2013)

This is a **major, breaking version**. See TRANSITION.md for information on upgrading your code.

* Rewrote the transpiler using Esprima
* Support default exports and named exports in the same module
  * Default export now exports to `moduleObject.default`, see TRANSITION.md for details
* Fixed multiline export parsing
* Added support for `module` keyword (i.e. `module foo from "foo"`)
* Added support for `import "foo";` form
* fixed the `--anonymous` flag with the CLI for recursive transpiling (#20)
* Removed relative pathing for AMD resolution & direct CoffeeScript transpilation (see TRANSITION.md)

## v0.2.0 (Monday, July 8th, 2013)

* added support for default export (`export default jQuery`)
* added support for default import (`import $ from "jquery"`)
* added support for re-exporting properties (`export { ajax } from "jquery"`)
* removed support for `export =` syntax (use `export default`)
* removed support for `import "jquery" as $` (use `import $ from "jquery"`)

## v0.1.3 (Friday, June 21st, 2013)

* fixed: import/export statements within block comments are now ignored
* added support for `export var foo = …`
* added support for `export function foo() { … }`

## v0.1.2 (Thursday, March 7th, 2013)

* use Grunt for building the project
* fixed: use local variables for imports

## v0.1.1 (Sunday, February 24th, 2013)

* fixed: add missing `--global` option to CLI
* documentation and clarifications of examples

## v0.1.0 (Monday, February 11th, 2013)

* initial release
