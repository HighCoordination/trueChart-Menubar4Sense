/** Languages that should be provided */
export declare type TLanguage = 'en' | 'de';
export declare type TTranslate<T extends object = TTranslation> = (key: keyof T & string, ...args: (string | number)[]) => string;
export declare type TTranslation<T extends object = object> = {
    [P in keyof T]: T[P] & string;
};
export declare type TTranslations<T extends object> = Partial<{
    [P in TLanguage]: TTranslation<T>;
}>;
export declare type TOnChangeCallback = () => void;
/**
 * @class Translation tool
 */
export declare class Translation<T extends object = TTranslation> {
    private static _instances;
    private readonly _translations;
    private _language;
    private _onChangeCallbacks;
    /**
     * Changes the current language to given language
     *
     * @param {TLanguage} lang - Language string to switch to
     */
    static switchLanguage(lang: TLanguage): void;
    /**
     * Returns the browser language
     */
    static getClientLanguage(): TLanguage;
    /**
     * @constructor
     * @param translations
     */
    constructor(translations: TTranslations<T>);
    /** Returns the translation for the current language */
    private readonly Translation;
    /**
     * Sets the currently used translation language
     *
     * @param language
     */
    private setCurrentLanguage;
    /**
     * Returns the currently used translation language
     */
    getCurrentLanguage(): TLanguage;
    /**
     * Sets the translation for the corresponding language
     *
     * @param language
     * @param translation
     */
    setTranslation(language: TLanguage, translation: TTranslation<T>): void;
    /**
     * Returns the translation for the given key
     *
     * @param {string} key - key, that should be translated
     * @param {string} [args] - strings that should be insert in translation as arguments
     *
     * @return {string} Translation for key
     */
    translate: TTranslate<T>;
    /**
     * Returns the translation and replaces some chars
     *
     * @param {string} key Key, that should be translated
     * @param {string} [args] - strings that should be insert in translation as arguments
     *
     * @returns {string} Translation for key
     */
    translateHtml: TTranslate<T>;
    /**
     * Registers a callback which will be executed on every language change
     *
     * @param {Function} callback - Callback function to be executed
     * @return {Function} - Callback which removes the onChange listener
     */
    onChange(callback: TOnChangeCallback): () => void;
}
