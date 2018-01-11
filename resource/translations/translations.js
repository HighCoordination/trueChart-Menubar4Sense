import de_de from './de_de/translations';
import en_us from './en_us/translations';

let _translations = switchToLanguage();

export function switchToLanguage(lang){
	let userLang = lang || navigator.language;

	switch(userLang){
		case 'de':
		case 'de-DE': // IE
			_translations = de_de;
			break;
		case 'us':
		case 'en-US':
			_translations = en_us;
			break;
		default: _translations = en_us;
	}

	return _translations;
}

export {
	_translations as translation
}