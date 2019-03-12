import * as log4javascript from 'log4javascript';
/**
 * @class Logger
 * singleton logger class for all projects, need to be initialized before use
 */
export declare class Logger {
    private static _logger?;
    /**
     * returns the logger
     * @throws Error - when not initialized
     */
    static readonly Instance: log4javascript.Logger;
    private constructor();
    /**
     * Initialize the default logger
     * @param biSystem
     * @param {IOptions} opts - Initialization options
     */
    static init(biSystem: string, opts?: IOptions): void;
}
interface IOptions {
    level?: string;
    username?: string;
    hasService?: boolean;
    serviceUrl?: string;
}
export {};
