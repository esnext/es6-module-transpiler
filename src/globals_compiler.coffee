import './abstract_compiler' as AbstractCompiler

class GlobalsCompiler extends AbstractCompiler
  stringify: ->
    passedArgs = []
    receivedArgs = []

    into = @options.into or @exportAs

    if @exports.length > 0 or @exportAs
      if @exportAs
        passedArgs.push "window"
      else if into
        passedArgs.push "window.#{into} = {}"
      else
        passedArgs.push "window"

      receivedArgs.push "exports"

    preamble = []
    preamble.push "\"use strict\"#{@eol}"

    for name in @dependencyNames
      globalImports = @options.imports[name]
      passedArgs.push "window.#{globalImports}"

      if name of @importAs
        receivedArgs.push @importAs[name]
      else
        receivedArgs.push globalImports

        for import_ in @imports[name]
          @emitVariable preamble, import_, "#{globalImports}.#{import_}"

    output = []
    output.push "(function(#{receivedArgs.join(", ")}) {"
    @indent output

    output.push preamble...
    output.push @lines...

    if @exportAs
      output.push "exports.#{into} = #{@exportAs};"
    else
      for export_ in @exports
        output.push "exports.#{export_} = #{export_};"

    @outdent output
    output.push "})(#{passedArgs.join(", ")});"

    @buildStringFromLines output

export = GlobalsCompiler
