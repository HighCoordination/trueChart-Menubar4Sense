const merge = require('merge-stream'),

	gulp = require('gulp'),
	cache = require('gulp-cached'),
	clean = require('gulp-clean'),
	replace = require('gulp-replace'),
	sequence = require('gulp-sequence'),
	webpack = require('webpack'),
	webpackStream = require('webpack-stream'),
	log = require('fancy-log'),
	zip = require('gulp-zip'),
	asciidoctor = require('gulp-asciidoctor'),

	_env = require('./env'),
	_watchMode = process.argv.indexOf('watch') > -1;

gulp.task('clean', function(){
	return gulp.src([
		_env.buildDir
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

gulp.task('local-install', ['build'], function(){
	return gulp.src([_env.distDir + '/**/*']).pipe(gulp.dest(_env.installDir));
});

gulp.task('watch', ['default'], function(){
	_env.distDir = _env.installDir; // build directly to installation directory

	gulp.watch(_env.resourceDir + '/**/*', ['resources']);
});

gulp.task('default', sequence('clean', 'local-install'));

gulp.task('build', ['resources'], bundle);

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
 * @return {*}
 */
function bundle(){
	return new Promise(resolve =>{
		const config = Object.assign({}, require('./webpack.config'), {watch: _watchMode});

		let bufferLength = 0, done = false, timeout;


		const stream = runWebpack(config, () => done = true)
			.on('data', (chunk) =>{bufferLength += chunk._contents.length;})
			.pipe(gulp.dest(_env.distDir))
			.on('data', (chunk) =>{
				bufferLength -= chunk._contents.length;

				// we must resolve the promise in watch mode manually
				if(done && !bufferLength && config.watch){
					timeout = setTimeout(resolve, 1000);
				}else if(config.watch){
					clearTimeout(timeout);
				}
			}).on('finish', resolve);

		// pipe also directly to the install directory in watch mode
		if(config.watch){
			stream.pipe(gulp.dest(_env.installDir));
		}
	});
}

function runWebpack(config, callback){
	return gulp.src(_env.srcDir).pipe(webpackStream(config, webpack, (error, stats) =>{
		error && log(error);

		showStats(stats);

		// resolve here in watch mode, otherwise stream would never end
		config.watch && callback();
	}));
}

function showStats(stats){
	log(stats.toString({
		colors: process.argv.indexOf('--dev') !== -1 ? true : false,
		entrypoints: true,
		excludeAssets: /(img|fonts)\//,
		hash: false,
		timings: true,
		chunks: false,
		chunkModules: false,
		modules: false,
		maxModules: 15,
		children: false,
		version: true,
		cached: true,
		cachedAssets: false,
		reasons: false,
		usedExports: true,
		source: true,
		errorDetails: true
	}));
}