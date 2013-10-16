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
