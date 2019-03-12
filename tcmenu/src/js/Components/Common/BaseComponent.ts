import {UtilService} from '../../Services/UtilService';
import {$timeout} from '../../Services/AngularService';

/**
 * Updates the colors and returns the current colors as a string (JSON)
 * @param $scope
 * @param $element
 * @param colors
 * @param type
 */
export function updateColors($scope: any, $element: JQuery, colors: string, type?: string): Promise<string>{
	return new Promise<string>((resolve) => {
		$timeout(() => {
			if($scope.item.props.colors && $scope.item.props.individualColor && JSON.stringify($scope.item.props.colors) !== colors){
				$scope.colors = UtilService.getColorsFromProps($scope.item.props.colors, type);
			}else{
				$scope.colors = $scope.parentscope.colors;
			}

			$element.css('background-color', $scope.colors.backgroundColor);
			$element.parent().css('border-bottom-color', $scope.colors.borderSeparatorColor);

			resolve(JSON.stringify($scope.colors));
		});
	});


}