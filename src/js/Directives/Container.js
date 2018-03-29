import {QlikService} from '../../lib/hico/services/qlik-service';

define([
	'qvangular',
	'../../templates/container.html'
], function(qvangular, template){

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
				controller: ['$scope', function($scope){
					$scope.layout = $scope.parentscope.layout;
					$scope.colors = $scope.parentscope.colors;
					$scope.utilService = utilService;
					// do not evaluate button states for snapshots
					$scope.evaluateStates = $scope.parentscope.evaluateStates;
					$scope.handleButtonStates = handleButtonStates;


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
});