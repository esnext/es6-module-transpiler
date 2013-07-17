import AbstractCompiler from './abstract_compiler';
import { isEmpty, forEach } from './utils';
import path from 'path';

class AMDCompiler extends AbstractCompiler {
  stringify() {
    var deps            = this.dependencyNames,
        argsAndPreamble = this.buildPreamble(deps),
        wrapperArgs     = argsAndPreamble[0],
        preamble        = argsAndPreamble[1],
        exports_        = this.exports,
        exportDefault   = this.exportDefault,
        moduleName      = this.moduleName,
        lines           = this.lines;

    return this.build(function(s) {
      if (!isEmpty(exports_)) {
        deps.push('exports');
        wrapperArgs.push('__exports__');
      }

      forEach(deps, function(dependency, i) {
        if (/^\./.test(dependency)) {
          // '..' makes up for path.join() treating a module name w/ no
          // extension as a folder
          deps[i] = path.join(moduleName, '..', dependency).replace(/[\\]/g, '/');
        }
      });

      s.line(function() {
        s.call('define', function(arg) {
          if (moduleName) {
            arg(s.print(moduleName));
          }
          arg(s.linebreak);
          arg(s.print(deps));
          arg(s.linebreak);
          arg(function() {
            s['function'](wrapperArgs, function() {
              s.useStrict();
              if (preamble) {
                s.append(preamble);
              }
              s.append(...lines);

              forEach(exports_, function(exportValue, exportName) {
                s.line('__exports__.' + exportName + ' = ' + exportValue);
              });

              if (exportDefault) {
                s.line('return ' + exportDefault);
              }
            });
          });
        });
      });
    });
  };
}

export default AMDCompiler;
