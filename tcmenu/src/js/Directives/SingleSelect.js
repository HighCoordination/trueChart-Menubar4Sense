import * as qvangular from 'qvangular';
import * as template from '../../templates/singleSelect.html';
import {Logger} from '../../classes/utils/Logger';
import {QlikService} from '@highcoordination/common-sense';
import {ListItem} from '../../classes/ListItem';
import {UtilService} from '../Services/UtilService';
import {$timeout} from '../Services/AngularService';
import {ContentManager} from '../Components/Managers/ContentManager';
import {updateColors} from '../Components/Common/BaseComponent';

new function(){

	const qlikService = QlikService.getInstance();

	return qvangular.directive('singleselect', [
		'utilService', function(utilService){
			return {
				restrict: 'E',
				scope: {
					item: '=',
					type: '<',
					listitems: '=',
					multiid: '<',
					parentscope: '=',
					groupitem: '<',
				},
				replace: true,
				template: template,
				controller: ['$scope', '$element', function($scope, $element){
					$scope.layout = $scope.parentscope.layout;
					$scope.itemId = $scope.layout.qInfo.qId + '-' + $scope.item.cId;
					$scope.utilService = utilService;
					$scope.activeItem = null;
					$scope.showDimPopover = false;

					const uniqueID = utilService.generateGuid();
					let _colors = '';

					$scope.$watch('item.cId', function() {
						$scope.itemId = $scope.layout.qInfo.qId + '-' + $scope.item.cId;
					});

					function update(){
						updateColors($scope, $element, _colors).then((colors) => _colors = colors);
					}

					this.$onInit = function(){
						let parentScope = $scope.parentscope,
							listObject = parentScope._listObjects[$scope.item.dimId];

						ContentManager.registerComponent(uniqueID, {update});

						update();

						if(!listObject || !listObject.layout){
							return;
						}
						const defaultSelection = ListItem.getDefaultSelection($scope.layout.listItems, $scope.item.dimId, false, listObject.layout.qListObject);
						defaultSelection !== null && parentScope.addSelection(listObject, defaultSelection, false, false);
					};

					this.$onDestroy = function(){
						ContentManager.unregisterComponent(uniqueID);

						const panel = document.getElementById('panel_container_' + $scope.itemId);
						panel && panel.parentElement.removeChild(panel);
					};

					$scope.openSelect = function(item){
						if(!qlikService.inEditMode()){
							if(!item.show){
								utilService.closeMenus($scope.listitems, $scope.item.cId);

								$scope.parentscope.menuOpen = true;
								item.show = !item.show;
								item.alignement = utilService.checkNumeric(item);

								if($scope.layout.appearance.orientation==='btn-inline' && !utilService.isMobileView && !$scope.groupitem){
									const panel = document.getElementById('panel_container_' + $scope.itemId);
									UtilService.repositionDropdown($scope, $element, panel, item.show);
								}

								utilService.handleMenuScroll($scope.itemId);
							}else{
								$scope.parentscope.menuOpen = false;
								item.show = !item.show;
							}

							let offset = 0;
							let hasSelect = false;

							$scope.item.selectValues && $scope.item.selectValues.qDataPages[0].qMatrix.some(function(matrixItem){
								if(matrixItem[0].qState === 'S'){
									hasSelect = true;
									return true;
								}
								offset += 31;
							});


							if(!hasSelect){
								offset = 0;
							}

							$timeout(function() {
								$element.find("#panel_" + $scope.itemId).scrollTop(offset);
							});

						}
					};

					$scope.checkNumeric = function(){
						let isNumeric = true;
						if(!$scope.item.selectValues){
							return false;
						}
						let qMatrix = $scope.item.selectValues.qDataPages[0].qMatrix;

						for(let i = 0; i <  qMatrix.length && i < 5 && isNumeric; i++){

							if(  qMatrix[i][0].qText){
								isNumeric =  qMatrix[i][0].qText.match(/^[0-9\.\-\/:\ \,]+$/g) !== null;
							}
						}
						return isNumeric;
					};

					$scope.closeDropdown = function(item){
						$scope.dropdownTimeout = $timeout(() =>{
							item.show = false;
							$scope.parentscope.menuOpen = false;
							$scope.selectValues = null;
							window.removeEventListener('click', clickevent);
							$scope.showDimPopover = false;
						}, 500);
					};

					$scope.keepDropdown = function(){
						$timeout.cancel($scope.dropdownTimeout);
					};

					$scope.handleSelect = function(item){
						let alwaysSelect = $scope.item.props.alwaysSelectValue,
							dimensionInfo = $scope.item.selectValues.qDimensionInfo,
							deselect = $scope.item.props.allowDeselect && item[0].qState === 'S',
							selected = dimensionInfo.qStateCounts.qSelected;

						if(deselect || !alwaysSelect || (item[0].qState === 'S' && selected > 1 || item[0].qState !== 'S')){
							let parentScope = $scope.parentscope,
								listObject = parentScope._listObjects[$scope.item.dimId];

							listObject
								? parentScope.applySelection(listObject, item[0].qElemNumber, true, undefined, deselect)
								: Logger.warn('No listObject found with dimId', $scope.item.dimId);
						}
					};

					$scope.drillUp = function(index){
						if(typeof index !== 'undefined'){
							index = $scope.fields.length - index;
							$scope.parentscope._listObjects[$scope.item.props.dimId].drillUp('/qListObjectDef',0,index);
						}else{
							$scope.parentscope._listObjects[$scope.item.props.dimId].drillUp('/qListObjectDef',0,1);
						}

						window.removeEventListener('click', clickevent);
						$scope.showDimPopover = false;
					};

					$scope.showDrilldownDims = function(){
						let dimInfo = $scope.parentscope._listObjects[$scope.item.props.dimId].layout.qListObject.qDimensionInfo;
						$scope.fields = dimInfo.qGroupFieldDefs.slice(0, dimInfo.qGroupPos);

						if(!$scope.showDimPopover && $scope.fields.length > 0){
							window.addEventListener('click', clickevent);
						}
					};

					function clickevent(e){
						e.stopPropagation();
						let target = $(e.target);
						if($scope.showDimPopover && !target.hasClass('hico-popover-evt')){
							window.removeEventListener('click', clickevent);
							$scope.$apply(()=> $scope.showDimPopover = false);
						}else if(!$scope.showDimPopover){
							$scope.showDimPopover = true;
							$scope.$apply();
						}
					}
				}]
			}
		}
	]);
};