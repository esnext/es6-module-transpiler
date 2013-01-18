import './abstract_compiler' as AbstractCompiler

class AMDCompiler extends AbstractCompiler
  stringify: ->
    [ args, preamble ] = @buildPreamble(@dependencyNames)

    unless @exports.length is 0
      @dependencyNames.push 'exports'
      args.push '__exports__'

    output = []

    if @moduleName
      output.push "define(\"#{@moduleName}\","
    else
      output.push "define("

    output.push "  #{JSON.stringify(@dependencyNames)},"
    @emitFunctionHeader output, args
    output.push "    \"use strict\"#{@eol}"

    output.push "    #{line}" for line in preamble

    for line in @lines
      if /^\s*$/.test line
        output.push line
      else
        output.push "    #{line}"

    for export_ in @exports
      output.push "    __exports__.#{export_} = #{export_}#{@eol}"

    if @exportAs
      output.push "    return #{@exportAs}#{@eol}"

    output.push "  #{@functionTail})#{@eol}"

    return output.join('\n')

export = AMDCompiler
