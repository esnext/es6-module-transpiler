# Transitioning from 0.4.x to 0.5.x

## API Changes

The API has completely changed. We still allow transpiling to CommonJS, but any
of the other previously supported formats have been removed. Each output format
is handled by a "formatter", and 3rd-party formatters may be used by using the
`--format` option in the CLI or initialing a `Container` with a particular
`formatter` when using as a library.

## Command-line changes

The transpiler still has a CLI, but it is structured completely differently.
See `compile-modules -h` for details.

## Spec compilance

### Bindings

In order to comply with the spec, this project now supports mutable bindings.
For example, given this:

```js
export var count = 0;
export function incr() { count++; }
```

And when it's imported, this will work:

```js
import { count, incr } from './count';
assert.equal(count, 0);
incr();
assert.equal(count, 1);
```

### Circular References

Cycles now work properly. Note that not all cases of cycles can be properly
handled - this is simply the nature of cycles. For example, this works:

```js
// a.js
import { b } from './b';

export function a(n) {
  if (n % 2 === 0) {
    return b(n);
  } else {
    return n + 1;
  }
}

// b.js
import { a } from './a';

export function b(n) {
  if (n % 2 === 0) {
    return n;
  } else {
    return a(n);
  }
}
```

This works because neither `a` nor `b` uses the other until sometime "later".
This second example will not work:

```js
// a.js
import { b } from './b';
export var a = b;

// b.js
import { a } from './a';
export var b = a;
```

This is a contrived example, obviously, but many more complicated examples
boil down to this same thing.

# Transitioning from 0.2.x to 0.3.x

## default export changes

### Spec changes

`export default foo;` has been removed in favor of `export default = foo`.

### Internal changes

In 0.2.x, the default export was the module's only export. Now, it's internally a named export called `default`:

```js
// es6
export default bar;

//cjs
exports.default = bar;

// es6
import bar from "bar";

// cjs
var bar = require("bar").default;
```

This means that your "entry point" - anywhere you're importing the transpiled output from AMD or CJS - needs to explicitly import `default`. For example, if your AMD app was using ES6-built Handlebars, you would need to do:

```js
define("my-module",
  ["handlebars"],
  function (handlebars) {
    var handlebars = handlebars.default;
  })
```

## New features you should use

* Multi line exports!

```js
export default = {
  foo: "\n to your heart's content!"
};
```

* Module keyword!

```js
module foo from "foo";
var namedExport = foo.namedExport;
```

* Mixed default/named exports!

```js
export default = "foo";
export var bar = "bar";
```

* Bare imports!

```js
// executes side effects in "foo" but doesn't import anything
import "foo";
```

## Old features you can no longer use

* Relative pathing in AMD modules has been removed, as it was broken, hacky, and made people sad.

* CoffeeScript support is removed, sort of.

If you're using **the original CoffeeScript compiler**, you can use JS passthrough:

```coffeescript
foo = "look at this elegant coffeescript!"

`
// now we're in sad curly-brace land
export default = foo;
`
```

You'll then want to transpile your modules using the compiled JS as a base.

Unfortunately, **this doesn't work with CoffeeScript Redux (or EmberScript)**, because that compiler wraps pass-through in an `eval` call.
