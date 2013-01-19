import './script_builder' as ScriptBuilder

class JavaScriptBuilder extends ScriptBuilder
  eol: ';'

  var: (lhs, rhs) ->
    @line "var #{@capture lhs} = #{@capture rhs}"

  _functionHeader: (args) ->
    "function(#{args.join ', '}) {"

  _functionTail: ->
    '}'

export = JavaScriptBuilder
