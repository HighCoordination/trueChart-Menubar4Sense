import {prefix} from '../prefix';

define([
	'qvangular',
	'qlik',
	'../translations/translation',
	'../directives/modal-dialog',
	'./qlik-service',
	'./config-service'
], function(qvangular, qlik, translation, Modal){

	// Register the angular service
	qvangular.service(prefix + 'ActionService', [prefix + 'QlikService', prefix + 'ConfigService', ActionService]);

	ActionService.getInstance = function(){
		return qvangular.getService(prefix + 'ActionService');
	};

	return ActionService;

	function ActionService(qlikService, configService){

		let _ready = qlik.Promise.defer(),
			_actions = getActionsDefinition(),
			_parameters = getParametersDefinition(),
			_triggers = getTriggersDefiition();

		/**
		 * Collection of various qlikList layouts
		 * @type {{variables: null, fields: null, bookmarks: null, stories: null, sheets: null, dimensions: null, measures: null, media: null}}
		 */
		let _listLayout = {
			variables: null,
			fields: null,
			bookmarks: null,
			stories: null,
			sheets: null,
			dimensions: null,
			measures: null,
			media: null
		};

		this.getAction = getAction;
		this.getActions = getActions;
		this.getParameter = getParameter;
		this.getParameters = getParameters;
		this.getReady = getReady;
		this.getTriggers = getTriggers;

		// initialize
		if(!qlikService.isPrinting()){
			init(this);
		}

		/**
		 * Returns actions definition
		 * @return {object}
		 */
		function getActionsDefinition(){
			return {

				'none': {
					type: 'None',
					name: 'none',
					label: translation.getTranslation('NO_ACTION'),
					description: translation.getTranslation('NO_ACTION_WILL_BE_PERFORMED'),
					parameters: ['none'],
					execute: function(){ /* No action */}
				},

				'custom': {
					type: 'Custom',
					name: 'custom',
					label: translation.getTranslation('CUSTOM'),
					description: translation.getTranslation('CUSTOM_ACTION'),
					parameters: ['custom'],
					execute: function($, qlik, $scope, $element, contextType, evt, params){
						try{
							var customFunction = new Function('$', 'qlik', '$scope', '$element', 'contextType', 'evt', params[0]);
							return customFunction($, qlik, $scope, $element, contextType, evt);
						}catch(e){
							console.warn("Action:", this.name, "| Parameters:", this.parameters.toString(), "| Value:", params[0], "| Error:", e);
						}
					}
				},

				/** Navigation actions */
				'nextSheet': {
					type: 'Navigation',
					name: 'nextSheet',
					label: translation.getTranslation('NEXT_SHEET/PAGE'),
					description: translation.getTranslation('NAVIGATE_TO_NEXT_SHEET_OR_PAGE_IN_MASHUP'),
					parameters: ['none'],
					execute: function(){
						qlik.navigation.nextSheet();

						// Dispatch an "nextPage" event for navigation in MashUps
						dispatchCustomEvent('nextPage', null);
					}
				},
				'prevSheet': {
					type: 'Navigation',
					name: 'prevSheet',
					label: translation.getTranslation('PREVIOUS_SHEET/PAGE'),
					description: translation.getTranslation('NAVIGATE_TO_PREVIOUS_SHEET_OR_PAGE_IN_MASHUP'),
					parameters: ['none'],
					execute: function(){
						qlik.navigation.prevSheet();

						// Dispatch an "nextPage" event for navigation in MashUps
						dispatchCustomEvent('previousPage', null);
					}
				},
				'gotoSheet': {
					type: 'Navigation',
					name: 'gotoSheet',
					label: translation.getTranslation('GO_TO_SHEET'),
					description: translation.getTranslation('NAVIGATE_TO_A_SPECIFIC_SHEET'),
					parameters: ['sheetId'],
					execute: function(params){
						if(!params[0]){
							return;
						}
						qlik.navigation.gotoSheet(params[0]);
					}
				},
				'gotoStory': {
					type: 'Navigation',
					name: 'gotoStory',
					label: translation.getTranslation('GO_TO_STORY'),
					description: translation.getTranslation('NAVIGATE_TO_A_SPECIFIC_STORY'),
					parameters: ['storyId'],
					execute: function(params){
						if(!params[0]){
							return;
						}
						qlik.navigation.gotoStory(params[0]);
					}
				},
				'gotoURL': {
					type: 'Navigation',
					name: 'gotoURL',
					label: translation.getTranslation('GO_TO_URL'),
					description: translation.getTranslation('NAVIGATE_TO_A_SPECIFIC_WEBSITE'),
					parameters: ['url', 'urlTarget', 'mashupOnly'],
					execute: function(params){
						if(!params[0] || params[2] && qlik.navigation.inClient){
							return;
						}
						window.open(params[0], params[1]);
					}
				},

				/** Sense Actions */
				'setVariable': {
					type: 'Sense',
					name: 'setVariable',
					label: translation.getTranslation('SET_VARIABLE'),
					description: translation.getTranslation('SET_A_VARIABLE_TO_A_SPECIFIC_VALUE'),
					parameters: ['senseVariable', 'variableContent', 'keep'],
					execute: function(params){
						var varName = params[0],
							varContent = params[1],
							keep = params[2];
						return qlikService.getVariableValue(varName).then(function(value){
							if(!varName || keep && value){
								return;
							}
							return qlik.currApp().variable.setStringValue(varName, varContent);
						});
					}
				},
				'selectValues': {
					type: 'Sense',
					name: 'selectValues',
					label: translation.getTranslation('SELECT_VALUE(S)'),
					description: translation.getTranslation('SELECTS_SPECIFIC_VALUES_IN_A_FIELD'),
					parameters: ['fieldName', 'fieldValues', 'toggle', 'softLock', 'initial', 'additional'],
					execute: function(params){
						var field, engineApp, deferred,
							fParams = getFieldParameters(params[0]),
							toggle = !!params[2],
							softLock = !!params[3],
							selectedValues = getExistingSelectionValues(fParams.fieldName),
							values = params[1].split(';').map(function(val){ return val.trim(); });

						if(selectedValues.length > 0){
							if(params[4]){
								return;
							}else if(params[5]){
								// Filter additional values
								values = params[1].filter(function(val){ return selectedValues.indexOf(val) === -1; });
								if(values.length === 0){
									return; // Nothing to select
								}else{
									toggle = true; // Do not override existing selections
								}
							}
						}
						field = qlik.currApp().field(fParams.fieldName);
						engineApp = qlik.currApp().model.engineApp;
						deferred = qlik.Promise.defer();

						// Get all field data for numeric values
						fParams.isNumeric ? getFieldData(field, fieldDataFetched) : deferred.resolve(field);

						return deferred.promise.then(function(field){ return Promise.all(values.map(function(value){
							if((!fParams.isNumeric || fParams.isTimestamp || fParams.isDate) && value.indexOf("'") !== 0){
								value = "'" + value + "'";
								return engineApp.evaluateEx(value);
							}else if(fParams.isNumeric){
								field.rows.some(function(item){ // get exact number value
									if(item.qText === value){
										value = item.qNum;
										return true;
									}
								});
								return value;
							}else{
								return value;
							}
						})).then(function(values){
							values = values.map(function(value){
								return value.qValue || value;
							});

							return field.selectValues(values, toggle, softLock);
						});});

						function fieldDataFetched(){
							field.rowCount > field.rows.length ? getFieldData(field, fieldDataFetched) : deferred.resolve(field);
						}
					}
				},
				'selectMatch': {
					type: 'Sense',
					name: 'selectMatch',
					label: translation.getTranslation('SELECT_MATCH'),
					description: translation.getTranslation('SELECTS_MATCHING_FIELD_VALUES'),
					parameters: ['fieldName', 'fieldValue', 'softLock', 'initial'],
					execute: function(params){
						var fParams = getFieldParameters(params[0]);

						if(getExistingSelectionValues(fParams.fieldName).length > 0 && params[3]){
							return;
						}

						return qlik.currApp().field(fParams.fieldName).selectMatch(params[1], params[2]);
					}
				},
				'selectAlternative': {
					type: 'Sense',
					name: 'selectAlternative',
					label: translation.getTranslation('SELECT_ALTERNATIVE'),
					description: translation.getTranslation('SELECTS_ALTERNATIVE_VALUES_IN_A_FIELD'),
					parameters: ['fieldName', 'softLock'],
					execute: function(params){
						try{
							return qlik.currApp().field(getFieldParameters(params[0]).fieldName).selectAlternative(params[1]);
						}catch(e){
							console.warn("Action:", this.name, "| Parameters:", this.parameters.toString(), "| Value:", params, "| Error:", e);
						}
					}
				},
				'selectExcluded': {
					type: 'Sense',
					name: 'selectExcluded',
					label: translation.getTranslation('SELECT_EXCLUDED'),
					description: translation.getTranslation('SELECTS_EXCLUDED_VALUES_IN_A_FIELD'),
					parameters: ['fieldName', 'softLock'],
					execute: function(params){
						try{
							return qlik.currApp().field(getFieldParameters(params[0]).fieldName).selectExcluded(params[1]);
						}catch(e){
							console.warn("Action:", this.name, "| Parameters:", this.parameters.toString(), "| Value:", params, "| Error:", e);
						}
					}
				},
				'selectPossible': {
					type: 'Sense',
					name: 'selectPossible',
					label: translation.getTranslation('SELECT_POSSIBLE'),
					description: translation.getTranslation('SELECTS_MATCHING_FIELD_VALUES'),
					parameters: ['fieldName', 'softLock'],
					execute: function(params){
						try{
							return qlik.currApp().field(getFieldParameters(params[0]).fieldName).selectPossible(params[1]);
						}catch(e){
							console.warn("Action:", this.name, "| Parameters:", this.parameters.toString(), "| Value:", params, "| Error:", e);
						}
					}
				},
				'selectAll': {
					type: 'Sense',
					name: 'selectAll',
					label: translation.getTranslation('SELECT_ALL'),
					description: translation.getTranslation('SELECTS_ALL_VALUES_IN_A_FIELD'),
					parameters: ['fieldName', 'softLock'],
					execute: function(params){
						try{
							return qlik.currApp().field(getFieldParameters(params[0]).fieldName).selectAll(params[1]);
						}catch(e){
							console.warn("Action:", this.name, "| Parameters:", this.parameters.toString(), "| Value:", params, "| Error:", e);
						}
					}
				},
				'clearField': {
					type: 'Sense',
					name: 'clearField',
					label: translation.getTranslation('CLEAR_FIELD'),
					description: translation.getTranslation('CLEARS_A_FIELD_SELECTION'),
					parameters: ['fieldName'],
					execute: function(params){
						try{
							return qlik.currApp().field(getFieldParameters(params[0]).fieldName).clear();
						}catch(e){
							console.warn("Action:", this.name, "| Parameters:", this.parameters.toString(), "| Value:", params, "| Error:", e);
						}
					}
				},
				'clearOther': {
					type: 'Sense',
					name: 'clearOther',
					label: translation.getTranslation('CLEAR_OTHER'),
					description: translation.getTranslation('CLEARS_ALL_FIELDS_EXCEPT_THE_SELECTED_ONE'),
					parameters: ['fieldName', 'softLock'],
					execute: function(params){
						try{
							return qlik.currApp().field(getFieldParameters(params[0]).fieldName).clearOther(params[1]);
						}catch(e){
							console.warn("Action:", this.name, "| Parameters:", this.parameters.toString(), "| Value:", params, "| Error:", e);
						}
					}
				},
				'clearAll': {
					type: 'Sense',
					name: 'clearAll',
					label: translation.getTranslation('CLEAR_ALL'),
					description: translation.getTranslation('CLEARS_ALL_SELECTIONS_IN_ALL_FIELDS_OF_THE_CURRENT_QLIK_SENSE_APP'),
					parameters: ['lockedAlso'/*, 'alternateState'*/], // don't know how to deal with "alternateState", so don't use it...
					execute: function(params){
						try{
							return qlik.currApp().clearAll(params[0], params[1]);
						}catch(e){
							console.warn("Action:", this.name, "| Parameters:", this.parameters.toString(), "| Value:", params, "| Error:", e);
						}
					}
				},
				'lockField': {
					type: 'Sense',
					name: 'lockField',
					label: translation.getTranslation('LOCK_FIELD'),
					description: translation.getTranslation('LOCKS_A_FIELD_SELECTION'),
					parameters: ['fieldName'],
					execute: function(params){
						try{
							return qlik.currApp().field(getFieldParameters(params[0]).fieldName).lock();
						}catch(e){
							console.warn("Action:", this.name, "| Parameters:", this.parameters.toString(), "| Value:", params, "| Error:", e);
						}
					}
				},
				'lockAll': {
					type: 'Sense',
					name: 'lockAll',
					label: translation.getTranslation('LOCK_ALL'),
					description: translation.getTranslation('LOCKS_ALL_SELECTIONS'),
					parameters: ['lockedAlso'/*, 'alternateState'*/],
					execute: function(params){
						try{
							return qlik.currApp().lockAll(params[0]);
						}catch(e){
							console.warn("Action:", this.name, "| Parameters:", this.parameters.toString(), "| Value:", params, "| Error:", e);
						}
					}
				},
				'unlockAll': {
					type: 'Sense',
					name: 'unlockAll',
					label: translation.getTranslation('UNLOCK_ALL'),
					description: translation.getTranslation('UNLOCKS_ALL_SELECTIONS_THAT_HAS_PREVIOUSLY_BEEN_LOCKED'),
					parameters: [/*'alternateState'*/ 'none'],
					execute: function(params){
						try{
							return qlik.currApp().unlockAll(params[0]);
						}catch(e){
							console.warn("Action:", this.name, "| Parameters:", this.parameters.toString(), "| Value:", params, "| Error:", e);
						}
					}
				},
				'applyBookmark': {
					type: 'Sense',
					name: 'applyBookmark',
					label: translation.getTranslation('APPLY_BOOKMARK_SELECTION'),
					description: translation.getTranslation('APPLIES_A_BOOKMARK_SELECTION'),
					parameters: ['bookmarkId'],
					execute: function(params){
						try{
							return qlik.currApp().bookmark.apply(params[0]);
						}catch(e){
							console.warn("Action:", this.name, "| Parameters:", this.parameters.toString(), "| Value:", params, "| Error:", e);
						}
					}
				},
				'reloadData': {
					type: 'Sense',
					name: 'reloadData',
					label: translation.getTranslation('RELOAD_DATA'),
					description: translation.getTranslation('RELOADS_THE_DATA_IN_A_QLIK_SENSE_APP'),
					parameters: ['qMode', 'qPartial'],
					execute: function(params){
						try{
							let $scope = qvangular.$rootScope.$new();
							Modal.show({
								scope: $scope,
								title: translation.getTranslation('RELOAD_IN_PROGRESS'),
								body: translation.getTranslation('RELOAD_IS_RUNNING')
							});
							return qlik.currApp().doReload(parseInt(params[0]), params[1]).then(function(){
								setTimeout(function(){ $scope.close(); }, 1000); // Show the dialog for minimum 1s
							}).catch(function(err){
								console.warn('Error occurred during "reloadData" action', err);
								$scope.close();
							});
						}catch(e){
							console.warn("Action:", this.name, "| Parameters:", this.parameters.toString(), "| Value:", params, "| Error:", e);
						}
					}
				},

				/* trueChart actions */
				'Toggle_Show_Edit_Mode': {type: 'trueChart', isHidden: true, name: 'Toggle_Show_Edit_Mode', parameters: ['none'], execute: executeTCAction},
				'Save_Changed': {type: 'trueChart', isHidden: true, name: 'Save_Changed', parameters: ['trueChartExtension'], execute: executeTCAction},
				'Save_All': {type: 'trueChart', isHidden: true, name: 'SaveAll', parameters: ['trueChartExtension'], execute: executeTCAction},
				'Refresh': {type: 'trueChart', isHidden: true, name: 'Refresh', parameters: ['none'], execute: executeTCAction},
				'Export_As_PDF': {type: 'trueChart', isHidden: true, name: 'Export_As_PDF', parameters: ['trueChartExtension'], execute: executeTCAction},
				'Export_As_PNG': {type: 'trueChart', isHidden: true, name: 'Export_As_PNG', parameters: ['trueChartExtension'], execute: executeTCAction},
				'Export_As_EMF': {type: 'trueChart', isHidden: true, name: 'Export_As_EMF', parameters: ['trueChartExtension'], execute: executeTCAction},
				'Export_As_XLS': {type: 'trueChart', isHidden: true, name: 'Export_As_XLS', parameters: ['trueChartExtension'], execute: executeTCAction},
				'Reload_Common_Tables': {type: 'trueChart', isHidden: true, name: 'Reload_Common_Tables', parameters: ['trueChartExtension'], execute: executeTCAction},

				'toggleFullScreen': {
					type: 'Other',
					name: 'toggleFullScreen',
					label: translation.getTranslation('TOGGLE_FULL_SCREEN'),
					description: translation.getTranslation('TOGGLE_FULL_SCREEN_DESCRIPTION'),
					supportedTriggers: ['click'],
					parameters: ['fullScreenExpression'],
					execute: function(params){
						var fullscreen = isTrue(typeof params[0] !== 'undefined' ? params[0] : !inFullScreen());

						toggleFullScreen(fullscreen);

						function toggleFullScreen(fullscreen) {
							var doc = document,
								elem = doc.documentElement,
								requestFullScreen = elem.requestFullscreen || elem.webkitRequestFullscreen || elem.mozRequestFullScreen || elem.msRequestFullscreen,
								exitFullScreen = doc.exitFullscreen || doc.webkitExitFullscreen || doc.mozCancelFullScreen || doc.msExitFullscreen;

							try{
								fullscreen ? requestFullScreen.call(elem) : exitFullScreen.call(doc);
							}catch(err){
								err && console.warn('Your browser do not support switching full screen per javascript');
							}
						}

						function inFullScreen(){
							return !(document.fullScreenElement === null
								|| document.webkitFullscreenElement === null
								|| document.mozFullScreenElement === null
								|| document.msFullscreenElement === null);
						}
					}
				},

			};
		}


		/**
		 * Returns parameters definition
		 * @return {object}
		 */
		function getParametersDefinition(){
			return {
				'none': {name: 'none', label: translation.getTranslation('PARAMETERS'),
					tooltip: translation.getTranslation('NO_PARAMETERS_REQUIRED_TO_PERFORM_THE_ACTION'), type: 'none'},
				'additional': {
					name: 'additional',
					label: translation.getTranslation('ADD'),
					tooltip: translation.getTranslation('IF_TRUE_VALUES_WILL_BE_ADDED_TO_AN_EXISTING_SELECTION_OF_SELECTED_FIELD'),
					type: 'checkbox'
				},
				'bookmarkId': {
					name: 'bookmarkId',
					label: translation.getTranslation('BOOKMARK_ID'),
					tooltip: translation.getTranslation('BOOKMARK_ID_OF_THE_BOOKMARK_TO_BE_APPLIED'),
					type: 'dropdown',
					expression: 'optional',
					items: []
				},
				'custom': {
					name: 'custom', label: translation.getTranslation('CUSTOM'), tooltip: translation.getTranslation('CUSTOM_JAVASCRIPT_WICH_WILL_BE_EVALUATE'),
					type: 'custom',	placeholder: 'if(contextType.isMashUp){\n  // do something in mashup\n}else{\n  // do something in sens\n}'
				},
				'dimensionName': {
					name: 'dimensionName', label: translation.getTranslation('DIMENSION_NAME'), tooltip: translation.getTranslation('DIMENSION_NAME'),
					type: 'dropdown', expression: 'optional', items: []},
				'fieldName': {
					name: 'fieldName',
					label: translation.getTranslation('FIELD_NAME'),
					tooltip: translation.getTranslation('FIELD_NAME_OF_THE_FIELD_ON_WHICH_THE_SELECTION_WILL_BE_APPLIED'),
					type: 'dropdown',
					expression: 'optional',
					items: []
				},
				'fieldValue': {
					name: 'fieldValue', label: translation.getTranslation('VALUE'), tooltip: translation.getTranslation('VALUE_AS_A_STRING_WICH_SHOULD_BE_SELECTED'),
					type: 'expressionInput'},
				'fieldValues': {
					name: 'fieldValues',
					label: translation.getTranslation('VALUES_SEPERATED_WITH_SEMICOLON'),
					tooltip: translation.getTranslation('MULTIPLE_VALUES_MUST_BE_SEPARATED_BY_SEMICOLON'),
					type: 'expressionInput'
				},
				'initial': {
					name: 'initial',
					label: translation.getTranslation('INITIAL'),
					tooltip: translation.getTranslation('IF_TRUE_EXISTING_SELECTIONS_OF_SELECTED_FIELD_REMAIN_UNCHANGED'),
					type: 'checkbox'
				},
				'keep': {
					name: 'keep',
					label: translation.getTranslation('KEEP'),
					tooltip: translation.getTranslation('IF_TRUE_KEEPS_THE_VALUE_UNCHANGED_WHEN_IT_IS_ALREADY_SET'),
					type: 'checkbox'
				},
				'lockedAlso': {
					name: 'lockedAlso', label: translation.getTranslation('LOCKED_ALSO'),
					tooltip: translation.getTranslation('IF_TRUE_CLEAR_ALSO_LOCKED_SELECTIONS'), type: 'checkbox'},
				'measureName': {
					name: 'measureName', label: translation.getTranslation('MEASURE_NAME'), tooltip: translation.getTranslation('MEASURE_NAME'), type: 'dropdown',
					expresson: 'optional', items: []},
				'mashupOnly': {
					name: 'mashupOnly', label: translation.getTranslation('MASHUP_ONLY'),
					tooltip: translation.getTranslation('IF_TRUE_THIS_ACTION_WILL_BE_PERFORMED_ONLY_IN_MASHUP'), type: 'checkbox'},
				'qMode': {name: 'qMode', label: translation.getTranslation('MODE'), tooltip: translation.getTranslation('ERROR_HANDLING_MODE'),
					type: 'dropdown', items: []},
				'qPartial': {name: 'qPartial', label: translation.getTranslation('PARTIAL'),
					tooltip: translation.getTranslation('SET_TO_TRUE_FOR_PARTIAL_RELOAD'), type: 'checkbox'},
				'senseVariable': {
					name: 'senseVariable',
					label: translation.getTranslation('SENSE_VARIABLE'),
					tooltip: translation.getTranslation('NAME_OF_THE_VARIABLE'),
					type: 'dropdown',
					expression: 'optional',
					items: []
				},
				'sheetId': {
					name: 'sheetId', label: translation.getTranslation('SHEET_ID'), tooltip: translation.getTranslation('SHEET_ID_AS_NAVIGATION_TARGET'),
					type: 'dropdown', expression: 'optional', items: []},
				'softLock': {
					name: 'softLock', label: translation.getTranslation('SOFT_LOCK'),
					tooltip: translation.getTranslation('IF_TRUE_LOCKED_SELECTIONS_CAN_BE_OVERRIDDEN'), type: 'checkbox'
				},
				'storyId': {
					name: 'storyId', label: translation.getTranslation('STORY_ID'), tooltip: translation.getTranslation('STORY_ID_AS_NAVIGATION_TARGET'),
					type: 'dropdown', expression: 'optional', items: []},
				'toggle': {
					name: 'toggle', label: translation.getTranslation('TOGGLE'), tooltip: translation.getTranslation('IF_TRUE_TOGGLE_SELECTED_STATE'),
					type: 'checkbox'
				},
				'trueChartExtension': {
					name: 'trueChartExtension',
					label: translation.getTranslation('TRUECHART_EXTENSION'),
					tooltip: translation.getTranslation('TRUECHART_EXTENSION_WHICH_SHOULD_PERFORM_THE_ACTION'),
					type: 'dropdown',
					items: []
				},
				'url': {name: 'url', label: translation.getTranslation('URL'), tooltip: translation.getTranslation('URL_OF_THE_WEBSITE'), type: 'expressionInput'},
				'urlTarget': {
					name: 'urlTarget',
					label: translation.getTranslation('TARGET'),
					tooltip: translation.getTranslation('TARGET_WINDOW_CAN_BE_ANY_STRING'),
					type: 'dropdown',
					expression: 'optional',
					items: []
				},
				'variableContent': {
					name: 'variableContent', label: translation.getTranslation('VARIABLE_CONTENT'),
					tooltip: translation.getTranslation('VALUE_TO_BE_ASSIGNED_TO_THE_VARIABLE'), type: 'expressionInput'},
				'fullScreenExpression': {
					name: 'fullScreenExpression', label: translation.getTranslation('FULL_SCREEN_TOGGLE_CONDITION'),
					tooltip: translation.getTranslation('FULL_SCREEN_TOGGLE_CONDITION_DESCRIPTION'), type: 'expressionInput'
				}
			};
		}


		/**
		 * Returns triggers definition
		 * @return {object}
		 */
		function getTriggersDefiition(){
			return [
				{type: 'click', label: 'ON_CLICK'},
				{type: 'beforeUnload', label: 'BEFORE_NAVIGATION'},
				{type: 'load', label: 'ON_LOAD'},
				{type: 'selection', label: 'ON_SELECTION'},
				{
					type: 'custom',
					label: 'CUSTOM',
					tooltip: translation.getTranslation('CUSTOM_TRIGGER_TOOLTIP')
				}
			];
		}



		/**
		 * Initialize the ActionService
		 */
		function init(service){
			Promise.all([
				initLists().then(function(){ updateParameters(_listLayout, _parameters); }),
				configService.getActionBlacklist().then(function(blacklist){ updateActions(blacklist, _actions); })
			]).then(function(){ _ready.resolve(service); });

			// update definitions on language changes
			translation.onChange(function(){
				_actions = getActionsDefinition();
				_parameters = getParametersDefinition();
				_triggers = getTriggersDefiition();

				updateParameters(_listLayout, _parameters);
			});

			// define a global method for triggering cutom triggers
			window.HiCo = window.HiCo || {};
			window.HiCo.performCustomTrigger = window.HiCo.performCustomTrigger || performCustomTrigger;
		}

		/**
		 * Returns a promise which will be resolved, when the action service is ready
		 * @return {Promise}
		 */
		function getReady(){
			return _ready.promise;
		}

		/**
		 * Returns all available trueChart specific actions
		 * @return {Array}
		 */
		function getTrueChartActions(){
			try{
				var multiButtonActions = HiCo.Utils.Constants.ParameterSets.multiButtonActions;
				var multiButtonActionsTL = HiCo.Utils.Constants.ParameterSets.multiButtonActionsTL;
				return multiButtonActions.map(function(actionName, i){
					return {
						type: 'trueChart',
						isHidden: false,
						name: actionName,
						label: multiButtonActionsTL[i],
						description: multiButtonActionsTL[i],
						parameters: ['Toggle_Show_Edit_Mode', 'Refresh'].indexOf(actionName) > -1 ? ['none'] : ['trueChartExtension'],
						execute: executeTCAction
					};
				}).filter(function(action){
					return action.name !== 'Reload';
				});
			}catch(e){
				if(window.HiCoMVCInit){
					console.log('An error has occured by trying to get a list of trueChart actions.', e);
				}
				return [];
			}
		}

		/**
		 * Returns all available actions
		 * @return {*}
		 */
		function getActions(){
			// Update trueChart actions
			getTrueChartActions().forEach(function(action){
				angular.extend(_actions[action.name], action);
			});

			var allowedActions = {};
			for(var key in _actions){
				if(_actions.hasOwnProperty(key) && !_actions[key].disabled){
					allowedActions[key] = _actions[key];
				}
			}

			return !Object.keys(allowedActions).length ? null : allowedActions;
		}

		/**
		 * Returns an action object by giving name
		 * @param name {string} Name of the action
		 * @return {*}
		 */
		function getAction(name){
			return _actions[name];
		}

		/**
		 * Returns all available triggers
		 * @return {*}
		 */
		function getTriggers(){
			return _triggers;
		}

		/**
		 * Returns a specific parameter by name
		 * @param name {string} Name of the parameter
		 * @return {*}
		 */
		function getParameter(name){
			return _parameters[name];
		}

		/**
		 * Returns all parameters
		 * @return {*}
		 */
		function getParameters(){
			return updateAllLists().then(function(){
				updateParameters(_listLayout, _parameters);
				updateTrueChartExtensionList(_parameters['trueChartExtension']);
				return _parameters;
			});
		}

		function initLists(){
			return Promise.all([
				qlikService.listProvider.getListData('VariableList').then(function(variables){ _listLayout.variables = variables; }),
				qlikService.listProvider.getListData('FieldList').then(function(fields){ _listLayout.fields = fields; }),
				qlikService.listProvider.getListData('DimensionList').then(function(dimensions){ _listLayout.dimensions = dimensions; })
			]);
		}

		function updateAllLists(){
			return Promise.all([
				qlikService.listProvider.getListData('VariableList').then(function(variables){ _listLayout.variables = variables; }),
				qlikService.listProvider.getListData('FieldList').then(function(fields){ _listLayout.fields = fields; }),
				qlikService.listProvider.getListData('BookmarkList').then(function(bookmarks){ _listLayout.bookmarks = bookmarks; }),
				qlikService.listProvider.getListData('story').then(function(stories){ _listLayout.stories = stories; }),
				qlikService.listProvider.getListData('sheet').then(function(sheets){ _listLayout.sheets = sheets; }),
				qlikService.listProvider.getListData('DimensionList').then(function(dimensions){ _listLayout.dimensions = dimensions; }),
				qlikService.listProvider.getListData('MeasureList').then(function(measures){ _listLayout.measures = measures; }),
				qlikService.listProvider.getListData('MediaList').then(function(media){ _listLayout.media = media; })
			]);
		}

		/**
		 * Returns specific/corrected field parameters
		 * @param fieldName Name of the field
		 * @return {{isNumeric: boolean, fieldName: string}}
		 */
		function getFieldParameters(fieldName){
			var i, field;
			for (i = 0; i < _parameters.fieldName.items.length; i++){
				field = _parameters.fieldName.items[i];
				if(field.value === fieldName){
					return field;
				}
			}
		}

		/**
		 * Get data of a given field
		 * @param field Field object
		 * @param callback Callback, which will be executed on data
		 */
		function getFieldData(field, callback){
			field.OnData.once(callback);
			if(field.rows.length === 0){
				field.getData({rows: 10000}); // try to get as much data as possible on first request
			}else if(field.rowCount > field.rows.length){
				field.getMoreData();
			}else{
				callback();
			}
		}
	}

	/**
	 * Updates parameter items
	 * @param listLayout qlik Lists layout
	 * @param parameters Parameter collection
	 */
	function updateParameters(listLayout, parameters){

		parameters.qMode.items = [
			{value: '0', label: translation.getTranslation('DEFAULT_MODE')},
			{value: '1', label: translation.getTranslation('ATTEMPT_RECOVERY_ON_ALL_ERRORS')},
			{value: '2', label: translation.getTranslation('FAIL_ON_ALL_ERRORS')}
		];

		parameters.urlTarget.items = [
			{value: 'customWindowName', label: translation.getTranslation('NAMED_WINDOW')},
			{value: '_blank', label: translation.getTranslation('NEW_WINDOW')},
			{value: '_self', label: translation.getTranslation('SAME_WINDOW')}
		];

		listLayout.variables && (parameters.senseVariable.items = listLayout.variables.qItems.map(function(item){
			return { value: item.qName, label: item.qName};
		}));

		listLayout.bookmarks && (parameters.bookmarkId.items = listLayout.bookmarks.qItems.map(buildCommentedItem));

		listLayout.stories && (parameters.storyId.items = listLayout.stories.qItems.map(buildCommentedItem));

		listLayout.sheets && (parameters.sheetId.items = listLayout.sheets.qItems.map(buildCommentedItem));

		listLayout.dimensions && (parameters.dimensionName.items = listLayout.dimensions.qItems.map(function(item){
			return {
				qItem: item,
				value: item.qData.title,
				label: item.qData.title,
				type: 'dimension',
				fieldName: item.qData.info[0].qName.indexOf('=') === -1 ? item.qData.info[0].qName : item.qData.title,
				isNumeric: item.qData.info[0].qTags.indexOf('$numeric') > -1,
				isDate: item.qData.info[0].qTags.indexOf('$date') > -1,
				isTimestamp: item.qData.info[0].qTags.indexOf('$timestamp') > -1
			};
		}));

		listLayout.measures && (parameters.measureName.items = listLayout.measures.qItems.map(function(item){
			return {
				qItem: item,
				value: item.qData.title,
				label: item.qData.title,
				type: 'measure'
			};
		}));

		listLayout.fields && (parameters.fieldName.items = listLayout.fields.qItems.map(function(item){
			return {
				qItem: item,
				value: item.qName,
				label: item.qName,
				type: 'field',
				fieldName: item.qName,
				isNumeric: item.qTags.indexOf('$numeric') > -1,
				isDate: item.qTags.indexOf('$date') > -1,
				isTimestamp: item.qTags.indexOf('$timestamp') > -1,
				isHidden: !!item.qIsHidden
			};
		}));

		// Add dimensions to the field list
		parameters.dimensionName && (parameters.fieldName.items = parameters.dimensionName.items.filter(function(item){
			return item.qItem.qData.grouping !== 'H'; // Ignore drilldowns
		}).concat(parameters.fieldName.items));


		function buildCommentedItem(item){
			return {
				value: '= /* ' + item.qMeta.title + ' */ \'' + item.qInfo.qId + '\'',
				label: item.qMeta.title
			};
		}
	}

	/**
	 * Update actionlist and disable blacklisted actions
	 * @param blacklist {Array} A list of action names which are blacklisted
	 * @param actions {Object} Action list which has to be updated
	 */
	function updateActions(blacklist, actions){
		if(!blacklist && blacklist.constructor !== Array){ // no blacklisted actions
			return;
		}

		if(blacklist.indexOf('*') > -1){ 					// all actions are blacklisted
			for(var key in actions){
				actions.hasOwnProperty(key) && (actions[key].disabled = true);
			}
			return;
		}

		blacklist.forEach(function(actionName){				// disable blacklisted actions only
			actions[actionName] && (actions[actionName].disabled = true);
		});
	}

	/**
	 * Updatees trueChart extension list items
	 */
	function updateTrueChartExtensionList(parameter){
		try{
			// Get trueChart extensions ids
			parameter.items = HiCo.DataObjects.DocumentDO.getAllExtensions().map(function(ext){
				return {value: ext.getId(), label: ext.getTitle() + (ext.getTitle() === 'trueChart' ? (' - ' + ext.getAdapter().getServerId()) : '')};
			});
		}catch(e){
			if(window.HiCoMVCInit){
				console.warn('An error has occurred while trying to get trueChart extensions', e);
			}
		}
	}

	/**
	 * Creates a custom event
	 * @param name {string} Name of the event
	 * @param data {*} Data of the event
	 */
	function dispatchCustomEvent(name, data){
		var event = document.createEvent('Event');
		event.initEvent(name, true, true);
		event.data = data;
		document.dispatchEvent(event);
		return event;
	}

	function getExistingSelectionValues(fieldName){
		var existingSelections = qlik.currApp().selectionState().selections.filter(function(selection){
			return selection.fieldName === fieldName;
		});

		if(existingSelections.length > 0){
			return existingSelections[0].selectedValues.map(function(value){
				return value.qName;
			});
		}else{
			return []; // No existing selections found
		}
	}

	/**
	 * Executes trueChart actions (works only when trueChart is available)
	 * @param params
	 */
	function executeTCAction(params){
		var extension;
		try{
			if(this.parameters[0] === 'trueChartExtension'){
				if(params[0]){
					extension = HiCo.DataObjects.DocumentDO.getExtension(params[0]);
					if(!extension){
						console.warn('A trueChart extension with following id wasn\'t found: "' + params[0]);
						return;
					}
				}else{
					console.warn('You try to execute an trueChart action without specifiyng an extension!!!');
					return;
				}
			}else{
				// if no specific extension required (!params[0]) use the first one (for compatibility reason)
				extension = HiCo.DataObjects.DocumentDO.getAllExtensions()[0];
			}
			HiCo.Actions.GetMultiActions.triggerAction(this.name, extension);
		}catch(e){
			console.warn('An error has occurred during the execution of a trueChart action "' + this.name + '"');
		}
	}

	/**
	 * Triggers all custom triggers with specific name
	 * @param name {string} Name of the custom trigger
	 * @param data {*} Data object which will be available in the custom action as evt.data
	 */
	function performCustomTrigger(name, data){
		qvangular.$rootScope.$broadcast('performCustomTrigger', {name: name, data: data});
	}


	function isTrue(condition){
		condition  = condition.toString().toLowerCase();
		return condition === ''
			|| condition === 'true'
			|| condition === '1'
			|| condition === '-1';
	}
});