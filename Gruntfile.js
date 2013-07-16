module.exports = function(grunt) {
  var path = require('path');

  // Please see the grunt documentation for more information regarding task and
  // helper creation: https://github.com/cowboy/grunt/blob/master/docs/toc.md

  // ==========================================================================
  // TASKS
  // ==========================================================================

  grunt.registerMultiTask('es6-module-transpile', 'Transpile files from ES6 module syntax', function() {
    var dest = this.data.dest,
        options = this.options();

    this.filesSrc.forEach(function (filepath) {
      transpile(filepath, dest, grunt.util._.clone(options));
    });

    // unload library code so that any subsequent tasks will use the new code
    var libraryPath = path.join(__dirname, 'lib');
    for (var requirePath in require.cache) {
      if (Object.prototype.hasOwnProperty.call(require.cache, requirePath)) {
        if (requirePath.indexOf(libraryPath) === 0) {
          delete require.cache[requirePath];
        }
      }
    }

    return !grunt.task.current.errorCount;
  });

  // ==========================================================================
  // HELPERS
  // ==========================================================================

  function transpile(src, dest, options) {
    var Compiler = require('./lib/compiler'),
        coffee   = require('coffee-script');

    if (!options) {
      options = {};
    }

    options.coffee = path.extname(src) === '.coffee';

    var compileCoffeeScript = options.coffee && (options.compileCoffeeScript !== false);

    if (grunt.file.isDir(dest)) {
      // our destination is just a folder, so figure out the real filename
      var ext = compileCoffeeScript ? '.js' : path.extname(src),
          basename = path.basename(src, path.extname(src)),
          dest = path.join(dest, basename + ext);
    }

    try {
      var compiler = new Compiler(grunt.file.read(src), null, options),
          compilerMethod = null,
          compiled = null;

      compilerMethod = {
        cjs: 'toCJS',
        amd: 'toAMD',
        globals: 'toGlobals'
      }[options.type];

      if (compilerMethod) {
        compiled = compiler[compilerMethod]();
      } else {
        throw new Error('unknown transpile destination type: ' + options.type);
      }

      if (compileCoffeeScript) {
        compiled = coffee.compile(compiled);
      }

      grunt.file.write(dest, compiled);
      return true;
    } catch (e) {
      grunt.log.error('Error in ' + src + ':\n' + e);
      return false;
    }
  }

  grunt.loadNpmTasks('grunt-jasmine-node');
  grunt.loadNpmTasks('grunt-browserify');
  grunt.loadNpmTasks('grunt-contrib-uglify');

  grunt.initConfig({
    'es6-module-transpile': {
      app: {
        src: ['src/*.{js,coffee}'],
        dest: 'lib',
        options: {
          type: 'cjs'
        }
      }
    },

    jasmine_node: {
      specNameMatcher: '_spec',
      projectRoot: '.',
      requirejs: false,
      extensions: 'js|coffee',
      forceExit: true
    },

    browserify: {
      dist: {
        src: 'lib/index.js',
        dest: 'dist/es6-module-transpiler.js',
        options: {
          standalone: 'ModuleTranspiler'
        }
      }
    },

    uglify: {
      dist: {
        files: {
          'dist/es6-module-transpiler.min.js': ['dist/es6-module-transpiler.js']
        }
      }
    }
  });

  grunt.registerTask('default', ['es6-module-transpile', 'jasmine_node', 'browserify', 'uglify']);
};
