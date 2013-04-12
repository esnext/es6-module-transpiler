import './amd_compiler' as AMDCompiler
import './cjs_compiler' as CJSCompiler
import './globals_compiler' as GlobalsCompiler

EXPORT = /^\s*export\s+(.*?)\s*(;)?\s*$/
EXPORT_AS = /^\s*export\s*=\s*(.*?)\s*(;)?\s*$/
EXPORT_FUNCTION = /^\s*export\s+function\s+(\w+)\s*(\(.*)$/
EXPORT_VAR = /^\s*export\s+var\s+(\w+)\s*=\s*(.*)$/
IMPORT = /^\s*import\s+(.*)\s+from\s+(?:"([^"]+?)"|'([^']+?)')\s*(;)?\s*$/
IMPORT_AS = /^\s*import\s+(?:"([^"]+?)"|'([^']+?)')\s*as\s+(.*?)\s*(;)?\s*$/

COMMENT_START = new RegExp("/\\*")
COMMENT_END = new RegExp("\\*/")

# naively-handled block comments: only look for ### at start of line
# avoids having to track state, since would want to avoid entering comment
# state on ### in other comments (like this one) and in strings
COMMENT_CS_TOGGLE = /^###/

class Compiler
  constructor: (string, moduleName=null, options={}) ->
    @string = string
    @moduleName = moduleName
    @options = options

    @imports = {}
    @importAs = {}
    @exports = {}
    @exportAs = null
    @lines = []
    @id = 0

    @inBlockComment = false

    if not @options.coffee
      @commentStart = COMMENT_START
      @commentEnd = COMMENT_END
    else
      @commentStart = COMMENT_CS_TOGGLE
      @commentEnd = COMMENT_CS_TOGGLE

    @parse()

  parse: ->
    @parseLine line for line in @string.split('\n')
    return null

  parseLine: (line) ->
    if not @inBlockComment
      if match = @matchLine line, EXPORT_AS
        @processExportAs match
      else if match = @matchLine line, EXPORT_FUNCTION
        @processExportFunction match
      else if match = @matchLine line, EXPORT_VAR
        @processExportVar match
      else if match = @matchLine line, EXPORT
        @processExport match
      else if match = @matchLine line, IMPORT_AS
        @processImportAs match
      else if match = @matchLine line, IMPORT
        @processImport match
      else if match = @matchLine line, @commentStart
        @processEnterComment line
      else
        @processLine line
    else
      if match = @matchLine line, @commentEnd
        @processExitComment line
      else
        @processLine line

  matchLine: (line, pattern) ->
    match = line.match pattern

    # if not CoffeeScript then we need the semi-colon
    if match and not @options.coffee and not match[match.length-1]
      return null

    return match

  processExportAs: (match) ->
    @exportAs = match[1]

  processExport: (match) ->
    exports = match[1]

    if exports[0] is '{' and exports[exports.length-1] is '}'
      exports = exports[1...-1]

    for ex in exports.split(/\s*,\s*/)
      ex = ex.trim()
      @exports[ex] = ex

  processExportFunction: (match) ->
    name = match[1]
    body = match[2]

    @lines.push "function #{name}#{body}"
    @exports[name] = name

  processExportVar: (match) ->
    name = match[1]
    value = match[2]

    @lines.push "var #{name} = #{value}"
    @exports[name] = name

  processImportAs: (match) ->
    @importAs[match[1] or match[2]] = match[3]

  processImport: (match) ->
    pattern = match[1]

    if pattern[0] is '{' and pattern[pattern.length-1] is '}'
      pattern = pattern[1...-1]

    importNames = (name.trim() for name in pattern.split(/\s*,\s*/))

    @imports[match[2] or match[3]] = importNames

  processLine: (line) ->
    @lines.push line

  processEnterComment: (line) ->
    if not @matchLine line, COMMENT_END
      @inBlockComment = true
    @lines.push line

  processExitComment: (line) ->
    @inBlockComment = false
    @lines.push line

  toAMD: ->
    new AMDCompiler(this, @options).stringify()

  toCJS: ->
    new CJSCompiler(this, @options).stringify()

  toGlobals: ->
    new GlobalsCompiler(this, @options).stringify()

export = Compiler
