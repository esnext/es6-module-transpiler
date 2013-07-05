import vm from 'vm'
import fs from 'fs'
import path from 'path'
import Compiler from './compiler'
import { compile } from 'coffee-script'

enabled = no
defaultJSHandler = require.extensions['.js']
defaultCoffeeHandler = require.extensions['.coffee']

enable = ->
  return if enabled
  enabled = yes
  require.extensions['.js'] = es6JSRequireHandler
  require.extensions['.coffee'] = es6CoffeeRequireHandler

disable = ->
  return unless enabled
  enabled = no
  require.extensions['.js'] = defaultJSHandler
  require.extensions['.coffee'] = defaultCoffeeHandler

es6JSRequireHandler = (module, filename) ->
  module._compile(loadES6Script filename)

es6CoffeeRequireHandler = (module, filename) ->
  module._compile(compile(loadES6Script filename))

loadES6Script = (filename) ->
  content = fs.readFileSync(filename, 'utf8')
  extname = path.extname(filename)
  new Compiler(content, path.basename(filename, extname), coffee: extname is '.coffee').toCJS()

export { enable, disable }
