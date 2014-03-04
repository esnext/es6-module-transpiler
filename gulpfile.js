var gulp = require('gulp');
var rename = require('gulp-rename');
var traceur = require('gulp-traceur');
var clean = require('gulp-clean');
var mocha = require('gulp-mocha');
var header = require('gulp-header');

/*
 * Main build pipeline
 * traceur -> add traceur runtime
 */
gulp.task('traceur', function() {
  return gulp.src('./src/**/*.js')
    .pipe(traceur({
      blockBinding: true
    }))
    .pipe(gulp.dest('./dist'));
});

// Build bin/compile-modules
gulp.task('cli', ['traceur'], function() {
  return gulp.src('./dist/compile-modules.js')
    .pipe(header('#!/usr/bin/env node\n'))
    .pipe(rename('compile-modules'))
    .pipe(gulp.dest('./bin'));
  });

gulp.task('build', ['traceur', 'cli']);

/*
 * Util tasks
 */

gulp.task('clean', function() {
  gulp.src(['./dist', './bin'], {read: false}).pipe(clean());
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
