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

var string = { indent: indent };

class Unique {
  constructor(prefix) {
    this.prefix = prefix;
    this.index = 1;
  }

  next() {
    return ['__', this.prefix, this.index++, '__'].join('');
  }
}

export { isEmpty, Unique, array, forEach, string };
