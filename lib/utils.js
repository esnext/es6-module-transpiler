"use strict";
function isEmpty(object) {
  for (var foo in object) {
    if (Object.prototype.hasOwnProperty.call(object, foo)) {
      return false;
    }
  }
  return true;
}

class Unique {
  constructor(prefix) {
    this.prefix = prefix;
    this.index = 1;
  }

  next() {
    return ['__', this.prefix, this.index++, '__'].join('');
  }
}


exports.isEmpty = isEmpty;
exports.Unique = Unique;