import optimist from 'optimist'
import fs from 'fs'
import path from 'path'
import Compiler from './compiler'

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
        @processPath(filename, options)

    return null

  parseArgs: (argv) ->
    args = @argParser(argv).argv
    if args.imports
      imports = {}
      for pair in args.imports.split(',')
        [requirePath, global] = pair.split(':')
        imports[requirePath] = global
      args.imports = imports
    if args.global
      args.into = args.global
    return args

  argParser: (argv) ->
    optimist(argv)
      .usage('compile-modules usage:\n\n  Using files:\n    compile-modules INPUT --to DIR [--anonymous] [--type TYPE] [--imports PATH:GLOBAL]\n\n  Using stdio:\n    compile-modules --stdio [--coffee] [--type TYPE] [--imports PATH:GLOBAL] (--module-name MOD|--anonymous)')
      .options(
        type:
          default: 'amd'
          describe: 'The type of output (one of "amd", "cjs", or "globals")'
        to:
          describe: 'A directory in which to write the resulting files'
        imports:
          describe: 'A list of path:global pairs, comma separated (e.g. jquery:$,ember:Ember)'
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
        global:
          describe: 'When the type is `globals`, the name of the global to export into'
        help:
          default: no
          type: 'boolean'
          alias: 'h'
          describe: 'Shows this help message'
      ).check(
        (args) -> args.type in ['amd', 'cjs', 'globals']
      ).check(
        (args) -> not (args.anonymous and args.m)
      ).check(
        (args) -> if args.stdio and args.type is 'amd' then args.anonymous or args.m or no else yes
      ).check(
        (args) -> not (args.coffee and not args.stdio)
      ).check(
        (args) -> args.stdio or args.to or args.help
      ).check(
        (args) -> if args.imports then args.type is 'globals' else yes
      )

  processStdio: (options) ->
    input = ''
    @stdin.resume()
    @stdin.setEncoding 'utf8'

    @stdin.on 'data', (data) =>
      input += data

    @stdin.on 'end', =>
      output = @_compile input, options.m, options.type, options
      @stdout.write output

  processPath: (filename, options) ->
    @fs.stat filename, (err, stat) =>
      if err
        console.error(err.message)
        process.exit(1)
      else if stat.isDirectory()
        @processDirectory filename, options
      else
        @processFile filename, options

  processDirectory: (dirname, options) ->
    @fs.readdir dirname, (err, children) =>
      if err
        console.error(err.message)
        process.exit(1)

      for child in children
        @processPath path.join(dirname, child), options

  processFile: (filename, options) ->
    @fs.readFile filename, 'utf8', (err, input) =>
      ext = path.extname(filename)
      moduleName = path.join(path.dirname(filename), path.basename(filename, ext)).replace(/[\\]/g, '/')
      output = @_compile input, moduleName, options.type, coffee: ext is '.coffee', imports: options.imports
      outputFilename = path.join(options.to, filename).replace(/[\\]/g, '/')

      @_mkdirp path.dirname(outputFilename)
      @fs.writeFile outputFilename, output, 'utf8', (err) ->
        if err
          console.error(err.message)
          process.exit(1)

  _compile: (input, moduleName, type, options) ->
    type = {amd: 'AMD', cjs: 'CJS', globals: 'Globals'}[type]
    compiler = new Compiler(input, moduleName, options)
    method   = "to#{type}"
    return compiler[method]()

  _mkdirp: (directory) ->
    return if @fs.existsSync directory
    prefix = path.dirname(directory)
    if prefix not in ['.', '/']
      @_mkdirp prefix
    @fs.mkdirSync directory


export default CLI
