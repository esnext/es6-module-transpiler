var es6Ext  = '.es6.js',
    typeMap = { amd: 'AMD', yui: 'YUI', cjs: 'CJS' },
    path    = require('path');

module.exports = function(grunt) {
  function extractSourceOptions(source) {
    var lines = source.split('\n'),
        options = {};

    source = grunt.util._.trim(lines.filter(function(line) {
      var lineopts = optionsFromLine(line);

      if (lineopts) {
        grunt.util._.extend(options, lineopts);
        return false;
      }

      return true;
    }).join('\n'));

    return { source: source, options: options };
  }

  function optionsFromLine(line) {
    var match = line.match(/^\/\*\s*transpile:\s*(.*?)\s*\*\/\s*$/);
    if (!match) { return null; }

    var optsString = match[1];

    if (optsString === 'INVALID') {
      return { invalid: true };
    }

    var options = {};

    optsString.split(/\s+/).forEach(function(pairString) {
      var pair  = pairString.split('='),
          key   = pair[0],
          value = pair[1];

      if (key === 'imports') {
        var imports = {};
        value.split(',').forEach(function(importPairString) {
          var importPair   = importPairString.split(':'),
              importPath   = importPair[0],
              importGlobal = importPair[1];
          imports[importPath] = importGlobal;
        });
        options[key] = imports;
      } else if (value === 'true') {
        options[key] = true;
      } else if (value === 'false') {
        options[key] = false;
      } else if (value === 'null') {
        options[key] = null;
      } else {
        options[key] = value;
      }
    });

    return options;
  }

  grunt.registerMultiTask('features', 'Creates test files for ES6 examples.', function() {
    var tmpl      = grunt.file.read(this.data.template),
        _         = grunt.util._,
        testFiles = [];

    this.files.forEach(function(file) {
      if (!_.endsWith(file.src, es6Ext)) {
        grunt.log.warn("skipping non-ES6 example file: "+file.src);
        return;
      }

      var basename = path.basename(file.src, es6Ext),
          mod      = {},
          source   = grunt.file.read(file.src),
          lines    = source.split('\n'),
          options  = null;

      mod.name     = basename.replace(/[^a-z]/gi, ' ');
      mod.basename = basename;
      mod.tests    = [];

      var extractedOptionsAndRemainingSource = extractSourceOptions(source);
      options = extractedOptionsAndRemainingSource.options;
      source  = extractedOptionsAndRemainingSource.source;

      if (options.invalid) {
        mod.tests.push({
          name    : "does not parse",
          source  : source,
          options : options,
          invalid : true
        });
      }

      ['amd', 'yui', 'cjs'].forEach(function(type) {
        var typedExt  = '.'+type+'.js',
            typeName  = typeMap[type],
            typedFile = file.src[0].replace(es6Ext, typedExt);

        if (!grunt.file.exists(typedFile)) { return; }

        var test = {};
        mod.tests.push(test);

        test.name     = 'to' + typeName;
        test.typeName = typeName;
        test.source   = source;
        test.expected = _.trim(grunt.file.read(typedFile));
        test.options  = options;
      });

      grunt.file.write(
        file.dest.replace(es6Ext, '_test.js'),
        grunt.template.process(tmpl, { data: { mod: mod } })
      );
    });
  });
};
