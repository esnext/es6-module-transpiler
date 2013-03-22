import './amd_compiler' as AMDCompiler
import './cjs_compiler' as CJSCompiler
import './globals_compiler' as GlobalsCompiler

EXPORT = /^\s*export\s+(.*?)\s*(;)?\s*$/
EXPORT_AS = /^\s*export\s*=\s*(.*?)\s*(;)?\s*$/
EXPORT_FUNCTION = /^\s*export\s+function\s+(\w+)\s*(\(.*)$/
EXPORT_VAR = /^\s*export\s+var\s+(\w+)\s*=\s*(.*)$/
IMPORT = /^\s*import\s+(.*)\s+from\s+(?:"([^"]+?)"|'([^']+?)')\s*(;)?\s*$/
IMPORT_AS = /^\s*import\s+(?:"([^"]+?)"|'([^']+?)')\s*as\s+(.*?)\s*(;)?\s*$/

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

    @parse()

  parse: ->
    @parseLine line for line in @string.split('\n')
    return null

  parseLine: (line) ->
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

    id = "__export#{++@id}__"
    @lines.push "var #{id} = #{value}"
    @exports[name] = id

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

  toAMD: ->
    new AMDCompiler(this, @options).stringify()

  toCJS: ->
    new CJSCompiler(this, @options).stringify()

  toGlobals: ->
    new GlobalsCompiler(this, @options).stringify()

export = Compiler
