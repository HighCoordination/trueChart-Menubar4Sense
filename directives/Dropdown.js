define(['qvangular', 'text!../templates/dropdown.html', '../lib/hico/services/qlik-service'], function (qvangular, template, QlikService) {

	return qvangular.directive('dropdown', ['utilService', function (utilService) {
		return {
			restrict: 'E',
			scope: {
				item: '=',
				firstItem: '<',
				layout: '<',
				itemindex: '<',
				listitems: '<',
				colors: '<'
			},
			replace: true,
			template: template,
			controller: ['$scope', '$element', function ($scope, $element) {
				var qlikService = QlikService.getInstance(),
				    isStoryMode = qlikService.inStoryMode();

				$scope.itemId = $scope.layout.qInfo.qId + '-' + $scope.item.cId;
				$scope.utilService = utilService;
				$scope.evaluateStates = $scope.layout.qInfo.qType !== 'embeddedsnapshot'; // do not evaluate button states for snapshots

				$scope.handleDropdown = handleDropdown;
				$scope.closeDropdown = closeDropdown;
				$scope.handleButtonStates = handleButtonStates;

				function handleDropdown(item, firstItem) {
					if (!qlikService.inEditMode()) {

						utilService.closeMenus($scope.listitems, $scope.item.cId);

						item.show = !item.show;

						if ($scope.layout.appearance.orientation === 'btn-inline' && utilService.screenWidth > 767) {
							$element.find('#panel_' + $scope.itemId).width($element.find('#hico-item-horizontal_' + $scope.itemId)[0].clientWidth);

							if (item.show) {
								$element.parents("article").css("z-index", 2);
							}
						}

						if ($scope.layout.appearance.orientation === 'btn-block' && !firstItem) {
							// handle scrolling when not the first item and menu is in vertical orientation
							$scope.utilService.handleMenuScroll($scope.itemId);
						}
					}
				}

				function closeDropdown(item) {
					item.show = false;
				}

				/**
     * Assigns updated button states to the extensions layout (required for snapshots)
     * @param {Object} activeStates
     * @param {Object} currDropdownItem
     * @param {number} itemindex
     */
				function handleButtonStates(activeStates, currDropdownItem, itemindex) {
					if (isStoryMode) {
						return; // do nothing in story mode
					}

					currDropdownItem.activeStates = activeStates;
					($scope.item.dropdownItems || []).some(function (dropdownItem, index) {
						if (dropdownItem === currDropdownItem) {
							$scope.layout.listItems[itemindex].dropdownItems[index].activeStates = dropdownItem.activeStates;
							return true;
						}
					});
				}
			}]
		};
	}]);
});