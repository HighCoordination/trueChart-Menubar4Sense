define(['jquery', 'qlik', 'qvangular', 'text!../templates/variableDropdown.html'], function ($, qlik, qvangular, template) {

	return qvangular.directive('variabledropdown', ['utilService', function (utilService) {
		return {
			restrict: 'E',
			scope: {
				item: '<',
				layout: '<',
				itemindex: '<',
				listitems: '<',
				colors: '<'
			},
			replace: false,
			template: template,
			controller: ['$scope', '$element', function ($scope, $element) {
				$scope.itemId = $scope.layout.qInfo.qId + '-' + $scope.item.cId;
				$scope.utilService = utilService;

				$scope.appearance = $scope.layout.appearance;
				$scope.handleDropdown = function (item, itemindex) {
					if (qlik.navigation.getMode() !== "edit") {

						utilService.closeMenus($scope.listitems, $scope.item.cId);

						item.show = !item.show;

						if ($scope.appearance.orientation === 'btn-inline' && $scope.utilService.screenWidth > 767) {
							$element.find('#panel_' + $scope.itemId).width($element.find('#hico-item-horizontal_' + $scope.itemId)[0].clientWidth);

							if (item.show) {
								$element.parents("article").css("z-index", 2);
							}
						}

						if ($scope.appearance.orientation === 'btn-block') $scope.utilService.handleMenuScroll($scope.itemId);
					}
				};

				$scope.closeDropdown = function (item) {
					item.show = false;
				};

				$scope.handleAction = function (item) {
					qlik.currApp().variable.setContent($scope.item.props.variableName, item.props.variableValue);
				};
			}]
		};
	}]);
});