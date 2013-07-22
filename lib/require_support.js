import vm from 'vm';
import fs from 'fs';
import path from 'path';
import Compiler from './compiler';
import { compile } from 'coffee-script';

var enabled = false,
    defaultJSHandler = require.extensions['.js'];

function enable() {
  if (enabled) { return; }

  enabled = true;
  require.extensions['.js'] = es6JSRequireHandler;
}

function disable() {
  if (!enabled) { return; }

  enabled = false;
  require.extensions['.js'] = defaultJSHandler;
}

function es6JSRequireHandler(module, filename) {
  return module._compile(loadES6Script(filename));
}

function loadES6Script(filename) {
  var content = fs.readFileSync(filename, 'utf8'),
      extname = path.extname(filename);

  return new Compiler(content, path.basename(filename, extname)).toCJS();
}

export { enable, disable };
