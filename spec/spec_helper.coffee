Compiler = require '../lib/compiler'
CLI = require '../lib/cli'
Stream = require 'stream'

class ProcessExitError extends Error
  constructor: (@code) ->
    @message = "exited with code #{@code}"

beforeEach ->
  # protect against optimist exiting
  verbose = no
  spyOn(process, 'exit').andCallFake(if verbose then verboseProcessExitFake else processExitFake)
  spyOn console, 'error'

processExitFake = (code) ->
  throw new ProcessExitError(code)

verboseProcessExitFake = (code) ->
  errorData = []
  errorData = errorData.concat(call.args).concat(['\n']) for call in console.error.calls
  console.error.originalValue.apply(console, errorData)
  processExitFake(code)

stripTrailingNewlines = (string) ->
  string.replace(/\n*\z/, '')

unindent = (string) ->
  string = stripTrailingNewlines string
  lines  = string.split('\n')
  minIndent = Math.min((line.match(/^( *)/)[1].length for line in lines)...)
  (line[minIndent..-1] for line in lines).join('\n')

normalize = (input, output, name, options={}) ->
  compiler = new Compiler(unindent(input), name, options)
  return [ unindent(output), compiler ]

shouldCompileAMD = (input, output, options={}) ->
  name = if options.anonymous then null else 'jquery'
  [ output, compiler ] = normalize input, output, name, options
  expect(stripTrailingNewlines compiler.toAMD()).toEqual(output)

shouldCompileCJS = (input, output, options={}) ->
  name = if options.anonymous then null else 'jquery'
  [ output, compiler ] = normalize input, output, name, options
  expect(stripTrailingNewlines compiler.toCJS()).toEqual(output)

shouldRaise = (input, message, options={}) ->
  compiler = new Compiler(input, 'jquery', options)
  expect(-> compiler.toAMD()).toThrow(message)

parseOptions = (args...) ->
  if args.length is 1 and typeof args[0] is 'string'
    args = args[0].split(/\s+/)
  new CLI().parseArgs(args)

optionsShouldBeInvalid = (args...) ->
  expect(-> parseOptions args...).toThrow('exited with code 1')
  expect(console.error).toHaveBeenCalled()

shouldRunCLI = (args, input, output) ->
  stdin  = new ReadableStream()
  stdout = new WritableStream()

  cli = new CLI(stdin, stdout)
  cli.start args

  stdin.emit 'data', unindent(input)
  stdin.emit 'end'

  expect(stdout.data).toEqual(unindent(output))

class MockStream extends Stream
  resume: ->
  pause: ->
  setEncoding: (@encoding) ->

class ReadableStream extends MockStream
  constructor: ->
    @readable = yes

class WritableStream extends MockStream
  constructor: ->
    @writable = yes
    @data = ''

  write: (data) ->
    @data += data


for own name, fn of { normalize, shouldCompileAMD, shouldCompileCJS, shouldRaise, parseOptions, optionsShouldBeInvalid, shouldRunCLI }
  global[name] = fn
