import CompileError from './compile_error';
import JavaScriptBuilder from './java_script_builder';
import { isEmpty, array, forEach } from './utils';

class AbstractCompiler {
  constructor(compiler, options) {
    this.compiler = compiler;

    this.exports = compiler.exports;
    this.exportDefault = compiler.exportDefault;
    this.imports = compiler.imports;

    this.moduleName = compiler.moduleName;
    this.lines = compiler.lines;
    this.string = compiler.string;

    this.options = options;
    this.dependencyNames = array.uniq(this.imports.map(function(import_) {
      return import_.source.value;
    }));

    this.assertValid();
  }

  assertValid() {
    if (this.exportDefault && !isEmpty(this.exports)) {
      throw new CompileError("You cannot use both `export default` and `export` in the same module");
    }
  }

  build(fn) {
    var builder = new JavaScriptBuilder();
    fn(builder);
    return builder.toString();
  }

  buildImportsForPreamble(builder, imports_, dependencyName) {
    forEach(imports_, function(alias, name) {
      builder.variable(alias, function() {
        return builder.prop(dependencyName, name);
      });
    });
  }
}

export default AbstractCompiler;
