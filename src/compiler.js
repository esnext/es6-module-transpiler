require('../lib/traceur-runtime');

var AMDCompiler = require('./amd_compiler');
var YUICompiler = require('./yui_compiler');
var CJSCompiler = require('./cjs_compiler');
var Unique = require('./utils').Unique;
var Parser = require('./parser');

/**
 * Public interface to the transpiler.
 *
 * @class Compiler
 * @constructor
 * @param {String} string Input string.
 * @param {String} moduleName The name of the module to output.
 * @param {Object} options Configuration object.
 */
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
    var parsed = new Parser(this.string);
    this.parsed = parsed;
  }

  /**
   * Transpiles an ES6 module to AMD.
   * @method toAMD
   * @return {String} The transpiled output
   */
  toAMD() {
    return new AMDCompiler(this, this.options).stringify();
  }

  /**
   * Transpiles an ES6 module to YUI.
   * @method toYUI
   * @return {String} The transpiled output
   */
  toYUI() {
    return new YUICompiler(this, this.options).stringify();
  }

  /**
   * Transpiles an ES6 module to CJS.
   * @method toCJS
   * @return {String} The transpiled output
   */
  toCJS() {
    return new CJSCompiler(this, this.options).stringify();
  }

}

module.exports = Compiler;
