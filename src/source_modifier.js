/*
 * Borrowed this wonderful utility class from the ES6 Loader Polyfill
 */

class SourceModifier  {
  constructor(source) {
    this.source = source;
    this.rangeOps = [];
  }

  mapIndex(index) {
    // apply the range operations in order to the index
    for (var i = 0; i < this.rangeOps.length; i++) {
      var curOp = this.rangeOps[i];
      if (curOp.start >= index)
        continue;
      if (curOp.end <= index) {
        index += curOp.diff;
        continue;
      }
      throw 'Source location ' + index + ' has already been transformed!';
    }
    return index;
  }

  replace(start, end, replacement) {
    var diff = replacement.length - (end - start + 1);

    start = this.mapIndex(start);
    end = this.mapIndex(end);
    
    this.source = this.source.substr(0, start) + replacement + this.source.substr(end + 1);

    this.rangeOps.push({
      start: start, 
      end: end, 
      diff: diff
    });
  }

  getRange(start, end) {
    return this.source.substr(this.mapIndex(start), this.mapIndex(end));
  }

  toString() {
    return this.source;
  }
}

module.exports = SourceModifier;
