import { TGenericObject, TPrimitives } from '../interfaces/interfaces';
/**
 * Checks if the parameter is an object (and not null!)
 *
 * @param {*} parameter - the value to be checked
 * @return {boolean} - true if parameter is an object, false otherwise
 */
export declare function isObject<T extends object | TPrimitives>(parameter: T): parameter is Exclude<T, TPrimitives>;
/**
 * Checks if the given object is an empty object
 * @see https://jsperf.com/methods-to-test-empty-objects/3
 *
 * @param {T} object
 * @return {boolean}
 */
export declare function isEmptyObject<T extends object>(object: T): boolean;
/**
 * Checks if given objects differs from each other
 * @param {T1} obj1 - First object
 * @param {T2} obj2 - Second object
 * @param {string[]} [ignoreKeys] - Array of key to be ignored
 * @return {boolean} Returns true, when objects are different, false otherwise
 */
export declare function isDifferent<T1, T2 extends T1>(obj1: T1, obj2: T2, ignoreKeys?: string[] | undefined): boolean;
export declare function array_unique<T>(originalArray: T[]): T[];
/**
 * Moves the item specified by given oldIndex to the newIndex of the given array
 *
 * @param array
 * @param oldIndex
 * @param newIndex
 * @param inPlace - If true the array will be directly modified instead of working with a shallow copy
 */
export declare function arrayMove<T>(array: T[], oldIndex: number, newIndex: number, inPlace?: boolean): T[];
export declare function createArray(len: number, value?: any): any[];
/**
 * Returns a new Object instance without excluded properties (keys)
 * @param {T} obj - To be filtered original object
 * @param {string[]} excludedKeys - Array of keys to be excluded in the returned object
 * @param {boolean} [recursive] - If true, the object is processed recursively -> deepCopy
 * @return {TGenericObject} - Filtered object
 */
export declare function filterKeys<T>(obj: T, excludedKeys: string[], recursive?: boolean): T | Partial<T>;
/**
 * Makes a deep copy of a "simple" object (without prototypes or special objects like Date) and returns a new instance
 * @param {T} obj - Object to be copied
 * @param {boolean} keepInstance - keep the instance (prototype, methods) of the original
 * @return {T}
 */
export declare function deepCopy<T extends object>(obj: T, keepInstance?: boolean): T;
/**
 * Goes through object properties recursively and returns an array of objects containing given searchKey
 *
 * @param {TGenericObject} obj - Source object
 * @param {string} searchKey - Name of the property the object has to have
 * @param {Array<TGenericObject>} [collection] - (existing) Array of objects
 *
 * @return {TGenericObject[]} - Array of objects if found any
 */
export declare function collectObjectsWithKey<T>(obj: TGenericObject<T> | TGenericObject<T>[], searchKey: string, collection?: TGenericObject<T>[]): TGenericObject<T>[];
/**
 * Replaces all occurrences of the given "search" with "replace"
 *
 * @param {string | undefined} str - string where data should be replaced
 * @param {string} search - search-string
 * @param {string} replace - replace-string
 *
 * @return {string}
 */
export declare function replaceAll(str: string | undefined, search: string, replace: string): string;
/**
 * Converts the given array to an object map with given key as object key
 *
 * Non unique key values will be overridden
 *
 * @param {T[]} array
 * @param {K} key
 *
 * @return {{[P in V]: T}}
 */
export declare function arrayToMap<T extends object, K extends keyof T, V extends string & T[K]>(array: T[], key: K): {
    [P in V]: T;
};
export declare function objectToArray<T>(obj: TGenericObject<T>): T[];
/**
 * Executes the given callback for each object property
 *
 * @param {T} obj
 * @param {(property: T[K], key: K) => void} callback
 */
export declare function objectForEach<T extends object, K extends string & keyof T>(obj: T, callback: (property: T[K], key: K) => void): void;
/**
 * Executes the given callback for each object property and returns callbacks return value in an Array
 *
 * @param {T} obj
 * @param {(property: T[K], key: K) => R} callback
 *
 * @return {R[]}
 */
