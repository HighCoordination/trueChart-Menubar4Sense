export declare function staticImplements<T>(): (__constructor: T) => void;
/**
 * Log every get/set call on the given property
 * @param target
 * @param key
 */
export declare function log<T>(target: T, key: keyof T): void;
/**
 * Makes the decorated property readonly after the first assignment
 * @param target - target class/object
 * @param key - property to be set as decorated as readonly
 */
export declare function readonly<T, V extends T[keyof T]>(target: T, key: keyof T): void;
/**
 * Decorates the property as a runtime only property which becomes "not serializable"
 * @param {V} [defaultValue] - default value which the property has before/after initialization/serialization
 */
export declare function runtime<T>(target: T, key: keyof T): void;
