import en_us from './en_us';
import de_de from './de_de';

	const _translations: { [lang: string]: { [key: string]: string } } = {
			en_us: en_us,
			de_de: de_de
		},
		_onChangeCallbacks: Function[] = [];

	let _translation: {[key: string]: string};

	// set default (browser) language
	switch(window.navigator.language || (window.navigator as any).userLanguage){ // fallback for browsers without support for standard property
		case 'de':
			switchToLanguage('de_de');
			break;
		default:
			_translation = en_us;
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
	export function getTranslation(key: string, ...args: any[]){
		let trans = _translation[key];
		if(!trans){
			console.warn('Missing translation for key: ', key);
		}else{
			// search and replace placeholders
			trans = trans.replace(/\${\d+}/g, (r)=>{
				let tIdxMatch = r.match(/\d+/);
				if(tIdxMatch && tIdxMatch.length > 0){
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
	export function switchToLanguage(lang: string){
		const translation = typeof lang === 'string' && _translations[lang.toLowerCase()];
		if(translation){
			_translation = translation;

			// Run onChange callbacks
			_onChangeCallbacks.forEach((callback) => callback(lang));
		}
	}

	/**
	 * Registers a callback which will be executed on every language change
	 * @param {Function} callback - Callback function to be executed
	 * @return {Function} - Callback which removes the onChange listener
	 */
	export function onChange(callback: (lang: string) => any){
		typeof callback === 'function' && _onChangeCallbacks.push(callback);

		// return "unbind" method witch disables execution of the callback on language changes
		return () =>{
			let idx = _onChangeCallbacks.indexOf(callback);
			if(idx !== -1){
				_onChangeCallbacks.splice(idx, 1);
			}
		};
	}