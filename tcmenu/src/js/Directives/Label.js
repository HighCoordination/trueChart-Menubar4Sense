import * as qvangular from 'qvangular';
import * as template from '../../templates/label.html'

new function(){

	return qvangular.directive('labeldirective', function(){
		return {
			restrict: 'E',
			scope: {
				item: '=',
				type: '=',
				layout: '='
			},
			replace: true,
			template: template
		}
	});
};
