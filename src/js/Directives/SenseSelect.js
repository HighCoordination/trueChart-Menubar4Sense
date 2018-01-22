import {prefix} from '../../lib/hico/prefix';

define([
	'jquery', 'qlik', 'qvangular', 'ng!$timeout', '../../templates/senseSelect.html'
], function($, qlik, qvangular, $timeout, template){

	qvangular.directive('senseselect', ['utilService', prefix + 'QlikService', SenseSelect]);

	function SenseSelect(utilService, qlikService){
		return {
			restrict: 'E',
			scope: {
				item: '=',
				layout: '<',
				listitems: '<',
				colors: '<',
				parentscope: '<',
			},
			replace: true,
			template: template,
			controller: [
				'$scope', '$element', '$window', function($scope, $element, $window){
					$scope.itemId = $scope.layout.qInfo.qId + '-' + $scope.item.cId;
					let watchers = [];

					$element.on('$destroy', onDestroy);

					$scope.utilService = utilService;

					if(qlikService.isPrinting()){
						$scope.item.show = $scope.item.isOpen = false;
					}

					$scope.openSenseSelect = function(item){
						if(qlik.navigation.getMode() !== "edit"){

							utilService.closeMenus($scope.listitems, $scope.item.cId);

							item.show = !item.show;
							item.isOpen = !item.isOpen;

							$scope.layout.isOpen = item.show;

							if($scope.layout.appearance.orientation === 'btn-inline' && $scope.utilService.screenWidth > 767){
								$element.find('#panel_' + $scope.itemId).width($element.find('#hico-item-horizontal_' + $scope.itemId)[0].clientWidth);

								if(item.show){
									$element.parents("article").css("z-index", 2);
								}
							}

							if(item.listBox){
								// item.listBox.resize(); not really required!? When used, repaint of all extensions was triggered
								item.listBox.show($element.find('#QV05_' + $scope.itemId)[0]);
							}else{
								$scope.createSenseSelect(item);
							}

							$scope.utilService.handleMenuScroll($scope.itemId);
						}
					};

					$scope.closeDropdown = function(item){
						item.show = false;
						item.isOpen = false;
						qvangular.$rootScope.tcmenuNoScroll = true;
					};

					$scope.createSenseSelect = function(item){
						if(item.isOpen){
							item.isOpen = false;

							if(item.props.dimId){

								let listObj = $scope.$parent._listObjects[item.props.dimId];
								let listObjDef = listObj.layout.listDef;
								let listObjLibId = listObj.layout.listLibId;
								let listObjListDef = listObjLibId ? [] : listObj.layout.listDef.qFieldDefs;

								qlik.currApp().visualization.create('listbox', listObjListDef, {
									"qInfo": {
										"qId": ($scope.layout.qExtendsId || $scope.layout.qInfo.qId) + '##' + item.cId + '##listBox'
									}, "qListObjectDef": {
										"qLibraryId": listObjLibId,
										"qDef": listObjDef
									}
								}).then(function(visual){
									item.listBox = visual;
									visual.show($element.find('#QV05_' + $scope.itemId)[0]);
									$scope.dimensionInfo = visual.model.layout.qListObject.qDimensionInfo;

									$scope.parentscope.removePropsForPrinting($scope.parentscope.layout.exportListItemsDub);
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
						if($scope.item.listBox){
							if(newValue){
								$element.find('#panel_' + $scope.itemId)[0].style.height = 244 + 'px';
								$element.find('#QV05_' + $scope.itemId)[0].firstChild.style.top = 44 + 'px';

								$scope.utilService.handleMenuScroll($scope.itemId);
							}else{
								$element.find('#panel_' + $scope.itemId)[0].style.height = 200 + 'px';
								$element.find('#QV05_' + $scope.itemId)[0].firstChild.style.top = 0 + 'px';
							}
						}
					}));

					function onDestroy(){
						// unwatch watchers
						watchers.forEach(function(unwatch){
							unwatch();
						});
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