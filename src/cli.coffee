optimist = require 'optimist'
fs       = require 'fs'
path     = require 'path'
Compiler = require './compiler'

class CLI
  @start: (argv, stdin=process.stdin, stdout=process.stdout, fs_=fs) ->
    new @(stdin, stdout, fs_).start(argv)

  constructor: (@stdin=process.stdin, @stdout=process.stdout, @fs=fs) ->

  start: (argv) ->
    options = @parseArgs argv

    if options.help
      @argParser(argv).showHelp()
      return

    if options.stdio
      @processStdio options
    else
      for filename in options._
        @processFile(filename, options)

    return null

  parseArgs: (argv) ->
    @argParser(argv).argv

  argParser: (argv) ->
    optimist(argv)
      .usage('compile-modules usage:\n\n  Using files:\n    compile-modules --to DIR [--anonymous] [--type TYPE] FILE [FILE2 ...]\n\n  Using stdio:\n    compile-modules --stdio [--coffee] [--type TYPE] (--module-name MOD|--anonymous)')
      .options(
        type:
          default: 'amd'
          describe: 'The type of output (one of "amd" or "cjs")'
        to:
          describe: 'A directory in which to write the resulting files'
        anonymous:
          default: no
          type: 'boolean'
          describe: 'Do not include a module name'
        'module-name':
          describe : 'The name of the outputted module'
          alias: 'm'
        stdio:
          default: no
          type: 'boolean'
          alias: 's'
          describe: 'Use stdin and stdout to process a file'
        coffee:
          default: no
          type: 'boolean'
          describe: 'Process stdin as CoffeeScript (requires --stdio)'
        help:
          default: no
          type: 'boolean'
          alias: 'h'
          describe: 'Shows this help message'
      ).check(
        (args) -> args.type in ['amd', 'cjs']
      ).check(
        (args) -> not (args.anonymous and args.m)
      ).check(
        (args) -> if args.stdio and args.type is 'amd' then args.anonymous or args.m or no else yes
      ).check(
        (args) -> not (args.coffee and not args.stdio)
      ).check(
        (args) -> args.stdio or args.to or args.help
      )

  processStdio: (options) ->
    input = ''
    @stdin.resume()
    @stdin.setEncoding 'utf8'

    @stdin.on 'data', (data) =>
      input += data

    @stdin.on 'end', =>
      output = @_compile input, options.m, options.type, coffee: options.coffee
      @stdout.write output

  processFile: (filename, options) ->
    @fs.readFile filename, 'utf8', (err, input) =>
      ext = path.extname(filename)
      moduleName = path.join(path.dirname(filename), path.basename(filename, ext))
      output = @_compile input, moduleName, options.type, coffee: ext is '.coffee'
      outputFilename = path.join(options.to, filename)

      @_mkdirp path.dirname(outputFilename)
      @fs.writeFile outputFilename, output, 'utf8', (err) ->
        if err
          console.error(err.message)
          process.exit(1)

  _compile: (input, moduleName, type, options) ->
    compiler = new Compiler(input, moduleName, options)
    method   = "to#{type.toUpperCase()}"
    return compiler[method]()

  _mkdirp: (directory) ->
    return if @fs.existsSync directory
    prefix = path.dirname(directory)
    if prefix not in ['.', '/']
      @_mkdirp prefix
    @fs.mkdirSync directory


module.exports = CLI
