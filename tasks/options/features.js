module.exports = {
  all: {
    template: 'test/features/test_template.js.tmpl',
    files: [{
      expand: true,
      cwd: 'test/spec-compliance/',
      src: ['**/*.es6.js'],
      dest: 'test/.generated'
    }]
  }
};
