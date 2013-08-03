import AbstractCompiler from './abstract_compiler';
import { isEmpty, forEach } from './utils';
import path from 'path';
import SourceModifier from './source_modifier';

class AMDCompiler extends AbstractCompiler {
  stringify() {
    var exports_        = this.exports,
        exportDefault   = this.exportDefault,
        imports         = this.imports,
        moduleName      = this.moduleName,
        dependencyNames = this.dependencyNames,
        string          = this.string.toString(),  // string is actually a node buffer
        out             = "";

    var source = new SourceModifier(string);

    out = this.buildPreamble();

    // build imports
    for (var idx = 0; idx < imports.length; idx++) {
      var import_ = imports[idx],
          replacement = "";

      if (import_.kind === "default") {
        // var name = __dependency[X]__;
        var specifier = import_.specifiers[0];
        replacement = `var ${specifier.id.name} = __dependency${idx}__;\n`;
      } else if (import_.kind === "named") {
        // var one = __dependency[X]__.one;
        // var two = __dependency[X]__.two;
        for (var specifier of import_.specifiers) {
          replacement += `var ${specifier.id.name} = __dependency${idx}__["${specifier.id.name}"];\n`;
        }
      }
      source.replace(import_.range[0], import_.range[1], replacement);
    }

    // build exports
    

    out += source.toString();
    out += "\n});";

    return out;

    /*return this.build(function(s) {
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
            s.func(wrapperArgs, function() {
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
    });*/
  }

  buildPreamble() {
    var out = "",
        dependencyNames = this.dependencyNames;

    out += "define(";
    if (this.moduleName) out += `"${this.moduleName}", `;
    out += "[";

    // build preamble
    var idx;
    for (idx = 0; idx < dependencyNames.length; idx++) {
      var name = dependencyNames[idx];
      out += `"${name}"`;
      if (!(idx === dependencyNames.length - 1)) out += ", ";
    }

    out += "], function(";

    for (idx = 0; idx < dependencyNames.length; idx++) {
      out += `__dependency${idx}__`;
      if (!(idx === dependencyNames.length - 1)) out += ", ";
    }

    out += ") {\n";

    return out;
  }
}

export default AMDCompiler;
