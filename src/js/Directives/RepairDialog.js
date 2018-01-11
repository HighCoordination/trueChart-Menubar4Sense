import {translation as translations} from '../../../resource/translations/translations';
import * as QlikService from '../../lib/hico/services/qlik-service';
import * as leonardoui from 'leonardo-ui';

requirejs.config({
	bundles: {
		'assets/client/client': [
			'client.property-panel/components/string/string',
		]
	}
});

define([
	'jquery',
	'qlik',
	'qvangular',
	'../../templates/repairDialog.html'], function($, qlik, qvangular, template){
	return qvangular.directive('repairdialogdirective', [function(){
			return {
				restrict: 'E',
				scope: {
					dialogdatas: '=',
					dimensions: '=',
					onSave: '&'
				},
				replace: true,
				template: template,
				controllerAs: '$ctrl',
				controller: ['$scope', '$element', function($scope, $element){
					const qlikService = QlikService.getInstance();
					$scope.currentIndex = 0;
					$scope.allFixed = false;
					$scope.resolvedCount = 0;
					$scope.errors = [];
					$scope.translations = translations;
					$scope.showConfigDialog = false;
					$scope.configString = '';
					qlikService.inClient() && requirejs(['client.property-panel/components/string/string'], function(){
						$scope.qComponents =  {string: requirejs('client.property-panel/components/string/string')};
					});

					// Properties which reuse qlik components
					$scope.definitions= {
						text: {type: 'string', ref: 'text', expression: 'optional'},
					};

					/**
					 * update erro array with new dialogdatas everytime the dialogdata array changes
					 * only add erro when not already in error array
					 */
					$scope.$watch('dialogdatas.length', function(newValue, oldValue) {
						$scope.dialogdatas.forEach(function(dialogd){
							let found = false;
							$scope.errors.some(function(errord){
								if(dialogd.oldValue === errord.oldValue){
									found = true;
									return true;
								}
							});

							if(!found){
								$scope.errors.push(
									{
										text: dialogd.oldValue,
										oldValue: dialogd.oldValue,
										changedValue: dialogd.oldValue,
										textTemplate: dialogd.textTemplate,
										fixed: false,
									}
								);
							}
						});
					});

					/**
					 * save new defined values
					 * call save function of dialogdata which triggers the setproperties in updater
					 */
					$scope.save = function(){
						$scope.applyErrorsToData();
						$scope.onSave();
						$scope.close();
					};

					/**
					 * confrm changes to current dialogitem (error)
					 * automatically goes to the next avaiable error
					 * @param item
					 */
					$scope.confirm = function(item){
						item.fixed = true;
						item.changedValue = item.text;
						$scope.allFixed = $scope.checkFixed();

						//remove expression object we dont need this
						if(item.text.qStringExpression){
							if(item.text.qStringExpression.qExpr.charAt(0) === '='){
								item.text =  item.text.qStringExpression.qExpr;
							}else{
								item.text =  '=' + item.text.qStringExpression.qExpr;
							}

						}

						//go to next unresolved error
						$scope.resolveSameExpressions(item.text, item.oldValue);
						$scope.goToNextError();
						$scope.calcResolved();
					};

					/**
					 * resets the current erro item to its original state
					 * @param item
					 */
					$scope.reset = function(item){
						item.fixed = false;
						item.text = item.oldValue;
						item.changedValue = item.oldValue;
						$scope.allFixed = $scope.checkFixed();
						$scope.calcResolved();
					};

					/**
					 * removes the dialog
					 */
					$scope.close = function(){
						$element.remove();
						$scope.$destroy();
					};

					/**
					 * display to next error
					 */
					$scope.next = function(){
						$scope.currentIndex++;
					};

					/**
					 * display previous error
					 */
					$scope.before = function(){
						$scope.currentIndex--;
					};

					/**
					 * checks if all errors haave been marked as fixed
					 * @returns {boolean}
					 */
					$scope.checkFixed = function(){
						let allFixed = true;
						$scope.errors.some(function(error){
							if(!error.fixed){
								allFixed = false;
								return true;
							}
						});

						return allFixed;
					};

					/**
					 * when fixing an erro the new value is applied to all error with the same old value
					 * this way we only have to fix the error one time instead of multiple times
					 * @param newValue
					 * @param oldValue
					 */
					$scope.resolveSameExpressions = function(newValue, oldValue){
						$scope.errors.forEach(function(error){
							if(error.oldValue === oldValue){
								error.text = newValue;
								error.changedValue = newValue;
								error.fixed = true;
							}
						})
					};

					/**
					 * finds the next avaiable error and display it in the dialog
					 */
					$scope.goToNextError = function(){
						let found = false;
						let parseRight = true;
						let index = $scope.currentIndex;
						let loops = 0;
						while(!found && loops < $scope.errors.length * 3){
							if(index < $scope.errors.length && parseRight){
								index++;

							}else if(index === $scope.errors.length && parseRight){
								parseRight = false;
							}else{
								index--;
							}

							if($scope.errors[index] && !$scope.errors[index].fixed){
								$scope.currentIndex = index;
								found = true;
							}

							loops++;
						}
					};

					/**
					 * calculates the amount of resolved errors and returns the counter for display
					 */
					$scope.calcResolved = function(){
						let count = 0;
						$scope.errors.forEach(function(error){
							error.fixed && count++;
						});

						$scope.resolvedCount = count;
					};

					/**
					 * fixed values from error array get copied into the dialogdata array
					 * error array only holds the unique values
					 */
					$scope.applyErrorsToData = function(){
						$scope.errors.forEach(function(errord){
							$scope.dialogdatas.forEach(function(dialogd){
								if(errord.oldValue === dialogd.oldValue){
									dialogd.text = errord.text;
								}
							})
						});
					};

					$scope.showConfiguration = function(){
						let configObj = {};

						$scope.errors.forEach(error => {
							configObj[error.oldValue] = error.changedValue;
						});

						let dialog = leonardoui.dialog( {
							content: document.getElementById("hico-config-dialog").innerHTML,
							closeOnEscape: true
						} );

						let text = JSON.stringify(configObj, null, 2);

						dialog.element.querySelectorAll('#hico-dialog-textarea')[0].value = text;
						dialog.element.querySelectorAll('#hico-dialog-textarea')[0].rows = Math.min(Object.keys(configObj).length + 3, 25);

						dialog.element.querySelectorAll('#hico-close-dialog-btn')[0].addEventListener( "click", function() {
							dialog.close();
						} );

						dialog.element.querySelectorAll('#hico-copy-dialog-btn')[0].addEventListener( "click", function() {
							dialog.element.querySelectorAll('#hico-dialog-textarea')[0].select();
							document.execCommand('copy',false, 'test');
						} );
					};
				}]
			}
	}]);
});