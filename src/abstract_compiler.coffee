CompileError = require './compile_error'

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
        preamble.concat @importsForPreamble(@imports[name], dependency)

    return [ args, preamble ]

  importsForPreamble: (importNames, dependencyName) ->
    for importName in importNames
      "var #{importName} = #{dependencyName}.#{importName};"

module.exports = AbstractCompiler
