import * as qvangular from 'qvangular';
import * as template from '../../templates/group.html';
import {QlikService} from '@highcoordination/common-sense';
import {UtilService} from '../Services/UtilService';
import {$timeout} from '../Services/AngularService';
import {ContentManager} from '../Components/Managers/ContentManager';
import {updateColors} from '../Components/Common/BaseComponent';

function Group(utilService){
	return {
		restrict: 'E',
		scope: {
			item: '=',
			firstItem: '<',
			itemindex: '<',
			listitems: '<',
			parentscope: '=',
		},
		replace: true,
		template: template,
		controller: ['$scope', '$element', function($scope, $element){
			let qlikService = QlikService.getInstance();
			$scope.layout = $scope.parentscope.layout;
			$scope.colors = $scope.parentscope.colors;

			$scope.itemId = $scope.layout.qInfo.qId + '-' + $scope.item.cId;
			$scope.utilService = utilService;
			// do not evaluate button states for snapshots
			$scope.evaluateStates = $scope.layout.qInfo.qType !== 'embeddedsnapshot' && !qlikService.isPrinting();

			$scope.$watch('item.cId', function() {
				$scope.itemId = $scope.layout.qInfo.qId + '-' + $scope.item.cId;
			});

			const uniqueID = utilService.generateGuid();
			let _colors = {};

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

			$scope.handleDropdown = handleDropdown;

			let watchers = [
				'item.show',
				'colors.textColor',
				'colors.textHoverColor',
				'colors.hoverActiveColor',
				'item.props.isCustomSize',
				'item.props.height',
				'layout.appearance.orientation'
			];

			let unwatch = $scope.$watchGroup(watchers, function(newValue, oldValue, scope){
				const item = scope.item,
					colors = scope.colors,
					show = newValue[0],
					isCustomSize = item.props.isCustomSize,
					orientation = scope.layout.appearance.orientation === 'btn-inline';

				scope.groupBtnStyle = {
					'background-color': show ? colors.hoverActiveColor : 'rgba(1,1,1,0)',
					'color': show ? colors.textHoverColor : colors.textColor,
					'height':  orientation && !utilService.isMobileView ? '100%' : (isCustomSize ? item.props.height : 56) + 'px'
				};
			});

			$element.on('$destroy', function(){
				unwatch();
			});


			function handleDropdown(item, firstItem){
				if(!qlikService.inEditMode()){

					utilService.closeMenus($scope.listitems, $scope.item.cId);
					utilService.closeMenus($scope.item.groupItems, $scope.item.cId);

					item.show = !item.show;
					$scope.parentscope.menuOpen = true;

					if($scope.layout.appearance.orientation === 'btn-inline' && !utilService.isMobileView){
						const panel = document.getElementById('panel_' + $scope.itemId);
						UtilService.repositionDropdown($scope, $element, panel, item.show);
					}

					if($scope.layout.appearance.orientation === 'btn-block' && !firstItem){
						// handle scrolling when not the first item and menu is in vertical orientation
						$scope.utilService.handleMenuScroll($scope.itemId);
					}
				}
			}

			$scope.closeDropdown = function(item){
				$scope.dropdownTimeout = $timeout(() =>{
					item.show = false;
					$scope.parentscope.menuOpen = false;
				}, 500);

			};

			$scope.keepDropdown = function(){
				$timeout.cancel($scope.dropdownTimeout);
			};
		}]
	}
}

qvangular.directive('group', ['utilService', Group]);