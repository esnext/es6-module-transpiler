AbstractCompiler = require './abstract_compiler'

class CJSCompiler extends AbstractCompiler
  stringify: ->
    output = []
    dependencyNumber = 0

    output.push "\"use strict\"#{@eol}"

    for own import_, name of @importAs
      @emitVariable output, name, "require(\"#{import_}\")"

    for own import_, variables of @imports
      if variables.length is 1
        variable = variables[0]
        @emitVariable output, variable, "require(\"#{import_}\").#{variable}"
      else
        dependencyNumber++
        dependency = "__dependency#{dependencyNumber}__"
        @emitVariable output, dependency, "require(\"#{import_}\")"

        for variable in variables
          @emitVariable output, variable, "#{dependency}.#{variable}"

    output.push line for line in @lines

    if @exportAs
      output.push "module.exports = #{@exportAs}#{@eol}"

    for export_ in @exports
      output.push "exports.#{export_} = #{export_}#{@eol}"

    return output.join('\n')

module.exports = CJSCompiler
