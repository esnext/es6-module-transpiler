var hasOwnProp = {}.hasOwnProperty;

function isEmpty(object) {
  for (var foo in object) {
    if (Object.prototype.hasOwnProperty.call(object, foo)) {
      return false;
    }
  }
  return true;
}

function uniq(array) {
  var result = [];

  for (var i = 0; i < array.length; i++) {
    var item = array[i];
    if (result.indexOf(item) === -1) {
      result.push(item);
    }
  }

  return result;
}

var array = { uniq: uniq };

function forEach(enumerable, callback) {
  if (enumerable !== null && enumerable !== undefined && typeof enumerable.forEach === 'function') {
    enumerable.forEach(callback);
    return;
  }

  for (var key in enumerable) {
    if (hasOwnProp.call(enumerable, key)) {
      callback(enumerable[key], key);
    }
  }
}

function isWhitespace(str) {
  return !str || /^\s*$/.test(str);
}

function indent(lines, level, indentString='  ') {
  return lines.map(function(line) {
    if (!isWhitespace(line)) {
      for (var i = 0; i < level; i++) {
        line = indentString + line;
      }
    }
    return line;
  });
}

var WHITESPACE_ONLY = /^\s*$/;
var LEADING_WHITESPACE = /^\s*/;

function unindent(string) {
  var minIndent = null;
  var lines = string.split('\n');

  for (var line of lines) {
    if (!WHITESPACE_ONLY.test(line)) {
      var match = line.match(LEADING_WHITESPACE);
      if (match) {
        if (minIndent !== null) {
          minIndent = Math.min(match[0].length, minIndent);
        } else {
          minIndent = match[0].length;
        }
      }
    }
  }

  return lines.map(line => line.slice(minIndent)).join('\n');
}

function ltrim(string) {
  return string.replace(LEADING_WHITESPACE, '');
}

var string = { indent, unindent, ltrim };

class Unique {
  constructor(prefix) {
    this.prefix = prefix;
    this.index = 1;
  }

  next() {
    return ['__', this.prefix, this.index++, '__'].join('');
  }
}

module.exports = {
  isEmpty: isEmpty,
  Unique: Unique,
  array: array,
  forEach: forEach,
  string: string
};
