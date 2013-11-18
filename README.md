# ES6 Module Transpiler [![Build Status](https://travis-ci.org/square/es6-module-transpiler.png)](https://travis-ci.org/square/es6-module-transpiler)

ES6 Module Transpiler is an experimental compiler that allows you to write your
JavaScript using a subset of the current ES6 module syntax, and compile it into
AMD or CommonJS modules.

**WARNING: The ES6 module syntax is still undergoing a lot of churn, and will
likely change before final approval.**

**ES6 Module Transpiler will track ES6 syntax, and not attempt to maintain
backwards compatibility with syntax that ultimately did not succeed as part of
ES6.**

This compiler provides a way to experiment with ES6 syntax in real world
scenarios to see how the syntax holds up. It also provides a nicer, more
declarative way to write AMD (or CommonJS) modules.

See the [CHANGELOG](./CHANGELOG.md) for the latest updates.

## Usage

### Executable

The easiest way to use the transpiler is via the command line:

```
$ npm install -g https://git.squareup.com/javascript/es6-module-transpiler
$ compile-modules foo.js --to compiled
```

Here is the basic usage:

```
compile-modules FILE [FILE…] --to OUTPUT [--type=TYPE]
  [--anonymous] [--module-name=NAME]
  [--global=GLOBAL] [--imports=IMPORTS]

FILE
  An input file relative to the current directory to process.

OUTPUT
  An output directory relative to the current directory.  If it does not exist,
  it will be created.

TYPE
  One of `amd` (for AMD output), `cjs` (for CommonJS output), `yui` (for YUI
  output).

ANONYMOUS
  If you use the --anonymous flag with the AMD type, the transpiler will output
  a module with no name.

NAME
  You can supply a name to use as the module name.  By default, the transpiler
  will use the name of the file (without the ending `.js`) as the module name.
  You may not use this option if you provided multiple FILEs.

GLOBAL
  This option is only supported when the type is `globals`. By default, the
  `globals` option will attach all of the exports to `window`. This option will
  attach the exports to a single named variable on `window` instead.

IMPORTS
  This option is only supported when the type is
  `globals`. It is a hash option. If your module
  includes imports, you must use this option to
  map the import names onto globals. For example,
  `--imports ember:Ember underscore:_`
```

### Library

You can also use the transpiler as a library:

```javascript
var Compiler = require("es6-module-transpiler").Compiler;

var compiler = new Compiler(inputString, moduleName);
var output = compiler.toAMD(); // AMD output as a string
```

If you want to emit globals output, and your module has imports, you must
supply an `imports` hash. You can also use the `global` option to specify that
exports should be added to a single global instead of `window`.

```javascript
var Compiler = require("es6-module-transpiler").Compiler;

var imports = { underscore: "_", ember: "Ember" };
var options = { imports: imports, global: "RSVP" };

var compiler = new Compiler(string, name, options);
compiler.toGlobals() // window global output
```

The `string` parameter is a string of JavaScript written using the declarative
module syntax.

The `name` parameter is an optional name that should be used as the name of the
module if appropriate (for AMD, this maps onto the first parameter to the
`define` function).

## Supported ES6 Module Syntax

Again, this syntax is in flux and is closely tracking the module work being
done by TC39.

### Named Exports

There are two types of exports. *Named exports* like the following:

```javascript
// foobar.js
var foo = "foo", bar = "bar";

export { foo, bar };
```

This module has two named exports, `foo` and `bar`.

You can also write this form as:

```javascript
// foobar.js
export var foo = "foo";
export var bar = "bar";
```

Either way, another module can then import your exports like so:

```js
import { foo, bar } from "foobar";

console.log(foo);  // "foo"
```

### Default Exports

You can also export a *default* export. For example, an ES6ified jQuery might
look like this:

```javascript
// jquery.js
var jQuery = function() {};

jQuery.prototype = {
  // ...
};

export default = jQuery;
```

Then, an app that uses jQuery could import it with:

```javascript
import $ from "jquery";
```

The default export of the "jquery" module is now aliased to `$`.

A default export makes the most sense as a module's "main" export, like the
`jQuery` object in jQuery. You can use default and named exports in parallel.

### Other Syntax

#### `module`

Whereas the `import` keyword imports specific identifiers from a module,
the `module` keyword creates an object that contains all of a module's
exports:

