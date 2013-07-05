import AbstractCompiler from './abstract_compiler'

class CJSCompiler extends AbstractCompiler
  stringify: ->
    @build (s) =>
      doImport = (name, import_, prop=null) ->
        req = -> s.call 'require', [s.print(import_)]
        rhs = if prop then (-> s.prop req, prop) else req
        s.var name, rhs

      s.useStrict()
      deps = s.unique('dependency')

      for own import_, name of @importDefault
        doImport name, import_

      for own import_, variables of @imports
        if Object.keys(variables).length is 1
          # var foo = require('./foo').foo;
          name = Object.keys(variables)[0]
          doImport variables[name], import_, name
        else
          # var __dependency1__ = require('./foo');
          dependency = deps.next()
          doImport dependency, import_

          # var foo = __dependency1__.foo;
          # var bar = __dependency1__.bar;
          for own name, alias of variables
            if name == 'default'
              s.var alias, "#{dependency}"
            else
              s.var alias, "#{dependency}.#{name}"

      s.append @lines...

      if @exportDefault
        s.line "module.exports = #{@exportDefault}"

      for exportName, exportValue of @exports
        s.line "exports.#{exportName} = #{exportValue}"

export default CJSCompiler
