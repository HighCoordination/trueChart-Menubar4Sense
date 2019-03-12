import * as qvangular from 'qvangular';
import * as template from '../../templates/variableInput.html'
import {QlikService} from '@highcoordination/common-sense';
import {UtilService} from "../Services/UtilService";
import {$timeout} from '../Services/AngularService';
import {ContentManager} from '../Components/Managers/ContentManager';

new function(){

	const qlikService = QlikService.getInstance();

	return qvangular.directive('variableinput', [
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

						$scope.item.input = {
							value: '',
							valid: true
						};

						const uniqueID = utilService.generateGuid();
						let watchers = [];
						let colors = {};

						let oldStyleInputBackground,
							oldStyleInputText,
							oldStyleInputFocus,
							oldStyleInputPlaceholder;

						function update(){
							$timeout(() => {
								if($scope.item.props.colors && $scope.item.props.individualColor && JSON.stringify($scope.item.props.colors) !== colors){
									$scope.colors = UtilService.getColorsFromProps($scope.item.props.colors, 'input');
									switchDynamicStyleSheet();
									$scope.usedID = uniqueID;
								}else{
									$scope.colors = $scope.parentscope.colors;
									$scope.usedID = $scope.uniqueId;
								}

								$element.css('background-color', $scope.colors.backgroundColor);
								$element.parent().css('border-bottom-color', $scope.colors.borderSeparatorColor);

								colors = JSON.stringify($scope.colors);
							});
						}

						setDefaultVariableValues($scope);

						$element.on('$destroy', () => onDestroy());

						this.$onInit = function(){
							ContentManager.registerComponent(uniqueID, {update});

							update();
						};

						this.$onDestroy = function(){
							ContentManager.unregisterComponent(uniqueID);
						};

						watchers.push($scope.$on('leaveEditMode', () => setDefaultVariableValues($scope)));

						$scope.$watch('item.cId', () =>{
							$scope.itemId = $scope.layout.qInfo.qId + '-' + $scope.item.cId;
						});

						$scope.$watch('item.props.variableInput.type', () =>{
							const item = $scope.item,
								inputProps = item.props.variableInput;

							item.input = {
								value: item.variableValue,
								valid: UtilService.checkValidInput(item.variableValue, inputProps.type, inputProps.isRequired, inputProps.dateformat, inputProps.decimalSep),
							};

						});

						$scope.$watch('item.variableValue', () =>{
							const item = $scope.item,
								inputProps = item.props.variableInput;

							item.input = {
								value: item.variableValue,
								valid: UtilService.checkValidInput(item.variableValue, inputProps.type, inputProps.isRequired, inputProps.dateformat, inputProps.decimalSep),
							};
						});

						$scope.setVariable = function(){
							const item = $scope.item,
								inputProps = item.props.variableInput;

							if(!qlikService.isPrinting() && !$scope.parentscope.inEditMode() && inputProps.variable){
								if(inputProps.type === 'Date'){
									const date = UtilService.stringToDate(item.input.value.toString(), inputProps.dateformat),
										formatedDate = UtilService.createFormatedDate(inputProps.dateformat, date.getDate(), date.getMonth(), date.getFullYear());

									qlikService.setVariableStringValue(inputProps.variable, formatedDate);
									item.input.value = formatedDate;
								}else{
									qlikService.setVariableStringValue(inputProps.variable, item.input.value.toString());
								}
							}
						};

						$scope.doBlur = function($event){
							let target = $event.target;

							target.blur();
						};

						$scope.inputChange = function(){
							const item = $scope.item,
								inputProps = item.props.variableInput,
								valid = UtilService.checkValidInput(item.input.value, inputProps.type, inputProps.isRequired, inputProps.dateformat, inputProps.decimalSep);

							item.input.valid = valid;

							if(valid){
								$scope.setVariable();
							}
						};

						function onDestroy(){
							const styleElement = document.getElementById('tcMenuStylesSheet_' + uniqueID);
							styleElement && styleElement.parentNode.removeChild(styleElement);

							// unwatch watchers
							watchers.forEach(function(unwatch){
								unwatch();
							});
						}

						function setDefaultVariableValues($scope){
							const inputProps = $scope.item.props.variableInput;

							if(!qlikService.isPrinting() && !$scope.parentscope.inEditMode() && inputProps.variable && inputProps.variableDefault){
								qlikService.setVariableStringValue(inputProps.variable, inputProps.variableDefault.toString());
							}
						}

						function switchDynamicStyleSheet(){
							const colors = $scope.colors;

							if(
								oldStyleInputBackground !== colors.variableInputBackground
								|| oldStyleInputText !== colors.variableInputText
								|| oldStyleInputPlaceholder !== colors.variableInputPlaceholder
								|| oldStyleInputFocus !== colors.variableInputFocus
							){
								oldStyleInputPlaceholder = colors.variableInputPlaceholder;
								oldStyleInputText = colors.variableInputText;
								oldStyleInputBackground = colors.variableInputBackground;
								oldStyleInputFocus = colors.variableInputFocus;

								const scopeId = uniqueID,
									variableInputPlaceholder = $scope.colors.variableInputPlaceholder,
									dynamicCss = ''
										+ '.hico-variable-input_' + scopeId + ':focus{'
										+ 'background: ' + colors.variableInputBackground + '!important;'
										+ 'color: ' + colors.variableInputText + '!important;'
										+ 'box-shadow: 0 0 1px 1px ' + colors.variableInputFocus + '!important;'
										+ '}'
										+ UtilService.createPlaceholderRule('::-ms-input-placeholder', scopeId, variableInputPlaceholder)
										+ UtilService.createPlaceholderRule(':-ms-input-placeholder', scopeId, variableInputPlaceholder)
										+ UtilService.createPlaceholderRule('::-webkit-input-placeholder', scopeId, variableInputPlaceholder)
										+ UtilService.createPlaceholderRule('::placeholder', scopeId, variableInputPlaceholder),
									oldStyle = document.getElementById('tcMenuStylesSheet_' + scopeId);

								let newStyle = document.createElement('style');

								newStyle.type = 'text/css';
								newStyle.id = 'tcMenuStylesSheet_' + uniqueID;
								newStyle.appendChild(document.createTextNode(dynamicCss));

								if(oldStyle){
									document.head.replaceChild(newStyle, oldStyle);
								}else{
									document.head.appendChild(newStyle);
								}
							}
						}
					}
				]
			}
		}
	]);
};