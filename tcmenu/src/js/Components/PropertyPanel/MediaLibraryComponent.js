import {UtilService} from '../../Services/UtilService';

import * as template from '../../../templates/mediaLibraryComponent.html';
import {
	QlikService,
	qvComponents,
	MediaLibrary
} from '@highcoordination/common-sense';

export const MediaLibraryComponent = !QlikService.inClient() ? 'string' : {
	template,
	controller: [
		'$scope', '$element', function(scope){
			scope.qComponents = {
				string: qvComponents.getComponent('string')
			};
			scope.text = {type: 'string', ref: scope.definition.ref, expression: 'optional'};

			scope.doAction = () => {
				MediaLibrary.show({
					mediaUrl: UtilService.getRefValue(scope.args.layout, scope.definition.ref),
					onConfirm(url){
						UtilService.setRefValue(scope.data, scope.definition.ref, url);
						scope.$emit("saveProperties");
					}
				});
			}
		}
	]
};