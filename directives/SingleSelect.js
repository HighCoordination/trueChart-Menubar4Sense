define(['jquery', 'qlik', 'qvangular', 'text!../templates/singleSelect.html', 'ng!$timeout', '../lib/hico/prefix', '../lib/hico/services/qlik-service'], function ($, qlik, qvangular, template, $timeout, prefix) {

	return qvangular.directive('singleselect', ['utilService', function (utilService) {
		return {
			restrict: 'E',
			scope: {
				item: '=',
				layout: '<',
				type: '<',
				listitems: '=',
				multiid: '<',
				colors: '<'
			},
			replace: true,
			template: template,
			controller: ['$scope', '$element', prefix + 'QlikService', function ($scope, $element, qlikService) {
				$scope.itemId = $scope.layout.qInfo.qId + '-' + $scope.item.cId;
				$scope.utilService = utilService;
				$scope.activeItem = null;

				$scope.openSelect = function (item) {
					if (qlik.navigation.getMode() !== "edit") {
						if (!item.show) {
							utilService.closeMenus($scope.listitems, $scope.item.cId);

							item.show = !item.show;
							item.isOpen = !item.isOpen;
							item.alignement = utilService.checkNumeric(item);

							if ($scope.layout.appearance.orientation === 'btn-inline' && $scope.utilService.screenWidth > 767) {
								$element.find("#panel_" + $scope.itemId).width($element[0].clientWidth);

								if (item.show) {
									$element.parents("article").css("z-index", 2);
								}
							}

							$scope.utilService.handleMenuScroll($scope.itemId);
						} else {
							item.show = !item.show;
							item.isOpen = !item.isOpen;
						}

						var offset = 0;
						var hasSelect = false;

						$scope.item.selectValues && $scope.item.selectValues.qDataPages[0].qMatrix.some(function (matrixItem) {
							if (matrixItem[0].qState === 'S') {
								hasSelect = true;
								return true;
							}
							offset += 31;
						});

						if (!hasSelect) {
							offset = 0;
						}

						$timeout(function () {
							$element.find("#panel_" + $scope.itemId).scrollTop(offset);
						});
					}
				};

				$scope.checkNumeric = function () {
					var isNumeric = true;
					if (!$scope.item.selectValues) {
						return false;
					}
					var qMatrix = $scope.item.selectValues.qDataPages[0].qMatrix;

					for (var i = 0; i < qMatrix.length && i < 5 && isNumeric; i++) {

						if (qMatrix[i][0].qText) {
							isNumeric = qMatrix[i][0].qText.match(/^[0-9\.\-\/:\ \,]+$/g) !== null;
						}
					}
					return isNumeric;
				};

				$scope.closeDropdown = function (item) {
					if ($scope.type !== 'Multi Select') {
						item.show = false;
						item.isOpen = false;

						$scope.selectValues = null;
					}
				};

				$scope.handleSelect = function (item) {
					var alwaysSelect = $scope.item.props.alwaysSelectValue,
					    dimensionInfo = $scope.item.selectValues.qDimensionInfo,
					    selected = dimensionInfo.qStateCounts.qSelected;

					if (alwaysSelect) {
						if (item[0].qState === 'S' && selected > 1 || item[0].qState !== 'S') {
							qlikService.select(dimensionInfo.qFallbackTitle, [item[0].qElemNumber], false, false);
						}
					} else {
						qlikService.select(dimensionInfo.qFallbackTitle, [item[0].qElemNumber], false, false);
					}
				};
			}]
		};
	}]);
});