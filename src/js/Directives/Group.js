import * as qvangular from 'qvangular';
import * as template from '../../templates/group.html';
import {QlikService} from '../../lib/hico/services/qlik-service';

function Group(utilService){
	return {
		restrict: 'E',
		scope: {
			item: '=',
			firstItem: '<',
			itemindex: '<',
			listitems: '<',
			parentscope: '<',
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
			$scope.panelDropdownOffset = 0;

			$scope.$watch('item.cId', function() {
				$scope.itemId = $scope.layout.qInfo.qId + '-' + $scope.item.cId;
			});

			$scope.handleDropdown = handleDropdown;
			$scope.closeDropdown = closeDropdown;

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
					'height':  orientation ? '100%' : (isCustomSize ? item.props.height : 56) + 'px'
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

					if($scope.layout.appearance.orientation === 'btn-inline' && utilService.screenWidth > 767){
						$scope.panelDropdownOffset = utilService.getDropdownOffset($element);
						$element.find('#panel_' + $scope.itemId).width($element[0].clientWidth);

						if(item.show){
							$element.parents("article").css("z-index", 2);
						}
					}

					if($scope.layout.appearance.orientation === 'btn-block' && !firstItem){
						// handle scrolling when not the first item and menu is in vertical orientation
						$scope.utilService.handleMenuScroll($scope.itemId);
					}
				}
			}

			function closeDropdown(item){
				item.show = false;
			}
		}]
	}
}

qvangular.directive('group', ['utilService', Group]);