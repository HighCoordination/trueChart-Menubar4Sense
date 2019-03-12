import * as qlik from 'qlik';
import * as qvangular from 'qvangular';
import * as template from '../../templates/variableDropdown.html';
import {UtilService} from '../Services/UtilService';
import {$timeout} from '../Services/AngularService';
import {ContentManager} from '../Components/Managers/ContentManager';
import {updateColors} from '../Components/Common/BaseComponent';

new function(){

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

					const uniqueID = utilService.generateGuid();
					let _colors = '';

					$scope.$watch('item.cId', function() {
						$scope.itemId = $scope.layout.qInfo.qId + '-' + $scope.item.cId;
					});

					function update(){
						updateColors($scope, $element, _colors).then((colors) => _colors = colors);
					}

					this.$onDestroy = function(){
						ContentManager.unregisterComponent(uniqueID);

						const panel = document.getElementById('panel_' + $scope.itemId);
						panel && panel.parentElement.removeChild(panel);
					};

					this.$onInit = function(){
						ContentManager.registerComponent(uniqueID, {update});

						update();
					};

					$scope.handleDropdown = function(item){
						if(qlik.navigation.getMode() !== "edit"){

							utilService.closeMenus($scope.listitems, $scope.item.cId);

							item.show = !item.show;
							$scope.parentscope.menuOpen = true;

							if($scope.appearance.orientation === 'btn-inline' && !utilService.isMobileView && !$scope.groupitem){
								const panel = document.getElementById('panel_' + $scope.itemId);
								UtilService.repositionDropdown($scope, $element, panel, item.show);
							}

							if( $scope.appearance.orientation === 'btn-block' )
								$scope.utilService.handleMenuScroll($scope.itemId);

						}
					};

					$scope.closeDropdown = function(item){
						$scope.dropdownTimeout = $timeout(() =>{
							item.show = false;
							$scope.parentscope.menuOpen = false;
						}, 500);
					};

					$scope.keepDropdown = function(){
						$timeout.cancel($scope.dropdownTimeout);
					};

					$scope.handleAction = function(item){
						qlik.currApp().variable.setStringValue($scope.item.props.variableName, item.props.variableValue);
					};
				}]
			}
		}
	]);
};