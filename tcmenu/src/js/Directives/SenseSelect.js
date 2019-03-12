import * as qvangular from 'qvangular';
import * as template from '../../templates/senseSelect.html';
import {QlikService} from '@highcoordination/common-sense';
import {UtilService} from '../Services/UtilService';
import {$timeout} from '../Services/AngularService';
import {ContentManager} from '../Components/Managers/ContentManager';
import {updateColors} from '../Components/Common/BaseComponent';

new function(){
	const qlikService = QlikService.getInstance();

	return qvangular.directive('senseselect', ['utilService', SenseSelect]);

	function SenseSelect(utilService){
		return {
			restrict: 'E',
			scope: {
				item: '=',
				listitems: '<',
				parentscope: '=',
				groupitem: '<',
			},
			replace: true,
			template: template,
			controller: [
				'$scope', '$element', '$window', '$document', function($scope, $element, $window, $document){
					$scope.layout = $scope.parentscope.layout;
					$scope.colors = $scope.parentscope.colors;
					$scope.itemId = $scope.layout.qInfo.qId + '-' + $scope.item.cId;
					$scope.listBox = undefined;
					let watchers = [];
					const uniqueID = utilService.generateGuid();

					$scope.$watch('item.cId', function() {
						$scope.itemId = $scope.layout.qInfo.qId + '-' + $scope.item.cId;
					});

					watchers.push($scope.$on('leaveEditMode', () => destroyListObject($scope)));

					$element.on('$destroy', () => onDestroy($scope));

					$scope.utilService = utilService;

					if(QlikService.isPrinting()){
						$scope.item.show = $scope.item.isOpen = false;
					}

					let _colors = '';

					function update(){
						updateColors($scope, $element, _colors).then((colors) => _colors = colors);
					}

					this.$onInit = function(){
						ContentManager.registerComponent(uniqueID, {update});

						update();
					};

					this.$onDestroy = function(){
						ContentManager.unregisterComponent(uniqueID);

						const panel = document.getElementById('panel_container_' + $scope.itemId);
						panel && panel.parentElement.removeChild(panel);
					};

					$scope.openSenseSelect = function(item){
						if(!qlikService.inEditMode()){

							utilService.closeMenus($scope.listitems, $scope.item.cId);

							item.show = !item.show;
							item.isOpen = !item.isOpen;
							$scope.parentscope.menuOpen = true;

							$scope.layout.isOpen = item.show;

							if($scope.layout.appearance.orientation === 'btn-inline' && !utilService.isMobileView && !$scope.groupitem){
								const panel = document.getElementById('panel_container_' + $scope.itemId);
								UtilService.repositionDropdown($scope, $element, panel, item.show);
							}

							if($scope.listBox){
								$scope.listBox.show(document.getElementById('QV05_' + $scope.itemId));
							}else{
								$scope.createSenseSelect(item);
							}

							$scope.utilService.handleMenuScroll($scope.itemId);
						}
					};

					$scope.closeDropdown = function(item){
						$scope.dropdownTimeout = $timeout(() =>{
							item.show = false;
							item.isOpen = false;
							$scope.parentscope.menuOpen = false;
							qvangular.$rootScope.tcmenuNoScroll = true;
						}, 500);
					};

					$scope.keepDropdown = function(){
						$timeout.cancel($scope.dropdownTimeout);
						$timeout(function(){
							if(!qvangular.$rootScope.tcmenuIsDrag){
								qvangular.$rootScope.tcmenuNoScroll = false;
							}
						});
					};

					$scope.createSenseSelect = function(item){
						if(item.isOpen){
							item.isOpen = false;

							if(item.props.dimId){

								let listObj = $scope.parentscope._listObjects[item.props.dimId];
								let listObjDef = listObj.layout.listDef;
								let listObjLibId = listObj.layout.listLibId;
								let listObjListDef = listObjLibId ? [] : listObj.layout.listDef.qFieldDefs;

								listObjDef && listObjDef.autoSort && listObjDef.qSortCriterias.forEach((criteria) =>{
									criteria.qSortByState = 1;
								});

								qlikService.createVisualization('listbox', listObjListDef, {
									title: ' ', // set title to make sure the search "magnifier" is always visible
									"qListObjectDef": {
										"qLibraryId": listObjLibId,
										"qStateName": listObjDef && listObjDef.tcmStateName,
										"qDef": listObjDef
									}
								}).then(function(visual){
									$scope.listBox = visual;
									visual.show(document.getElementById('QV05_' + $scope.itemId));
									$scope.dimensionInfo = visual.model.layout.qListObject.qDimensionInfo;
								});
							}else{
								console.warn("No Dimension Selected");
							}
						}
					};

					$scope.mouseOver = function(){
						$timeout(function(){
							if(!qvangular.$rootScope.tcmenuIsDrag){
								qvangular.$rootScope.tcmenuNoScroll = false;
							}
						});

						return false;
					};

					$scope.mouseLeave = function(){
						$timeout(function(){
							qvangular.$rootScope.tcmenuNoScroll = true;
						});

						return false;
					};

					$scope.drillUp = function(index){
						if(typeof index !== 'undefined'){
							index = $scope.fields.length - index;
							$scope.parentscope._listObjects[$scope.item.props.dimId].drillUp('/qListObjectDef',0,index);
						}else{
							$scope.parentscope._listObjects[$scope.item.props.dimId].drillUp('/qListObjectDef',0,1);
						}

						$window.removeEventListener('click', clickevent);
						$scope.showDimPopover = false;
					};

					$scope.showDrilldownDims = function(){
						let dimInfo = $scope.dimensionInfo;
						$scope.fields = dimInfo.qGroupFieldDefs.slice(0, dimInfo.qGroupPos);

						if(!$scope.showDimPopover && $scope.fields.length > 0){
							$window.addEventListener('click', clickevent);
						}
					};

					watchers.push($scope.$watch(function(){ return $document.find('#panel_container_' + $scope.itemId).find('.qv-selection-toolbar').is(':visible') }, function(newValue, oldValue){
						if($scope.listBox){
							if(newValue){
								document.getElementById('panel_' + $scope.itemId).style.height = 244 + 'px';
								document.getElementById('QV05_' + $scope.itemId).children[0].style.top = 44 + 'px';

								if($scope.layout.appearance.orientation === 'btn-inline' && !utilService.isMobileView && !$scope.groupitem){
									UtilService.setPanelOffsets($scope, $element, document.getElementById('panel_container_' + $scope.itemId));
								}


								$scope.utilService.handleMenuScroll($scope.itemId);
							}else{
								document.getElementById('panel_' + $scope.itemId).style.height = 200 + 'px';
								document.getElementById('QV05_' + $scope.itemId).children[0].style.top = 0 + 'px';

								if($scope.layout.appearance.orientation === 'btn-inline' && !utilService.isMobileView && !$scope.groupitem){
									UtilService.setPanelOffsets($scope, $element, document.getElementById('panel_container_' + $scope.itemId));
								}
							}
						}
					}));

					function onDestroy($scope){
						destroyListObject($scope);
						// unwatch watchers
						watchers.forEach(function(unwatch){
							unwatch();
						});
					}

					function destroyListObject($scope){
						if($scope.listBox){
							const id = $scope.listBox.id;
							$timeout(() => qlikService.destroySessionObject(id));
							delete $scope.listBox;
						}
						$scope.item.show = $scope.item.isOpen = false;
					}

					function clickevent(e){
						e.stopPropagation();
						let target = $(e.target);
						if($scope.showDimPopover && !target.hasClass('hico-popover-evt')){
							$window.removeEventListener('click', clickevent);
							$scope.$apply(()=> $scope.showDimPopover = false);
						}else if(!$scope.showDimPopover){
							$scope.showDimPopover = true;
							$scope.$apply();
						}
					}
				}
			]
		}
	}
};