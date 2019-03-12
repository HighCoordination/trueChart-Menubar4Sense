/**
 * @class LoadExternal
 * loads the scripts from an external web server, mostly used by
 */
export declare class LoadExternal {
    /** stores of a is the download is */
    private static process;
    /**
     * loads the given scripts and returns a promise, that is resolved when finished
     * @param urls - multiple urls as params
     */
    static load(...urls: string[]): Promise<void[]>;
    /**
     * creates a js node at the head to trigger the download
     * @param url - url where the scripts are located
     */
    private static createNode;
}
