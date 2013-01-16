AbstractCompiler = require './abstract_compiler'

class CJSCompiler extends AbstractCompiler
  stringify: ->
    output = []
    dependencyNumber = 0

    output.push '"use strict";'

    for own import_, name of @importAs
      output.push "var #{name} = require(\"#{import_}\");"

    for own import_, variables of @imports
      if variables.length is 1
        variable = variables[0]
        output.push "var #{variable} = require(\"#{import_}\").#{variable};"
      else
        dependencyNumber++
        dependency = "__dependency#{dependencyNumber}__"
        output.push "var #{dependency} = require(\"#{import_}\");"

        for variable in variables
          output.push "var #{variable} = #{dependency}.#{variable};"

    output.push line for line in @lines

    if @exportAs
      output.push "module.exports = #{@exportAs};"

    for export_ in @exports
      output.push "exports.#{export_} = #{export_};"

    return output.join('\n')

module.exports = CJSCompiler
