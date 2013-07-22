module.exports = {
  app: {
    type: 'cjs',
    files: [{
      expand: true,
      cwd: 'lib/',
      src: ['**/*.js'],
      dest: 'tmp/transpiled/'
    }]
  }
};
