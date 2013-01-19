import './abstract_compiler' as AbstractCompiler

class GlobalsCompiler extends AbstractCompiler
  stringify: ->
    @build (s) =>
      passedArgs = []
      receivedArgs = []
      locals = {}

      into = @options.into or @exportAs

      if @exports.length > 0 or @exportAs
        passedArgs.push(
          if @exportAs
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

        if name of @importAs
          receivedArgs.push @importAs[name]
        else
          receivedArgs.push globalImport

          for import_ in @imports[name]
            locals[import_] = "#{globalImport}.#{import_}"

      wrapper = =>
        s.function receivedArgs, =>
          s.useStrict()

          # var get = Ember.get;
          s.var lhs, rhs for own lhs, rhs of locals

          # body
          s.append @lines...

          if @exportAs
            s.set "exports.#{into}", @exportAs
          else
            for export_ in @exports
              s.set "exports.#{export_}", export_

      args = (arg) =>
        arg passedArg for passedArg in passedArgs

      s.line => s.call wrapper, args

export = GlobalsCompiler
