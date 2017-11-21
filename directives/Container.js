define(['qvangular', 'text!../templates/container.html', '../lib/hico/services/qlik-service'], function (qvangular, template, QlikService) {

	return qvangular.directive('containerelement', ['utilService', function (utilService) {
		return {
			restrict: 'E',
			scope: {
				item: '<',
				layout: '<',
				itemindex: '<',
				colors: '<'
			},
			replace: true,
			template: template,
			controller: ['$scope', function ($scope) {
				var qlikService = QlikService.getInstance(),
				    isStoryMode = qlikService.inStoryMode();

				$scope.utilService = utilService;
				$scope.evaluateStates = $scope.layout.qInfo.qType !== 'embeddedsnapshot'; // do not evaluate button states for snapshots
				$scope.handleButtonStates = handleButtonStates;

				/**
     * Assigns updated button states to the extensions layout (required for snapshots)
     * @param {Object} activeStates
     * @param {Object} currSubItem
     * @param {number} itemindex
     */
				function handleButtonStates(activeStates, currSubItem, itemindex) {
					if (isStoryMode) {
						return; // do nothing in story mode
					}

					currSubItem.activeStates = activeStates;
					($scope.item.subItems || []).some(function (subItem, index) {
						if (subItem === currSubItem) {
							$scope.layout.listItems[itemindex].subItems[index].activeStates = subItem.activeStates;
							return true;
						}
					});
				}
			}]
		};
	}]);
});