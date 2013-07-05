import AbstractCompiler from './abstract_compiler'
import { isEmpty } from './utils'

class GlobalsCompiler extends AbstractCompiler
  stringify: ->
    @build (s) =>
      passedArgs = []
      receivedArgs = []
      locals = {}

      into = @options.into or @exportDefault

      if !isEmpty(@exports) or @exportDefault
        passedArgs.push(
          if @exportDefault
            s.global
          else if into
            "#{s.global}.#{into} = {}"
          else
            s.global
        )

        receivedArgs.push 'exports'

      for name in @dependencyNames
        globalImport = @options.imports[name]
        passedArgs.push "#{s.global}.#{globalImport}"

        if name of @importDefault
          receivedArgs.push @importDefault[name]
        else
          receivedArgs.push globalImport

          for own name, alias of @imports[name]
            locals[alias] = "#{globalImport}.#{name}"

      wrapper = =>
        s.function receivedArgs, =>
          s.useStrict()

          # var get = Ember.get;
          s.var lhs, rhs for own lhs, rhs of locals

          # body
          s.append @lines...

          if @exportDefault
            s.set "exports.#{into}", @exportDefault
          else
            for exportName, exportValue of @exports
              s.set "exports.#{exportName}", exportValue

      args = (arg) =>
        arg passedArg for passedArg in passedArgs

      s.line => s.call wrapper, args

export default GlobalsCompiler
