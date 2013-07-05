import ScriptBuilder from './script_builder'

class JavaScriptBuilder extends ScriptBuilder
  eol: ';'

  var: (lhs, rhs) ->
    @line "var #{@capture lhs} = #{@capture rhs}"

  _functionHeader: (args) ->
    "function(#{args.join ', '}) {"

  _functionTail: ->
    '}'

export default JavaScriptBuilder
