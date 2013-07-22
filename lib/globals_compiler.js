import AbstractCompiler from './abstract_compiler';
import { isEmpty, forEach } from './utils';

class GlobalsCompiler extends AbstractCompiler {
  stringify() {
    var options       = this.options,
        deps          = this.dependencyNames,
        exports_      = this.exports,
        exportDefault = this.exportDefault,
        imports       = this.imports,
        importDefault = this.importDefault,
        lines         = this.lines;

    return this.build(function(s) {
      var passedArgs   = [],
          receivedArgs = [],
          locals       = {},
          into         = options.into || exportDefault;

      if (!isEmpty(exports_) || exportDefault) {
        passedArgs.push(exportDefault ? s.global : into ? '' + s.global + '.' + into + ' = {}' : s.global);
        receivedArgs.push('exports');
      }

      forEach(deps, function(name) {
        var globalImport = options.imports[name];
        passedArgs.push([s.global, globalImport].join('.'));

        if (name in importDefault) {
          receivedArgs.push(importDefault[name]);
        } else {
          receivedArgs.push(globalImport);

          forEach(imports[name], function(alias, name) {
            locals[alias] = [globalImport, name].join('.');
          });
        }
      });

      function wrapper() {
        s.func(receivedArgs, function() {
          s.useStrict();

          // var get = Ember.get;
          forEach(locals, function(rhs, lhs) {
            s.variable(lhs, rhs);
          });

          // body
          s.append.apply(s, lines);

          if (exportDefault) {
            s.set('exports.' + into, exportDefault);
          } else {
            forEach(exports_, function(exportValue, exportName) {
              s.set('exports.' + exportName, exportValue);
            });
          }
        });
      };

      function args(arg) {
        forEach(passedArgs, arg);
      };

      s.line(function() {
        s.call(wrapper, args);
      });
    });
  }
}

export default GlobalsCompiler;
