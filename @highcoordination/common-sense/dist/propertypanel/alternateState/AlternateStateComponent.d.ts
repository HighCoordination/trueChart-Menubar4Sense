import { IPPComponentScope } from '../../interfaces';
import * as alternateStatesComponentTemplate from './AlternateStateComponent.html';
export declare const AlternateStateComponent: {
    scope: boolean;
    template: typeof alternateStatesComponentTemplate;
    controller: (string | (<V, D extends {
        [key: string]: V;
    }, H, P>($scope: IPPComponentScope<V, D, H, P>) => void))[];
};
