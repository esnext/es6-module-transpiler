Compiler = require '../lib/compiler'

stripTrailingNewlines = (string) ->
  string.replace(/\n*\z/, '')

normalize = (input, output, name, options={}) ->
  input = input.replace(/^ {6}/g, '')
  output = stripTrailingNewlines output.replace(/^ {6}/g, '')

  compiler = new Compiler(input, name, options)
  return [ output, compiler ]

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

for own name, fn of { normalize, shouldCompileAMD, shouldCompileCJS, shouldRaise }
  global[name] = fn
