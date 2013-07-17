var es6Ext  = '.es6.js',
    typeMap = { amd: 'AMD', cjs: 'CJS', globals: 'Globals' },
    path    = require('path');

module.exports = function(grunt) {
  grunt.registerMultiTask('qunit-runner', 'Creates a test runner file.', function() {
    var tmpl      = grunt.file.read('test/runner.html.tmpl'),
        _         = grunt.util._,
        testFiles = [],
        modules   = [];

    this.filesSrc.forEach(function(file) {
      if (!_.endsWith(file, es6Ext)) {
        testFiles.push(file);
        return;
      }

      var basename = path.basename(file, es6Ext),
          mod      = {},
          source   = grunt.file.read(file),
          lines    = source.split('\n'),
          options  = {};

      modules.push(mod);

      mod.name  = basename.replace(/[^a-z]/i, ' ');
      mod.tests = [];

      source = _.trim(lines.filter(function(line) {
        var match = line.match(/^\/\*\s*transpile:\s*(.*?)\s*\*\/\s*$/);

        if (match) {
          var optsString = match[1];

          optsString.split(/\s+/).forEach(function(pairString) {
            var pair  = pairString.split('='),
                key   = pair[0],
                value = pair[1];

            switch (key) {
              case 'imports':
                var imports = {};
                value.split(',').forEach(function(importPairString) {
                  var importPair   = importPairString.split(':'),
                      importPath   = importPair[0],
                      importGlobal = importPair[1];
                  imports[importPath] = importGlobal;
                });
                options[key] = imports;
                break;

              default:
                options[key] = value;
            }
          });
          return false;
        } else {
          return true;
        }
      }).join('\n'));

      ['amd', 'cjs', 'globals'].forEach(function(type) {
        var typedExt  = '.'+type+'.js',
            typeName  = typeMap[type],
            typedFile = file.replace(es6Ext, typedExt);

        if (!grunt.file.exists(typedFile)) { return; }

        var test = {};
        mod.tests.push(test);

        test.name     = 'to' + typeName;
        test.typeName = typeName;
        test.source   = source;
        test.expected = _.trim(grunt.file.read(typedFile));
        test.options  = options;
      });
    });

    var renderingContext = {
      data: {
        files: testFiles,
        modules: modules
      }
    };
    grunt.file.write('test/index.html', grunt.template.process(tmpl, renderingContext));
  });
};
