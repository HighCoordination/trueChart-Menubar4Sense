/**
 * Provide all exports here which must be available for other libs/consumer code
 *
 * @module This is the entry point of the common-sense module
 */
import './components/entry';
import './propertypanel/styles/common.less';
export { ActionService } from './components/services/action-service';
export { AngularService } from './components/services/AngularService';
export { MediaLibrary } from './components/directives/media-library';
export { MediaService } from './components/services/media-service';
export { Modal } from './components/directives/modal-dialog';
export { qlik, QlikService, qvComponents } from './components/services/qlik-service';
export { ConfigService } from './components/services/config-service';
export { loadEditor, Button } from './components/hico-button';
export * from './components/translations/translation';
export * from './propertypanel/Factory';
export declare function registerCommonDirectives(): void;
