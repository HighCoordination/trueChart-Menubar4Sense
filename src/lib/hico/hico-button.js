import './directives/button';

let buttonEditor = null;

/**
 * Requires button editor asynchronous and returns a promise, which will be resolved, when button editor was loaded
 * @return {Promise<any>}
 */
export function loadEditor(){
	if(buttonEditor){
		return Promise.resolve(buttonEditor);
	}
	return new Promise(resolve => require.ensure([], () => buttonEditor = resolve(require('./directives/button-editor')), 'lib/hico/button-editor'));
}