import {Logger} from '@highcoordination/common-utils';

// initialize default logger for tcmenu
Logger.init('Menubar', {
	level: '##LOG_LEVEL##', // must be replaced by webpack
	username: 'Anonymous',
	hasService: '##HAS_SERVICE##' as string | boolean as boolean, // must be replaced by webpack
	serviceUrl: '##SERVICE_URL##', // must be replaced by webpack
});

const logger = Logger.Instance;

export {
	logger as Logger
};