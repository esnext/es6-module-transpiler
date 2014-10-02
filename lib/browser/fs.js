var Fs = require('fake-fs');
var fs = new Fs();
fs.patch();
module.exports = fs;
