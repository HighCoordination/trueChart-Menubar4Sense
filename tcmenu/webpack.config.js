const webpack = require('webpack'),
	UglifyJsPlugin = require('uglifyjs-webpack-plugin'),
	ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin'),
	BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin,

	_env = require('./env'),
	_plugins = [new ForkTsCheckerWebpackPlugin({
		checkSyntacticErrors: true
	})];

const modules = [ // entrypoints of @highcoordination modules which are used by the menubar
	'common-sense/dist/index',
	'common-utils/dist/index',
];

if(_env.analyseBundle){
	_plugins.push(new BundleAnalyzerPlugin({
		openAnalyzer: false,
		analyzerMode: 'static' // default is 'server'
	}));
}

module.exports = {
	mode: _env.IS_PROD ? 'production' : 'development',

	optimization: {
		minimize: _env.IS_PROD || _env.DO_UGLIFY,
		minimizer: [
			new UglifyJsPlugin({
				cache: false, // it produces to long filenames for windows, jenkins do not like it :-(
				parallel: true
			})
		],
		sideEffects: true,
		usedExports: true,
		splitChunks: {
			name: _env.PKG_NAME,
			minChunks: Infinity
		}
	},

	entry: _env.IS_GITHUB ? modules.reduce((entries, entry) => {
		entries[`../@highcoordination/${entry}`] = `${_env.distDir}/../@highcoordination/${entry}`;
		return entries;
	}, {}) : {
		'tcmenu': `${_env.srcDir}/${_env.PKG_NAME}`
	},

	plugins: _plugins,

	output: {
		path: _env.distDir,
		filename: '[name].js',
		chunkFilename: '[name].js',
		library: _env.IS_GITHUB ? undefined : _env.PKG_NAME,
		libraryExport: _env.IS_GITHUB ? undefined : 'default', // here will be the 'default' export of the entry used as export of the library
		libraryTarget: 'umd'
	},

	module: {
		rules: [
			{
				test: /\.(less|css)$/,
				use: [
					'style-loader', // loads style as inline style
					'css-loader', // translates CSS into CommonJS
					{
						loader: 'string-replace-loader', // remove "unneeded" fonts from the bundle
						options: {
							multiple: [ // IMPROVE: use custom path.less instead of replacing the font awesome paths on the fly
								{search: /src: url\(((?!url).)*\.eot\?v=.*'\);/, replace: ''},
								{search: /url\(((?!url).)*woff2'\),/, replace: ''}, // remove "problematic" fonts (unsupported by sense hub)
								{search: /url\(((?!url).)*truetype'\),/, replace: ''},
								{search: /url\(((?!url).)*opentype'\),/, replace: ''},
								{search: /url\(((?!url).)*svg'\);/, replace: ''},
								{search: /(url\(((?!url).)*woff'\)),/, replace: '$1;'}, // make sure we end with ';'
							]
						}
					},
					'less-loader', // compiles Less to CSS
				]
			},
			{
				// include small images as Base64 in bundle, otherwise act as file-loader (copy as <md5>.ext to dist/-folder)
				test: /\.(png|svg|jpg|gif|ttf|woff|woff2|eot)$/,
				use: [
					{
						loader: 'url-loader',
						options: {
							name(file){
								if(/fonts/.test(file)){
									return 'fonts/[name].[ext]';
								}else if(/images/.test(file)){
									return 'img/[name].[ext]';
								}
								return 'assets/[path][name].[ext]';
							},
							limit: 100 * 1024
						},
					}
				]
			},
			{
				test: /\.html/,
				use: ['html-loader?minimize=true']
			},
			_env.IS_GITHUB ? {} : {
				test: /lib[\/\\]hico[\/\\]button-editor\.js$/,
				use: {
					loader: 'file-loader',
					options: {
						name: '[path][name].[ext]',
					},
				}
			},
			{
				test: /\.(js|ts|tsx)$/,
				exclude: /node_modules/,
				use: ['ts-loader?happyPackMode=true']
			},
			{
				test: /\.(less|html|js|ts|tsx|txt|qext)$/,
				enforce: 'pre',
				exclude: /node_modules\/(?!@highcoordination)/,
				use: [
					{
						loader: 'string-replace-loader',
						query: {
							multiple: [
								{search: /##PREFIX##/g, replace: _env.PKG_NAME},
								{search: /##ENTRY##/g, replace: _env.PKG_NAME},
								{search: /##EXTENSION_NAME##/g, replace: 'trueChart-Menubar'},
								{search: /##DATE##/g, replace: _env.DATE},
								{search: /##VERSION##/g, replace: _env.VERSION},
								{search: /##VER##/g, replace: _env.VER},
								{search: /##BUILD_NUMBER##/g, replace: _env.BUILD_NUMBER},
								{search: /##LOG_LEVEL##/g, replace: _env.LOG_LEVEL},
								{search: /'##HAS_SERVICE##'/g, replace: _env.HAS_SERVICE},
								{search: /##SERVICE_URL##/g, replace: _env.SERVICE_URL},

								{search: /font-family: "LUI icons"/g, replace: "font-family: \"hico-lui-icons\""},
							]
						}
					}
				]
			},
		]
	},

	resolve: {
		extensions: ['.ts', '.tsx', '.js', '.less'],
		modules: [_env.getPath('node_modules'), 'node_modules'], // for ted package, otherwise it can't find some common-utils dependencies
	},

	// hide source code from source-map in production
	devtool: _env.IS_PROD ? undefined : 'cheap-module-eval-source-map',

	externals: {
		'client.property-panel/components/components': 'client.property-panel/components/components',
		'jquery': 'jquery',
		'qlik': 'qlik',
		'angular': 'angular',
		'qvangular': 'qvangular',

		'config': './config',
		'../../../resource/config': './config'
	}
};
