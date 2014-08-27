/* jshint node:true, undef:true, unused:true */

var fs = require('fs');
var assert = require('assert');
var Path = require('path');
var recast = require('recast');

var formatters = require('../formatters');
var Container = require('../container');
var FileResolver = require('../file_resolver');

var getopt = require('posix-getopt');
var exe = Path.basename(process.argv[1]);

exports.run = function(args, puts, eputs) {
  var offset = 0;

  var files = [];
  var includePaths = [process.cwd()];
  var output;
  var formatter = formatters[formatters.DEFAULT];
  var resolverClasses = [FileResolver];

  while (offset < args.length) {
    var parser = new getopt.BasicParser('h(help)o:(output)I:(include)f:(format)r:(resolver)', ['', ''].concat(args.slice(offset)));
    var option;

    while ((option = parser.getopt()) !== undefined) {
      if (option.error) {
        usage(eputs);
        return 1;
      }

      switch (option.option) {
        case 'h':
          usage(puts);
          return 0;

        case 'o':
          output = option.optarg;
          break;

        case 'I':
          includePaths.push(option.optarg);
          break;

        case 'f':
          formatter = formatters[option.optarg];
          if (!formatter) {
            try { formatter = require(option.optarg); }
            catch (ex) {}
          }
          if (!formatter) {
            eputs('Cannot find formatter for ' + option.optarg);
            usage(eputs);
            return 1;
          }
          break;

        case 'r':
          try {
            var resolverPath = option.optarg;
            if (fs.existsSync(resolverPath)) {
              resolverClasses.push(require(Path.join(process.cwd(), resolverPath)));
            } else {
              resolverClasses.push(require(option.optarg));
            }
          }
          catch (ex) {
            eputs('Error reading resolver ' + option.optarg + ': ' + ex);
            usage(eputs);
            return 1;
          }
          break;
      }
    }

    for (offset += parser.optind() - 2; args[offset] && args[offset][0] !== '-'; offset++) {
      files.push(args[offset]);
    }
  }

  assert.ok(
    files.length > 0,
    'Please provide at least one file to convert.'
  );

  if (typeof formatter === 'function') {
    formatter = new formatter();
  }

  var resolvers = resolverClasses.map(function(resolverClass) {
    return new resolverClass(includePaths);
  });
  var container = new Container({
    formatter: formatter,
    resolvers: resolvers
  });

  files.forEach(function(file) {
    container.getModule(file);
  });

  if (output) {
    container.write(output);
  } else {
    var outputs = container.convert();
    assert.equal(
      outputs.length, 1,
      'Cannot output ' + outputs.length + ' files to stdout. ' +
      'Please use the --output flag to specify where to put the ' +
      'files or choose a formatter that concatenates.'
    );
    process.stdout.write(recast.print(outputs[0]).code);
  }

};

function bold(string) {
  return '\x1b[01m' + string + '\x1b[0m';
}

function usage(puts) {
  puts(exe + ' convert [-I <path>] [-o <path>] [-f <path|name>] [-r <path>] <path> [<path> ...]');
  puts();
  puts(bold('Description'));
  puts();
  puts('  Converts the given modules by changing `import`/`export` statements to an ES5 equivalent.');
  puts();
  puts(bold('Options'));
  puts();
  puts('  -I, --include <path>      Check the given path for imported modules (usable multiple times).');
  puts('  -o, --output <path>       File or directory to output converted files.');
  puts('  -f, --format <path|name>  Path to custom formatter or choose from built-in formats.');
  puts('  -r, --resolver <path>     Path to custom resolver (usable multiple times).');
  puts('  -h, --help                Show this help message.');
  puts();
  puts(bold('Formats'));
  puts();
  puts('  commonjs - convert modules to files using CommonJS `require` and `exports` objects.');
  puts('  bundle - concatenate modules into a single file.');
  puts();
  puts('  You may provide custom a formatter by passing the path to your module to the `--format` option. See the');
  puts('  source of any of the built-in formatters for details on how to build your own.');
  puts();
  puts(bold('Resolvers'));
  puts();
  puts('  Resolvers resolve import paths to modules. The default resolver will search the include paths provided');
  puts('  by `--include` arguments and the current working directory. To provide custom resolver logic, pass the');
  puts('  path to your resolver module providing a `resolveModule` function or class with an instance method with');
  puts('  this signature: `resolveModule(importedPath:String, fromModule:?Module, container:Container): Module`.');
}
