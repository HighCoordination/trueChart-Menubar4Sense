import * as qvangular from 'qvangular';
import * as Modal from '../directives/modal-dialog';
import {QlikService, qlik} from './qlik-service';
import {getTranslation, onChange} from '../translations/translation';
import {Logger} from '../logger';
import {Toastr} from '../common/toastr';
import {ConfigService} from './config-service';

const qlikService = QlikService.getInstance(),
	_configService = ConfigService.getInstance();

export class ActionService {

	constructor(){
		ActionService._instance = this;

		let _ready = qlik.Promise.defer(),
			_actions = getActionsDefinition(),
			_parameters = getParametersDefinition(),
			_triggers = getTriggersDefiition();

		/**
		 * Collection of various qlikList layouts
		 * @type {{variables: null, fields: null, bookmarks: null, stories: null, sheets: null, dimensions: null, measures: null, media: null}}
		 */
		const _listLayout = {
			appIds: null,
			apps: {},
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
					label: getTranslation('NO_ACTION'),
					description: getTranslation('NO_ACTION_WILL_BE_PERFORMED'),
					parameters: ['none'],
					execute: function(){ /* No action */}
				},

				'custom': {
					type: 'Custom',
					name: 'custom',
					label: getTranslation('CUSTOM'),
					description: getTranslation('CUSTOM_ACTION'),
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
					label: getTranslation('NEXT_SHEET/PAGE'),
					description: getTranslation('NAVIGATE_TO_NEXT_SHEET_OR_PAGE_IN_MASHUP'),
					parameters: ['none'],
					execute: function(){
						qlik.navigation.nextSheet();

						// Dispatch an "nextPage" event for navigation in MashUps
						ActionService.dispatchCustomEvent('nextPage', null);
					}
				},
				'prevSheet': {
					type: 'Navigation',
					name: 'prevSheet',
					label: getTranslation('PREVIOUS_SHEET/PAGE'),
					description: getTranslation('NAVIGATE_TO_PREVIOUS_SHEET_OR_PAGE_IN_MASHUP'),
					parameters: ['none'],
					execute: function(){
						qlik.navigation.prevSheet();

						// Dispatch an "nextPage" event for navigation in MashUps
						ActionService.dispatchCustomEvent('previousPage', null);
					}
				},
				'gotoSheet': {
					type: 'Navigation',
					name: 'gotoSheet',
					label: getTranslation('GO_TO_SHEET'),
					description: getTranslation('NAVIGATE_TO_A_SPECIFIC_SHEET'),
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
					label: getTranslation('GO_TO_STORY'),
					description: getTranslation('NAVIGATE_TO_A_SPECIFIC_STORY'),
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
					label: getTranslation('GO_TO_URL'),
					description: getTranslation('NAVIGATE_TO_A_SPECIFIC_WEBSITE'),
					parameters: ['url', 'urlTarget', 'mashupOnly'],
					execute: function(params){
						if(!params[0] || params[2] && qlikService.inClient()){
							return;
						}
						window.open(params[0], params[1]);
					}
				},
				'gotoApp': {
					type: 'Navigation',
					name: 'gotoApp',
					label: getTranslation('GO_TO_APP'),
					description: getTranslation('NAVIGATE_TO_A_SPECIFIC_APP'),
					parameters: ['appId', 'appSheetId', 'clearSelections', 'currentSelections', 'appTarget', 'customWindowName', 'email', 'emailSubject', 'emailBody'],
					optionalLabel: getTranslation('OPTIONAL_PARAMETERS'),
					optionalParameters: {
						'selectValues': {
							label: getTranslation('SELECT_VALUE(S)'),
							parameters: ['appFieldName', 'fieldValues']
						},
						'applyBookmark': {
							label: getTranslation('APPLY_BOOKMARK_SELECTION'),
							parameters: ['appBookmarkId']
						}
					},
					execute: function(params, optionalParams){
						let url = `${QlikService.biURL}sense/app/${encodeURIComponent(params[0] || '')}/sheet/${params[1]}/state/analysis/`,
							clearSelections = params[2],
							currentSelections = params[3],
							target = params[4],
							customWindowName = params[5],
							email = params[6] || '',
							emailSubject = params[7] || '',
							emailBody = (params[8] || '').replace(/(\\n|<br>|<br\/>)/g, '\n'),
							options = '',
							selections = {},
							selectionStr = '',
							bookmark = '';

						if(clearSelections){
							options += 'options/clearselections/';
						}

						if(currentSelections){
							// collect all current selections, to omit duplications in the url
							qlikService.selectionProvider.getCurrentSelections().forEach(selection =>{
								let list = selections[selection.fieldName];
								if(!list){
									list = selections[selection.fieldName] = [];
								}
								selections[selection.fieldName] = list.concat(selection.selectedValues.map(v => '[' + v + ']'));
							});
						}

						optionalParams && optionalParams.forEach(param =>{
							let fieldName, values, list;
							switch(param.type){
								case 'selectValues':
									fieldName = param.params[0];
									values = param.params[1];
									if(fieldName){
										list = selections[fieldName];
										if(!list){
											list = selections[fieldName] = [];
										}
										selections[fieldName] = list.concat(values.split(';').map(v => '[' + v + ']'));
									}
									break;
								case 'applyBookmark':
									if(param.params[0]){
										bookmark += `bookmark/${param.params[0]}/`;
									}
									break;
							}
						});

						// build selections string
						const fieldNames = Object.keys(selections);
						if(fieldNames.length){
							selectionStr = fieldNames.reduce((str, fieldName) =>{
								return str + `select/${encodeURIComponent(fieldName)}/${encodeURIComponent(selections[fieldName].join(';'))}/`;
							}, '');
						}

						url += options + selectionStr + bookmark;

						switch(target){
							case 'clipboard':
								ActionService.copyTextToClipboard(url)
									? Toastr.success(
										`<a target="_blank" href="${url}">${getTranslation('CLICK_HERE_TO_NAVIGATE')}</a>`,
										getTranslation('LINK_WAS_COPIED_TO_CLIPBOARD'),
										{escapeHtml: false}
									)
									: Toastr.error(url, 'LINK_WASNT_COPIED_TO_CLIPBOARD');
								break;
							case 'email':
								// if no placeholder found append the url to the end, otherwise replace placeholder with generated url
								!emailBody || emailBody.indexOf('{0}') === -1
									? emailBody = emailBody + '\n\n' + url
									: emailBody = emailBody.replace(/\{0\}/g, url);

								ActionService.writeMail(email, '' /*cc*/, emailSubject, emailBody);
								break;
							case 'customWindowName':
								window.open(url, customWindowName);
								break;
							default:
								window.open(url, target);
						}
					}
				},
				'shareApp': {
					type: 'Navigation',
					name: 'shareApp',
					label: getTranslation('SHARE_APP'),
					description: getTranslation('HELP_SHARE_APP'),
					parameters: ['shareAppTarget', 'email', 'emailSubject', 'emailBody'],
					execute: function(params){
						const appId = QlikService.getCurrentAppId(),
							sheetId = QlikService.getCurrentSheetId();

						if(!appId || !sheetId){
							Toastr.warn(getTranslation('HELP_SHARE_APP_NOT_SUPPORTED'), appId, sheetId);
							return;
						}

						let url = `${QlikService.biURL}sense/app/${encodeURIComponent(appId)}/sheet/${sheetId}/state/analysis/`,
							target = params[0],
							email = params[1] || '',
							emailSubject = params[2] || '',
							emailBody = (params[3] || '').replace(/(\\n|<br>|<br\/>)/g, '\n'),
							selections = {},
							selectionStr = '';


						// collect all current selections, to omit duplications in the url
						qlikService.selectionProvider.getCurrentSelections().forEach(selection =>{
							let list = selections[selection.fieldName];
							if(!list){
								list = selections[selection.fieldName] = [];
							}
							selections[selection.fieldName] = list.concat(selection.selectedValues.map(v => '[' + v + ']'));
						});

						// build selections string
						const fieldNames = Object.keys(selections);
						if(fieldNames.length){
							selectionStr = fieldNames.reduce((str, fieldName) =>{
								return str + `select/${encodeURIComponent(fieldName)}/${encodeURIComponent(selections[fieldName].join(';'))}/`;
							}, '');
						}

						url += 'options/clearselections/' + selectionStr;

						switch(target){
							case 'clipboard':
								ActionService.copyTextToClipboard(url)
									? Toastr.success(
										`<a target="_blank" href="${url}">${getTranslation('CLICK_HERE_TO_NAVIGATE')}</a>`,
										getTranslation('LINK_WAS_COPIED_TO_CLIPBOARD'),
										{escapeHtml: false}
									)
									: Toastr.error(url, 'LINK_WASNT_COPIED_TO_CLIPBOARD');
								break;
							case 'email':
								// if no placeholder found append the url to the end, otherwise replace placeholder with generated url
								!emailBody || emailBody.indexOf('{0}') === -1
									? emailBody = emailBody + '\n\n' + url
									: emailBody = emailBody.replace(/\{0\}/g, url);

								ActionService.writeMail(email, '' /*cc*/, emailSubject, emailBody);
								break;
							default:
								Logger.warn('Execute "shareApp" action without valid target definition');
						}
					}
				},

				/** Sense Actions */
				'setVariable': {
					type: 'Sense',
					name: 'setVariable',
					label: getTranslation('SET_VARIABLE'),
					description: getTranslation('SET_A_VARIABLE_TO_A_SPECIFIC_VALUE'),
					parameters: ['senseVariable', 'variableContent', 'keep'],
					execute: function(params){
						var varName = params[0],
							varContent = params[1],
							keep = params[2];
						return qlikService.getVariableValue(varName).then(function(value){
							if(!varName || keep && value){
								return;
							}
							return qlikService.app.variable.setStringValue(varName, varContent);
						});
					}
				},
				'selectValues': {
					type: 'Sense',
					name: 'selectValues',
					label: getTranslation('SELECT_VALUE(S)'),
					description: getTranslation('SELECTS_SPECIFIC_VALUES_IN_A_FIELD'),
					parameters: ['fieldName', 'fieldValues', 'toggle', 'softLock', 'initial', 'additional'],
					execute: function(params){
						var field, engineApp, deferred,
							fParams = getFieldParameters(params[0]),
							toggle = !!params[2],
							softLock = !!params[3],
							selectedValues = ActionService.getExistingSelectionValues(fParams.fieldName),
							values = params[1].split(';').map(function(val){ return val.trim(); });

						if(selectedValues.length > 0){
							if(!toggle && values.every(value => selectedValues.indexOf(value) !== -1)){
								return; // no toggle defined and values are already selected, nothing more to select
							}else if(params[4]){
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
						field = qlikService.app.field(fParams.fieldName);
						engineApp = qlikService.app.model.engineApp;
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
					label: getTranslation('SELECT_MATCH'),
					description: getTranslation('SELECTS_MATCHING_FIELD_VALUES'),
					parameters: ['fieldName', 'fieldValue', 'softLock', 'initial'],
					execute: function(params){
						var fParams = getFieldParameters(params[0]);

						if(ActionService.getExistingSelectionValues(fParams.fieldName).length > 0 && params[3]){
							return;
						}

						return qlikService.app.field(fParams.fieldName).selectMatch(params[1], params[2]);
					}
				},
				'selectAlternative': {
					type: 'Sense',
					name: 'selectAlternative',
					label: getTranslation('SELECT_ALTERNATIVE'),
					description: getTranslation('SELECTS_ALTERNATIVE_VALUES_IN_A_FIELD'),
					parameters: ['fieldName', 'softLock'],
					execute: function(params){
						try{
							return qlikService.app.field(getFieldParameters(params[0]).fieldName).selectAlternative(params[1]);
						}catch(e){
							console.warn("Action:", this.name, "| Parameters:", this.parameters.toString(), "| Value:", params, "| Error:", e);
						}
					}
				},
				'selectExcluded': {
					type: 'Sense',
					name: 'selectExcluded',
					label: getTranslation('SELECT_EXCLUDED'),
					description: getTranslation('SELECTS_EXCLUDED_VALUES_IN_A_FIELD'),
					parameters: ['fieldName', 'softLock'],
					execute: function(params){
						try{
							return qlikService.app.field(getFieldParameters(params[0]).fieldName).selectExcluded(params[1]);
						}catch(e){
							console.warn("Action:", this.name, "| Parameters:", this.parameters.toString(), "| Value:", params, "| Error:", e);
						}
					}
				},
				'selectPossible': {
					type: 'Sense',
					name: 'selectPossible',
					label: getTranslation('SELECT_POSSIBLE'),
					description: getTranslation('SELECTS_MATCHING_FIELD_VALUES'),
					parameters: ['fieldName', 'softLock'],
					execute: function(params){
						try{
							return qlikService.app.field(getFieldParameters(params[0]).fieldName).selectPossible(params[1]);
						}catch(e){
							console.warn("Action:", this.name, "| Parameters:", this.parameters.toString(), "| Value:", params, "| Error:", e);
						}
					}
				},
				'selectAll': {
					type: 'Sense',
					name: 'selectAll',
					label: getTranslation('SELECT_ALL'),
					description: getTranslation('SELECTS_ALL_VALUES_IN_A_FIELD'),
					parameters: ['fieldName', 'softLock'],
					execute: function(params){
						try{
							return qlikService.app.field(getFieldParameters(params[0]).fieldName).selectAll(params[1]);
						}catch(e){
							console.warn("Action:", this.name, "| Parameters:", this.parameters.toString(), "| Value:", params, "| Error:", e);
						}
					}
				},
				'clearField': {
					type: 'Sense',
					name: 'clearField',
					label: getTranslation('CLEAR_FIELD'),
					description: getTranslation('CLEARS_A_FIELD_SELECTION'),
					parameters: ['fieldName'],
					execute: function(params){
						try{
							return qlikService.app.field(getFieldParameters(params[0]).fieldName).clear();
						}catch(e){
							console.warn("Action:", this.name, "| Parameters:", this.parameters.toString(), "| Value:", params, "| Error:", e);
						}
					}
				},
				'clearOther': {
					type: 'Sense',
					name: 'clearOther',
					label: getTranslation('CLEAR_OTHER'),
					description: getTranslation('CLEARS_ALL_FIELDS_EXCEPT_THE_SELECTED_ONE'),
					parameters: ['fieldName', 'softLock'],
					execute: function(params){
						try{
							return qlikService.app.field(getFieldParameters(params[0]).fieldName).clearOther(params[1]);
						}catch(e){
							console.warn("Action:", this.name, "| Parameters:", this.parameters.toString(), "| Value:", params, "| Error:", e);
						}
					}
				},
				'clearAll': {
					type: 'Sense',
					name: 'clearAll',
					label: getTranslation('CLEAR_ALL'),
					description: getTranslation('CLEARS_ALL_SELECTIONS_IN_ALL_FIELDS_OF_THE_CURRENT_QLIK_SENSE_APP'),
					parameters: ['lockedAlso'/*, 'alternateState'*/], // don't know how to deal with "alternateState", so don't use it...
					execute: function(params){
						try{
							return qlikService.app.clearAll(params[0], params[1]);
						}catch(e){
							console.warn("Action:", this.name, "| Parameters:", this.parameters.toString(), "| Value:", params, "| Error:", e);
						}
					}
				},
				'lockField': {
					type: 'Sense',
					name: 'lockField',
					label: getTranslation('LOCK_FIELD'),
					description: getTranslation('LOCKS_A_FIELD_SELECTION'),
					parameters: ['fieldName'],
					execute: function(params){
						try{
							return qlikService.app.field(getFieldParameters(params[0]).fieldName).lock();
						}catch(e){
							console.warn("Action:", this.name, "| Parameters:", this.parameters.toString(), "| Value:", params, "| Error:", e);
						}
					}
				},
				'lockAll': {
					type: 'Sense',
					name: 'lockAll',
					label: getTranslation('LOCK_ALL'),
					description: getTranslation('LOCKS_ALL_SELECTIONS'),
					parameters: ['lockedAlso'/*, 'alternateState'*/],
					execute: function(params){
						try{
							return qlikService.app.lockAll(params[0]);
						}catch(e){
							console.warn("Action:", this.name, "| Parameters:", this.parameters.toString(), "| Value:", params, "| Error:", e);
						}
					}
				},
				'unlockAll': {
					type: 'Sense',
					name: 'unlockAll',
					label: getTranslation('UNLOCK_ALL'),
					description: getTranslation('UNLOCKS_ALL_SELECTIONS_THAT_HAS_PREVIOUSLY_BEEN_LOCKED'),
					parameters: [/*'alternateState'*/ 'none'],
					execute: function(params){
						try{
							return qlikService.app.unlockAll(params[0]);
						}catch(e){
							console.warn("Action:", this.name, "| Parameters:", this.parameters.toString(), "| Value:", params, "| Error:", e);
						}
					}
				},
				'applyBookmark': {
					type: 'Sense',
					name: 'applyBookmark',
					label: getTranslation('APPLY_BOOKMARK_SELECTION'),
					description: getTranslation('APPLIES_A_BOOKMARK_SELECTION'),
					parameters: ['bookmarkId'],
					execute: function(params){
						try{
							return qlikService.app.bookmark.apply(params[0]);
						}catch(e){
							console.warn("Action:", this.name, "| Parameters:", this.parameters.toString(), "| Value:", params, "| Error:", e);
						}
					}
				},
				'reloadData': {
					type: 'Sense',
					name: 'reloadData',
					label: getTranslation('RELOAD_DATA'),
					description: getTranslation('RELOADS_THE_DATA_IN_A_QLIK_SENSE_APP'),
					parameters: ['qMode', 'qPartial'],
					execute: function(params){
						try{
							let $scope = qvangular.$rootScope.$new();
							Modal.show({
								scope: $scope,
								title: getTranslation('RELOAD_IN_PROGRESS'),
								body: getTranslation('RELOAD_IS_RUNNING')
							});
							return qlikService.doReload(parseInt(params[0]), params[1]).then(() =>{
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
				'Toggle_Show_Edit_Mode': {type: 'trueChart', isHidden: true, name: 'Toggle_Show_Edit_Mode', parameters: ['none'], execute: ActionService.executeTCAction},
				'Save_Changed': {type: 'trueChart', isHidden: true, name: 'Save_Changed', parameters: ['trueChartExtension'], execute: ActionService.executeTCAction},
				'Save_All': {type: 'trueChart', isHidden: true, name: 'SaveAll', parameters: ['trueChartExtension'], execute: ActionService.executeTCAction},
				'Refresh': {type: 'trueChart', isHidden: true, name: 'Refresh', parameters: ['none'], execute: ActionService.executeTCAction},
				'Export_As_PDF': {type: 'trueChart', isHidden: true, name: 'Export_As_PDF', parameters: ['trueChartExtension'], execute: ActionService.executeTCAction},
				'Export_As_PNG': {type: 'trueChart', isHidden: true, name: 'Export_As_PNG', parameters: ['trueChartExtension'], execute: ActionService.executeTCAction},
				'Export_As_EMF': {type: 'trueChart', isHidden: true, name: 'Export_As_EMF', parameters: ['trueChartExtension'], execute: ActionService.executeTCAction},
				'Export_As_XLS': {type: 'trueChart', isHidden: true, name: 'Export_As_XLS', parameters: ['trueChartExtension'], execute: ActionService.executeTCAction},
				'Reload_Common_Tables': {type: 'trueChart', isHidden: true, name: 'Reload_Common_Tables', parameters: ['trueChartExtension'], execute: ActionService.executeTCAction},

				'toggleFullScreen': {
					type: 'Other',
					name: 'toggleFullScreen',
					label: getTranslation('TOGGLE_FULL_SCREEN'),
					description: getTranslation('TOGGLE_FULL_SCREEN_DESCRIPTION'),
					supportedTriggers: ['click'],
					parameters: ['fullScreenExpression'],
					execute: function(params){
						var fullscreen = ActionService.isTrue(typeof params[0] !== 'undefined' ? params[0] : !inFullScreen());

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
				'none': {name: 'none', label: getTranslation('PARAMETERS'),
					tooltip: getTranslation('NO_PARAMETERS_REQUIRED_TO_PERFORM_THE_ACTION'), type: 'none'},
				'additional': {
					name: 'additional',
					label: getTranslation('ADD'),
					tooltip: getTranslation('IF_TRUE_VALUES_WILL_BE_ADDED_TO_AN_EXISTING_SELECTION_OF_SELECTED_FIELD'),
					type: 'checkbox'
				},
				'appId': {
					name: 'appId',
					label: getTranslation('APP_ID'),
					tooltip: getTranslation('APP_ID_AS_NAVIGATION_TARGET'),
					type: 'dropdown',
					expression: 'optional',
					items: [],
					loadItems: function(){
						if(this.items.length){
							// it is also a WORKAROUND (introduced with HICO-2564) for a buggy Sense string component
							// which throws null pointer exceptions, when this.items gets "reassigned" more then once
							// on the other hand, items were already loaded, so no need to do it again
							return Promise.resolve();
						}

						this.loading = true;
						this.items = [{value: '', label: getTranslation('DATA_IS_LOADING')}];
						return getSpecialList('AppList', 'appIds').then(appIds =>{
							this.items = appIds.qItems.map(item => ({
								value: `= /* ${item.qTitle} */ '${item.qDocId}'`,
								label: item.qTitle
							}));
							this.loading = false;
						}).catch(error =>{
							this.items = [];
							this.loading = false;
							Logger.error('Error occured during update of appBookmarkId items', error);
						});
					},
					onChange: function(appIdExpr){
						qlikService.evalExpression(appIdExpr).then(appId =>{
							if(appId){
								for(let key in _parameters){
									const paramDef = _parameters[key];
									if(_parameters.hasOwnProperty(key) && paramDef.dependsOn && paramDef.dependsOn.appId){
										typeof paramDef.onDependencyChange === 'function' && paramDef.onDependencyChange({appId});
									}
								}
							}
						}).catch(error => Logger.error('Error occurred during onChange handler of appIds', error));
					},
					loading: false
				},
				'appBookmarkId': {
					label: getTranslation('BOOKMARK_ID'),
					tooltip: getTranslation('BOOKMARK_ID_OF_THE_BOOKMARK_TO_BE_APPLIED'),
					type: 'dropdown',
					expression: 'optional',
					items: [{value: '', label: getTranslation('SELECT_AN_APP_FIRST')}],
					dependsOn: {appId: true},
					onDependencyChange(deps){
						let getItems, appId = deps.appId, appLists = _listLayout.apps[appId];

						if(appLists && appLists.bookmarks){
							getItems = Promise.resolve(appLists.bookmarks.qItems);
						}else{
							this.items = [{value: '', label: getTranslation('DATA_IS_LOADING')}];
							this.loading = true;
							getItems = qlikService.openApp(appId).then(app => app.getList('BookmarkList')).then(list =>{
								appLists = _listLayout.apps[appId] || (_listLayout.apps[appId] = {});
								appLists.bookmarks = list.layout.qBookmarkList;
								return appLists.bookmarks.qItems;
							});
						}

						getItems.then(items =>{
							this.items = items.map(QlikService.mapCommentedItem);
							this.loading = false;
							qlikService.closeAppDelayed(appId);
						}).catch(err =>{
							this.items = [{value: '', label: getTranslation('NO_DATA_AVAILABLE')}];
							this.loading = false;
							qlikService.closeAppDelayed(appId);
							Logger.error('Error occurred during update of appBookmarkId items', err);
						});
					},
					loading: false
				},
				'appFieldName': {
					label: getTranslation('FIELD_NAME'),
					tooltip: getTranslation('FIELD_NAME_OF_THE_FIELD_ON_WHICH_THE_SELECTION_WILL_BE_APPLIED'),
					type: 'dropdown',
					expression: 'optional',
					items: [{value: '', label: getTranslation('SELECT_AN_APP_FIRST')}],
					dependsOn: {appId: true},
					onDependencyChange(deps){
						let getItems, appId = deps.appId, appLists = _listLayout.apps[appId];

						if(appLists && appLists.fields && appLists.dimensions){
							getItems = Promise.resolve([appLists.fields.qItems, appLists.dimensions.qItems]);
						}else{
							this.loading = true;
							this.items = [{value: '', label: getTranslation('DATA_IS_LOADING')}];
							getItems = Promise.all([
								qlikService.openApp(appId).then(app => app.getList('FieldList')),
								qlikService.openApp(appId).then(app => app.getList('DimensionList'))
							]).then(lists =>{
								appLists = _listLayout.apps[appId] || (_listLayout.apps[appId] = {});
								appLists.fields = lists[0].layout.qFieldList;
								appLists.dimensions = lists[1].layout.qDimensionList;
								return [appLists.fields.qItems, appLists.dimensions.qItems];
							});
						}

						getItems.then(items =>{
							this.items = items[1]
								.filter(item => item.qData.grouping !== 'H') // dimensions without drilldowns
								.map(QlikService.mapDimensionItem)
								.concat(items[0].map(QlikService.mapFieldItem));
							this.loading = false;
							qlikService.closeAppDelayed(appId);
						}).catch(err => {
							this.items = [{value: '', label: getTranslation('NO_DATA_AVAILABLE')}];
							this.loading = false;
							qlikService.closeAppDelayed(appId);
							Logger.error('Error occurred during update of appFieldName items', err);
						});
					},
					loading: false
				},
				'appSheetId': {
					name: 'appSheetId',
					label: getTranslation('SHEET_ID'),
					tooltip: getTranslation('SHEET_ID_AS_NAVIGATION_TARGET'),
					type: 'dropdown',
					expression: 'optional',
					items: [{value: '', label: getTranslation('SELECT_AN_APP_FIRST')}],
					dependsOn: {appId: true},
					onDependencyChange(deps){
						let getItems, appId = deps.appId, appLists = _listLayout.apps[appId];

						if(appLists && appLists.sheets){
							getItems = Promise.resolve(appLists.sheets.qItems);
						}else{
							this.items = [{value: '', label: getTranslation('DATA_IS_LOADING')}];
							this.loading = true;
							getItems = qlikService.openApp(appId).then(app => app.getList('sheet')).then(list =>{
								appLists = _listLayout.apps[appId] || (_listLayout.apps[appId] = {});
								appLists.sheets = list.layout.qAppObjectList;
								return appLists.sheets.qItems;
							});
						}

						getItems.then(items =>{
							this.items = items.map(QlikService.mapCommentedItem);
							this.loading = false;
							qlikService.closeAppDelayed(appId);
						}).catch(err => {
							this.items = [{value: '', label: getTranslation('NO_DATA_AVAILABLE')}];
							this.loading = false;
							qlikService.closeAppDelayed(appId);
							Logger.error('Error occurred during update of appSheetId items', err);
						});
					},
					loading: false
				},
				'appTarget': {
					name: 'appTarget',
					label: getTranslation('TARGET'),
					tooltip: getTranslation('HELP_GOTO_APP_TARGET'),
					className: 'col-sm-6',
					type: 'dropdown',
					defaultValue: '_blank',
					items: []
				},
				'bookmarkId': {
					name: 'bookmarkId',
					label: getTranslation('BOOKMARK_ID'),
					tooltip: getTranslation('BOOKMARK_ID_OF_THE_BOOKMARK_TO_BE_APPLIED'),
					type: 'dropdown',
					expression: 'optional',
					items: []
				},
				'clearSelections': {
					name: 'clearSelections',
					label: getTranslation('CLEAR'),
					tooltip: getTranslation('HELP_CLEAR_ALL_SELECTIONS'),
					type: 'checkbox',
				},
				'currentSelections': {
					name: 'currentSelections',
					label: getTranslation('CURRENT'),
					tooltip: getTranslation('HELP_CURRENT_SELECTIONS'),
					type: 'checkbox',
				},
				'custom': {
					name: 'custom', label: getTranslation('CUSTOM'), tooltip: getTranslation('CUSTOM_JAVASCRIPT_WICH_WILL_BE_EVALUATE'),
					type: 'custom',	placeholder: 'if(contextType.isMashUp){\n  // do something in mashup\n}else{\n  // do something in sens\n}'
				},
				'customWindowName': {
					name: 'customWindowName',
					label: getTranslation('NAMED_WINDOW'),
					tooltip: getTranslation('HELP_NAMED_WINDOW'),
					type: 'expressionInput',
					className: 'col-sm-12',
					show: (action) => showWhenParameter(action, 'customWindowName')
				},
				'dimensionName': {
					name: 'dimensionName', label: getTranslation('DIMENSION_NAME'), tooltip: getTranslation('DIMENSION_NAME'),
					type: 'dropdown', expression: 'optional', items: []},
				'email': {
					name: 'email',
					label: getTranslation('EMAIL_RECIPIENT'),
					tooltip: getTranslation('EMAIL_RECIPIENT'),
					type: 'expressionInput',
					expression: 'optional',
					show: (action) => showWhenParameter(action, 'email'),
					className: 'col-sm-6'
				},
				'emailSubject': {
					name: 'emailSubject',
					label: getTranslation('EMAIL_SUBJECT'),
					tooltip: getTranslation('EMAIL_SUBJECT'),
					type: 'expressionInput',
					expression: 'optional',
					show: (action) => showWhenParameter(action, 'email'),
					className: 'col-sm-6'
				},
				'emailBody': {
					name: 'emailBody',
					label: getTranslation('EMAIL_BODY'),
					tooltip: getTranslation('HELP_EMAIL_BODY_PARAMETER'),
					type: 'expressionInput',
					expression: 'optional',
					show: (action) => showWhenParameter(action, 'email'),
					className: 'col-sm-12'
				},
				'fieldName': {
					name: 'fieldName',
					label: getTranslation('FIELD_NAME'),
					tooltip: getTranslation('FIELD_NAME_OF_THE_FIELD_ON_WHICH_THE_SELECTION_WILL_BE_APPLIED'),
					type: 'dropdown',
					expression: 'optional',
					items: []
				},
				'fieldValue': {
					name: 'fieldValue', label: getTranslation('VALUE'), tooltip: getTranslation('VALUE_AS_A_STRING_WICH_SHOULD_BE_SELECTED'),
					type: 'expressionInput'},
				'fieldValues': {
					name: 'fieldValues',
					label: getTranslation('VALUES_SEPERATED_WITH_SEMICOLON'),
					tooltip: getTranslation('MULTIPLE_VALUES_MUST_BE_SEPARATED_BY_SEMICOLON'),
					type: 'expressionInput'
				},
				'initial': {
					name: 'initial',
					label: getTranslation('INITIAL'),
					tooltip: getTranslation('IF_TRUE_EXISTING_SELECTIONS_OF_SELECTED_FIELD_REMAIN_UNCHANGED'),
					type: 'checkbox'
				},
				'keep': {
					name: 'keep',
					label: getTranslation('KEEP'),
					tooltip: getTranslation('IF_TRUE_KEEPS_THE_VALUE_UNCHANGED_WHEN_IT_IS_ALREADY_SET'),
					type: 'checkbox'
				},
				'lockedAlso': {
					name: 'lockedAlso', label: getTranslation('LOCKED_ALSO'),
					tooltip: getTranslation('IF_TRUE_CLEAR_ALSO_LOCKED_SELECTIONS'), type: 'checkbox'},
				'measureName': {
					name: 'measureName', label: getTranslation('MEASURE_NAME'), tooltip: getTranslation('MEASURE_NAME'), type: 'dropdown',
					expresson: 'optional', items: []},
				'mashupOnly': {
					name: 'mashupOnly', label: getTranslation('MASHUP_ONLY'),
					tooltip: getTranslation('IF_TRUE_THIS_ACTION_WILL_BE_PERFORMED_ONLY_IN_MASHUP'), type: 'checkbox'},
				'qMode': {name: 'qMode', label: getTranslation('MODE'), tooltip: getTranslation('ERROR_HANDLING_MODE'),
					type: 'dropdown', items: []},
				'qPartial': {name: 'qPartial', label: getTranslation('PARTIAL'),
					tooltip: getTranslation('SET_TO_TRUE_FOR_PARTIAL_RELOAD'), type: 'checkbox'},
				'senseVariable': {
					name: 'senseVariable',
					label: getTranslation('SENSE_VARIABLE'),
					tooltip: getTranslation('NAME_OF_THE_VARIABLE'),
					type: 'dropdown',
					expression: 'optional',
					items: []
				},
				'shareAppTarget':{
					name: 'appTarget',
					label: getTranslation('TARGET'),
					tooltip: getTranslation('HELP_SHARE_APP_TARGET'),
					type: 'dropdown',
					className: 'col-sm-12',
					defaultValue: 'email',
					items: []
				},
				'sheetId': {
					name: 'sheetId', label: getTranslation('SHEET_ID'), tooltip: getTranslation('SHEET_ID_AS_NAVIGATION_TARGET'),
					type: 'dropdown', expression: 'optional', items: []},
				'softLock': {
					name: 'softLock', label: getTranslation('SOFT_LOCK'),
					tooltip: getTranslation('IF_TRUE_LOCKED_SELECTIONS_CAN_BE_OVERRIDDEN'), type: 'checkbox'
				},
				'storyId': {
					name: 'storyId', label: getTranslation('STORY_ID'), tooltip: getTranslation('STORY_ID_AS_NAVIGATION_TARGET'),
					type: 'dropdown', expression: 'optional', items: []},
				'toggle': {
					name: 'toggle', label: getTranslation('TOGGLE'), tooltip: getTranslation('IF_TRUE_TOGGLE_SELECTED_STATE'),
					type: 'checkbox'
				},
				'trueChartExtension': {
					name: 'trueChartExtension',
					label: getTranslation('TRUECHART_EXTENSION'),
					tooltip: getTranslation('TRUECHART_EXTENSION_WHICH_SHOULD_PERFORM_THE_ACTION'),
					type: 'dropdown',
					items: []
				},
				'url': {name: 'url', label: getTranslation('URL'), tooltip: getTranslation('URL_OF_THE_WEBSITE'), type: 'expressionInput'},
				'urlTarget': {
					name: 'urlTarget',
					label: getTranslation('TARGET'),
					tooltip: getTranslation('TARGET_WINDOW_CAN_BE_ANY_STRING'),
					type: 'dropdown',
					expression: 'optional',
					defaultValue: '_blank',
					items: []
				},
				'variableContent': {
					name: 'variableContent', label: getTranslation('VARIABLE_CONTENT'),
					tooltip: getTranslation('VALUE_TO_BE_ASSIGNED_TO_THE_VARIABLE'), type: 'expressionInput'},
				'fullScreenExpression': {
					name: 'fullScreenExpression', label: getTranslation('FULL_SCREEN_TOGGLE_CONDITION'),
					tooltip: getTranslation('FULL_SCREEN_TOGGLE_CONDITION_DESCRIPTION'), type: 'expressionInput'
				}
			};
		}

		function showWhenParameter(action, targetParam){
			for(let p in action.paramsExpr){
				if(action.paramsExpr[p] === targetParam){
					return true;
				}
			}
			return false;
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
					tooltip: getTranslation('CUSTOM_TRIGGER_TOOLTIP')
				}
			];
		}



		/**
		 * Initialize the ActionService
		 */
		function init(service){
			Promise.all([
				initLists().then(() => ActionService.updateParameters(_listLayout, _parameters)),
				_configService.getActionBlacklist().then((blacklist) => ActionService.updateActions(blacklist, _actions))
			]).then(() => _ready.resolve(service));

			// update definitions on language changes
			onChange(function(){
				_actions = getActionsDefinition();
				_parameters = getParametersDefinition();
				_triggers = getTriggersDefiition();

				ActionService.updateParameters(_listLayout, _parameters);
			});

			// define a global method for triggering cutom triggers
			window.HiCo = window.HiCo || {};
			window.HiCo.performCustomTrigger = window.HiCo.performCustomTrigger || ActionService.performCustomTrigger;
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
						execute: ActionService.executeTCAction
					};
				}).filter(function(action){
					return action.name !== 'Reload';
				});
			}catch(e){
				if(window.HiCoMVCInit){
					console.log('An error has occurred by trying to get a list of trueChart actions.', e);
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
			return updateMainLists().then(() =>{
				ActionService.updateParameters(_listLayout, _parameters);
				ActionService.updateTrueChartExtensionList(_parameters['trueChartExtension']);
				return _parameters;
			});
		}

		function initLists(){
			return Promise.all([
				getSpecialList('VariableList', 'variables'),
				getSpecialList('FieldList', 'fields'),
				getSpecialList('DimensionList', 'dimensions')
			]);
		}

		function updateMainLists(){
			return Promise.all([
				getSpecialList('VariableList', 'variables'),
				getSpecialList('FieldList', 'fields'),
				getSpecialList('BookmarkList', 'bookmarks'),
				getSpecialList('story', 'stories'),
				getSpecialList('sheet', 'sheets'),
				getSpecialList('DimensionList', 'dimensions'),
				getSpecialList('MeasureList', 'measures'),
				getSpecialList('MediaList', 'media')
			]);
		}

		/**
		 * Retrieves a list by given listName from the app and store the result by given key
		 *
		 * @param {string} listName - List name to be retrieved
		 * @param {string} key - Key value where the list should be stored
		 */
		function getSpecialList(listName, key){
			return qlikService.listProvider.getListData(listName).then((list) => _listLayout[key] = list);
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
	 * Returns the instance of the ActionService
	 * @return {*}
	 */
	static getInstance(){
		return this._instance || new ActionService();
	}

	/**
	 * Updates parameter items
	 * @param listLayout qlik Lists layout
	 * @param parameters Parameter collection
	 */
	static updateParameters(listLayout, parameters){

		parameters.qMode.items = [
			{value: '0', label: getTranslation('DEFAULT_MODE')},
			{value: '1', label: getTranslation('ATTEMPT_RECOVERY_ON_ALL_ERRORS')},
			{value: '2', label: getTranslation('FAIL_ON_ALL_ERRORS')}
		];

		parameters.urlTarget.items = [
			{value: 'customWindowName', label: getTranslation('NAMED_WINDOW')},
			{value: '_blank', label: getTranslation('NEW_WINDOW')},
			{value: '_self', label: getTranslation('SAME_WINDOW')}
		];

		parameters.shareAppTarget.items = [
			{value: 'clipboard', label: getTranslation('CLIPBOARD')},
			{value: 'email', label: getTranslation('EMAIL')}
		];

		parameters.appTarget.items = [
			...parameters.urlTarget.items, ...parameters.shareAppTarget.items
		];

		listLayout.variables && (parameters.senseVariable.items = listLayout.variables.qItems.map(function(item){
			return { value: item.qName, label: item.qName};
		}));

		listLayout.bookmarks && (parameters.bookmarkId.items = listLayout.bookmarks.qItems.map(QlikService.mapCommentedItem));

		listLayout.stories && (parameters.storyId.items = listLayout.stories.qItems.map(QlikService.mapCommentedItem));

		listLayout.sheets && (parameters.sheetId.items = listLayout.sheets.qItems.map(QlikService.mapCommentedItem));

		listLayout.dimensions && (parameters.dimensionName.items = listLayout.dimensions.qItems.map(QlikService.mapDimensionItem));

		listLayout.measures && (parameters.measureName.items = listLayout.measures.qItems.map(function(item){
			return {
				qItem: item,
				value: item.qData.title,
				label: item.qData.title,
				type: 'measure'
			};
		}));

		listLayout.fields && (parameters.fieldName.items = listLayout.fields.qItems.map(QlikService.mapFieldItem));

		// Add dimensions to the field list
		parameters.dimensionName && (parameters.fieldName.items = parameters.dimensionName.items.filter(function(item){
			return item.qItem.qData.grouping !== 'H'; // Ignore drilldowns
		}).concat(parameters.fieldName.items));
	}


	/**
	 * Update actionlist and disable blacklisted actions
	 * @param blacklist {Array} A list of action names which are blacklisted
	 * @param actions {Object} Action list which has to be updated
	 */
	static updateActions(blacklist, actions){
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
	static updateTrueChartExtensionList(parameter){
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
	static dispatchCustomEvent(name, data){
		var event = document.createEvent('Event');
		event.initEvent(name, true, true);
		event.data = data;
		document.dispatchEvent(event);
		return event;
	}

	static getExistingSelectionValues(fieldName){
		var existingSelections = qlikService.app.selectionState().selections.filter(function(selection){
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
	static executeTCAction(params){
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
	static performCustomTrigger(name, data){
		qvangular.$rootScope.$broadcast('performCustomTrigger', {name: name, data: data});
	}

	static isTrue(condition){
		condition  = condition.toString().toLowerCase();
		return condition === ''
			|| condition === 'true'
			|| condition === '1'
			|| condition === '-1';
	}

	/**
	 * Copies given text to clipboard
	 *
	 * @param {string} text - Text to be copied
	 *
	 * @retrn {boolean} - returns true, if copy was successful, false otherwise
	 */
	static copyTextToClipboard(text){
		const textArea = document.createElement('textarea');

		textArea.style.position = 'fixed';
		textArea.style.top = '9000px';

		textArea.value = text;
		document.body.appendChild(textArea);
		textArea.select();

		let success;
		try {
			success = document.execCommand('copy');
		} catch (err) {
			success = false;
			console.warn('Oops, unable to copy text to clipboard');
		}
		document.body.removeChild(textArea);
		return success;
	}

	/**
	 * Opens the default mail client with given parameters
	 *
	 * @param {string} mailto
	 * @param {string} cc
	 * @param {string} subject
	 * @param {string} body
	 */
	static writeMail(mailto, cc, subject, body) {
		window.location.href = `mailto:${mailto}?`
			+ (cc ? `cc=${cc}&` : '')
			+ (subject ? `subject=${subject}&` : '')
			+ (body ? `body=${encodeURIComponent(body)}` : '');
	}

	/**
	 * Loads data of actions parameter items
	 *
	 * @param {string} actionName
	 *
	 * @return {Promise<*>}
	 */
	loadActionParameterItems(actionName){
		const actionDef = this.getAction(actionName);
		if(actionDef && actionDef.parameters){
			return Promise.all(actionDef.parameters.map(param => this.loadParameterItems(param)));
		}
		return Promise.resolve();
	}

	/**
	 * Loads parameter specific data
	 *
	 * @param {string} paramName
	 *
	 * @return {Promise<void>} - Returns a promise which will be resolved, when parameters are loaded (if any)
	 */
	loadParameterItems(paramName){
		const paramDef = this.getParameter(paramName);

		if(paramDef && typeof paramDef.loadItems === 'function'){
			let needConfirmation = false;

			// only show toastr when data loading takes a while
			const loadTimer = setTimeout(() => {
				needConfirmation = true;
				Toastr.info(getTranslation('DATA_IS_LOADING'));
			}, 500);

			return paramDef.loadItems().then(() => {
				clearTimeout(loadTimer);
				needConfirmation && Toastr.success(getTranslation('DATA_SUCCESSFULLY_LOADED'));
			});
		}
		return Promise.resolve();
	}
}