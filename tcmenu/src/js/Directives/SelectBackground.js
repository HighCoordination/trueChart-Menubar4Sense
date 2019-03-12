import * as qvangular from 'qvangular';

new function(){

	return qvangular.directive('selectBackground',[function(){
		return {
			restrict: 'A',
			scope: {
				layout: '<',
				state: '<'
			},
			link: function($scope, element){
				const appearance = $scope.layout.appearance;
					switch($scope.state){
						case 'S':
							element.css('background-color', appearance.selectionSelected);
							element.css('border-top', '1px solid ' + appearance.selectionSelectedBorder);
							element.css('color', appearance.selectionSelectedText);
							break;
						case 'A':
							element.css('background-color', appearance.selectionAlternative);
							element.css('border-top', '1px solid ' + appearance.selectionAlternativBorder);
							element.css('color', appearance.selectionAlternativeText);
							break;
						case 'O':
							element.css('background-color', appearance.selectionNormal);
							element.css('border-top', '1px solid ' + appearance.selectionNormalBorder);
							element.css('color', appearance.selectionNormalText);
							break;
						case 'X':
							element.css('background-color', appearance.selectionExcluded);
							element.css('border-top', '1px solid ' + appearance.selectionExcludedBorder);
							element.css('color', appearance.selectionExcludedText);
							break;
						case 'XS':
							element.css('background-color', appearance.selectionExcluded);
							element.css('border-top', '1px solid ' + appearance.selectionExcludedBorder);
							element.css('color', appearance.selectionExcludedText);
							break;
					}
			}
		};
	}]);
};