import './abstract_compiler' as AbstractCompiler
import { isEmpty } from './utils'

class AMDCompiler extends AbstractCompiler
  stringify: ->
    @build (s) =>
      [ wrapperArgs, preamble ] = @buildPreamble(@dependencyNames)

      unless isEmpty(@exports)
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

              for exportName, exportValue of @exports
                s.line "__exports__.#{exportName} = #{exportValue}"

              if @exportAs
                s.line "return #{@exportAs}"

export = AMDCompiler
