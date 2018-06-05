import {QlikService} from '../../lib/hico/services/qlik-service';
import {UtilService} from '../Services/UtilService';
import {$timeout} from '../Services/AngularService';

const qlikService = QlikService.getInstance();

define([
	'jquery', 'qlik', 'qvangular', '../../templates/senseSelect.html'
], function($, qlik, qvangular, template){

	qvangular.directive('senseselect', ['utilService', SenseSelect]);

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
				'$scope', '$element', '$window', function($scope, $element, $window){
					$scope.layout = $scope.parentscope.layout;
					$scope.colors = $scope.parentscope.colors;
					$scope.itemId = $scope.layout.qInfo.qId + '-' + $scope.item.cId;
					$scope.listBox = undefined;
					let watchers = [];

					$scope.$watch('item.cId', function() {
						$scope.itemId = $scope.layout.qInfo.qId + '-' + $scope.item.cId;
					});

					watchers.push($scope.$on('leaveEditMode', () => destroyListObject($scope)));

					$element.on('$destroy', () => onDestroy($scope));

					$scope.utilService = utilService;

					if(QlikService.isPrinting()){
						$scope.item.show = $scope.item.isOpen = false;
					}

					$scope.openSenseSelect = function(item){
						if(qlik.navigation.getMode() !== "edit"){

							utilService.closeMenus($scope.listitems, $scope.item.cId);

							item.show = !item.show;
							item.isOpen = !item.isOpen;
							$scope.parentscope.menuOpen = true;

							$scope.layout.isOpen = item.show;

							if($scope.layout.appearance.orientation === 'btn-inline' && $scope.utilService.screenWidth > 767 && !$scope.groupitem){
								UtilService.setPanelOffsets($scope, $element, $element.find('#panel_container_' + $scope.itemId));

								$element.find('#panel_' + $scope.itemId).width($element[0].clientWidth);

								if(item.show){
									$element.parents("article").css("z-index", 2);
								}
							}

							if($scope.listBox){
								$scope.listBox.show($element.find('#QV05_' + $scope.itemId)[0]);
							}else{
								$scope.createSenseSelect(item);
							}

							$scope.utilService.handleMenuScroll($scope.itemId);
						}
					};

					$scope.closeDropdown = function(item){
						item.show = false;
						item.isOpen = false;
						$scope.parentscope.menuOpen = false;
						qvangular.$rootScope.tcmenuNoScroll = true;
					};

					$scope.createSenseSelect = function(item){
						if(item.isOpen){
							item.isOpen = false;

							if(item.props.dimId){

								let listObj = $scope.parentscope._listObjects[item.props.dimId];
								let listObjDef = listObj.layout.listDef;
								let listObjLibId = listObj.layout.listLibId;
								let listObjListDef = listObjLibId ? [] : listObj.layout.listDef.qFieldDefs;

								qlikService.createVisualization('listbox', listObjListDef, {
									"qListObjectDef": {
										"qLibraryId": listObjLibId,
										"qDef": listObjDef
									}
								}).then(function(visual){
									$scope.listBox = visual;
									visual.show($element.find('#QV05_' + $scope.itemId)[0]);
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

					watchers.push($scope.$watch(function(){ return $element.find('.qv-selection-toolbar').is(':visible') }, function(newValue, oldValue){
						if($scope.listBox){
							if(newValue){
								$element.find('#panel_' + $scope.itemId)[0].style.height = 244 + 'px';
								$element.find('#QV05_' + $scope.itemId)[0].firstChild.style.top = 44 + 'px';

								if($scope.layout.appearance.orientation === 'btn-inline' && $scope.utilService.screenWidth > 767 && !$scope.groupitem){
									UtilService.setPanelOffsets($scope, $element, $element.find('#panel_container_' + $scope.itemId));
								}


								$scope.utilService.handleMenuScroll($scope.itemId);
							}else{
								$element.find('#panel_' + $scope.itemId)[0].style.height = 200 + 'px';
								$element.find('#QV05_' + $scope.itemId)[0].firstChild.style.top = 0 + 'px';

								if($scope.layout.appearance.orientation === 'btn-inline' && $scope.utilService.screenWidth > 767 && !$scope.groupitem){
									UtilService.setPanelOffsets($scope, $element, $element.find('#panel_container_' + $scope.itemId));
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
});