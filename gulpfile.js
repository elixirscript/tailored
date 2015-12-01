const gulp = require('gulp');
const mocha = require('gulp-mocha');
const babel = require('gulp-babel');
const eslint = require('gulp-eslint');
const sourcemaps = require('gulp-sourcemaps');
const rollup = require('gulp-rollup');

const testPath = './test/**/*.spec.js';
const libPath = './src/**/*.js';

gulp.task('build', function() {
  return gulp.src([libPath])
      .pipe(sourcemaps.init())
      .pipe(babel())
      .pipe(sourcemaps.write())
      .pipe(gulp.dest('./lib'));
});

gulp.task('build_test', function() {
  return gulp.src([testPath])
      .pipe(sourcemaps.init())
      .pipe(babel())
      .pipe(sourcemaps.write())
      .pipe(gulp.dest('./test_build'));
});

gulp.task('test', ['lint', 'build', 'build_test'], function () {
  return gulp.src('./test_build/**/*.spec.js')
    .pipe(mocha({reporter: 'nyan'}));
});

gulp.task('lint', function () {
  return gulp.src([libPath, testPath])
      .pipe(eslint())
      .pipe(eslint.format())
});
