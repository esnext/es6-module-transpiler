import optimist from 'optimist';
import fs from 'fs';
import path from 'path';
import Compiler from './compiler';

class CLI {
  constructor(stdin, stdout, fs_) {
    this.stdin = stdin != null ? stdin : process.stdin;
    this.stdout = stdout != null ? stdout : process.stdout;
    this.fs = fs_ != null ? fs_ : fs;
  }

  start(argv) {
    var filename, options, _i, _len, _ref;
    options = this.parseArgs(argv);
    if (options.help) {
      this.argParser(argv).showHelp();
      return;
    }
    if (options.stdio) {
      this.processStdio(options);
    } else {
      _ref = options._;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        filename = _ref[_i];
        this.processPath(filename, options);
      }
    }
    return null;
  }

  parseArgs(argv) {
    var args, global, imports, pair, requirePath, _i, _len, _ref, _ref1;
    args = this.argParser(argv).argv;
    if (args.imports) {
      imports = {};
      _ref = args.imports.split(',');
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        pair = _ref[_i];
        _ref1 = pair.split(':'), requirePath = _ref1[0], global = _ref1[1];
        imports[requirePath] = global;
      }
      args.imports = imports;
    }
    if (args.global) {
      args.into = args.global;
    }
    return args;
  }

  argParser(argv) {
    return optimist(argv).usage('compile-modules usage:\n\n  Using files:\n    compile-modules INPUT --to DIR [--anonymous] [--type TYPE] [--imports PATH:GLOBAL]\n\n  Using stdio:\n    compile-modules --stdio [--coffee] [--type TYPE] [--imports PATH:GLOBAL] (--module-name MOD|--anonymous)').options({
      type: {
        "default": 'amd',
        describe: 'The type of output (one of "amd", "cjs", or "globals")'
      },
      to: {
        describe: 'A directory in which to write the resulting files'
      },
      imports: {
        describe: 'A list of path:global pairs, comma separated (e.g. jquery:$,ember:Ember)'
      },
      anonymous: {
        "default": false,
        type: 'boolean',
        describe: 'Do not include a module name'
      },
      'module-name': {
        describe: 'The name of the outputted module',
        alias: 'm'
      },
      stdio: {
        "default": false,
        type: 'boolean',
        alias: 's',
        describe: 'Use stdin and stdout to process a file'
      },
      coffee: {
        "default": false,
        type: 'boolean',
        describe: 'Process stdin as CoffeeScript (requires --stdio)'
      },
      global: {
        describe: 'When the type is `globals`, the name of the global to export into'
      },
      help: {
        "default": false,
        type: 'boolean',
        alias: 'h',
        describe: 'Shows this help message'
      }
    }).check(function(args) {
      var _ref;
      return (_ref = args.type) === 'amd' || _ref === 'cjs' || _ref === 'globals';
    }).check(function(args) {
      return !(args.anonymous && args.m);
    }).check(function(args) {
      if (args.stdio && args.type === 'amd') {
        return args.anonymous || args.m || false;
      } else {
        return true;
      }
    }).check(function(args) {
      return !(args.coffee && !args.stdio);
    }).check(function(args) {
      return args.stdio || args.to || args.help;
    }).check(function(args) {
      if (args.imports) {
        return args.type === 'globals';
      } else {
        return true;
      }
    });
  }

  processStdio(options) {
    var input,
      _this = this;
    input = '';
    this.stdin.resume();
    this.stdin.setEncoding('utf8');
    this.stdin.on('data', function(data) {
      return input += data;
    });
    return this.stdin.on('end', function() {
      var output;
      output = _this._compile(input, options.m, options.type, options);
      return _this.stdout.write(output);
    });
  }

  processPath(filename, options) {
    var _this = this;
    return this.fs.stat(filename, function(err, stat) {
      if (err) {
        console.error(err.message);
        return process.exit(1);
      } else if (stat.isDirectory()) {
        return _this.processDirectory(filename, options);
      } else {
        return _this.processFile(filename, options);
      }
    });
  }

  processDirectory(dirname, options) {
    var _this = this;
    return this.fs.readdir(dirname, function(err, children) {
      var child, _i, _len, _results;
      if (err) {
        console.error(err.message);
        process.exit(1);
      }
      _results = [];
      for (_i = 0, _len = children.length; _i < _len; _i++) {
        child = children[_i];
        _results.push(_this.processPath(path.join(dirname, child), options));
      }
      return _results;
    });
  }

  processFile(filename, options) {
    var _this = this;
    return this.fs.readFile(filename, 'utf8', function(err, input) {
      var ext, moduleName, output, outputFilename;
      ext = path.extname(filename);
      if (!options.anonymous) {
        moduleName = path.join(path.dirname(filename), path.basename(filename, ext)).replace(/[\\]/g, '/');
      }
      output = _this._compile(input, moduleName, options.type, {
        coffee: ext === '.coffee',
        imports: options.imports
      });
      outputFilename = path.join(options.to, filename).replace(/[\\]/g, '/');
      _this._mkdirp(path.dirname(outputFilename));
      return _this.fs.writeFile(outputFilename, output, 'utf8', function(err) {
        if (err) {
          console.error(err.message);
          return process.exit(1);
        }
      });
    });
  }

  _compile(input, moduleName, type, options) {
    var compiler, method;
    type = {
      amd: 'AMD',
      cjs: 'CJS',
      globals: 'Globals'
    }[type];
    compiler = new Compiler(input, moduleName, options);
    method = "to" + type;
    return compiler[method]();
  }

  _mkdirp(directory) {
    var prefix;
    if (this.fs.existsSync(directory)) {
      return;
    }
    prefix = path.dirname(directory);
    if (prefix !== '.' && prefix !== '/') {
      this._mkdirp(prefix);
    }
    return this.fs.mkdirSync(directory);
  }
}

CLI.start = function(argv, stdin, stdout, fs_) {
  if (stdin == null) {
    stdin = process.stdin;
  }
  if (stdout == null) {
    stdout = process.stdout;
  }
  if (fs_ == null) {
    fs_ = fs;
  }
  return new this(stdin, stdout, fs_).start(argv);
};

export default CLI;
