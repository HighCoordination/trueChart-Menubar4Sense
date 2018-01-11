define([
	'./en_us',
	'./de_de'
], function(en_us, de_de){
	let _translations = {
			'en_us': en_us,
			'de_de': de_de
		},
		defaultLang = en_us,
		_translation = defaultLang,
		_onChangeCallbacks = [];

	// initialize default (browser) language
	init();

	/**
	 * Initialization
	 * @returns {*}
	 */
	function init(){
		var userLang = window.navigator.language || window.navigator.userLanguage;
		switch(userLang){
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
	function getTranslation(key, ...args){
		let trans = _translation[key];
		if(!trans){
			console.warn('Missing translation for key: ', key);
		}else{
			// search and replace placeholders
			trans = trans.replace(/\${\d+}/g, function(r){
				let tIdxMatch = r.match(/\d+/);
				if(tIdxMatch.length > 0){
					let tIdx = parseInt(tIdxMatch[0]);
					if(!isNaN(tIdx) && (args.length > tIdx)){
						return args[tIdx].toString();
					}
				}
				return r;
			});
		}
		return trans || key;
	}

	/**
	 * Changes the current language to given language
	 *
	 * @param {string} lang - Language string to switch to
	 */
	function switchToLanguage(lang){
		const translation = typeof lang === 'string' && _translations[lang.toLowerCase()];
		if(translation){
			_translation = translation;

			// Run onChange callbacks
			_onChangeCallbacks.forEach(function(callback){ callback(lang); });
		}
	}

	/**
	 * Registers a callback which will be executed on every language change
	 * @param {Function} callback - Callback function to be executed
	 * @return {Function} - Callback which removes the onChange listener
	 */
	function onChange(callback){
		typeof callback === 'function' && _onChangeCallbacks.push(callback);

		// return "unbind" method witch disables execution of the callback on language changes
		return function(){
			let idx = _onChangeCallbacks.indexOf(callback);
			if(idx !== -1){
				_onChangeCallbacks.splice(idx, 1);
			}
		};
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