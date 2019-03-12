import { AError } from './AError';
/**
 * @class AUiError
 * extends the default error with an required translation key
 */
export declare abstract class AUiError extends AError {
    private readonly _translationKey;
    constructor(translationKey: string, message?: string);
    readonly TranslationKey: string;
}
