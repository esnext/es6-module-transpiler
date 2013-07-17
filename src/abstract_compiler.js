import CompileError from './compile_error';
import JavaScriptBuilder from './java_script_builder';
import { isEmpty, array, forEach } from './utils';

class AbstractCompiler {
  constructor(compiler, options) {
    this.compiler = compiler;

    this.exports = compiler.exports;
    this.exportDefault = compiler.exportDefault;
    this.imports = compiler.imports;
    this.importDefault = compiler.importDefault;

    this.moduleName = compiler.moduleName;
    this.lines = compiler.lines;

    this.options = options;
    this.dependencyNames = array.uniq([
      ...Object.getOwnPropertyNames(this.imports),
      ...Object.getOwnPropertyNames(this.importDefault)
    ]);

    this.assertValid();
  }

  assertValid() {
    if (this.exportDefault && !isEmpty(this.exports)) {
      throw new CompileError("You cannot use both `export default` and `export` in the same module");
    }
  }

  buildPreamble(names) {
    var args = [],
        preamble;

    preamble = this.build(function(s) {
      var deps = s.unique('dependency');

      for (var i = 0; i < names.length; i++) {
        var name = names[i];
        if (name in this.importDefault) {
          args.push(this.importDefault[name]);
        } else {
          var dependency = deps.next();
          args.push(dependency);
          this.buildImportsForPreamble(s, this.imports[name], dependency);
        }
      };
    }.bind(this));

    return [ args, preamble ];
  }

  build(fn) {
    var builder = new JavaScriptBuilder();
    fn(builder);
    return builder.toString();
  }

  buildImportsForPreamble(builder, imports_, dependencyName) {
    forEach(imports_, function(alias, name) {
      builder["var"](alias, function() {
        return builder.prop(dependencyName, name);
      });
    });
  }
}

export default AbstractCompiler;
