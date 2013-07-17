module.exports = {
  app: {
    type: 'cjs',
    files: [{
      expand: true,
      cwd: 'src/',
      src: ['**/*.js'],
      dest: 'tmp/transpiled/'
    }]
  }
};
