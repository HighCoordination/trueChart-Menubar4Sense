import {prefix} from '../prefix';

define([
	'qvangular',
	'angular',
	'ng!$timeout',
	'codemirror/lib/codemirror',
	'codemirror/mode/javascript/javascript',
	'codemirror/mode/css/css',
	'codemirror/addon/display/autorefresh',
	'codemirror/addon/display/placeholder'

], function(qvangular, angular, $timeout, CodeMirror){

	const directiveName = prefix + 'Codemirror';

	/**
	 * Binds a CodeMirror widget to a <textarea> element.
	 */
	qvangular.directive(directiveName, uiCodemirrorDirective);

	/**
	 * @ngInject
	 */
	function uiCodemirrorDirective(){

		return {
			restrict: 'A',
			require: '?ngModel',
			compile: function compile(){
				return postLink;
			}
		};

		/**
		 *
		 * @param scope
		 * @param iElement
		 * @param iAttrs
		 * @param ngModel
		 */
		function postLink(scope, iElement, iAttrs, ngModel){

			var codemirrorOptions = angular.extend(
				{value: iElement.text()},
				scope.$eval(iAttrs[directiveName])
			);

			var codemirror = newCodemirrorEditor(iElement, codemirrorOptions);

			configOptionsWatcher(
				codemirror,
				iAttrs[directiveName],
				scope
			);

			configNgModelLink(codemirror, ngModel, scope);

			configUiRefreshAttribute(codemirror, iAttrs.uiRefresh, scope);

			// Allow access to the CodeMirror instance through a broadcasted event
			// eg: $broadcast('CodeMirror', function(cm){...});
			scope.$on('CodeMirror', function(__event, callback){
				if(angular.isFunction(callback)){
					callback(codemirror);
				}else{
					throw new Error('the CodeMirror event requires a callback function');
				}
			});

			// onLoad callback
			if(angular.isFunction(codemirrorOptions.onLoad)){
				codemirrorOptions.onLoad(codemirror);
			}

			$timeout(() => codemirror.refresh());
		}

		/**
		 *
		 * @param iElement
		 * @param codemirrorOptions
		 * @return {*}
		 */
		function newCodemirrorEditor(iElement, codemirrorOptions){
			var codemirror;

			if(iElement[0].tagName === 'TEXTAREA'){
				// Might bug but still ...
				codemirror = CodeMirror.fromTextArea(iElement[0], codemirrorOptions);
			}else{
				iElement.html('');
				codemirror = new CodeMirror(function(cm_el){
					iElement.append(cm_el);
				}, codemirrorOptions);
			}

			codemirror.setSize(codemirrorOptions.width, codemirrorOptions.height);

			return codemirror;
		}

		/**
		 *
		 * @param codemirrot
		 * @param uiCodemirrorAttr
		 * @param scope
		 */
		function configOptionsWatcher(codemirrot, uiCodemirrorAttr, scope){
			if(!uiCodemirrorAttr){
				return;
			}

			var codemirrorDefaultsKeys = Object.keys(CodeMirror.defaults);
			scope.$watch(uiCodemirrorAttr, updateOptions, true);

			function updateOptions(newValues, oldValue){
				if(!angular.isObject(newValues)){
					return;
				}
				codemirrorDefaultsKeys.forEach(function(key){
					if(newValues.hasOwnProperty(key)){

						if(oldValue && newValues[key] === oldValue[key]){
							return;
						}

						codemirrot.setOption(key, newValues[key]);
					}
				});
			}
		}

		/**
		 *
		 * @param codemirror
		 * @param ngModel
		 * @param scope
		 */
		function configNgModelLink(codemirror, ngModel, scope){
			if(!ngModel){
				return;
			}
			// CodeMirror expects a string, so make sure it gets one.
			// This does not change the model.
			ngModel.$formatters.push(function(value){
				if(angular.isUndefined(value) || value === null){
					return '';
				}else if(angular.isObject(value) || angular.isArray(value)){
					throw new Error('ui-codemirror cannot use an object or an array as a model');
				}
				return value;
			});


			// Override the ngModelController $render method, which is what gets called when the model is updated.
			// This takes care of the synchronizing the codeMirror element with the underlying model, in the case that it is changed by something else.
			ngModel.$render = function(){
				//Code mirror expects a string so make sure it gets one
				//Although the formatter have already done this, it can be possible that another formatter returns undefined (for example the required
				// directive)
				var safeViewValue = ngModel.$viewValue || '';
				codemirror.setValue(safeViewValue);
			};


			// Keep the ngModel in sync with changes from CodeMirror
			codemirror.on('change', function(instance){
				var newValue = instance.getValue();
				if(newValue !== ngModel.$viewValue){
					scope.$evalAsync(function(){
						ngModel.$setViewValue(newValue);
					});
				}
			});
		}

		/**
		 *
		 * @param codeMirror
		 * @param uiRefreshAttr
		 * @param scope
		 */
		function configUiRefreshAttribute(codeMirror, uiRefreshAttr, scope){
			if(!uiRefreshAttr){
				return;
			}

			scope.$watch(uiRefreshAttr, function(newVal, oldVal){
				// Skip the initial watch firing
				if(newVal !== oldVal){
					$timeout(function(){
						codeMirror.refresh();
					});
				}
			});
		}

	}
});