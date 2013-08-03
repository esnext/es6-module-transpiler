import CompileError from './compile_error';
import { isEmpty, array, forEach } from './utils';

class AbstractCompiler {
  constructor(compiler, options) {
    this.compiler = compiler;

    this.exports = compiler.exports;
    this.exportDefault = compiler.exportDefault;
    this.imports = compiler.imports;
    this.directives = compiler.directives;

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
}

export default AbstractCompiler;
