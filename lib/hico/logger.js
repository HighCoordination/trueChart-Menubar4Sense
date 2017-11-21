var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

define(['../external/log4javascript/log4javascript', './prefix'], function (log4javascript, prefix) {

	// holds single Logger instances
	var _instances = {};

	var Logger = function () {
		/**
   * Constructor
   * @param {object} options - Initial options
   */
		function Logger(options) {
			_classCallCheck(this, Logger);

			var _this = this;
			this.Logger = log4javascript.getLogger(prefix === 'tcmenu' ? 'tcMenu' : 'trueChart');

			// make properties "protected"
			Object.defineProperties(this.Logger, {
				'Log': { configurable: false, enumerable: false, value: log4javascript },
				'init': { configurable: false, enumerable: false, value: function value(opts) {
						return _this.init(opts);
					} }
			});

			this.init(options);
		}

		/**
   * Initialize the default logger
   * @param {object} opts - Initialization options
   */


		_createClass(Logger, [{
			key: 'init',
			value: function init(opts) {
				// remove all previous added appenders
				this.Logger.removeAllAppenders();

				var options = opts || {
					level: 'WARN',
					username: 'Anonymous',
					hasService: false,
					serviceUrl: ''
				};

				var level = void 0;
				switch (options.level) {
					case 'WARN':
						level = this.Logger.Log.Level.WARN;
						break;
					case 'ALL':
					default:
						level = this.Logger.Log.Level.ALL;
				}

				var consoleAppender = new this.Logger.Log.BrowserConsoleAppender();
				//			consoleAppender.setLayout(new this.Logger.Log.PatternLayout('%r %p %c - %m%n')); // %r prints out time in ms, since log4javascript was instantiated
				consoleAppender.setLayout(new this.Logger.Log.PatternLayout('"%d{HH:mm:ss.SSS} %p:%c - %m"'));
				consoleAppender.setThreshold(level);

				this.Logger.setLevel(level);
				this.Logger.addAppender(consoleAppender);

				if (options.hasService) {
					var ajaxAppender = new this.Logger.Log.AjaxAppender(options.serviceUrl);
					var logLayout = new this.Logger.Log.HttpPostDataLayout();

					logLayout.setCustomField('action', 'createLogMessage');
					logLayout.setCustomField('username', options.username);
					ajaxAppender.setLayout(logLayout);
					ajaxAppender.setThreshold(level);

					this.Logger.addAppender(ajaxAppender);
				}
			}
		}]);

		return Logger;
	}();

	if (_instances[prefix] === undefined) {
		try {
			_instances[prefix] = new Logger(prefix);
		} catch (err) {
			console.error(err);
		}
	}

	return _instances[prefix].Logger;
});