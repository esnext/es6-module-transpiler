import AMDCompiler from './amd_compiler';
import CJSCompiler from './cjs_compiler';
import GlobalsCompiler from './globals_compiler';
import { Unique } from './utils';
import Parser from './parser';

class Compiler {
  constructor(string, moduleName, options) {
    if (moduleName == null) {
      moduleName = null;
    }

    if (options == null) {
      options = {};
    }

    this.string = string;
    this.moduleName = moduleName;
    this.options = options;

    this.inBlockComment = false;
    this.reExportUnique = new Unique('reexport');

    this.parse();
  }

  parse() {
    var parser = new Parser(this.string);
    this.imports = parser.imports;
    this.exports = parser.exports;
    this.exportDefault = parser.exportDefault;
    this.directives = parser.directives;
  }
  toAMD() {
    return new AMDCompiler(this, this.options).stringify();
  }

  toCJS() {
    return new CJSCompiler(this, this.options).stringify();
  }

  toGlobals() {
    return new GlobalsCompiler(this, this.options).stringify();
  }
}

export default Compiler;
