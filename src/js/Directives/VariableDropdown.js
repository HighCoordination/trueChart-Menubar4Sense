import {UtilService} from '../Services/UtilService';

define(['jquery', 'qlik', 'qvangular', '../../templates/variableDropdown.html'], function($, qlik, qvangular, template){

	return qvangular.directive('variabledropdown', [
		'utilService', function(utilService){
			return {
				restrict: 'E',
				scope: {
					item: '<',
					itemindex: '<',
					listitems: '<',
					groupitem: '<',
					parentscope: '=',
				},
				replace: true,
				template: template,
				controller: ['$scope', '$element', function($scope, $element){
					$scope.layout = $scope.parentscope.layout;
					$scope.colors = $scope.parentscope.colors;
					$scope.itemId = $scope.layout.qInfo.qId + '-' + $scope.item.cId;
					$scope.utilService = utilService;

					$scope.appearance = $scope.layout.appearance;

					$scope.$watch('item.cId', function() {
						$scope.itemId = $scope.layout.qInfo.qId + '-' + $scope.item.cId;
					});

					$scope.handleDropdown = function(item){
						if(qlik.navigation.getMode() !== "edit"){

							utilService.closeMenus($scope.listitems, $scope.item.cId);

							item.show = !item.show;
							$scope.parentscope.menuOpen = true;

							if($scope.appearance.orientation === 'btn-inline' && $scope.utilService.screenWidth > 767 && !$scope.groupitem){
								const panel = $element.find('#panel_' + $scope.itemId);
								UtilService.setPanelOffsets($scope, $element, panel);

								panel.width($element[0].clientWidth);

								if(item.show){
									$element.parents("article").css("z-index", 2);
								}
							}

							if( $scope.appearance.orientation === 'btn-block' )
								$scope.utilService.handleMenuScroll($scope.itemId);

						}
					};

					$scope.closeDropdown = function(item){
						item.show = false;
						$scope.parentscope.menuOpen = false;
					};

					$scope.handleAction = function(item){
						qlik.currApp().variable.setContent($scope.item.props.variableName, item.props.variableValue);
					};
				}]
			}
		}
	]);
});