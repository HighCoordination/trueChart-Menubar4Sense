import { IScope as IAngularScope } from 'angular';
/**
 * Dropdown options compatible for native property panel dropdown components
 */
export interface IOption {
    value: string;
    label: string;
}
/**
 * App object available in the args property of a property panel component
 */
export interface IApp {
    layout: {
        qStateNames: string[];
        isPublished?: boolean;
    };
    addAlternateState: (name: string) => Promise<void>;
    removeAlternateState: (name: string) => Promise<void>;
}
/**
 * Args property of a property panel components scope
 */
export interface IArgs<H, P> {
    app: IApp;
    handler: H;
    properties: P;
}
/**
 * Interface of data which is passed within the 'datachanged' event registered by Qlik Sense property panel components
 */
export interface IQSDataChangeData<D> {
    [key: string]: D;
}
/**
 * Scope of a property panel component
 */
export interface IPPComponentScope<V, D extends {
    [key: string]: V;
}, H, P> extends IAngularScope {
    [key: string]: any;
    args: IArgs<H, P>;
    data: {
        [key: string]: D;
    };
    definition: {
        ref: string;
        label?: string;
        translation?: string;
        change?: (data: {
            [key: string]: D;
        }, handler: H, properties: P, args: IArgs<H, P>) => void | Promise<void>;
    };
}
