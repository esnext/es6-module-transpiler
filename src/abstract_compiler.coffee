import './compile_error' as CompileError

INDENT = {}
OUTDENT = {}

class AbstractCompiler
  constructor: (compiler, options) ->
    @compiler = compiler

    @exports = compiler.exports
    @exportAs = compiler.exportAs
    @imports = compiler.imports
    @importAs = compiler.importAs

    @moduleName = compiler.moduleName
    @lines = compiler.lines

    @options = options

    @dependencyNames = []
    @dependencyNames.push name for own name of @imports when name not in @dependencyNames
    @dependencyNames.push name for own name of @importAs when name not in @dependencyNames

    @eol = if @options.coffee then '' else ';'
    @functionTail = if @options.coffee then '' else '}'

    @assertValid()

  assertValid: ->
    if @exportAs and @exports.length > 0
      throw new CompileError("You cannot use both `export =` and `export` in the same module")

  buildPreamble: (names) ->
    preamble = []
    args = []
    number = 0

    for name in names
      if name of @importAs
        args.push @importAs[name]
      else
        dependency = "__dependency#{number++}__"
        args.push dependency
        preamble = preamble.concat @importsForPreamble(@imports[name], dependency)

    return [ args, preamble ]

  importsForPreamble: (importNames, dependencyName) ->
    for importName in importNames
      "var #{importName} = #{dependencyName}.#{importName};"

  emitVariable: (output, name, value) ->
    line = "#{name} = #{value}#{@eol}"
    line = "var #{line}" unless @options.coffee
    output.push line

  emitFunctionHeader: (output, args) ->
    line = "(#{args.join(', ')})"
    if @options.coffee
      if args.length is 0
        line = "->"
      else
        line = "#{line} ->"
    else
      line = "function#{line} {"
    output.push line

  indent: (output) ->
    output.push INDENT

  outdent: (output) ->
    output.push OUTDENT

  buildStringFromLines: (lines) ->
    indent = 0
    result = []
    for line in lines
      if line is INDENT
        indent++
      else if line is OUTDENT
        indent--
      else if /^\s*$/.test line
        result.push line
      else
        result.push (new Array(indent+1)).join('  ') + line
    return result.join('\n')


export = AbstractCompiler
