define(['jquery', 'qlik', 'qvangular', 'text!../templates/selectDropdown.html'], function ($, qlik, qvangular, template) {

	return qvangular.directive('selectdropdown', ['utilService', function (utilService) {
		return {
			restrict: 'E',
			scope: {
				item: '=',
				layout: '<',
				itemindex: '<',
				listitems: '=',
				colors: '<'
			},
			replace: true,
			template: template,
			controller: ['$scope', '$element', function ($scope, $element) {
				$scope.itemId = $scope.layout.qInfo.qId + '-' + $scope.item.cId;
				$scope.utilService = utilService;

				$scope.closeDropdown = function (item) {
					item.show = false;
				};

				$scope.handleDropdown = function (item, itemindex) {
					if (qlik.navigation.getMode() !== "edit") {

						utilService.closeMenus($scope.listitems, $scope.item.cId);

						$scope.item.selectItems.forEach(function (selectItem) {
							selectItem.isOpen = false;
							selectItem.show = false;
						});

						item.show = !item.show;

						if ($scope.layout.appearance.orientation === 'btn-inline' && $scope.utilService.screenWidth > 767) {
							$element.find('#panel_' + $scope.itemId).width($element.find('#hico-item-horizontal_' + $scope.itemId)[0].clientWidth);

							if (item.show) {
								$element.parents("article").css("z-index", 2);
							}
						}

						if (!itemindex) {
							$scope.utilService.handleMenuScroll($scope.itemId);
						}
					}
				};
			}]
		};
	}]);
});