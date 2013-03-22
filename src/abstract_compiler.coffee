import './compile_error' as CompileError
import './java_script_builder' as JavaScriptBuilder
import './coffee_script_builder' as CoffeeScriptBuilder
import { isEmpty } from './utils'

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
    if @exportAs and !isEmpty(@exports)
      throw new CompileError("You cannot use both `export =` and `export` in the same module")

  buildPreamble: (names) ->
    args = []

    preamble = @build (s) =>
      number = 0
      deps = s.unique('dependency')

      for name in names
        if name of @importAs
          args.push @importAs[name]
        else
          dependency = deps.next()
          args.push dependency
          @buildImportsForPreamble s, @imports[name], dependency

    return [ args, preamble ]

  build: (fn) ->
    if @options.coffee
      builder = new CoffeeScriptBuilder()
    else
      builder = new JavaScriptBuilder()
    fn builder
    return builder.toString()

  buildImportsForPreamble: (builder, imports_, dependencyName) ->
    for import_ in imports_
      builder.var import_, -> builder.prop dependencyName, import_


export = AbstractCompiler
