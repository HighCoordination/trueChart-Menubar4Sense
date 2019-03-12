export declare type TFlatObject<V> = {
    [key: string]: V;
} & object;
export declare type TDeepObject<V> = {
    [key: string]: TDeepObject<V> | TFlatObject<V>;
};
export declare type TObject<V> = TFlatObject<V> | TDeepObject<V>;
/**
 * Sets the given value to the given data by given reference path
 * @param data
 * @param refPath
 * @param value
 */
export declare function setRefValue<V>(data: TObject<V>, refPath: string, value: V): void;
/**
 * Returns the value of the given data by given reference path
 * @param data
 * @param refPath
 */
export declare function getRefValue<V>(data: TObject<V>, refPath: string): V | TFlatObject<V> | TDeepObject<V>;
