module.exports = {
  cli: {
    files: [{
      expand: true,
      cwd: 'tmp/transpiled/',
      src: 'cli.js',
      dest: 'lib/'
    }]
  }
};
