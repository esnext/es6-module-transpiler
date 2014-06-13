/* jshint node:true, undef:true, unused:true */

Error.stackTraceLimit = 50;

var fs = require('fs');
var Path = require('path');
var vm = require('vm');
var assert = require('assert');

var modules = require('../lib');
var utils = require('../lib/utils');
var endsWith = utils.endsWith;
var ExpectedError = require('./support/expected_error');

var examples = Path.join(__dirname, 'examples');

var paths = [];
var formatters = require('../lib/formatters');
var formatterNames = Object.keys(formatters).filter(function(formatter) {
  return formatter !== 'DEFAULT';
});
var formatter = formatters.DEFAULT;

var getopt = require('posix-getopt');
var parser = new getopt.BasicParser('h(help)f:(format)', process.argv);
var option;

while ((option = parser.getopt()) !== undefined) {
  if (option.error) {
    usage();
    process.exit(1);
  }

  switch (option.option) {
    case 'f':
      formatter = option.optarg;
      if (formatterNames.indexOf(formatter) < 0) {
        usage();
        process.exit(1);
      }
      break;

    case 'h':
      usage();
      process.exit(0);
      break;
  }
}

paths.push.apply(paths, process.argv.slice(parser.optind()));

if (paths.length === 0) {
  paths = fs.readdirSync(examples).map(function(example) {
    return Path.join(examples, example);
  });
} else {
  var cwd = process.cwd();
  paths = paths.map(function(example) {
    return Path.resolve(cwd, example);
  });
}

var results = Path.join(__dirname, 'results');
if (fs.existsSync(results)) {
  rmrf(results);
}
fs.mkdirSync(results);
runTests(paths);

function runTests(paths) {
  var passed = 0, failed = 0;
  paths.forEach(function(path) {
    if (runTestDir(path)) {
      passed++;
    } else {
      failed++;
    }
  });

  console.log();
  console.log('%d passed, %s failed.', passed, failed);
  process.exit(
    (passed + failed === 0) ? 1 : // no tests, fail
              failed === 0  ? 0 : // no failed, pass
                              1); // some failed, fail
}

function runTestDir(testDir) {
  var passed = false;
  var testName = Path.basename(testDir);

  var options = {
    resolvers: [new modules.FileResolver([testDir])],
    formatter: formatters[formatter]
  };
  var container = new modules.Container(options);

  var expectedError;
  try {
    fs.readdirSync(testDir).forEach(function(child) {
      var mod = container.getModule(child);
      var contents = fs.readFileSync(mod.path).toString();
      var newExpectedError = ExpectedError.getFromSource(contents);

      assert.ok(
        !newExpectedError || !expectedError,
        'found more than one error comment!'
      );

      expectedError = newExpectedError;
    });

    var resultPath = Path.join(results, testName + '.js');
    container.write(resultPath);

    var testAssert = wrappedAssert();
    if (fs.statSync(resultPath).isDirectory()) {
      fs.readdirSync(resultPath).forEach(function(child) {
        requireTestFile('./' + child, resultPath, testAssert);
      });
    } else {
      requireTestFile(resultPath, process.cwd(), testAssert);
    }

    assert.ok(
      expectedError || testAssert.count > 0,
      'expected at least one assertion'
    );

    if (expectedError) {
      expectedError.assertMatch(null);
    }

    passed = true;
    printSuccess(testName);
  } catch (ex) {
    if (!(ex instanceof assert.AssertionError) && expectedError) {
      ex = expectedError.matchError(ex);
    }

    if (ex) {
      printFailure(testName, ex);
      console.log();
    } else {
      printSuccess(testName);
      passed = true;
    }
  }

  return passed;
}

// TODO: Just use the real node require system with proxyquire?
var testFileCache;
var testFileGlobal;
function requireTestFile(path, relativeTo, assert) {
  if (path[0] === '.') {
    path = Path.resolve(relativeTo, path);
  }

  if (!testFileCache) { testFileCache = {}; }

  if (path in testFileCache) {
    return testFileCache[path];
  } else if (!fs.existsSync(path) && !endsWith(path, '.js')) {
    return requireTestFile(path + '.js');
  }

  var code = fs.readFileSync(path);
  var mod = {exports: {}};
  testFileCache[path] = mod.exports;

  if (!testFileGlobal) { testFileGlobal = {}; }

  testFileGlobal.assert = assert;
  testFileGlobal.global = testFileGlobal;
  testFileGlobal.module = mod;
  testFileGlobal.exports = mod.exports;
  testFileGlobal.require = function(requiredPath) {
    return requireTestFile(requiredPath, Path.dirname(path), assert);
  };

  // Hack to work around an issue where vm does not set `this` to the context.
  code = '(function(){' + code + '}).call(global);';
  vm.runInNewContext(code, testFileGlobal, path);

  testFileCache[path] = mod.exports;
  return mod.exports;
}

function wrappedAssert() {
  var result = {count: 0};

  Object.getOwnPropertyNames(assert).forEach(function(property) {
    result[property] = function() {
      result.count++;
      return assert[property].apply(assert, arguments);
    };
  });

  return result;
}

function rmrf(path) {
  var stat = fs.statSync(path);
  if (stat.isDirectory()) {
    fs.readdirSync(path).forEach(function(child) {
      rmrf(Path.join(path, child));
    });
    fs.rmdirSync(path);
  } else if (stat.isFile()) {
    fs.unlinkSync(path);
  }
}

/**
 * Prints a line to stdout for the given test indicating that it passed.
 *
 * @param {string} testName
 */
function printSuccess(testName) {
  console.log('\x1b[32m✓ \x1b[0m' + testName);
}

/**
 * Prints a line to stdout for the given test indicating that it failed. In
 * addition, prints any additional information indented one level.
 *
 * @param {string} testName
 * @param {Error} error
 */
function printFailure(testName, error) {
  console.log('\x1b[31m✘ ' + testName + '\x1b[0m');
  console.log();
  if (error.stack) {
    console.log(error.stack);
  } else {
    console.log(error.message);
  }
}

function usage() {
  console.log('node test/runner.js [OPTIONS] [EXAMPLE1 [EXAMPLE2 ...]]');
  console.log();
  console.log('  -f, --format <name>  Choose from: %s.', formatterNames.join(', '));
  console.log('  -h, --help           Show this help message.');
}
