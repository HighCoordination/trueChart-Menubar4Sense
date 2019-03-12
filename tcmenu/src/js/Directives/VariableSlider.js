import * as qvangular from 'qvangular';
import * as template from '../../templates/variableSlider.html'
import {QlikService} from '@highcoordination/common-sense';
import {UtilService} from "../Services/UtilService";
import {RangeSlider} from '../Components/RangeSlider/RangeSlider';
import {$timeout} from '../Services/AngularService';
import {ContentManager} from '../Components/Managers/ContentManager';
import {updateColors} from '../Components/Common/BaseComponent';

new function(){
	const qlikService = QlikService.getInstance();

	return qvangular.directive('variableslider', [
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

						setDefaultVariableValues($scope);

						$element.on('$destroy', () => onDestroy());

						watchers.push($scope.$on('leaveEditMode', () => setDefaultVariableValues($scope)));

						$scope.$watch('item.cId', () =>{
							$scope.itemId = $scope.layout.qInfo.qId + '-' + $scope.item.cId;
						});

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

						$scope.$watchCollection('item.props.variableSlider', () =>{
							const sliderProps = $scope.item.props.variableSlider;

							if(sliderProps.type === 'multi'){
								$scope.item.multiVariables = sliderProps.multiHandles.map((handle) => handle.variableDefault);
								onChangeMultiWatcher()
							}
						});

						$scope.$watch('item.variableValue', (val) =>{
							if(UtilService.isValidVariable(val)){
								$timeout(() =>{
									const sliderProps = $scope.item.props.variableSlider,
										type = sliderProps.type,
										colors = $scope.colors,
										variableSliderBackground = colors.variableSliderBackground,
										variableSliderTrack = colors.variableSliderTrack,
										variableSliderHandle = colors.variableSliderHandle,
										valueType = sliderProps.valueType;


									if(!isValidValue(valueType,val)){
										return;
									}

									let defaultValue;

									if(valueType === 'date'){
										defaultValue = UtilService.stringToDate(val, sliderProps.dateformat).getTime();
									}else if(valueType === 'string'){
										if(sliderProps.strings){
											defaultValue = UtilService.findIndexByKey(sliderProps.strings,'value',val);
										}
									}else{ //numeric
										defaultValue = parseInt(val);
									}

									const trackStyle = {background: type === 'single' ? variableSliderBackground : variableSliderTrack},
										handleStyle = {background: variableSliderHandle, border: 0};

									$scope.renderSlider(defaultValue, trackStyle, handleStyle);
								});
							}
						});

						$scope.$watchGroup(['item.variableValueStart', 'item.variableValueEnd'], (val) =>{
							if(UtilService.isValidVariable(val[0]) && UtilService.isValidVariable(val[1])){
								$timeout(() =>{

									const sliderProps = $scope.item.props.variableSlider,
										colors = $scope.colors,
										valueType = sliderProps.valueType;

									if(!isValidValue(valueType,val[0]) && !isValidValue(valueType,val[1])){
										return;
									}

									let defaultValues = [];

									if(valueType === 'date'){
										defaultValues = [
											UtilService.stringToDate(val[0], sliderProps.dateformat).getTime(),
											UtilService.stringToDate(val[1], sliderProps.dateformat).getTime()
										];
									}else if(valueType === 'string'){
										if(sliderProps.strings){
											defaultValues.push(UtilService.findIndexByKey(sliderProps.strings,'value',val[0]));
											defaultValues.push(UtilService.findIndexByKey(sliderProps.strings,'value',val[1]));
										}
									}else{
										defaultValues = [parseInt(val[0]), parseInt(val[1])];
									}

									let trackStyle = [
											{background: colors.variableSliderTrack},
											{background: colors.variableSliderTrack}
										],
										handleStyle = [
											{background: colors.variableSliderHandle, border: 0},
											{background: colors.variableSliderHandle, border: 0}
										];

									$scope.renderSlider(defaultValues, trackStyle, handleStyle);
								});
							}
						});

						$scope.$watchCollection('item.multiVariables', () =>{
							onChangeMultiWatcher();
						});

						$scope.renderSlider = function(defaultValue, trackStyle, handleStyle){
							const sliderProps = $scope.item.props.variableSlider,
								colors = $scope.colors,
								type = sliderProps.type,
								valueType = sliderProps.valueType;

							let min = parseInt(sliderProps.minValue),
								max = parseInt(sliderProps.maxValue),
								step = parseInt(sliderProps.steps);

							if(valueType === 'date'){
								min = UtilService.stringToDate(sliderProps.minValue, sliderProps.dateformat).getUtcTimeStamp();
								max = UtilService.stringToDate(sliderProps.maxValue, sliderProps.dateformat).getUtcTimeStamp();
								step = UtilService.dayInMs;
							}

							if(valueType === 'string'){
								if(!sliderProps.strings || sliderProps.strings.length < 1){
									return;
								}
								min = 0; //index 0 of the string array
								max = sliderProps.strings.length - 1;
								step = 1; // iterate over the string array in single steps
							}

							RangeSlider.remove({
								container: $element.find('#slider_' + $scope.itemId)[0]
							});

							RangeSlider.show({
								container: $element.find('#slider_' + $scope.itemId)[0],
								type: type,
								valueType: valueType,
								dateFormat: sliderProps.dateformat,
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
								strings: sliderProps.strings,
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

						$scope.onAfterChange = function(val){
							const sliderProps = $scope.item.props.variableSlider,
								valueType = sliderProps.valueType;

							if(sliderProps.type === 'single'){
								let variableValue = val;

								if(valueType === 'date'){
									let date = new Date(val);
									variableValue = UtilService.createFormatedDate(sliderProps.dateformat, date.getDate(), date.getMonth(), date.getFullYear());
								}else if(valueType === 'string'){
									variableValue = sliderProps.strings[val].value
								}

								qlikService.setVariableStringValue(sliderProps.variable, variableValue.toString());
							}else if(sliderProps.type === 'range'){
								let variableValueStart = val[0],
									variableValueEnd = val[1];

								if(valueType === 'date'){
									let startDate = new Date(val[0]),
										endDate = new Date(val[1]);

									variableValueStart = UtilService.createFormatedDate(
										sliderProps.dateformat, startDate.getDate(), startDate.getMonth(), startDate.getFullYear());
									variableValueEnd = UtilService.createFormatedDate(
										sliderProps.dateformat, endDate.getDate(), endDate.getMonth(), endDate.getFullYear());
								}else if(valueType === 'string'){
									variableValueStart = sliderProps.strings[val[0]].value;
									variableValueEnd = sliderProps.strings[val[1]].value;
								}

								qlikService.setVariableStringValue(sliderProps.variableStart, variableValueStart.toString());
								qlikService.setVariableStringValue(sliderProps.variableEnd, variableValueEnd.toString());
							}else if(sliderProps.type === 'multi'){
								sliderProps.multiHandles.forEach((handle, index) =>{
									let value = val[index];

									if(valueType === 'date'){
										let date = new Date(val[index]);

										value = UtilService.createFormatedDate(sliderProps.dateformat, date.getDate(), date.getMonth(), date.getFullYear());
									}else if(valueType === 'string'){
										value = sliderProps.strings[val[index]].value;
									}

									qlikService.setVariableStringValue(handle.variableName, value.toString());
								});
							}
						};

						function isValidValue(type, value){
							return !((type === 'date' || type === 'string') && value === undefined || (type === 'numeric' && isNaN(value)));
						}

						function onChangeMultiWatcher(){
							const colors = $scope.colors,
								sliderProps = $scope.item.props.variableSlider;

							if(!$scope.item.multiVariables || $scope.item.multiVariables.length === 0){
								return;
							}

							$timeout(() =>{
								let defaultValues = [],
									trackStyle = [],
									handleStyle = [];

								$scope.item.multiVariables.forEach((variable) =>{
									if(sliderProps.valueType === 'date'){
										defaultValues.push(UtilService.stringToDate(variable, sliderProps.dateformat).getTime());
									}else if(sliderProps.valueType === 'string'){
										if(sliderProps.strings){
											defaultValues.push(UtilService.findIndexByKey(sliderProps.strings,'value',variable));
										}
									}else{
										defaultValues.push(parseInt(variable));
									}

									trackStyle.push({background: colors.variableSliderTrack});
									handleStyle.push({background: colors.variableSliderHandle, border: 0});
								});

								$scope.renderSlider(defaultValues, trackStyle, handleStyle);

							});
						}

						function setDefaultVariableValues($scope){
							const sliderProps = $scope.item.props.variableSlider;

							if(!qlikService.isPrinting() && !$scope.parentscope.inEditMode()){
								if(sliderProps.type === 'single'){
									if(sliderProps.variable && sliderProps.variableDefault){
										qlikService.setVariableStringValue(sliderProps.variable, sliderProps.variableDefault.toString());
									}
								}else if(sliderProps.type === 'range'){
									if(sliderProps.variableStart && sliderProps.variableStartDefault && sliderProps.variableEnd && sliderProps.variableEndDefault){
										qlikService.setVariableStringValue(sliderProps.variableStart, sliderProps.variableStartDefault.toString());
										qlikService.setVariableStringValue(sliderProps.variableEnd, sliderProps.variableEndDefault.toString());
									}
								}else if(sliderProps.type === 'multi'){
									sliderProps.multiHandles.forEach((handle) =>{
										if(handle.variableName && handle.variableDefault){
											qlikService.setVariableStringValue(handle.variableName, handle.variableDefault.toString());
										}
									})
								}
							}
						}

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