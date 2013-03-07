(function() {
  "use strict";

  var Compiler, compile, defaultCoffeeHandler, defaultJSHandler, disable, enable, enabled, es6CoffeeRequireHandler, es6JSRequireHandler, fs, loadES6Script, path, vm;

  vm = require("vm");

  fs = require("fs");

  path = require("path");

  Compiler = require("./compiler");

  compile = require("coffee-script").compile;

  enabled = false;

  defaultJSHandler = require.extensions['.js'];

  defaultCoffeeHandler = require.extensions['.coffee'];

  enable = function() {
    if (enabled) {
      return;
    }
    enabled = true;
    require.extensions['.js'] = es6JSRequireHandler;
    return require.extensions['.coffee'] = es6CoffeeRequireHandler;
  };

  disable = function() {
    if (!enabled) {
      return;
    }
    enabled = false;
    require.extensions['.js'] = defaultJSHandler;
    return require.extensions['.coffee'] = defaultCoffeeHandler;
  };

  es6JSRequireHandler = function(module, filename) {
    return module._compile(loadES6Script(filename));
  };

  es6CoffeeRequireHandler = function(module, filename) {
    return module._compile(compile(loadES6Script(filename)));
  };

  loadES6Script = function(filename) {
    var content, extname;
    content = fs.readFileSync(filename, 'utf8');
    extname = path.extname(filename);
    return new Compiler(content, path.basename(filename, extname), {
      coffee: extname === '.coffee'
    }).toCJS();
  };

  exports.enable = enable;

  exports.disable = disable;

}).call(this);
