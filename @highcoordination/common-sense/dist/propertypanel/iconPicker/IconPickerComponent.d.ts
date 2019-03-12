import { IPPComponentScope } from '../../interfaces';
import * as template from './IconPickerComponent.html';
export declare const IconPickerComponent: {
    template: typeof template;
    scope: boolean;
    controller: (string | (<Value, Data extends {
        [key: string]: Value;
    }, Handle, Props>($scope: IPPComponentScope<Value, Data, Handle, Props>) => void))[];
};
