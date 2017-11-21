define(['../prefix', './en_us'], function (prefix, defaultLang) {
	var _translation = defaultLang,
	    _onChangeCallbacks = [],
	    _path = getExtensionPath('tcmenu') + '/lib/hico/translations/';

	// initialize default (browser) language
	init();

	/**
  * Initialization
  * @returns {*}
  */
	function init() {
		var userLang = window.navigator.language || window.navigator.userLanguage;
		switch (userLang) {
			case 'de':
				return switchToLanguage('de_de');
			default:
				_translation = defaultLang;
		}
	}

	/**
  * Get translation of given key
  * If the translation contains a placeholder in the format '${idx}', this placeholder will be
  * replaced by args[idx].toString().
  * Example:
  *   translation = 'Please select a value greater then ${0} and smaller then ${1}!'
  *   args = 10, 100
  *   returns 'Please select a value greater then 10 and smaller then 100!'
  * @param {string} key - Translation key
  * @param {Array<*>} args - placeholder replacements (optional)
  * @returns {string}
  */
	function getTranslation(key) {
		for (var _len = arguments.length, args = Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
			args[_key - 1] = arguments[_key];
		}

		var trans = _translation[key];
		if (!trans) {
			console.warn('Missing translation for key: ', key);
		} else {
			// search and replace placeholders
			trans = trans.replace(/\${\d+}/g, function (r) {
				var tIdxMatch = r.match(/\d+/);
				if (tIdxMatch.length > 0) {
					var tIdx = parseInt(tIdxMatch[0]);
					if (!isNaN(tIdx) && args.length > tIdx) {
						return args[tIdx].toString();
					}
				}
				return r;
			});
		}
		return trans || key;
	}

	/**
  * Changes the current language
  * @param lang {string} Language string to switch to
  */
	function switchToLanguage(lang) {
		require([_path + lang.toLowerCase() + '.js'], function (trans) {
			_translation = trans;

			// Run onChange callbacks
			_onChangeCallbacks.forEach(function (callback) {
				callback(lang);
			});
		});
	}

	/**
  * Registers a callback which will be executed on every language change
  * @param {Function} callback - Callback function to be executed
  * @return {Function} - Callback which removes the onChange listener
  */
	function onChange(callback) {
		typeof callback === 'function' && _onChangeCallbacks.push(callback);

		// return "unbind" method witch disables execution of the callback on language changes
		return function () {
			var idx = _onChangeCallbacks.indexOf(callback);
			if (idx !== -1) {
				_onChangeCallbacks.splice(idx, 1);
			}
		};
	}

	/**
  * Get absolute trueChart extension path
  *
  * @return {string}
  */
	function getExtensionPath(extensionName) {
		return require.toUrl('extensions/' + extensionName).split('?')[0];
	}

	/**
  * Export "public" methods
  */
	return {
		getTranslation: getTranslation,
		onChange: onChange,
		switchToLanguage: switchToLanguage
	};
});