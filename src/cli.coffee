optimist = require 'optimist'
fs = require 'fs'
Compiler = require './compiler'

class CLI
  @start: (argv, stdin=process.stdin, stdout=process.stdout) ->
    new @(stdin, stdout).start(argv)

  constructor: (@stdin=process.stdin, @stdout=process.stdout) ->

  start: (argv) ->
    options = @parseArgs argv

    input = ''
    @stdin.resume()
    @stdin.setEncoding 'utf8'
    @stdin.on 'data', (data) -> input += data
    @stdin.on 'end', => @stdout.write @process(input, options)

  parseArgs: (argv) ->
    optimist(argv)
      .options(
        type:
          default: 'amd'
          describe: 'The type of output'
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
          describe: 'Process a single file by reading stdin and writing to stdout'
        coffee:
          default: no
          type: 'boolean'
          describe: 'Process stdin as CoffeeScript (used with --stdio)'
      ).check(
        (args) -> args.type in ['amd', 'cjs']
      ).check(
        (args) -> not (args.anonymous and args.m)
      ).check(
        (args) -> if args.stdio and args.type is 'amd' then args.anonymous or args.m or no else yes
      ).check(
        (args) -> not (args.coffee and not args.stdio)
      ).argv

  process: (input, options) ->
    compiler = new Compiler(input, options.m, coffee: options.coffee)
    method   = "to#{options.type.toUpperCase()}"
    return compiler[method]()

module.exports = CLI