export declare function objectMap<T extends object, K extends string & keyof T, R>(obj: T, callback: (property: T[K], key: K) => R): R[];
/**
 * Executes the given callback for each object property and returns true if callback also does
 *
 * @param {T} obj
 * @param {(property: T[K], key: K) => R} callback
 *
 * @return {boolean}
 */
export declare function objectSome<T extends object, K extends string & keyof T>(obj: T, callback: (property: T[K], key: K) => boolean | void): boolean;
/**
 * Returns true if the given arrays contain same values
 *
 * @param arr1
 * @param arr2
 */
export declare function sameValuesInArray<T, U extends T>(arr1: T[], arr2: U[]): boolean;
/**
 * Checks for nodes with the defined part of the id, including the start element
 *
 * @param {Element} element - DOM-Element to start searching
 * @param {string[]} partOfId - Array of strings that should be searched in the ids of the parents
 * @param {number} [maxRecursion] - number of max recursions, or unlimited if left undefined
 *
 * @return {Element | undefined} - Found element or undefined
 */
export declare function hasParentWithIDContaining(element: Element, partOfId: string[], maxRecursion: number): Element | undefined;
/**
 * Combines a given definition with the default definition. Only properties that are in the default definition are returned.
 *
 * @param {D} defaultDef
 * @param {C} [customDef]
 * @param {Function<string, Object, Object>} [cb] - callback-function (Key, CurrentDefinitionOfKey, DefaultDefinitionOfKey)
 * @returns {TGenericObject}
 */
export declare function initDefinition<D extends TGenericObject<any>, C extends Partial<D>>(defaultDef: D, customDef?: C, cb?: (key: string, currKeyDef: D[keyof D] | C[keyof D], defKeyDef: D[keyof D]) => D[keyof D]): D;
/**
 * Combines a given definition with the default definition. Only properties that are in the default definition are returned.
 *
 * @param {D} defaultDef
 * @param {C} [customDef]
 * @param {Function<string, C[keyof D], D[keyof D]>} [cb] - callback-function (Key, CurrentDefinitionOfKey, DefaultDefinitionOfKey)
 * @returns {Object}
 */
export declare function initDefinitionRecursive<D extends TGenericObject<any>, C extends Partial<D>>(defaultDef: D, customDef?: C, cb?: (key: string, customKeyDef: C[keyof D], defKeyDef: D[keyof D]) => any): D;
/**
 * Returns Key name searched by value
 * @param object
 * @param value
 * @param ignoreErrors - if true possible "errors" will be ignored, otherwise reported
 * @returns {string | undefined}
 */
export declare function getKeyByValue<T, O extends TGenericObject<T>>(object: O, value: O[keyof O], ignoreErrors?: boolean): keyof O | undefined;
/**
 * Finds object in a given array by key and returns it if found
 *
 * @param {T[]} array - Array to search in
 * @param {string} key - Key of the object to search for
 * @param {*} value - Value of the key to compare with
 *
 * @param ignoreKeys - Keys which can be ignored
 * @return {T | null} - First object if found, otherwise null
 */
export declare function findObjectByValue<T extends TGenericObject<any>, V extends T[keyof T]>(array: T[], key: keyof T, value: V, ignoreKeys?: string[]): T | null;
/**
 * replaces a 'default' with the real default value
 *
 * @param value
 * @param defaultValue
 */
export declare function replaceDefault(value: string | number, defaultValue: string | number): string | number;
/**
 * Checks if a enum has a a certain value
 *
 * @param {TGenericObject} enumDef
 * @param {string} searchValue
 * @returns {boolean}
 */
export declare function enumHasValue<T extends TGenericObject<any>>(enumDef: T, searchValue: string | number): boolean;
/**
 * Reduce function for objects (like Array.reduce)
 * @param obj
 * @param callback
 * @param acc
 */
export declare function objectReduce<T extends object, R>(obj: T, callback: (acc: R, value: T[keyof T], key: string | number | symbol) => R, acc: R): R;
