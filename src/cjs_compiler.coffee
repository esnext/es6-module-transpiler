import './abstract_compiler' as AbstractCompiler

class CJSCompiler extends AbstractCompiler
  stringify: ->
    @build (s) =>
      doImport = (name, import_, prop=null) ->
        req = -> s.call 'require', [s.print(import_)]
        rhs = if prop then (-> s.prop req, prop) else req
        s.var name, rhs

      s.useStrict()
      deps = s.unique('dependency')

      for own import_, name of @importAs
        doImport name, import_

      for own import_, variables of @imports
        if variables.length is 1
          # var foo = require('./foo').foo;
          name = variables[0]
          doImport name, import_, name
        else
          # var __dependency1__ = require('./foo');
          dependency = deps.next()
          doImport dependency, import_

          # var foo = __dependency1__.foo;
          # var bar = __dependency1__.bar;
          for name in variables
            s.var name, "#{dependency}.#{name}"

      s.append @lines...

      if @exportAs
        s.line "module.exports = #{@exportAs}"

      for exportName, exportValue of @exports
        s.line "exports.#{exportName} = #{exportValue}"

export = CJSCompiler
