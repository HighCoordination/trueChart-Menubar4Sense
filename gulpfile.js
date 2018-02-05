const merge = require('merge-stream'),

	gulp = require('gulp'),
	cache = require('gulp-cached'),
	clean = require('gulp-clean'),
	replace = require('gulp-replace'),
	sequence = require('gulp-sequence'),
	webpack = require('webpack'),
	gulpWebpack = require('gulp-webpack'),
	zip = require('gulp-zip'),
	asciidoctor = require('gulp-asciidoctor'),

	_env = require('./env'),
	_watchMode = process.argv.indexOf('watch') > -1;

gulp.task('clean', function(){
	return gulp.src([
		_env.buildDir,
//		_env.hicoDir // temporary (local) hico lib directory
	], {read: false}).pipe(clean());
});

gulp.task('resources', function(){
	let qextFile = _env.PKG_NAME + '.qext';

	let textData = gulp.src(`${_env.resourceDir}/{${qextFile},config.js}`)
		.pipe(replace('##DATE##', _env.DATE))
		.pipe(replace('##VERSION##', _env.VERSION))
		.pipe(replace('##BUILD_NUMBER##', _env.BUILD_NUMBER))
		.pipe(gulp.dest(_env.distDir));

	let binaryData = gulp.src(`${_env.resourceDir}/images/tcmenu_logo.jpg`) // copy tcmenu_logo.jpg which is used in button-editor as example image
		.pipe(gulp.dest(`${_env.distDir}/img/`));

	return merge(textData, binaryData);
});

gulp.task('copy-hico-libs', function(){
	const hicomvcDir = _env.hicomvcDir, dest = _env.hicoDir;
	return gulp.src([
			hicomvcDir + '/HiCoMVCFramework/components/**/*',
			'!' + hicomvcDir + '/HiCoMVCFramework/components/layouteditor{,/**/*}'
		])
		.pipe(replace('require([\'./directives/button-editor', '// require([\'./directives/button-editor')) // temporary workaround for webpack
		.pipe(cache('hico-libs'))
		.pipe(gulp.dest(dest));
});

gulp.task('copy-hico-styles', function(){
	const hicomvcDir = _env.hicomvcDir, dest = _env.getPath(_env.hicoDir, 'style');
	return gulp.src([
		hicomvcDir + '/HiCoMVCFramework/resource/less/*',
		'!' + hicomvcDir + '/HiCoMVCFramework/resource/less/style.less',
	]).pipe(cache('hico-styles')).pipe(gulp.dest(dest));
});

gulp.task('local-install', ['build'], function(){
	return gulp.src([_env.distDir + '/**/*']).pipe(gulp.dest(_env.installDir));
});

gulp.task('watch', ['default'], function(){
	_env.distDir = _env.installDir; // build directly to installation directory

	setTimeout(build, 0); // run webpack asynchronous in watch mode

	gulp.watch(_env.resourceDir + '/**/*', ['resources']);
//	gulp.watch(_env.hicomvcDir + '/HiCoMVCFramework/components/**/*', ['copy-hico-libs']);
//	gulp.watch(_env.hicomvcDir + '/HiCoMVCFramework/resource/**/*', ['copy-hico-styles']);
});

gulp.task('default', sequence('clean', 'local-install'));

gulp.task('build', ['resources'/*, 'copy-hico-libs', 'copy-hico-styles', 'update-doc'*/], () => build(false));

gulp.task('zip', function(){
	gulp.src(_env.distDir + '/**/*')
		.pipe(zip(_env.PKG_NAME + '-' + _env.VERSION + '.zip'))
		.pipe(gulp.dest('builds'))
});

gulp.task('build-doc-html', () =>
    merge(
        gulp.src(_env.srcDir + '/doc/img{,/*}'),
        gulp.src(_env.srcDir + '/doc/tcmenu.adoc')
            .pipe(asciidoctor({
                safe: 'unsafe',
                attributes: ['appversion=' + _env.VER]
            }))
    ).pipe(gulp.dest(_env.tmpDir + '/tcmenu-doc'))
);

/**
 * Builds tcmenu and watch for changes if needed
 *
 * @param {boolean} [watch] Watches for changes if true
 * @return {*}
 */
function build(watch){
	let config = Object.assign({}, require('./webpack.config'));

	config.watch = typeof watch === 'boolean' ? watch : _watchMode;

	return gulp.src(_env.srcDir)
		.pipe(gulpWebpack(config, webpack))
		.pipe(gulp.dest(_env.distDir)).on('finish', () => console.log('close'));
}