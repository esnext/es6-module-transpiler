Compiler = require '../lib/compiler'
CLI      = require '../lib/cli'
Stream   = require 'stream'
path     = require 'path'

class ProcessExitError extends Error
  constructor: (@code) ->
    @message = "exited with code #{@code}"

expectingDirtyExit = no

beforeEach ->
  # protect against optimist exiting
  expectingDirtyExit = no
  spyOn(process, 'exit').andCallFake(processExitFake)
  spyOn console, 'error'

processExitFake = (code) ->
  if not expectingDirtyExit and code? and code isnt 0
    errorData = []
    errorData = errorData.concat(call.args).concat(['\n']) for call in console.error.calls
    console.error.originalValue.apply(console, errorData)
  throw new ProcessExitError(code)

stripTrailingNewlines = (string) ->
  string.replace(/\n*$/, '')

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

shouldCompileGlobals = (input, output, options={}) ->
  name = if options.anonymous then null else 'jquery'
  [ output, compiler ] = normalize input, output, name, options
  expect(stripTrailingNewlines compiler.toGlobals()).toEqual(output)

shouldRaise = (input, message, options={}) ->
  compiler = new Compiler(input, 'jquery', options)
  expect(-> compiler.toAMD()).toThrow(message)

parseOptions = (args...) ->
  if args.length is 1 and typeof args[0] is 'string'
    args = args[0].split(/\s+/)
  new CLI().parseArgs(args)

optionsShouldBeInvalid = (args...) ->
  expectingDirtyExit = yes
  expect(-> parseOptions args...).toThrow('exited with code 1')
  expect(console.error).toHaveBeenCalled()

shouldRunCLI = (args, input, output) ->
  usingStdio = typeof input is 'string' and typeof output is 'string'

  stdin  = new ReadableStream()
  stdout = new WritableStream()
  fs     = new FakeFilesystem(if usingStdio then {} else input)

  cli = new CLI(stdin, stdout, fs)
  cli.start args

  if usingStdio
    stdin.emit 'data', unindent(input)
  stdin.emit 'end'

  if usingStdio
    expect(stdout.data).toEqual(unindent(output))
  else
    fs.verify()

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

class FakeFilesystem
  constructor: (@_description) ->
    # convert to windows paths if necessary
    for eachPath of @_description
      if eachPath != path.normalize(eachPath)
        @_description[path.normalize(eachPath)] = @_description[eachPath]
        delete @_description[eachPath]

  readFile: (filename, encoding, callback) ->
    filename = path.normalize(filename)

    if arguments.length is 2
      callback = encoding
      encoding = 'utf8'

    callback null, @readFileSync(filename, encoding)
    return null

  readFileSync: (filename, encoding) ->
    filename = path.normalize(filename)

    if filename of @_description
      if 'read' of @_description[filename]
        return @_description[filename].read

    throw new Error("unexpectedly trying to read data from file #{filename}")

  writeFile: (filename, data, encoding, callback) ->
    filename = path.normalize(filename)

    if arguments.length is 3
      callback = encoding
      encoding = 'utf8'

    @writeFileSync(filename, data, encoding)
    callback? null
    return null

  writeFileSync: (filename, data, encoding) ->
    filename = path.normalize(filename)

    if filename of @_description
      fileDescription = @_description[filename]
      if 'write' of fileDescription
        expect(data).toEqual(fileDescription.write)
        delete fileDescription.write
        return null

    throw new Error("unexpected data written to file #{filename}: #{data}")

  exists: (filename, callback) ->
    filename = path.normalize(filename)

    callback null, @existsSync(filename)
    return null

  existsSync: (filename) ->
    filename = path.normalize(filename)

    fileDescription = @_description[filename]
    return fileDescription?.read? or fileDescription?.exists

  mkdir: (dirname, callback) ->
    dirname = path.normalize(dirname)

    @mkdirSync dirname
    callback? null
    return null

  mkdirSync: (dirname) ->
    dirname = path.normalize(dirname)

    if dirname of @_description
      dirDescription = @_description[dirname]
      if 'mkdir' of dirDescription
        delete dirDescription.mkdir
        return null

    throw new Error("unexpectedly trying to make directory #{dirname}")

  stat: (filename, callback) ->
    filename = path.normalize(filename)

    result = @statSync filename
    callback? null, result
    return null

  statSync: (filename) ->
    filename = path.normalize(filename)

    if filename of @_description
      fileDescription = @_description[filename]
      {
        isDirectory: -> fileDescription.contents?
        isFile: -> not @isDirectory()
      }

  readdir: (dirname, callback) ->
    dirname = path.normalize(dirname)

    result = @readdirSync dirname
    callback? null, result
    return null

  readdirSync: (dirname) ->
    dirname = path.normalize(dirname)

    if dirname of @_description
      dirDescription = @_description[dirname]
      if 'contents' of dirDescription
        return dirDescription.contents

  verify: ->
    for own filename, { read, write, mkdir } of @_description
      if write?
        throw new Error("expected data to have been written to #{filename}, but was not: #{write}")
      if mkdir?
        throw new Error("expected directory to have been made, but was not: #{filename}")
    return null


module.exports = { normalize, shouldCompileAMD, shouldCompileCJS, shouldCompileGlobals, shouldRaise, parseOptions, optionsShouldBeInvalid, shouldRunCLI }
