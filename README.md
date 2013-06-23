# ES6 Module Transpiler

ES6 Module Transpiler is an experimental compiler that allows you to write
your JavaScript/CoffeeScript using a subset of the current ES6 module syntax,
and compile it into AMD or CommonJS modules.

**WARNING: The ES6 module syntax is still undergoing a lot of churn,
and will definitely still change before final approval.**

**ES6 Module Transpiler will track ES6 syntax, and not attempt to
maintain backwards compatibility with syntax that ultimately did
not succeed as part of ES6.**

This compiler provides a way to experiment with ES6 syntax in real
world scenarios to see how the syntax holds up. It also provides a
nicer, more declarative way to write AMD (or CommonJS) modules.

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
  One of `amd` (for AMD output), `cjs` (for CommonJS output).

ANONYMOUS
  If you use the --anonymous flag with the AMD type, the transpiler will output
  a module with no name.

NAME
  You can supply a name to use as the module name.  By default, the transpiler
  will use the name of the file (without the ending `.js`/`.coffee`) as the
  module name.  You may not use this option if you provided multiple FILEs.

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

var compiler = new Compiler(string, name);
compiler.toAMD(); // AMD output
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

## Support Syntax

Again, this syntax is in flux and is closely tracking the module work being
done by TC39.

### Exports

There are two ways to do exports.

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

You can also write this form as:

```javascript
var get = function(obj, key) {
  return obj[key];
};

export get;

var set = function(obj, key, value) {
  obj[key] = value;
  return obj;
};

export set;
```

Both of these export two variables: `get` and `set`. Below, in the import
section, you will see how to use these exports in another module.

You can also export a single variable *as the module itself*:

```javascript
var jQuery = function() {};

jQuery.prototype = {
  // ...
};

export default jQuery;
```

### Imports

If you want to import variables exported individually from another module, you
use this syntax:

```javascript
import { get, set } from "ember";
```

To import a module that set its export using `export default`, you use this syntax:

```javascript
import jQuery from "jquery";
```

As you can see, the import and export syntaxes are symmetric.

## AMD Compiled Output

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
define("ember",
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

### A Single Export

This input:

```javascript
var jQuery = function() {};

jQuery.prototype = {
  // ...
};

export default jQuery;
```

will compile into this AMD output:

```javascript
define("ember",
  [],
  function() {
    "use strict";
    var jQuery = function() {};

    jQuery.prototype = {
      // ...
    };

    return jQuery;
  });
```

### Individual Imports

This input:

```javascript
import { get, set } from "ember";
```

will compile into this AMD output:

```javascript
define("app",
  ["ember"],
  function(__dependency1__) {
    "use strict";
    var get = __dependency1__.get;
    var set = __dependency1__.set;
  });
```

### Importing a Whole Module (`import as`)

This input:

```javascript
import jQuery from "jquery";
```

will compile into this AMD output:

```javascript
define("app",
  ["jquery"],
  function(jQuery) {
    "use strict";
  });
```

## Using with Node.js

You can use this library to pre-transpile your browser code or your node packages,
but when developing a node package this can be painful. To make testing your
packages easier you can configure es6-module-transpiler to auto-transpile your
JavaScript or CoffeeScript modules on the fly:

```javascript
// mymodule.js
import jQuery from "jquery";
export jQuery;

// bootstrap.js
require("es6-module-transpiler/require_support").enable();
var jQuery = require("./mymodule").jQuery;

// …
```

## Using with Grunt

You can install the
[grunt-es6-module-transpiler](http://github.com/joefiorini/grunt-es6-module-transpiler)
plugin to run the transpiler as part of your [Grunt.js](http://gruntjs.com)
build task. See the README on the plugin's Github page for more information.

## Installation

Add this project to your application's package.json by running this:

    $ npm install --save es6-module-transpiler

Or install it globally:

    $ sudo npm install -g es6-module-transpiler

## Acknowledgements

Thanks to Yehuda Katz for
[js_module_transpiler](https://github.com/wycats/js_module_transpiler), the
library on which this one is based. Thanks to Dave Herman for his work on ES6
modules. Thanks to Erik Bryn for providing the initial push to write this
library. And finally thanks to the JavaScript community at Square for helping
to write and release this library.

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
