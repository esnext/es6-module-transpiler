module.exports = (grunt) ->
  path = require('path')

  # Please see the grunt documentation for more information regarding task and
  # helper creation: https://github.com/cowboy/grunt/blob/master/docs/toc.md

  # ==========================================================================
  # TASKS
  # ==========================================================================

  grunt.registerMultiTask 'es6-module-transpile', 'Transpile files from ES6 module syntax', ->
    dest = @data.dest
    options = @options()

    @filesSrc.forEach (filepath) ->
      transpile(filepath, dest, grunt.util._.clone(options))

    # unload library code so that any subsequent tasks will use the new code
    libraryPath = path.join(__dirname, 'lib')
    for own requirePath of require.cache
      if requirePath.indexOf(libraryPath) is 0
        delete require.cache[requirePath]

    if grunt.task.current.errorCount
      return false
    else
      return true

  # ==========================================================================
  # HELPERS
  # ==========================================================================

  transpile = (src, dest, options) ->
    Compiler = require './lib/compiler'
    coffee   = require 'coffee-script'

    options ||= {}
    options.coffee = path.extname(src) is '.coffee'

    compileCoffeeScript = options.coffee and (options.compileCoffeeScript isnt false)

    if grunt.file.isDir(dest)
      # our destination is just a folder, so figure out the real filename
      ext = if compileCoffeeScript then '.js' else path.extname(src)
      basename = path.basename(src, path.extname(src))
      dest = path.join(dest, basename + ext)

    try
      compiler = new Compiler(grunt.file.read(src), null, options)

      compiled = \
        switch options.type
          when 'cjs'
            compiler.toCJS()
          when 'amd'
            compiler.toAMD()
          when 'globals'
            compiler.toGlobals()
          else throw new Error("unknown transpile destination type: #{options.type}")

      if compileCoffeeScript
        compiled = coffee.compile(compiled)

      grunt.file.write(dest, compiled)
      return true
    catch e
      grunt.log.error("Error in #{src}:\n#{e}")
      return false

  grunt.loadNpmTasks 'grunt-jasmine-node'
  grunt.loadNpmTasks 'grunt-contrib-gluejs'
  grunt.loadNpmTasks 'grunt-contrib-uglify'

  grunt.initConfig
    'es6-module-transpile':
      app:
        src: ['src/*.coffee']
        dest: 'lib'
        options:
          type: 'cjs'

    jasmine_node:
      specNameMatcher: '_spec'
      projectRoot: '.'
      requirejs: false
      extensions: 'js|coffee'
      forceExit: true

    gluejs:
      dist:
        options:
          export: 'ModuleTranspiler'
          basepath: 'lib'
        src: 'lib/*.js'
        dest: 'dist/es6-module-transpiler.js'

    uglify:
      dist:
        files:
          'dist/es6-module-transpiler.min.js': ['dist/es6-module-transpiler.js']

  grunt.registerTask('default', ['es6-module-transpile', 'jasmine_node', 'gluejs', 'uglify'])
