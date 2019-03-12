declare type TItems<C> = {
    [key: string]: IComponent<C>;
};
declare type TParams<C, T extends {
    items?: TItems<C>;
}> = {
    [key: string]: T | string | number | boolean;
};
interface IComponent<C> {
    type: string;
    component?: ICustomComponent<C>;
    ref?: string;
    items?: TItems<C>;
}
interface ICustomComponent<C> {
    template: string;
    controller: C;
}
/**
 * Creates a string component
 *
 * @param label
 * @param params
 */
export declare const createStringComponent: <C, T>(label: string, params?: TParams<C, T> | undefined) => {
    type: string;
    label: string;
} | {
    type: string;
    label: string;
};
/**
 * Returns a generic property panel items component
 *
 * @param label
 * @param items
 * @param params
 */
export declare const createItemsComponent: <C, T>(label: string, items: TItems<C>, params?: TParams<C, T> | undefined) => {
    type: string;
    label: string;
    items: TItems<C>;
} | {
    type: string;
    label: string;
    items: TItems<C>;
};
/**
 * Returns an expandable items component which will use "ng-if" to show/hide items content
 *
 * @param label
 * @param params
 * @param items
 */
export declare const createExpandableItemsComponent: <C, T>(label: string, items: TItems<C>, params?: TParams<C, T> | undefined) => {
    type: string;
    label: string;
    items: TItems<C>;
    component: string;
};
/**
 * Returns an alternate states property panel component
 * @param params
 */
export declare const createAlternateStateComponent: <C, T>(params?: TParams<C, T> | undefined) => {
    type: string;
    label: string;
    items: TItems<{}>;
};
export declare const createIconPickerComponent: <C, T>(params?: TParams<C, T> | undefined) => {
    type: string;
    label: string;
};
/**
 * Returns a selection (alternate states) property panel component
 * @param params
 */
export declare const createSelectionsComponent: <C, T>(params: TParams<C, T>) => {
    type: string;
    label: string;
    items: TItems<{}>;
};
export {};
