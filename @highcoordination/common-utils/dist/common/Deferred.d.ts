declare enum EDeferredState {
    Pending = 0,
    Resolved = 1,
    Rejected = 2,
    Canceled = 3
}
/**
 * Creates a deferred object, which can be use for asynchronous purposes
 */
export declare class Deferred<T> {
    promise: Promise<T>;
    resolve: (value?: T) => void;
    reject: (reason?: string | Error) => void;
    cancel: () => void;
    status: EDeferredState;
    /**
     * Constructor
     * @param {boolean} [withTimeMeasure] - should timeMeasurement be disabled
     */
    constructor(withTimeMeasure?: boolean);
    readonly pending: boolean;
    readonly resolved: boolean;
    readonly rejected: boolean;
    readonly canceled: boolean;
    static resolve<T>(value: T): Deferred<T>;
    /**
     * Wait for the given promise and returns a cancelable deferred object
     * @param {Promise<T>} promise - Promise to wait for
     * @returns new Deferred object
     */
    static await<T>(promise: Promise<T>): Deferred<T>;
    /**
     * Helper function for easily catching promise rejects, where the reason was a cancel
     * @param {T} reason
     */
    static ignoreCancel<T>(reason: T): void;
}
export {};
