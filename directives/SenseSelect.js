define(['jquery', 'qlik', 'qvangular', 'ng!$timeout', 'text!../templates/senseSelect.html'], function ($, qlik, qvangular, $timeout, template) {

	return qvangular.directive('senseselect', ['utilService', function (utilService) {
		return {
			restrict: 'E',
			scope: {
				item: '=',
				layout: '<',
				listitems: '<',
				colors: '<'
			},
			replace: true,
			template: template,
			controller: ['$scope', '$element', function ($scope, $element) {
				$scope.itemId = $scope.layout.qInfo.qId + '-' + $scope.item.cId;
				var watchers = [];

				$element.on('$destroy', onDestroy);

				$scope.utilService = utilService;

				$scope.openSenseSelect = function (item) {
					if (qlik.navigation.getMode() !== "edit") {

						utilService.closeMenus($scope.listitems, $scope.item.cId);

						item.show = !item.show;
						item.isOpen = !item.isOpen;

						$scope.layout.isOpen = item.show;

						if ($scope.layout.appearance.orientation === 'btn-inline' && $scope.utilService.screenWidth > 767) {
							$element.find('#panel_' + $scope.itemId).width($element.find('#hico-item-horizontal_' + $scope.itemId)[0].clientWidth);

							if (item.show) {
								$element.parents("article").css("z-index", 2);
							}
						}

						if (item.listBox) {
							// item.listBox.resize(); not really required!? When used, repaint of all extensions was triggered
							item.listBox.show($element.find('#QV05_' + $scope.itemId)[0]);
						} else {
							$scope.createSenseSelect(item);
						}

						$scope.utilService.handleMenuScroll($scope.itemId);
					}
				};

				$scope.closeDropdown = function (item) {
					item.show = false;
					item.isOpen = false;
					qvangular.$rootScope.tcmenuNoScroll = true;
				};

				$scope.createSenseSelect = function (item) {
					if (item.isOpen) {
						item.isOpen = false;
						var dim = undefined;

						$scope.layout.dimensions.some(function (dimension) {
							if (dimension.dim === item.props.dim) {
								dim = dimension;
								return true;
							}
						});

						if (dim) {
							if (!dim.customSortOrder) {
								if (!dim.qSortByStateCheck) {
									dim.sortByState = 0;
								}
								if (!dim.qSortByFrequencyCheck) {
									dim.sortByFrequency = 0;
								}
								if (!dim.qSortByNumericCheck) {
									dim.sortByNumeric = 0;
								}
								if (!dim.qSortByAsciiCheck) {
									dim.sortByAscii = 0;
								}
								if (!dim.sortByLoadOrderCheck) {
									dim.sortByLoadOrder = 0;
								}
								if (!dim.qSortByExpressionCheck) {
									dim.sortByExpression = 0;
								}
							} else {
								dim.sortByState = 1;
								dim.sortByFrequency = 0;
								dim.sortByNumeric = 0;
								dim.sortByAscii = 0;
								dim.sortByLoadOrder = 0;
								dim.sortByExpression = 0;
							}

							qlik.currApp().visualization.create('listbox', $scope.item.props.dim.split('~'), {
								"qInfo": {
									"qId": ($scope.layout.qExtendsId || $scope.layout.qInfo.qId) + '##' + item.cId + '##listBox'
								}, "qListObjectDef": {
									"qDef": {
										"qSortCriterias": [{
											"qSortByState": dim.sortByState,
											"qSortByFrequency": dim.sortByFrequency,
											"qSortByNumeric": dim.sortByNumeric,
											"qSortByAscii": dim.sortByAscii,
											"qSortByLoadOrder": dim.sortByLoadOrder,
											"qSortByExpression": dim.sortByExpression,
											"qExpression": {
												"qv": dim.sortExpression
											}
										}]
									}
								} }).then(function (visual) {
								item.listBox = visual;
								visual.show($element.find('#QV05_' + $scope.itemId)[0]);
							});
						} else {
							console.warn("No Dimension Selected");
						}
					}
				};

				$scope.mouseOver = function () {
					$timeout(function () {
						if (!qvangular.$rootScope.tcmenuIsDrag) {
							qvangular.$rootScope.tcmenuNoScroll = false;
						}
					});

					return false;
				};

				$scope.mouseLeave = function () {
					$timeout(function () {
						qvangular.$rootScope.tcmenuNoScroll = true;
					});

					return false;
				};

				watchers.push($scope.$watch(function () {
					return $element.find('.qv-selection-toolbar').is(':visible');
				}, function (newValue, oldValue) {
					if ($scope.item.listBox) {
						if (newValue) {
							$element.find('#panel_' + $scope.itemId)[0].style.height = 244 + 'px';
							$element.find('#QV05_' + $scope.itemId)[0].firstChild.style.top = 44 + 'px';

							$scope.utilService.handleMenuScroll($scope.itemId);
						} else {
							$element.find('#panel_' + $scope.itemId)[0].style.height = 200 + 'px';
							$element.find('#QV05_' + $scope.itemId)[0].firstChild.style.top = 0 + 'px';
						}
					}
				}));

				function onDestroy() {
					// unwatch watchers
					watchers.forEach(function (unwatch) {
						unwatch();
					});
				}
			}]
		};
	}]);
});