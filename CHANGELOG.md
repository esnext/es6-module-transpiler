# CHANGELOG

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
