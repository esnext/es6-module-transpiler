module.exports = {
  development: {
    options: {
      urls: ['http://localhost:' + (process.env.PORT || 8000) + '/test/index.html']
    }
  }
};
