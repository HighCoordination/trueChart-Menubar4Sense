import * as qvangular from 'qvangular';
import * as template from '../../templates/trial.html';

function Trial(utilService){
	return {
		restrict: 'E',
		scope: {
			parentscope: '=',
		},
		replace: true,
		template: template,
		controller: ['$scope', '$element', function($scope){
			$scope.layout = $scope.parentscope.layout;
			$scope.colors = $scope.parentscope.colors;

			$scope.utilService = utilService;

			$scope.item = {};

			$scope.groupBtnStyle = {
				'background-color': 'rgba(1,1,1,0)',
				'height':  '56px'
			};
		}]
	}
}

qvangular.directive('trial', ['utilService', Trial]);