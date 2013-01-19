import './abstract_compiler' as AbstractCompiler

class AMDCompiler extends AbstractCompiler
  stringify: ->
    @build (s) =>
      [ wrapperArgs, preamble ] = @buildPreamble(@dependencyNames)

      unless @exports.length is 0
        @dependencyNames.push 'exports'
        wrapperArgs.push '__exports__'

      s.line =>
        s.call 'define', (arg) =>
          arg s.print(@moduleName) if @moduleName
          arg s.break
          arg s.print(@dependencyNames)
          arg s.break
          arg =>
            s.function wrapperArgs, =>
              s.useStrict()
              s.append preamble if preamble
              s.append @lines...

              for export_ in @exports
                s.line "__exports__.#{export_} = #{export_}"

              if @exportAs
                s.line "return #{@exportAs}"

export = AMDCompiler
