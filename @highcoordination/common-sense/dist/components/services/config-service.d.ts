import * as Config from 'config';
export declare class ConfigService {
    private static _instance;
    getReady: () => Promise<void>;
    private _actionWhitelist;
    private _actionBlacklist;
    constructor();
    /**
     * Returns the instance of the service
     *
     * @return {object}
     */
    static getInstance(): ConfigService;
    /**
     * Returns a blacklisted actions for current user
     * @return {Promise} Array of blacklisted action names
     */
    getActionBlacklist(): Promise<string[]>;
    getActionWhitelist(): Promise<string[]>;
    /**
     * Parse the actionPermissions definition and returns blacklisted actions for given user in a promise
     * @param config {actionPermissions: [{match: {UserDirectory: string, UserId: string}, blackList: string[]}]} definition
     * @return Promise Array of blacklisted actions
     */
    getActions(config: typeof Config): Promise<void>;
}
