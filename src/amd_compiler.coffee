AbstractCompiler = require './abstract_compiler'

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

    output.push "  [#{(JSON.stringify(name) for name in @dependencyNames).join(', ')}],"
    output.push "  function(#{args.join(', ')}) {"
    output.push "    \"use strict\";"

    output.push "    #{line}" for line in preamble

    for line in @lines
      if /^\s*$/.test line
        output.push line
      else
        output.push "    #{line}"

    for ex in @exports
      output.push "    __exports__.#{ex} = #{ex};"

    if @exportAs
      output.push "    return #{@exportAs};"

    output.push "  });"

    return output.join('\n')

module.exports = AMDCompiler
