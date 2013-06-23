import ScriptBuilder from './script_builder'

class CoffeeScriptBuilder extends ScriptBuilder
  eol: ''

  var: (lhs, rhs) ->
    @set lhs, rhs

  _prepareArgsForCall: (args) ->
    args = super(args).slice()
    for arg in args
      if arg is @break
        args.push @break unless args[args.length - 1] is @break
        break
    return args

  _functionHeader: (args) ->
    if args.length
      "(#{args.join ', '}) ->"
    else
      '->'

export default CoffeeScriptBuilder
