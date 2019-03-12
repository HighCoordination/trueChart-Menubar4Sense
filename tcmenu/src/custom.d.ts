declare var __dirname: string;
declare var __webpack_public_path__: string;

/**
 * Declare webpack require
 */
declare interface WebpackRequire {
	(path: string): any;

	context(directory: string, useSubdirectories: boolean, regExp: RegExp): any;

	ensure(dependencies: string[], callback: () => void, filename: string): any;

	include(dependency: string): void;
}

declare var require: WebpackRequire;

declare module 'es6-object-assign' {
	export function polyfill(): void;

	export function assign(target: any, firstSource: any): any;
}

/**
 * Helper for importing json files
 */
declare module '*.json' {
	const content: any;
	export default content;
}

declare type TTranslate<T> = (key: keyof T, ...args: (string | number)[]) => string;