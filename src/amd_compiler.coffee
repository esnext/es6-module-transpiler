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

    @indent output
    output.push "#{JSON.stringify(@dependencyNames)},"
    @emitFunctionHeader output, args
    @indent output
    output.push "\"use strict\"#{@eol}"

    output.push preamble...
    output.push @lines...

    for export_ in @exports
      output.push "__exports__.#{export_} = #{export_}#{@eol}"

    if @exportAs
      output.push "return #{@exportAs}#{@eol}"

    @outdent output
    output.push "#{@functionTail})#{@eol}"
    @outdent output

    return @buildStringFromLines output

export = AMDCompiler
