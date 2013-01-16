AMDCompiler = require './amd_compiler'
CJSCompiler = require './cjs_compiler'

EXPORT = /^\s*export\s+(.*)\s*;\s*$/
EXPORT_AS = /^\s*export\s*=\s*(.*)\s*;\s*$/
IMPORT = /^\s*import\s+(.*)\s+from\s+(?:"([^"]+)"|'([^']+)')\s*;\s*$/
IMPORT_AS = /^\s*import\s+(?:"([^"]+)"|'([^']+)')\s*as\s+(.*)\s*;\s*$/

class Compiler
  constructor: (string, moduleName=null, options={}) ->
    @string = string
    @moduleName = moduleName
    @options = options

    @imports = {}
    @importAs = {}
    @exports = []
    @exportAs = null
    @lines = []

    @parse()

  parse: ->
    @parseLine line for line in @string.split('\n')
    return null

  parseLine: (line) ->
    if match = line.match EXPORT_AS
      @processExportAs match
    else if match = line.match EXPORT
      @processExport match
    else if match = line.match IMPORT_AS
      @processImportAs match
    else if match = line.match IMPORT
      @processImport match
    else
      @processLine line

  processExportAs: (match) ->
    @exportAs = match[1]

  processExport: (match) ->
    exports = match[1]

    if exports[0] is '{' and exports[exports.length-1] is '}'
      exports = exports[1...-1]

    for ex in exports.split(/\s*,\s*/)
      ex = ex.trim()
      @exports.push ex unless ex in @exports

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

module.exports = Compiler
