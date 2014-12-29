# ES6 Module Transpiler [![Build Status](https://travis-ci.org/esnext/es6-module-transpiler.png)](https://travis-ci.org/esnext/es6-module-transpiler)

ES6 Module Transpiler is an experimental compiler that allows you to write your
JavaScript using a subset of the ES6 module syntax, and compile it into
AMD or CommonJS modules.

This compiler provides a way to experiment with ES6 syntax in real world
scenarios to see how the syntax holds up. It also provides a nicer, more
declarative way to write AMD (or CommonJS) modules.

See the [CHANGELOG](./CHANGELOG.md) for the latest updates.

## Usage

### Build tools

The easiest way to use the transpiler is from an existing build tool. There
several plugins developed for different build tools:

* **Grunt:** [grunt-es6-module-transpiler](https://github.com/joefiorini/grunt-es6-module-transpiler), maintained by @joefiorini (not yet compatible with v0.5.x)
* **Gulp:** [gulp-es6-module-transpiler](https://github.com/ryanseddon/gulp-es6-module-transpiler), maintained by @ryanseddon
* **Brunch:** [es6-module-transpiler-brunch](https://github.com/gcollazo/es6-module-transpiler-brunch), maintained by @gcollazo *(CommonJS only)* (not yet compatible with v0.5.x)
* **Broccoli:** [broccoli-es6-concatenator](https://github.com/joliss/broccoli-es6-concatenator), maintained by @joliss (not yet compatible with v0.5.x)
* **Mimosa:** [mimosa-es6-module-transpiler](https://github.com/dbashford/mimosa-es6-module-transpiler), maintained by @dbashford (not yet compatible with v0.5.x)
* **AMD Formatter:** [es6-module-transpiler-amd-formatter](https://github.com/caridy/es6-module-transpiler-amd-formatter), maintained by @caridy (compatible with v0.5.x+ only)

### Executable

The transpiler can be used directly from the command line:

```
$ npm install -g es6-module-transpiler
$ compile-modules convert foo.js
```

Here is the basic usage:

```
compile-modules convert -I lib -o out FILE [FILE…]
```

### Library

You can also use the transpiler as a library:

```javascript
var transpiler = require('es6-module-transpiler');
var Container = transpiler.Container;
var FileResolver = transpiler.FileResolver;
var BundleFormatter = transpiler.formatters.bundle;

var container = new Container({
  resolvers: [new FileResolver(['lib/'])],
  formatter: new BundleFormatter()
});

container.getModule('index');
container.write('out/mylib.js');
```

## Supported ES6 Module Syntax

### Named Exports

There are two types of exports. *Named exports* like the following:

```javascript
// foobar.js
var foo = 'foo', bar = 'bar';

export { foo, bar };
```

This module has two named exports, `foo` and `bar`.

You can also write this form as:

```javascript
// foobar.js
export var foo = 'foo';
export var bar = 'bar';
```

Either way, another module can then import your exports like so:

```js
import { foo, bar } from 'foobar';

console.log(foo);  // 'foo'
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

export default jQuery;
```

Then, an app that uses jQuery could import it with:

```javascript
import $ from 'jquery';
```

The default export of the "jquery" module is now aliased to `$`.

A default export makes the most sense as a module's "main" export, like the
`jQuery` object in jQuery. You can use default and named exports in parallel.

### Other Syntax

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
not the module itself. For example, a CommonJS consumer should look like this:

```js
var $ = require('jquery')['default'];
```

## Installation

Add this project to your application's package.json by running this:

    $ npm install --save es6-module-transpiler

Or install it globally:

    $ npm install -g es6-module-transpiler

## Acknowledgements

Thanks to [Yehuda Katz](https://twitter.com/wycats) for
[js_module_transpiler](https://github.com/wycats/js_module_transpiler), the
library on which this one is based. Thanks to [Dave
Herman](https://twitter.com/littlecalculist) for his work on ES6 modules.
Thanks to [Erik Bryn](https://twitter.com/ebryn) for providing the initial push
to write this library. Thanks to [Domenic
Denicola](https://twitter.com/domenic), [Jo Liss](https://twitter.com/jo_liss),
& [Thomas Boyt](https://twitter.com/thomasaboyt) for their efforts to make this
project even better. And finally thanks to the JavaScript community at Square
for helping to write and release this library.

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
request](https://github.com/esnext/es6-module-transpiler/pulls). Before we merge
your request, we'll make sure you're in the list of people who have signed a
CLA.

Thanks, and enjoy living in the ES6 future!
