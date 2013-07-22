import AMDCompiler from './amd_compiler';
import CJSCompiler from './cjs_compiler';
import GlobalsCompiler from './globals_compiler';
import { Unique } from './utils';

var EXPORT = /^\s*export\s+(.*?)\s*(;)?\s*$/;
var EXPORT_DEFAULT = /^\s*export\s*default\s*(.*?)\s*(;)?\s*$/;
var EXPORT_FUNCTION = /^\s*export\s+function\s+(\w+)\s*(\(.*)$/;
var EXPORT_VAR = /^\s*export\s+var\s+(\w+)\s*=\s*(.*)$/;

var IMPORT = /^\s*import\s+(.*)\s+from\s+(?:"([^"]+?)"|'([^']+?)')\s*(;)?\s*$/;
var IMPORT_AS = /^\s*(.*)\s+as\s+(.*)\s*$/;

var RE_EXPORT = /^export\s+({.*})\s+from\s+(?:"([^"]+?)"|'([^']+?)')\s*(;)?\s*$/;

var COMMENT_START = new RegExp("/\\*");
var COMMENT_END = new RegExp("\\*/");

// naively-handled block comments: only look for ### at start of line
// avoids having to track state, since would want to avoid entering comment
// state on ### in other comments (like this one) and in strings
var COMMENT_CS_TOGGLE = /^###/;

function getNames(string) {
  if (string[0] === '{' && string[string.length - 1] === '}') {
    return string.slice(1, -1).split(',').map(name => name.trim());
  } else {
    return [string.trim()];
  }
}

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

    this.imports = {};
    this.importDefault = {};
    this.exports = {};
    this.exportDefault = null;
    this.lines = [];
    this.id = 0;

    this.inBlockComment = false;
    this.reExportUnique = new Unique('reexport');

    if (!this.options.coffee) {
      this.commentStart = COMMENT_START;
      this.commentEnd = COMMENT_END;
    } else {
      this.commentStart = COMMENT_CS_TOGGLE;
      this.commentEnd = COMMENT_CS_TOGGLE;
    }

    this.parse();
  }

  parse() {
    this.string.split('\n').forEach(this.parseLine.bind(this));
  }

  parseLine(line) {
    var match;

    if (!this.inBlockComment) {
      if (match = this.matchLine(line, EXPORT_DEFAULT)) {
        this.processExportDefault(match);
      } else if (match = this.matchLine(line, EXPORT_FUNCTION)) {
        this.processExportFunction(match);
      } else if (match = this.matchLine(line, EXPORT_VAR)) {
        this.processExportVar(match);
      } else if (match = this.matchLine(line, RE_EXPORT)) {
        this.processReexport(match);
      } else if (match = this.matchLine(line, EXPORT)) {
        this.processExport(match);
      } else if (match = this.matchLine(line, IMPORT)) {
        this.processImport(match);
      } else if (match = this.matchLine(line, this.commentStart)) {
        this.processEnterComment(line);
      } else {
        this.processLine(line);
      }
    } else {
      if (match = this.matchLine(line, this.commentEnd)) {
        this.processExitComment(line);
      } else {
        this.processLine(line);
      }
    }
  }

  matchLine(line, pattern) {
    var match = line.match(pattern);

    // if not CoffeeScript then we need the semi-colon
    if (match && !this.options.coffee && !match[match.length - 1]) {
      return null;
    }

    return match;
  }

  processExportDefault(match) {
    this.exportDefault = match[1];
  }

  processExport(match) {
    var self = this;
    getNames(match[1]).forEach(function(ex) {
      self.exports[ex] = ex;
    });
  }

  processExportFunction(match) {
    var body, name;
    name = match[1];
    body = match[2];

    this.lines.push('function ' + name + body);
    this.exports[name] = name;
  }

  processExportVar(match) {
    var name, value;
    name = match[1];
    value = match[2];

    this.lines.push('var ' + name + ' = ' + value);
    this.exports[name] = name;
  }

  processImport(match) {
    var asMatch, importSpecifiers, imports, name, pattern;
    pattern = match[1];
    if (pattern[0] === '{' && pattern[pattern.length - 1] === '}') {
      pattern = pattern.slice(1, -1);
      importSpecifiers = pattern.split(/\s*,\s*/).map(function(name) {
        return name.trim();
      });
      imports = {};
      importSpecifiers.forEach(function(name) {
        if (asMatch = name.match(IMPORT_AS)) {
          imports[asMatch[1]] = asMatch[2];
        } else {
          imports[name] = name;
        }
      });
      this.imports[match[2] || match[3]] = imports;
    } else {
      this.importDefault[match[2] || match[3]] = match[1];
    }
  }

  processReexport(match) {
    var names = getNames(match[1]),
        importPath = match[2] || match[3],
        importLocal = this.reExportUnique.next(),
        self = this;

    this.importDefault[importPath] = importLocal;
    names.forEach(function(name) {
      self.exports[name] = "" + importLocal + "." + name;
    });
  }

  processLine(line) {
    this.lines.push(line);
  }

  processEnterComment(line) {
    if (!this.matchLine(line, COMMENT_END)) {
      this.inBlockComment = true;
    }
    this.lines.push(line);
  }

  processExitComment(line) {
    this.inBlockComment = false;
    this.lines.push(line);
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
