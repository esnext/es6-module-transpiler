var gulp = require('gulp');
var browserify = require('gulp-browserify');
var concat = require('gulp-concat');
var traceur = require('gulp-traceur');
var clean = require('gulp-clean');
var mocha = require('gulp-mocha');

/*
 * Main build pipeline
 * traceur -> browserify -> add browserify runtime
 */
gulp.task('traceur', function() {
  return gulp.src('./lib/**/*.js')
    .pipe(traceur({
      blockBinding: true
    }))
    .pipe(gulp.dest('./tmp/traceured'));
});

gulp.task('browserify', ['traceur'], function() {
  return gulp.src('./tmp/traceured/index.js')
    .pipe(browserify({
      standalone: 'ModuleTranspiler'
    }))
    .pipe(gulp.dest('./tmp'));
});

gulp.task('add-runtime', ['browserify'], function() {
  return gulp.src(['node_modules/gulp-traceur/node_modules/traceur/bin/traceur-runtime.js', './tmp/index.js'])
    .pipe(concat('es6-module-transpiler.js'))
    .pipe(gulp.dest('./dist'));
});

gulp.task('build', ['traceur', 'browserify', 'add-runtime']);

/*
 * Util tasks
 */

gulp.task('clean', function() {
  gulp.src(['./tmp', './dist'], {read: false}).pipe(clean());
});

// TODO: build tests

gulp.task('run-tests', function() {
  gulp.src('./tmp/test/**/*.js')
    .pipe(mocha({
      globals: ['should'],
      timeout: 3000,
      ignoreLeaks: false,
      ui: 'qunit-mocha-ui'
    }));
});
