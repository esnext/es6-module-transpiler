/* jshint node:true, undef:true, unused:true */

var assert = require('assert');

/**
 * @param {string|Error=} type
 * @param {string=} message
 * @constructor
 */
function ExpectedError(type, message) {
  this.type = type;
  this.message = message;
}

/**
 * Builds an ExpectedError from the given source code.
 *
 * @param {string} source
 * @return {?ExpectedError}
 */
ExpectedError.getFromSource = function(source) {
  var errorMatch = source.match(/\/\*\s*error:\s*(.+?)\*\//);
  if (!errorMatch) {
    return null;
  }

  var errorInfo = errorMatch[1];
  var expectedTypeMatch = errorInfo.match(/type=([a-zA-Z]+)/);
  var expectedMessageMatch = errorInfo.match(/message="([^"]+)"/);

  assert.ok(
    expectedTypeMatch || expectedMessageMatch,
    'expected error comment contains neither a type or a message: ' +
    errorInfo
  );

  return new ExpectedError(
    expectedTypeMatch && expectedTypeMatch[1],
    expectedMessageMatch && expectedMessageMatch[1]
  );
};

/**
 * Determines whether the given error matches the expected error type.
 *
 * @param {!Error} error
 * @return {boolean}
 */
ExpectedError.prototype.matchesType = function(error) {
  return !this.type ||
    (typeof this.type === 'function' && error instanceof this.type) ||
    (this.type === error.constructor) ||
    (this.type === error.constructor.name);
};

/**
 * Determines whether the given error matches the expected error message.
 *
 * @param {!Error} error
 * @return {boolean}
 */
ExpectedError.prototype.matchesMessage = function(error) {
  return !this.message ||
    (this.message === error.message) ||
    (this.message.test && this.message.test(error.message));
};

/**
 * Asserts that the given error matches the expected error info.
 *
 * @param {?Error} error
 */
ExpectedError.prototype.assertMatch = function(error) {
  var matchError = this.matchError(error);
  if (matchError) {
    throw matchError;
  }
};

/**
 * Gets the error to throw if the given error does not match.
 *
 * @param {?Error} error
 * @return {?AssertionError}
 */
ExpectedError.prototype.matchError = function(error) {
  var matchesType = error && this.matchesType(error);
  var matchesMessage = error && this.matchesMessage(error);

  if (matchesType && matchesMessage) {
    return null;
  }

  var assertMessage = 'expected error';

  if (!matchesType && this.type) {
    assertMessage += ' type to equal ' + this.type;
    if (!matchesMessage && this.message) {
      assertMessage += ' and';
    }
  }
  if (!matchesMessage && this.message) {
    assertMessage += ' message to match ' +
      (typeof this.message === 'string' ? '"' + this.message + '"' : this.message);
  }

  if (error) {
    assertMessage += ', but got ' + error;
  } else {
    assertMessage += ', but no error was thrown'
  }

  return new assert.AssertionError({ message: assertMessage });
};

module.exports = ExpectedError;
