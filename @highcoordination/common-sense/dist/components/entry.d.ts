/**
 * Entry module which should be imported as first "own" module in entry script (starter script)
 * It must not import any modules which require publicPath to be set/available, because this is the module where it is defined
 */
import './polyfills';
/**
 * Name of the extension which should be replaced during the build process (webpack)
 */
export declare const EXTENSION_NAME: string;
/**
 * Public path of the entry script
 * @type {string}
 */
export declare const publicPath: string;
/**
 * Imports all dependencies of the given webpack context
 *
 * @param {object} context - webpack context created with require.context method
 * @return {Array} - Exports of imported modules
 */
export declare function importAll(context: {
    keys: () => Function[];
    (): any;
}): any[];
