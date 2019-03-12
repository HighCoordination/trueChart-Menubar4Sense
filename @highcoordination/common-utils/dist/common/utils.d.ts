/**
 * Is true if browsers local storage is available/usable
 */
export declare const canUseLocalStorage: boolean;
/**
 * Reads the file and returns the result in a Promise
 *
 * @param {File} file
 *
 * @return {Promise<string>}
 */
export declare function readAsText(file: File): Promise<string>;
/**
 * Saves given data as with given mime type
 *
 * @param {string} data
 * @param {string} fileName
 * @param {string} type
 */
export declare function saveAsFile(data: string, fileName: string, type?: string): void;
/**
 * Saves given dataURI as file
 *
 * @param {string} dataURI - Example: data:text/plain;charset=UTF-8;page=21,the%20data:1234,5678
 * @param {string} fileName
 */
export declare function saveDataURIAsFile(dataURI: string, fileName: string): void;
/**
 * Converts given base64 string to a Blob
 *
 * @param {string} b64Data
 * @param {string} contentType
 * @return {Blob}
 */
export declare function b64toBlob(b64Data: string, contentType: string): Blob;
/**
 * Returns fontSize depending on given screenSize
 *
 * @param {number | string} fontSize
 * @param {number} screenSize
 *
 * @returns {number}
 */
export declare function getDynamicFontSize(fontSize: number | string, screenSize?: number): number;
