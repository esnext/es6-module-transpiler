vm = require 'vm'
fs = require 'fs'
path = require 'path'
Compiler = require './compiler'
try CoffeeScript = require 'coffee-script'

enabled = no
defaultJSHandler = require.extensions['.js']
defaultCoffeeHandler = require.extensions['.coffee']

enable = ->
  return if enabled
  enabled = yes
  require.extensions['.js'] = es6JSRequireHandler
  require.extensions['.coffee'] = es6CoffeeRequireHandler if CoffeeScript?

disable = ->
  return unless enabled
  enabled = no
  require.extensions['.js'] = defaultJSHandler
  require.extensions['.coffee'] = defaultCoffeeHandler if CoffeeScript?

es6JSRequireHandler = (module, filename) ->
  module._compile(loadES6Script filename)

es6CoffeeRequireHandler = (module, filename) ->
  module._compile(CoffeeScript.compile(loadES6Script filename))

loadES6Script = (filename) ->
  content = fs.readFileSync(filename, 'utf8')
  extname = path.extname(filename)
  new Compiler(content, path.basename(filename, extname), coffee: extname is '.coffee').toCJS()

module.exports = { enable, disable }
