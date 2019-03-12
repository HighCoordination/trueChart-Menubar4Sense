import * as qvangular from 'qvangular';
import * as template from '../../templates/fieldSlider.html';
import {UtilService} from "../Services/UtilService";
import {RangeSlider} from '../Components/RangeSlider/RangeSlider';
import {$timeout} from '../Services/AngularService';
import {Logger} from '../../classes/utils/Logger';
import {ContentManager} from '../Components/Managers/ContentManager';
import {updateColors} from '../Components/Common/BaseComponent';

new function(){

	return qvangular.directive('fieldslider', [
		'utilService', function(utilService){
			return {
				restrict: 'E',
				scope: {
					item: '<',
					itemindex: '<',
					groupitem: '<',
					parentscope: '<',
				},
				replace: true,
				template: template,
				controller: [
					'$scope', '$element', function($scope, $element){
						$scope.layout = $scope.parentscope.layout;
						$scope.colors = $scope.parentscope.colors;
						$scope.itemId = $scope.layout.qInfo.qId + '-' + $scope.item.cId;
						$scope.utilService = utilService;
						$scope.uniqueId = $scope.parentscope.uniqueId;

						const uniqueID = utilService.generateGuid();
						let watchers = [];
						let _colors = '';

						watchers.push($scope.$watch('item.props.selectedValue', () => {
							$scope.setupSlider();
						}));

						$element.on('$destroy', () => onDestroy());

						function update(){
							updateColors($scope, $element, _colors, 'slider').then((colors) => _colors = colors);
						}

						this.$onInit = function(){
							ContentManager.registerComponent(uniqueID, {update});

							update();
						};

						this.$onDestroy = function(){
							ContentManager.unregisterComponent(uniqueID);
						};

						$scope.setupSlider = function(){
							$timeout(() => {
								if(!$scope.item.selectValues){
									return;
								}

								const colors = $scope.colors,
									selectedValues = UtilService.getAllSelectedIndexes($scope.item.selectValues),
									type = $scope.item.props.fieldSlider.type;

								let defaultValue, trackStyle, handleStyle;

								if(selectedValues.length < 1){
									return;
								}

								if(type === 'single'){
									defaultValue = selectedValues[0];

									trackStyle = {background: colors.variableSliderBackground};
									handleStyle = {background: colors.variableSliderHandle, border: 0};
								}else if(type === 'range'){
									defaultValue = [selectedValues[0], selectedValues[selectedValues.length - 1]];

									trackStyle = [
										{background: colors.variableSliderTrack},
										{background: colors.variableSliderTrack}
									];
									handleStyle = [
										{background: colors.variableSliderHandle, border: 0},
										{background: colors.variableSliderHandle, border: 0}
									];
								}


								$scope.renderSlider(defaultValue, type, trackStyle, handleStyle);
							});
						};

						$scope.renderSlider = function(defaultValue, type, trackStyle, handleStyle){
							const sliderProps = $scope.item.props.fieldSlider,
								colors = $scope.colors,
								matrix = $scope.item.selectValues.qDataPages[0].qMatrix;

							if(matrix.length < 2){
								return;
							}

							let min = 0,
								max = matrix.length - 1,
								step = 1;

							RangeSlider.remove({
								container: $element.find('#slider_' + $scope.itemId)[0]
							});

							RangeSlider.show({
								container: $element.find('#slider_' + $scope.itemId)[0],
								type: type,
								valueType: 'string',
								min: min,
								max: max,
								showMinMAx: sliderProps.showMinMax,
								showValues: sliderProps.showValues,
								step: step,
								onAfterChange: $scope.onAfterChange,
								orientation: sliderProps.orientation,
								vertical: sliderProps.orientation === 'vertical',
								defaultValue: defaultValue,
								defaultValues: defaultValue,
								allowCross: true,
								strings: matrix.map((listObj, i) => ({value: i, label: listObj[0].qText || ''})),
								railStyle: {background: colors.variableSliderBackground},
								trackStyle: trackStyle,
								handleStyle: handleStyle,
								dotStyle: {background: colors.variableSliderSteps, border: 0},
								activeDotStyle: {
									background: type === 'single' ? colors.variableSliderSteps : colors.variableSliderActiveSteps,
									border: 0,
								},
							})
						};

						/**
						 * After Cchange callback
						 *
						 * @param {number|number[]} val - when single number when range number[] of start and end value
						 */
						$scope.onAfterChange = function(val){
							const parentScope = $scope.parentscope,
								values = [],
								listObject = parentScope._listObjects[$scope.item.dimId];

							if(Array.isArray(val)){

								for(let i = val[0]; i <= val[1]; i++){
									values.push($scope.item.selectValues.qDataPages[0].qMatrix[i][0].qElemNumber);
								}

							}else{
								values.push($scope.item.selectValues.qDataPages[0].qMatrix[val][0].qElemNumber);
							}

							listObject
								? parentScope.applySelection(listObject, values, true)
								: Logger.warn('No listObject found with dimId', $scope.item.dimId);

						};

						function onDestroy(){
							// unwatch watchers
							watchers.forEach(function(unwatch){
								unwatch();
							});
						}
					}
				]
			}
		}
	]);
};