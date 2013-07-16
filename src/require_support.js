import vm from 'vm';
import fs from 'fs';
import path from 'path';
import Compiler from './compiler';
import { compile } from 'coffee-script';

var defaultCoffeeHandler, defaultJSHandler, disable, enable, enabled, es6CoffeeRequireHandler, es6JSRequireHandler, loadES6Script;

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

export { enable, disable };
