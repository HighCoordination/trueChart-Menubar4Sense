import * as qvangular from 'qvangular';
import * as template from '../../templates/container.html';
import {updateColors} from '../Components/Common/BaseComponent';
import {ContentManager} from '../Components/Managers/ContentManager';

new function(){

	return qvangular.directive('containerelement', [
		'utilService', function(utilService){
			return {
				restrict: 'E',
				scope: {
					item: '<',
					itemindex: '<',
					subitemindex: '<',
					groupitem: '<',
					parentscope: '<',
				},
				replace: true,
				template: template,
				controller: ['$scope', '$element', function($scope, $element){
					$scope.layout = $scope.parentscope.layout;
					$scope.colors = $scope.parentscope.colors;
					$scope.utilService = utilService;
					// do not evaluate button states for snapshots
					$scope.evaluateStates = $scope.parentscope.evaluateStates;
					$scope.handleButtonStates = handleButtonStates;

					const uniqueID = utilService.generateGuid();
					let _colors = '';

					function update(){
						updateColors($scope, $element, _colors).then((colors) => _colors = colors);
					}

					this.$onInit = function(){
						ContentManager.registerComponent(uniqueID, {update});
					};

					this.$onDestroy = function(){
						ContentManager.unregisterComponent(uniqueID);
					};

					/**
					 * Assigns updated button states to the extensions layout (required for snapshots)
					 * @param {Object} activeStates
					 * @param {Object} currSubItem
					 * @param {number} itemindex
					 */
					function handleButtonStates(activeStates, currSubItem, itemindex){
						if(!$scope.evaluateStates){
							return; // do nothing in story mode
						}

						const listItem = $scope.layout.listItems[itemindex];

						currSubItem.activeStates = activeStates;
						($scope.item.subItems || []).some(function(subItem, index){
							if(subItem === currSubItem && listItem){
								if(typeof $scope.subitemindex !== 'undefined' && listItem.groupItems && listItem.groupItems[$scope.subitemindex] && listItem.groupItems[$scope.subitemindex].subItems[index]){
									listItem.groupItems[$scope.subitemindex].subItems[index].activeStates = subItem.activeStates;
								}else if(listItem.subItems && listItem.subItems[index]){
									listItem.subItems[index].activeStates = subItem.activeStates;
								}
								return true;
							}
						});
					}
				}]
			}
		}
	]);
};