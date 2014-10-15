var DEFAULT_STACK_TRACE_LIMIT = 10;

// Polyfill Error.captureStackTrace, which exists only in v8 (Chrome). This is
// used in depd, which is used by ast-types.
if (!Error.captureStackTrace) {
  /**
   * Adds a 'stack' property to the given object with stack info.
   *
   * @param obj
   * @returns {Error.stack|*}
   */
  Error.captureStackTrace = function(obj) {
    var stack = new Error().stack;
    var prepare = Error.prepareStackTrace;

    if (prepare) {
      stack = prepare(stack, parseStack(stack));
    }

    obj.stack = stack;
  };
}

if (typeof Error.stackTraceLimit === 'undefined') {
  Error.stackTraceLimit = DEFAULT_STACK_TRACE_LIMIT;
}

/**
 * Parse a formatted stack string into an array of call sites.
 *
 * @param {string} stack
 * @returns {Array.<CallSite>}
 */
function parseStack(stack) {
  return stack.split('\n').slice(0, Error.stackTraceLimit).map(CallSite.parse);
}

/**
 * Represents a call site in a stack trace.
 *
 * @param {string} fnName
 * @param {string} fileName
 * @param {number} lineNumber
 * @param {number} columnNumber
 * @param {boolean} isEval
 * @param {string} evalOrigin
 * @constructor
 */
function CallSite(fnName, fileName, lineNumber, columnNumber, isEval, evalOrigin) {
  this.getFunctionName = function() { return fnName; };
  this.getFileName = function() { return fileName; };
  this.getLineNumber = function() { return lineNumber; };
  this.getColumnNumber = function() { return columnNumber; };
  this.isEval = function() { return isEval; };
  this.getEvalOrigin = function() { return evalOrigin; };
}

/**
 * Parses a line in a formatted stack trace and returns call site info.
 *
 * @param {string} stackTraceLine
 * @returns {CallSite}
 */
CallSite.parse = function(stackTraceLine) {
  var fnNameAndLocation = stackTraceLine.split('@');
  var fnName = fnNameAndLocation[0];
  var location = fnNameAndLocation[1];

  var fileAndLineAndColumn = location ? location.split(':') : [];
  var fileName = fileAndLineAndColumn[0];
  var lineNumber = parseInt(fileAndLineAndColumn[1], 10);
  var columnNumber = parseInt(fileAndLineAndColumn[2], 10);

  return new CallSite(fnName, fileName, lineNumber, columnNumber, fnName === 'eval', '');
};
