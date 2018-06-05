import {QlikService} from '../../lib/hico/services/qlik-service';
import {UtilService} from "../Services/UtilService";

define(['qvangular', '../../templates/variableInput.html'], function(qvangular, template){

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

						let watchers = [];

						setDefaultVariableValues($scope);

						$element.on('$destroy', () => onDestroy());

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
					}
				]
			}
		}
	]);
});