```js
module foobar from "foobar";
console.log(foobar.foo);  // "foo"
```

In ES6, this created object is *read-only*, so don't treat it like a mutable
namespace!

#### `import "foo";`

A "bare import" that doesn't import any identifiers is useful for executing
side effects in a module. For example:

```js
// alerter.js
alert("alert! alert!");

// alertee.js
import "alerter";  // will pop up alert box
```

## Compiled Output

### Default Exports

This is super important:

**Default exports bind to an identifier on the module called `default`!**

Internally, the transpiler will use this default identifer when importing, but
any outside consumer needs to be aware that it should use the `default` key and
not the module itself. For example, an AMD consumer should look like this:

```js
define(["jquery"],
  function(jQuery) {
    var $ = jQuery['default'];
  });
```

In general, if your project wants to create a "native" module for AMD, YUI, CJS,
or globals, you should wrap modules with default exports like so:

```js
// AMD wrapper
define("jquery-amd",
  ["jquery"],
  function(jQuery) {
    return jQuery['default'];
  });

// consumer
define(["jquery-amd"],
  function($) {
    // $ is now bound to jQuery['default']
  });
```

The reason for all of this extra boilerplate is that ES6 modules support
a module having both default and named exports, whereas AMD, YUI and CJS do not.

### Individual Exports

This input (ember.js):

```javascript
var get = function(obj, key) {
  return obj[key];
};

var set = function(obj, key, value) {
  obj[key] = value;
  return obj;
};

export { get, set };
```

will compile into this AMD output:

```javascript
define(
  ["exports"],
  function(__exports__) {
    "use strict";
    var get = function(obj, key) {
      return obj[key];
    };

    var set = function(obj, key, value) {
      obj[key] = value;
      return obj;
    };

    __exports__.get = get;
    __exports__.set = set;
  });
```

The output is the same whether you use the single-line export (`export { get,
set }`) or multiple export lines, as above.

### Individual Imports

This input:

```javascript
import { get, set } from "ember";
```

will compile into this AMD output:

```javascript
define(
  ["ember"],
  function(__dependency1__) {
    "use strict";
    var get = __dependency1__.get;
    var set = __dependency1__.set;
  });
```

## Using with Node.js/Grunt

You can use this library to pre-transpile your browser code or your node
packages however you wish, but the easiest way to do it is probably to use the
[grunt-es6-module-transpiler](http://github.com/joefiorini/grunt-es6-module-transpiler)
plugin to run the transpiler as part of your [Grunt.js](http://gruntjs.com)
build task. See the README on the plugin's Github page for more information.

## Installation

Add this project to your application's package.json by running this:

    $ npm install --save es6-module-transpiler

Or install it globally:

    $ sudo npm install -g es6-module-transpiler

## Acknowledgements

Thanks to [Yehuda Katz](https://twitter.com/wycats) for
[js_module_transpiler](https://github.com/wycats/js_module_transpiler), the
library on which this one is based. Thanks to [Dave
Herman](https://twitter.com/littlecalculist) for his work on ES6 modules.
Thanks to [Erik Bryn](https://twitter.com/ebryn) for providing the initial push
to write this library. Thanks to [Domenic
Denicola](https://twitter.com/domenic) & [Thomas
Boyt](https://twitter.com/thomasaboyt) for their efforts to make this project
even better. And finally thanks to the JavaScript community at Square for
helping to write and release this library.

## Contributing

1. Fork it
2. Create your feature branch (`git checkout -b my-new-feature`)
3. Commit your changes (`git commit -am 'Add some feature'`)
4. Push to the branch (`git push origin my-new-feature`)
5. Create new Pull Request

Any contributors to the master es6-module-transpiler repository must sign the
[Individual Contributor License Agreement (CLA)][cla].  It's a short form that
covers our bases and makes sure you're eligible to contribute.

[cla]: https://spreadsheets.google.com/spreadsheet/viewform?formkey=dDViT2xzUHAwRkI3X3k5Z0lQM091OGc6MQ&ndplr=1

When you have a change you'd like to see in the master repository, [send a pull
request](https://github.com/square/es6-module-transpiler/pulls). Before we merge
your request, we'll make sure you're in the list of people who have signed a
CLA.

Thanks, and enjoy living in the ES6 future!
