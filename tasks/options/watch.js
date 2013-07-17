module.exports = {
  options: {
    nospawn: true
  },
  code: {
    files: ['src/**/*.js'],
    tasks: ['build']
  },
  test: {
    files: ['test/**/*_test.js', 'test/features/**/*.js'],
    tasks: ['qunit-runner']
  }
};
