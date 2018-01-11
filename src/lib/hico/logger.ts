import * as log4javascript from 'log4javascript';
import {prefix} from './prefix';

export const Logger = (function(){

	class Logger {
		Logger: log4javascript.Logger;
		/**
		 * Constructor
		 * @param {TOptions} options - Initial options
		 */
		constructor(options?: TOptions){
			const _this = this;
			this.Logger = log4javascript.getLogger(prefix === 'tcmenu' ? 'tcMenu' : 'trueChart');

			// make properties "protected"
			Object.defineProperties(this.Logger, {
				'Log': {configurable: false, enumerable: false, value: log4javascript},
				'init': {configurable: false, enumerable: false, value: (opts: TOptions) => _this.init(opts)}
			});

			this.init(options);
		}

		/**
		 * Initialize the default logger
		 * @param {TOptions} opts - Initialization options
		 */
		init(opts: TOptions){
			// remove all previous added appenders
			this.Logger.removeAllAppenders();

			const options = Object.assign({}, {
				level: 'WARN',
				username: 'Anonymous',
				hasService: false,
				serviceUrl: ''
			}, opts);

			let level;
			switch(options.level){
				case 'WARN':
					level = log4javascript.Level.WARN;
					break;
				case 'ALL':
				default:
					level = log4javascript.Level.ALL;
			}

			const consoleAppender = new log4javascript.BrowserConsoleAppender();
//			consoleAppender.setLayout(new log4javascript.PatternLayout('%r %p %c - %m%n')); // %r prints out time in ms, since log4javascript was instantiated
			consoleAppender.setLayout(new log4javascript.PatternLayout('"%d{HH:mm:ss.SSS} %p:%c - %m"'));
			consoleAppender.setThreshold(level);

			this.Logger.setLevel(level);
			this.Logger.addAppender(consoleAppender);

			if(options.hasService){
				const ajaxAppender = new log4javascript.AjaxAppender(options.serviceUrl);
				const logLayout = new log4javascript.HttpPostDataLayout();

				logLayout.setCustomField('action', 'createLogMessage');
				logLayout.setCustomField('username', options.username);
				ajaxAppender.setLayout(logLayout);
				ajaxAppender.setThreshold(level);

				this.Logger.addAppender(ajaxAppender);
			}
		}
	}

	// create an Logger instance (singleton)
	const logger = new Logger();

	return logger.Logger;
})();

type TOptions = {
	level?: string;
	username?: string;
	hasService?: boolean;
	serviceUrl?: string;
}