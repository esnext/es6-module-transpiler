import AbstractCompiler from './abstract_compiler';
import { forEach } from './utils';

class CJSCompiler extends AbstractCompiler {
  stringify() {
    var imports       = this.imports,
        importDefault = this.importDefault,
        exports_      = this.exports,
        exportDefault = this.exportDefault,
        lines         = this.lines;

    return this.build(function(s) {
      function doImport(name, import_, prop) {
        var req, rhs;
        if (prop == null) {
          prop = null;
        }
        req = function() {
          s.call('require', [s.print(import_)]);
        };
        rhs = prop ? (function() {
          s.prop(req, prop);
        }) : req;
        s['var'](name, rhs);
      };

      s.useStrict();
      var deps = s.unique('dependency');

      forEach(importDefault, doImport);

      forEach(imports, function(variables, import_) {
        if (Object.keys(variables).length === 1) {
          // var foo = require('./foo').foo;
          var name = Object.keys(variables)[0];
          doImport(variables[name], import_, name);
        } else {
          // var __dependency1__ = require('./foo');
          var dependency = deps.next();
          doImport(dependency, import_);

          // var foo = __dependency1__.foo;
          // var bar = __dependency1__.bar;
          forEach(variables, function(alias, name) {
            if (name === 'default') {
              s['var'](alias, '' + dependency);
            } else {
              s['var'](alias, '' + dependency + '.' + name);
            }
          });
        }
      });

      s.append(...lines);

      if (exportDefault) {
        s.line('module.exports = ' + exportDefault);
      }

      forEach(exports_, function(exportValue, exportName) {
        s.line('exports.' + exportName + ' = ' + exportValue);
      });
    });
  };
}

export default CJSCompiler;
