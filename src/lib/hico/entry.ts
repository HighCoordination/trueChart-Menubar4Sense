/**
 * Entry module which should be imported as first "own" module in entry script (starter script)
 * It must not import any modules which require publicPath to be set/available, because this is the module where it is defined
 */
import './polyfills';

// require modules which shouldn't be included in every chunk (if required by chunks modules) but in entry chunk only
require.include('react');
require.include('react-dom');

export const EXTENSION_NAME = '##EXTENSION_NAME##';

/**
 * Entry path of the main entry script
 * @type {string}
 */
const entryPath: string = getEntryPath('##ENTRY##');

/**
 * Public path of the entry script
 * @type {string}
 */
export const publicPath: string = entryPath + '/';

/**
 * Returns absolute path to the entry script
 *
 * @param {string} entry - Entry name to get path for
 * @return {string} - Absolute path
 */
function getEntryPath(entry: string){
	let path = '';

	if(entry === 'Script'){ // QlikView
		path = (window as any).Qva.Remote + '?public=only&name=Extensions/HiCoMVCChart';

	}else{
		const scripts = document.getElementsByTagName('script'),
			searchString = `/${entry}.js`;

		for(let i = 0; i < scripts.length; i++){
			if(scripts[i].src.indexOf(searchString) > -1){
				path = scripts[i].src.split(searchString)[0];
				break;
			}
		}
	}

	return path;
}

/**
 * Imports all dependencies of the given webpack context
 *
 * @param {object} context - webpack context created with require.context method
 * @return {Array} - Exports of imported modules
 */
export function importAll(context: {keys: () => Function[], (): any}){
	return context.keys().map(context);
}

// set WebPacks public path to a real (runtime) value
__webpack_public_path__ = publicPath;
