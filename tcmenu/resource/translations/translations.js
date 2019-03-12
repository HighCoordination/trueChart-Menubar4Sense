import de_de from './de_de/translations';
import en_us from './en_us/translations';
import {Translation} from '@highcoordination/common-sense';

let _translations = switchToLanguage();

export function switchToLanguage(lang){
	let userLang = lang || navigator.language;
	let useLanguage = 'en_US';

	switch(userLang){
		case 'de':
		case 'de-DE': // IE
			_translations = de_de;
			useLanguage = 'de_DE';
			break;
		case 'us':
		case 'en-US':
			_translations = en_us;
			break;
		default: _translations = en_us;
	}

	Translation.switchToLanguage(useLanguage); // synchronize the translation for hico components
	return _translations;
}

export {
	_translations as translation
}