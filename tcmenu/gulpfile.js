const merge = require('merge-stream'),

	gulp = require('gulp'),
	gulpClean = require('gulp-clean'),
	replace = require('gulp-replace'),
	webpack = require('webpack'),
	webpackStream = require('webpack-stream'),
	gulpZip = require('gulp-zip'),
	asciidoctor = require('gulp-asciidoctor'),

	_env = require('./env'),
	_watchMode = process.argv.indexOf('watch') > -1;

function clean(){
	return gulp.src([
		_env.buildDir,
	], {read: false, allowEmpty: true}).pipe(gulpClean());
}

function resources(){
	let qextFile = _env.PKG_NAME + '.qext';

	let textData = gulp.src(`${_env.resourceDir}/{${qextFile},config.js}`)
		.pipe(replace('##DATE##', _env.DATE))
		.pipe(replace('##VERSION##', _env.VERSION))
		.pipe(replace('##BUILD_NUMBER##', _env.BUILD_NUMBER))
		.pipe(gulp.dest(_env.distDir));

	let binaryData = gulp.src(`${_env.resourceDir}/images/menubar_logo.png`) // copy menubar_logo.png which is used in button-editor as example image
		.pipe(gulp.dest(`${_env.distDir}/img/`));

	return merge(textData, binaryData);
}

function install(){
	return gulp.src([_env.distDir + '/**/*']).pipe(gulp.dest(_env.installDir));
}

function watch(){
	_env.distDir = _env.installDir; // build directly to installation directory

	// see https://github.com/doowb/gulp-issue-2093/pull/1#issuecomment-356642041
	gulp.watch(_env.resourceDir.replace(/\\/g, '/') + '/**/*', resources);
}

function zip(){
	return gulp.src(_env.distDir + '/**/*')
		.pipe(gulpZip(_env.PKG_NAME + '-' + _env.VERSION + '.zip'))
		.pipe(gulp.dest('builds'))
}

function buildDocHtml(){
	return merge(
		gulp.src(_env.srcDir + '/doc/img{,/*}'),
		gulp.src(_env.srcDir + '/doc/tcmenu.adoc')
			.pipe(asciidoctor({
				safe: 'unsafe',
				attributes: ['appversion=' + _env.VER]
			}))
	).pipe(gulp.dest(_env.tmpDir + '/tcmenu-doc'));
}

function updateDoc(){
	// updates the version number and date, also copy it to the local temp directory, where it is copy later in the build-doc step
	return merge(
		gulp.src(_env.srcDir + '/doc/img{,/*}'),
		gulp.src(_env.srcDir + '/doc/tcmenu.adoc')
			.pipe(replace('##VERSION', _env.VERSION))
			.pipe(replace('##BUILDDATE', _env.BUILD_DATE))
	).pipe(gulp.dest(process.env.TEMP + '/tcmenu-doc'))
}

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
		error && console.info(error);

		showStats(stats);

		// resolve here in watch mode, otherwise stream would never end
		config.watch && callback();
	}));
}


function showStats(stats){
	console.info(stats.toString({
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

const prebuild = gulp.parallel(resources, updateDoc);
const build = gulp.series(prebuild, bundle);
const localInstall = gulp.series(build, install);
const defaultTask = gulp.series(clean, localInstall);

exports['build'] = build;
exports['build-doc-html'] = buildDocHtml;
exports['clean'] = clean;
exports['watch'] = gulp.series(defaultTask, watch);
exports['zip'] = zip;

exports['default'] = defaultTask;