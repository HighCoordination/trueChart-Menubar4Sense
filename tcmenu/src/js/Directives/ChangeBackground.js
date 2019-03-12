import * as qvangular from 'qvangular';

new function(){

	return qvangular.directive('changeBackground',[function(){
		return {
			restrict: 'A',
			scope: {
				item: '<',
				issubitem: '<',
				colors: '<'
			},
			link: function($scope, element){
				element.on('mouseenter', function(){
					if(($scope.item.type === 'Button Container' || $scope.item.type === 'Button') && element.find('.no-action-button').length > 0){
						return; // don't change background colors (no hover effect) of buttons without actions
					}
					if(!$scope.item.show && !$scope.item.isActive && $scope.colors){
						if($scope.issubitem){
							element.css('background-color', $scope.colors.hoverSubItemColor);
							element.css('color', $scope.colors.textHoverSubColor);
						}else{
							element.css('background-color', $scope.colors.hoverActiveColor);
							element.css('color', $scope.colors.textHoverColor);
						}

					}
				});
				element.on('mouseleave', function(){
					if(!$scope.item.show && !$scope.item.isActive && $scope.colors){
						if($scope.issubitem){
							element.css('background-color', 'rgba(1,1,1,0)');
							element.css('color', $scope.colors.textSubColor);
						}else{
							element.css('background-color', 'rgba(1,1,1,0)');
							element.css('color', $scope.colors.textColor);
						}
					}
				});
			}
		};
	}]);
};