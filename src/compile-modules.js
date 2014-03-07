require('../lib/traceur-runtime');

var optimist = require('optimist');
var fs = require('fs');
var path = require('path');
var through = require('through');

function extend(target, ...sources) {
  var toString = {}.toString;

  sources.forEach(function(source) {
    for (var key in source) {
      target[key] = source[key];
    }
  });

  return target;
}

class CLI {
  constructor(Compiler, stdin=process.stdin, stdout=process.stdout, fs_=fs) {
    this.Compiler = Compiler;
    this.stdin = stdin;
    this.stdout = stdout;
    this.fs = fs_;
  }

  start(argv) {
    var options = this.parseArgs(argv);

    if (options.help) {
      this.argParser(argv).showHelp();
    } else if (options.stdio) {
      this.processStdio(options);
    } else {
      for (var i = 2; i < options._.length; i++) {
        var filename = options._[i];
        this.processPath(filename, options);
      }
    }
  }

  parseArgs(argv) {
    var args = this.argParser(argv).argv;

    return args;
  }

  argParser(argv) {
    return optimist(argv).usage('compile-modules usage:\n\n  Using files:\n    compile-modules INPUT --to DIR [--infer-name] [--type TYPE]\n\n  Using stdio:\n    compile-modules --stdio [--type TYPE] [--module-name MOD]').options({
      type: {
        "default": 'amd',
        describe: 'The type of output (one of "amd", "yui", or "cjs")'
      },
      to: {
        describe: 'A directory in which to write the resulting files'
      },
      'infer-name': {
        "default": false,
        type: 'boolean',
        describe: 'Automatically generate names for AMD and YUI modules'
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
      help: {
        "default": false,
        type: 'boolean',
        alias: 'h',
        describe: 'Shows this help message'
      }
    }).check(({type}) => type === 'amd' || type === 'yui' || type === 'cjs')
    .check(args => !args['infer-name'] || !args.m)
    .check(args => (args.stdio && args.type === 'amd') ? !args['infer-name'] : true)
    .check(args => (args.stdio && args.type === 'yui') ? !args['infer-name'] : true)
    .check(args => args.stdio || args.to || args.help)
  }

  processStdio(options) {
    this.processIO(this.stdin, this.stdout, options);
  }

  processIO(input, output, options) {
    var data = '',
        self = this;

    function write(chunk) {
      data += chunk;
    }

    function end() {
      /* jshint -W040 */
      this.queue(self._compile(data, options.m, options.type, options));
      this.queue(null);
    }

    input.pipe(through(write, end)).pipe(output);
  }

  processPath(filename, options) {
    this.fs.stat(filename, function(err, stat) {
      if (err) {
        throw new Error(err);
      } else if (stat.isDirectory()) {
        this.processDirectory(filename, options);
      } else {
        this.processFile(filename, options);
      }
    }.bind(this));
  }

  processDirectory(dirname, options) {
    this.fs.readdir(dirname, function(err, children) {
      if (err) {
        console.error(err.message);
        process.exit(1);
      }
      children.forEach(function(child) {
        this.processPath(path.join(dirname, child), options);
      }.bind(this));
    }.bind(this));
  }

  processFile(filename, options) {
    function normalizePath(p) {
      return p.replace(/\\/g, '/');
    }

    var ext            = path.extname(filename),
        basenameNoExt  = path.basename(filename, ext),
        dirname        = path.dirname(filename),
        pathNoExt      = normalizePath(path.join(dirname, basenameNoExt)),
        output,
        outputFilename = normalizePath(path.join(options.to, filename)),
        moduleName     = options['infer-name'] ? pathNoExt : null;

    options = extend({}, options, {m: moduleName});
    this._mkdirp(path.dirname(outputFilename));

    this.processIO(
      this.fs.createReadStream(filename),
      this.fs.createWriteStream(outputFilename),
      options
    );
  }

  _compile(input, moduleName, type, options) {
    var compiler, method;
    type = {
      amd: 'AMD',
      yui: 'YUI',
      cjs: 'CJS'
    }[type];
    compiler = new this.Compiler(input, moduleName, options);
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

CLI.start = function(Compiler, argv, stdin=process.stdin, stdout=process.stdout, fs_=fs) {
  return new CLI(Compiler, stdin, stdout, fs_).start(argv);
};

function requireMain() {
  var root    = path.join(__dirname, '..'),
      pkgPath = path.join(root, 'package.json'),
      pkg     = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

  return require(path.join(root, pkg.main));
}

let Compiler = requireMain().Compiler;

CLI.start(Compiler, process.argv);
