define(['jquery', 'qvangular', 'text!../templates/calendar.html'], function ($, qvangular, template) {

	return qvangular.directive('calendar', ['utilService', function (utilService) {
		return {
			restrict: 'E',
			scope: {
				item: '=',
				layout: '<',
				colors: '<'
			},
			replace: true,
			template: template,
			controller: ['$scope', function ($scope) {
				$scope.itemId = $scope.layout.qInfo.qId + '-' + $scope.item.cId;
				$scope.utilService = utilService;

				$scope.handleDropdown = function (item, itemindex) {
					if (qlik.navigation.getMode() !== "edit") {
						item.show = !item.show;

						if ($scope.layout.appearance.orientation === 'btn-inline' && $scope.utilService.screenWidth > 767) {
							$element.find('#panel_' + $scope.itemId).width($element.find('#hico-item-horizontal_' + $scope.itemId)[0].clientWidth);
						}

						if (!itemindex) {
							$scope.utilService.handleMenuScroll(item, itemindex, $scope.layout.qInfo.qId);
						}
					}
				};

				$scope.closeDropdown = function (item) {
					item.show = false;
				};
			}]
		};
	}]);
});