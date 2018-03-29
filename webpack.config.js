const webpack = require('webpack'),
	ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin'),
	BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin,

	_env = require('./env'),
	_plugins = [new ForkTsCheckerWebpackPlugin({
		checkSyntacticErrors: true
	})];

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
		splitChunks: {
			name: _env.PKG_NAME,
			minChunks: Infinity
		}
	},

	entry: {
		'tcmenu': `${_env.srcDir}/${_env.PKG_NAME}`
	},

	plugins: _plugins,

	output: {
		path: _env.distDir,
		filename: '[name].js',
		chunkFilename: '[name].js',
		library: _env.PKG_NAME,
		libraryTarget: 'umd'
	},

	module: {
		rules: [
			{
				test: /\.(less|css)$/,
				use: [
					'style-loader', // loads style as inline style
					'css-loader?minimize=true', // translates CSS into CommonJS
					{
						loader: 'string-replace-loader',
						query: {search: /url\(.*woff2'\),/g, replace: ''} // remove "problematic" fonts (unsupported by sense hub)
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
			{
				test: /\.(js|ts|tsx)$/,
				exclude: /node_modules/,
				use: ['ts-loader?happyPackMode=true']
			},
			{
				test: /\.(less|html|js|ts|tsx|txt|qext)$/,
				enforce: 'pre',
				exclude: /node_modules/,
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

								{search: 'url(\'@{fa-font-path}/fontawesome-webfont.woff2?v=@{fa-version}\') format(\'woff2\'),', replace: ''},
							]
						}
					}
				]
			},
		]
	},

	resolve: {
		extensions: ['.ts', '.tsx', '.js', '.less'],
	},

	// hide source code from source-map in production
	devtool: _env.IS_PROD ? undefined : 'cheap-module-eval-source-map',

	externals: {
		'ng!$q': 'ng!$q',
		'ng!$http': 'ng!$http',
		'ng!$compile': 'ng!$compile',
		'ng!$timeout': 'ng!$timeout',
		'client.property-panel/components/components': 'client.property-panel/components/components',
		'client.property-panel/components/list/list': 'client.property-panel/components/list/list',
		'client.property-panel/components/buttongroup/buttongroup': 'client.property-panel/components/buttongroup/buttongroup',
		'client.property-panel/components/string/string': 'client.property-panel/components/string/string',
		'client.property-panel/components/slider/slider': 'client.property-panel/components/slider/slider',
		'general.services/media-library/media-library': 'general.services/media-library/media-library',
		'jquery': 'jquery',
		'qlik': 'qlik',
		'angular': 'angular',
		'qvangular': 'qvangular',

		'config': './config',
		'../../../resource/config': './config'
	}
};
