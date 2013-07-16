function isEmpty(object) {
  for (var foo in object) {
    if (Object.prototype.hasOwnProperty.call(object, foo)) {
      return false;
    }
  }
  return true;
}

function Unique(prefix) {
  this.prefix = prefix;
  this.index = 1;
}

Unique.prototype.next = function() {
  return ['__', this.prefix, this.index++, '__'].join('');
};

export { isEmpty, Unique };
