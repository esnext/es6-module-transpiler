var Mocha = require('mocha');
Mocha.interfaces['qunit-mocha-ui'] = require('qunit-mocha-ui');

module.exports = {
  options: {
    globals: ['should'],
    timeout: 3000,
    ignoreLeaks: false,
    ui: 'qunit-mocha-ui',
    reporter: 'tap'
  },

  all: { src: ['test/.generated/**/*.js'] }
};
