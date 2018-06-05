import * as qlik from 'qlik';
import * as qvangular from 'qvangular';
import {prefix} from '../prefix';
import {Toastr} from '../common/toastr';
import {Logger} from '../logger';
import {getTranslation} from '../translations/translation';
import {Deferred} from '../common/global';

const _instances = {}, // holds QlikService instances with appId as key
	_appsTimeouts = {}, // app dependent timers which are used to close the delayed
	_appClosingDelay = 5000, // wait a specific amount of time, before closing the app
	_apps = {}, // app collection with appId as key
	_debounceTime = 50, // delay before request is repeated
	_maxTries = 5; // maximum requests before giving up

export class QlikService {

	// Static methodes/properties
	static getInstance(/*appId*/){
//		if(typeof appId.id !== 'string' || !appId){
//			throw new Error('You must provide a valid appId as parameter');
//		}
//		const id = appId.toLowerCase();
		const id = 'currApp'; // use currApp as id (for now) but it should be "improved" for multi app support
		if(!_instances[id]){
			_instances[id] = new QlikService(id);
		}
		return _instances[id];
	}

	static isPrinting(){
		const app = qlik.currApp(),
			isOnline = app && app.global && app.global.session && app.global.session.options !== undefined; // assume that we are "inApp"
		return !isOnline && typeof window.qlikPrintingService !== 'undefined';
	}

	/**
	 * Checks if the given condition is truthy
	 *
	 * @param {string} value - Condition to be checked
	 *
	 * @return {boolean} - true if condition is interpreted as truthy, false otherwise
	 */
	static isTrueCondition(value){
		const condition = value && value.toString().toLowerCase() || '';
		return condition === ''
			|| condition === 'true'
			|| condition === '1'
			|| condition === '-1';
	}

	/**
	 * Checks if current environment corresponds to inClient mode
	 *
	 * @return {boolean}
	 */
	static inClient(){
		return qlik.navigation.inClient === true;
	}

	/**
	 * Get base url of used BI (Qlik Sense)
	 *
	 * @returns {string}
	 */
	static getBIUrl(){
		let options = qlik.getGlobal().session.options,
			prefix = options.prefix || '';

		// make sure the prefix ends with '/'
		if(prefix[prefix.length - 1] !== '/'){
			prefix += '/';
		}
		return QlikService._biURL = (options.isSecure ? 'https://' : 'http://') + options.host + (options.port ? (':' + options.port) : '') + prefix;
	}

	/**
	 * Getter for the base url of BI used by "origin" app
	 *
	 * @return {string}
	 */
	static get biURL(){
		return QlikService._biURL || this.getBIUrl();
	}

	/**
	 * Returns the id of the current app
	 *
	 * @return {string} - Returns the appId, or an empty string when unavailable
	 */
	static getCurrentAppId(){
		const app = qlik.currApp();
		if(app && typeof app.id === 'string'){
			return app.id;
		}
		return '';
	}

	/**
	 * Returns the id of the current sheet
	 *
	 * @return {string} - Returns the sheetId, or an empty string when unavailable
	 */
	static getCurrentSheetId(){
		const reply = qlik.navigation.getCurrentSheetId();
		if(reply && reply.success){
			return reply.sheetId;
		}
		return '';
	}

	/**
	 * Returns the authenticated user in a Promise as a string
	 *
	 * @return {Promise<string>}
	 */
	static getAuthenticatedUser(){
		return qlik.getGlobal().getAuthenticatedUser();
	}

	/**
	 * Returns an item object with value and label properties, where value is a Qlik Sense expression with title inside a comment
	 *
	 * @param {qItem} item - Item to be mapped
	 *
	 * @return {{value: string, label: string}}
	 */
	static mapCommentedItem(item){
		return {
			value: '= /* ' + item.qMeta.title + ' */ \'' + item.qInfo.qId + '\'',
			label: item.qMeta.title
		};
	}

	/**
	 * Returns an item object containing specific dimension properties
	 *
	 * @param {qItem} item - Dimension item to be mapped
	 *
	 * @return {{qItem: *, value: string|string, label: string|string, type: string, fieldName: string|string, isNumeric: boolean, isDate: boolean, isTimestamp: boolean}}
	 */
	static mapDimensionItem(item){
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
	}

	/**
	 * Returns an item object containing specific field properties
	 *
	 * @param {qItem} item - Field item to be mapped
	 *
	 * @return {{qItem: *, value: *, label: *, type: string, fieldName: *, isNumeric: boolean, isDate: boolean, isTimestamp: boolean, isHidden: boolean}}
	 */
	static mapFieldItem(item){
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
	}

	/**
	 * Qlik Sense angular service
	 * @constructor
	 */
	constructor(/*appId*/){
		window.qlikService = this;

		const _service = this,
			_app = qlik.currApp(), // here we should get the real app instead of using currApp()
			_isPublished = QlikService.isPrinting() || _app.model.layout.published === true,
			_enigma = !QlikService.isPrinting() ? _app.model.enigmaModel : {};

		this._app = _app;
		this._enigma = _enigma;
		this._fieldCache = {};

		/* Public/privileged functions definition */
		this.bindListener = bindListener;
		this.createGenericObjectDef = createGenericObjectDef;
		this.getObject = getObject;
		this.destroyObject = destroyObject;
		this.destroySessionObject = destroySessionObject;
		this.getObjectLayout = getObjectLayout;
		this.getObjectProperties = getObjectProperties;
		this.getMasterObjectProperties = getMasterObjectProperties; // used by tcmenu!!!
		this.getLayout = getLayout;
		this.getProperties = getProperties;
		this.applyPatches = applyPatches;
		this.setProperties = setProperties;
		this.setMinInitialDataFetch = setMinInitialDataFetch;
		this.createObject = createObject;
		this.createSessionObject = createSessionObject;
		this.createSessionCube = createSessionCube;
		this.createChildCube = createChildCube;
		this.updateChildCube = updateChildCube;
		this.getChildItems = getChildItems;
		this.createChild = createChild;
		this.removeChild = removeChild;
		this.sendEngineRequest = sendEngineRequest;
		this.engineErrorHandler = engineErrorHandler;

		this.getUserInfo = getUserInfo;

		this.onSheet = onSheet;
		this.inStoryMode = inStoryMode;
		this.inPlayMode = inPlayMode;
		this.inEditMode = inEditMode;
		this.inClient = QlikService.inClient;
		this.isPersonalMode = isPersonalMode;
		this.isPrinting = QlikService.isPrinting;
		this.isPublished = isPublished;
		this.isUpdatable = isUpdatable;
		this.isMasterObject = isMasterObject;
		this.isMasterItem = isMasterItem;
		this.isSnapshotObject = isSnapshotObject;

		this.getExtensionScope = getExtensionScope;

		this.listProvider = new ListProvider(_service, _app);
		this.variableProvider = new VariableProvider(_service, _app);
		this.expressionProvider = new ExpressionProvider(_service);
		this.selectionProvider = new SelectionProvider(_service, _app);

		this.evalExpression = this.expressionProvider.evalExpression;
		this.getVariableValue = this.variableProvider.getValue;
		this.setVariableStringValue = this.variableProvider.setStringValue;
		this.getVariableValueList = this.variableProvider.getValueList;
		this.getVariableValueObject = this.variableProvider.getValueObject;
		this.select = this.selectionProvider.select;

		this.debug = {
			profileVariables: this.variableProvider.profile
		};

		this.getReady = getReady;

		function getReady(){
			return Promise.all(
				[
					_service.variableProvider.getReady(),
					_service.expressionProvider.getReady()
				]
			).then(function(){
				return _service;
			});
		}

		/**
		 * Binds an event listener to a given model and returns a callback which can be used to unbind the listener
		 * @param model GenericObject
		 * @param evt Qlik Sense angular event like "Validated" "Invalidated" etc.
		 * @param callback Callback which unbinds the listener
		 * @return {Function} Unbind callback
		 */
		function bindListener(model, evt, callback){
			if(QlikService.isPrinting()){
				return function(){};
			}
			try{
				model[evt].bind(callback);
				return function(){
					model[evt].unbind(callback);
				};
			}catch(err){
				console.warn('could not bind the eventListener to the model', model, evt, callback);
			}
		}

		/**
		 * Returns an object definition of a generic object
		 * @param {{[id]: string, type: string}} [parameters]
		 * @return {{qInfo: {qId: string, qType: string}}}
		 */
		function createGenericObjectDef(parameters){
			let params = typeof parameters === 'object' && parameters || {id: '', type: 'GenericObject'};

			return {
				qInfo: {
					qId: params.id,
					qType: params.type
				}
			};
		}

		/**
		 * Returns the object without layout/properties in a promise
		 * @param {string} qId ID of the object
		 * @return {*}
		 */
		function getObject(qId){
			return sendEngineRequest(_enigma, 'getObject', [qId], 'id');
		}

		/**
		 * Returns the object with its layout in a promise
		 * @param {string} qId ID of the object
		 * @return {*}
		 */
		function getObjectLayout(qId){
			return sendEngineRequest(_app, 'getObject', [qId], 'isValid');
		}

		/**
		 * Returns the object with its properties in a promise
		 * @param {string|Object} data Object or qId of the object
		 * @return {*}
		 */
		function getObjectProperties(data){
			var qId = data, model = typeof data === 'object' ? data : null;

			if(model){
				qId = model.id || ((model.properties || {}).qInfo || (model.layout || {}).qInfo).qId;
			}
			return sendEngineRequest(_app, 'getObjectProperties', [qId], 'id');
		}

		/**
		 * Returns source object with its properties in a promise
		 * @param {string|Object} data Object or qId of the object
		 * @return {*}
		 */
		function getMasterObjectProperties(data){
			var getObject = typeof data === 'string' ? getObjectProperties(data) : Promise.resolve(data);

			return getObject.then(function(obj){
				var qExtendsId = obj && ((obj.properties || {}).qExtendsId || (obj.layout || {}).qExtendsId);

				if(qExtendsId){ // check if we need to get the real sourceobject
					return getObjectProperties(qExtendsId);
				}
				return obj;
			});
		}

		/**
		 * Returns layout of the object in a Promise
		 * @param {Object} model
		 * @return {*}
		 */
		function getLayout(model){
			return model.getLayout().catch(engineErrorHandler(model, 'getLayout', []));
		}

		/**
		 * Returns properties of the given model
		 * @param {string|Object} data I either objectModel, or qId of the object
		 * @param {boolean} [cached] If true cached properties will be returned, if they are available, otherweise an engine request will be performed
		 * @return {*}
		 */
		function getProperties(data, cached){
			var model = typeof data === 'object' ? data : null,
				properties = model && model.properties || null;

			if(cached && properties && properties.qInfo){
				return Promise.resolve(properties);
			}

			return getObjectProperties(data).then(function(obj){ return obj && obj.properties || null; });
		}

		/**
		 * Applies properties patches to the given model
		 * @param model
		 * @param patches
		 * @param softPatches {boolean} If true, changes will be not persitent
		 * @return Promise {*}
		 */
		function applyPatches(model, patches, softPatches){
			return model.applyPatches(patches, softPatches).catch(engineErrorHandler(model, 'applyPatches', [patches, softPatches]));
		}

		/**
		 * Sets properties of a given model
		 * @param model
		 * @param properties
		 * @return Promise {*}
		 */
		function setProperties(model, properties){
			return model.setProperties(properties).catch(engineErrorHandler(model, 'setProperties', [properties]));
		}

		/**
		 * Sets minimum initial data fetch parameters for a given hyper cube definition
		 * @param qHyperCubeDef {object} HyperCube definition
		 * @return {object} HyperCube definition
		 */
		function setMinInitialDataFetch(qHyperCubeDef){
			qHyperCubeDef.qInitialDataFetch[0].qWidth = 0;
			qHyperCubeDef.qInitialDataFetch[0].qHeight = 0;
			return qHyperCubeDef;
		}

		/**
		 * Sets maximum (optimum) data fetch parameters for a given hyper cube definition
		 * @param qHyperCubeDef {object} HyperCube definition
		 * @return {object} HyperCube definition
		 */
		function setMaxInitialDataFetch(qHyperCubeDef){
			var width = Math.max(1, qHyperCubeDef.qDimensions.length + qHyperCubeDef.qMeasures.length),
				height = Math.floor(10000 / width);

			qHyperCubeDef.qInitialDataFetch[0].qWidth = width;
			qHyperCubeDef.qInitialDataFetch[0].qHeight = height;
			return qHyperCubeDef;
		}

		/**
		 * Creates a persistent generic object
		 * @param definition {Object} Definition of the persistent object
		 * @return Promise {Object}
		 */
		function createObject(definition){
			return sendEngineRequest(_enigma, 'createObject', [definition], 'id');
		}

		/**
		 * Creates a generic (not persistend) session object
		 * @param definition {object} Definition of the session object
		 * @return Promise {*}
		 */
		function createSessionObject(definition){
			return sendEngineRequest(_app, 'createGenericObject', [definition], 'id');
		}

		/**
		 * Creates a hyper cube session object
		 * @param {Object} qHyperCubeDef HyperCube definition
		 * @param {string} hicoId
		 * @return {*}
		 */
		function createSessionCube(qHyperCubeDef, hicoId){
			var definition = {qInfo: {qId: hicoId, qType: 'HyperCube'}, qHyperCubeDef: setMaxInitialDataFetch(qHyperCubeDef)};
			return createSessionObject(definition);
		}

		/**
		 * Creates a child hyper cube of a given model
		 * @param {Object} model Parent model, where children will belong to
		 * @param {Object} qHyperCubeDef HyperCube definition of the child object
		 * @param {string} hicoId
		 * @return {*}
		 */
		function createChildCube(model, qHyperCubeDef, hicoId){
			var definition = {qInfo: {qId: hicoId, qType: 'HyperCube'}, qHyperCubeDef: setMaxInitialDataFetch(qHyperCubeDef)};
			return createChild(model, definition);
		}

		/**
		 * Updates a child hyper cube with given definition
		 * @param qId {string} Id of the child object
		 * @param qHyperCubeDef {object} HyperCube definition
		 * @return {*}
		 */
		function updateChildCube(qId, qHyperCubeDef){
			console.info('updateChildCube', qId);
			return getObjectProperties(qId).then(function(model){
				if(!qHyperCubeDef.hcIdx){
					console.error('Update a hyperCube without hcIdx', qHyperCubeDef);
				}
				model.properties.qHyperCubeDef = setMaxInitialDataFetch(qHyperCubeDef);
				return setProperties(model, model.properties).then(function(){ return model; });
			});
		}

		/**
		 * Returns childItems from given object layout
		 * @param {{qChildList: {qItems: array}}} layout - Objects layout
		 * @returns {Array<{id: string, type: string, data: {*}>}
		 */
		function getChildItems(layout){
			let items = layout && layout.qChildList && layout.qChildList.qItems || [];
			return items.map(function(item){
				return {
					id: item.qInfo.qId,
					type: item.qInfo.qType,
					data: item.qData
				};
			});
		}

		/**
		 * Creates a child object for a given model with a given definition
		 * @param {Object} model
		 * @param {Object} definition
		 * @return {Promise.<Object>}
		 */
		function createChild(model, definition){
			return sendEngineRequest(model, 'createChild', [definition], 'id');
		}

		/**
		 * Removes child object from a given model
		 * @param model {object} Parent model object
		 * @param qId {string} Id of the child object
		 * @return {*}
		 */
		function removeChild(model, qId){
			// in some cases (different version, usage of enigmaModel instead ov capability api) the method name can differ, so we need to check it first
			if(typeof model.destroyChild === 'function'){
				return model.destroyChild(qId).catch(engineErrorHandler(model, 'destroyChild', [qId]));
			}else{
				return model.removeChild(qId).catch(engineErrorHandler(model, 'removeChild', [qId]));
			}
		}

		/**
		 * Destroys a session object with given id
		 *
		 * @param {string} qId - qId of the object to be destroyed
		 */
		function destroySessionObject(qId){
			return _app.destroySessionObject(qId).catch(engineErrorHandler(_app, 'destroySessionObject', [qId]));
		}

		/**
		 * Destroys an object with given id
		 * @param {string} qId Id of the object, which has to be destroyed
		 * @return {Promise.<*>}
		 */
		function destroyObject(qId){
			return _enigma.destroyObject(qId).catch(engineErrorHandler(_enigma, 'destroyObject', [qId]));
		}

		/**
		 * Makes an engine request and handles empty response/errors if needed
		 *
		 * @param {Object} [source] - Reference which will be "this" in the callback method
		 * @param {string} [method] - Callback method which will be executed if response is invalid cases (must exist in source object)
		 * @param {Array} [args] - Arguments of the callback
		 * @param {string} [validProperty] - property, which the response MUST have to be treated as valid response
		 * @param {int} [tries] - Re-try counter (used as internal counter)
		 *
		 * @return {Promise<*>} - Engine response
		 */
		function sendEngineRequest(source, method, args, validProperty, tries = 1){
			return source[method].apply(source, args || [])
				.then(engineResponseHandler(source, method, args, validProperty, tries))
				.catch(engineErrorHandler(source, method, args));
		}

		/**
		 * Handle responses from client.js/engine and retry them if needed
		 *
		 * @param {Object} [source] - Reference which will be "this" in the callback method
		 * @param {string} [method] - Callback method which will be executed if response is invalid cases (must exist in source object)
		 * @param {Array} [args] - Arguments of the callback
		 * @param {string} [validProperty] - property, which the response MUST have to be treated as valid response
		 * @param {int} [tries] - Re-try counter (used as internal counter)
		 *
		 * @return {Function}
		 */
		function engineResponseHandler(source, method, args, validProperty, tries = 1){
			return function(reply){
				if(!reply || validProperty && !reply[validProperty]){
					if(tries < _maxTries){
						// repeat the request in case of "invalid" reply
						return new Promise((resolve) =>{
							setTimeout(() => resolve(sendEngineRequest(source, method, args, validProperty, tries + 1)), _debounceTime);
						});
					}
					return Promise.reject('Request aborted after ' + tries + ' tries');
				}
				return Promise.resolve(reply);
			};
		}

		/**
		 * Handle common/known engine errors
		 *
		 * @param {Object} [source] - Reference which will be "this" in the callback method
		 * @param {string} [method] - Callback method which will be executed in special cases (must exist in source object)
		 * @param {Array} [args] - Arguments of the callback
		 * @param {int} [tries] - Re-try counter (used as internal counter)
		 *
		 * @return {Function}
		 */
		function engineErrorHandler(source, method, args, tries = 1){

			return function(reply){
				let rejectReason,
					err = reply.error || reply, // format changed in QS 2017.06

					// for (older) published apps, where tcMediaStore object is not available, omit error reports (known error won't fix)
					reportError = err.code !== 2 || args[0] !== 'tcMediaStore' || !isPublished();

				if(reportError){
					console.warn(err, args);
					method
						? Logger.warn('Error occurred during: ' + method, (err.code !== 15 ? err : args))
						: Logger.error('Error occurred', reply);
				}

				switch(err.code){
					case 2: // no object found
						rejectReason = new Error('no object found with id ' + args[0]);
						rejectReason.code = 2;
						break;
					case 15: // request abborted try again
						if('function' === typeof source[method] && tries < _maxTries){
							console.info('try again');
							return new Promise((resolve) =>{
								setTimeout(() =>{
									resolve(Promise.resolve(source[method].apply(source, args || [])).catch(engineErrorHandler(source, method, args, tries + 1)));
								}, _debounceTime);
							});
						}else{
							console.info(source, args);
							rejectReason = new Error('HICO: Give up after ' + _maxTries + ' tries to ' + method);
							rejectReason.code = 15;
						}
				}
				return Promise.reject(rejectReason);
			};
		}

		/**
		 * returns userName and userDisplayName when initialized, when not a Promise
		 *
		 * @return {Object|Promise.<Object>}
		 */
		function getUserInfo(){
			return new Promise(function(resolve){
				isPersonalMode().then(function(personalMode){
					if(personalMode){
						getUsernameOnly();
					}else{
						// if the user is on server environment then we can get the preferred username by engine API
						qlik.callRepository('/qps/user')
							.success(data => resolve({displayName: data.userName, username: data.userDirectory + "\\" + data.userId}))
							.error((error) =>{
								getUsernameOnly(); // fallback
								console.warn('ajax get usercall failed, please check this', error);
							});
					}
				});

				/**
				 * this function gets only the username and resolves the promise when it is done
				 */
				function getUsernameOnly(){
					QlikService.getAuthenticatedUser().then(data =>{
						let name = '';

						//data.qReturn = "UserDirectory=HICO; UserId=jll";
						data.qReturn.split(';').forEach(function(part, index){
							part = part.trim();
							if(part.indexOf('UserDirectory=') === 0){
								name += part.slice('UserDirectory='.length) + "\\";
							}else if(part.indexOf('UserId=') === 0){
								name += part.slice('UserId='.length);
							}else if(index === 0){
								name = part;
							}
						});
						resolve({username: name, displayName: name});
					});
				}
			});
		}

		/**
		 * Checks if the current environment is on sheet or not
		 * @return {boolean}
		 */
		function onSheet(){
			return qlik.navigation.getCurrentSheetId().success === true;
		}

		/**
		 * Checks if current mode is either "play" or "editstory"
		 * @return {boolean} true if in "play|editstory" mode, otherwise false
		 */
		function inStoryMode(){
			var qMode = qlik.navigation.getMode();
			return  qMode === 'play' || qMode === 'editstory';
		}

		/**
		 * Checks if current mode is "play"
		 * @return {boolean} true if in "play" mode, otherwise false
		 */
		function inPlayMode(){
			return !QlikService.isPrinting() && qlik.navigation.getMode() === 'play';
		}

		/**
		 * Checks if current mode is "edit"
		 * @return {boolean} true if in "edit" mode, otherwise false
		 */
		function inEditMode(){
			return qlik.navigation.getMode() === "edit";
		}

		/**
		 * Check if the user is working on Sense Desktop or on server environment
		 * @return {Promise} this Promise returns a boolean when it is resolved
		 */
		function isPersonalMode(){
			return new Promise(function(resolve){
				qlik.getGlobal().isPersonalMode(function(response){
					resolve(response.qReturn);
				});
			});
		}

		/**
		 * Checks if an app was published
		 *
		 * @return {boolean} - returns true if app was published, false otherwise
		 */
		function isPublished(){
			return _isPublished === true;
		}

		/**
		 * Checks and returns 'update' permission. With no parameter it returns permission of the current sheet or false for snapshots/mashups.
		 * With an object passed it returns permission of the given object.
		 *
		 * @param {object} object - qs model
		 * @param {Array} [extensions]
		 *
		 * @return {boolean} - true if sheet or object is updatable
		 */
		function isUpdatable(object, extensions){
			/* For proper support of story mode and mashUps it must be decided on per object basis. To do this, fetch the sheets
			   (qlik.navigation.sheets is unavailable in mashUp), find out to which sheet belongs the object and then decide per sheet permissions.
			   Property permissions is not available if sheets are fetched with qlik.currApp().getList('sheet')... However there is an array in
			   layout.qMeta.privileges which pretty much matches the permissions.
			   Additionally move this function into connector or adapter!
			 */
			/* INFO:
			   qlik.navigation.isModeAllowed(qlik.navigation.EDIT) is false for: mashUps, published sheets; true for: snapshots, master item edit mode
			   qlik.navigation.getCurrentSheetId().error === 'NOCURRENTSHEET' is true for: mashUps, story mode (embedded sheets too!), master item edit mode
			   object.properties.extensionMeta.isLibraryItem === true: master item itself
			 */

			if(!_service.inClient() || QlikService.isPrinting()){
				return false;
			}

			let currSheet = qlik.navigation.getCurrentSheetId(); // currSheet.success is either true or false, check it?

			if(!object){
				if(currSheet.error === 'NOCURRENTSHEET' &&
					!(qlik.navigation.isModeAllowed(qlik.navigation.EDIT) && extensions.length === 1)){
					return false; // story mode (or mashUp, for that matter) but not master item edit mode
				}

				if(!_isPublished){
					return true; // neither story mode nor mashUp and the app is not published -> updatable
				}

				if(currSheet.success){
					let currSheetId = currSheet.sheetId;
					currSheet = qlik.navigation.sheets[qlik.navigation.sheets.findIndex(sheet => sheet.qInfo.qId === currSheetId)];

					return currSheet.permissions ? currSheet.permissions.update : (currSheet.qMeta.privileges.indexOf('update') > -1);
				}

				// no current sheet, only 1 extension which is editable. Either master item edit mode or snapshot with 1 extension only.
				let extension = extensions[0],
					srcObject = extension.getAdapter().getSourceObject(),
					data = (srcObject.layout && srcObject.layout.qInfo) ? srcObject.layout : srcObject.properties;
				return data && data.qInfo && data.qInfo.qType === 'masterobject';

			}else{
				if(currSheet.error === 'NOCURRENTSHEET' && (object.layout.snapshotData || qlik.navigation.isModeAllowed(qlik.navigation.EDIT))){
					return false; // story mode (or mashUp, for that matter) but not master item edit mode
				}

				let sheets = qlik.navigation.sheets; // unavailable in mashUps
				for(let i = 0, len = sheets.length; i < len; i++){
					let sheet = sheets[i];
					if(sheet.qData.cells.some(cell => cell.name === object.id)){
						if(currSheet.error === 'NOCURRENTSHEET'){
							return false; // object from a sheet -> this is not a master item; then it must be a snapshot
						}else if(sheet.permissions){
							return sheet.permissions.update;
						}else{
							return sheet.qMeta.privileges.indexOf('update') > -1;
						}
					}
				}

				// editable object without sheet, must be master item, doesn't matter whether (currSheet.error === 'NOCURRENTSHEET') or not
				return qlik.navigation.isModeAllowed(qlik.navigation.EDIT);
			}
		}

		/**
		 * Checks if the current sourceObject is a master item (derived object)
		 *
		 * @param {object} object - Object model, must have either properties or layout property
		 *
		 * @return {boolean} - true if object is a master item, false otherwise
		 */
		function isMasterItem(object){
			const data = object.layout && object.layout.qInfo ? object.layout : object.properties;

			return typeof data.qExtendsId === 'string' && data.qExtendsId !== '';
		}

		/**
		 * Checks if the current sourceObject is a master (main, parent from which are others derived) object
		 *
		 * @param {object} object - Object must have either properties or layout available
		 *
		 * @return {boolean} - true if object is a master object, false otherwise
		 */
		function isMasterObject(object){
			const data = object.layout && object.layout.qInfo ? object.layout : object.properties,
				qInfo = data && data.qInfo;

			return qInfo && qInfo.qType === 'masterobject';
		}

		/**
		 * Checks if the current sourceObject is a snapshot object
		 *
		 * @param {object} object - Object must have either properties or layout available
		 *
		 * @return {boolean} - true if object is a snapshot object, false otherwise
		 */
		function isSnapshotObject(object){
			const data = object.layout && object.layout.qInfo ? object.layout : object.properties,
				qInfo = data && data.qInfo;

			return qInfo && qInfo.qType === 'embeddedsnapshot' || typeof data.snapshotData === 'object';
		}

		/**
		 * Returns extensions scope by given child scope
		 * @param {{$parent: Object, ext: Object, model: Object}} scope - Child scope of the extension scope
		 * @return {{ext: {model: {app: Object}}}|null}
		 */
		function getExtensionScope(scope){
			if(!scope){
				return null;
			}else if(scope.ext && scope.ext.model){
				return scope;
			}else{
				return getExtensionScope(scope.$parent);
			}
		}
	}

	/**
	 * Returns the app used by this QlickService instance
	 * @return {AppAPI.IApp | *}
	 */
	get app(){
		return this._app;
	}

	/**
	 * Returns the enigma instance used by this QlickService instance
	 * @return {AppAPI.IEnigma | *}
	 */
	get enigma(){
		return this._enigma;
	}

	/**
	 * Applies a bookmark.
	 *
	 * @param {string} id - Bookmark id.
	 *
	 * @return {Promise<*>}
	 */
	applyBookmark(id){
		return this.app.bookmark.apply(id);
	}

	/**
	 * Returns all available apps in a Promise
	 *
	 * @param {Function} callback - Callback method
	 * @param {Object} [config] - Optional. Parameters:
	 * @param {string} [config.host] - Qlik Sense host
	 * @param {string} config.port  - Port number
	 * @param {string} [config.prefix] - Qlik Sense virtual proxy. / if no virtual proxy
	 * @param {boolean} [config.isSecure] - Use SSL
	 * @param {string} [config.identity] - Unique identity for the session. If omitted, the session will be shared.
	 *
	 * @return {Promise<any>}
	 */
	getAppList(callback, config){
		qlik.getGlobal(config).getAppList(callback, config);
	}

	/**
	 * Opens an App by id and returns it
	 *
	 * @param {string} appId
	 * @param {Object} [config] - Optional. Parameters:
	 * @param {string} [config.host] - Qlik Sense host
	 * @param {string} config.port  - Port number
	 * @param {string} [config.prefix] - Qlik Sense virtual proxy. / if no virtual proxy
	 * @param {boolean} [config.isSecure] - Use SSL
	 * @param {string} [config.identity] - Unique identity for the session. If omitted, the session will be shared.
	 *
	 * return {Promise<AppAPI.IApp>}
	 */
	openApp(appId, config){
		// prevent error notification during this step (like modal dialogs with only "goto hub" | "refresh" options.
		if(!_apps[appId]){
			qlik.setOnError((error) =>{
				switch(error.code){
					case 1003:
						Toastr.error(getTranslation('ERROR_APP_NOT_FOUND', appId), getTranslation('ERROR_OCCURRED'));
						break;
				}
			});
			_apps[appId] = qlik.openApp(appId, config);
		}
		return Promise.resolve(_apps[appId]);
	}

	/**
	 * Closes the app, if it was already opened
	 *
	 * @param {string} appId - Id of the app to be closed
	 */
	closeApp(appId){
		const appToClose = _apps[appId];
		if(appToClose && appToClose.id !== this.app.id){
			// close any other app, but not the current (own) one
			appToClose.close();
			delete _apps[appId];
		}
	}

	/**
	 * Closes the app by given appId after a given delay
	 *
	 * @param {string} appId
	 */
	closeAppDelayed(appId){
		window.clearTimeout(_appsTimeouts[appId]);
		window.setTimeout(() => this.closeApp(appId), _appClosingDelay);
	}

	/**
	 * Reloads the data in a Qlik Sense app.
	 *
	 * @param {string} [mode] - Error handling Mode: 0 = default, 1 = attempt recovery on all errors, 2 = fail on all errors
	 * @param {boolean} [partial] - Set to true for partial reload
	 * @param {boolean} [debug] - Set to true if debug breakpoints are honored. Execution of the script will be in debug mode.
	 */
	doReload(mode, partial, debug){
		return this.app.doReload(mode, partial, debug).then((resp) =>{
			if(resp === true || typeof resp === 'object' && resp.qReturn === true){
				return this.app.doSave();
			}
		});
	}

	/**
	 * Create a new visualization on the fly based on a session object and will not be persisted in the app.
	 *
	 * @param {string} type - Visualization type
	 * @param {*} [cols] - Column definitions, dimensions and measures
	 * @param {*} [options] - Options to set
	 *
	 * @return {Promise<*>}
	 */
	createVisualization(type, cols, options){
		return this.sendEngineRequest(this.app.visualization, 'create', [type, cols, options], 'show');
	}

	/**
	 * Returns the field object by given fieldName or null, if field do not exist
	 *
	 * @param {string} fieldName - Field name
	 *
	 * @return {Promise<*>} - Returns a field object in a promise if its valid
	 */
	getField(fieldName){
		if(!this._fieldCache[fieldName]){
			this._fieldCache[fieldName] = this.sendEngineRequest(this.enigma, 'getField', [fieldName], 'handle')
				.catch((err) =>{
					// in case of errors clear the internal fieldCache (to give it one more try...)
					delete this._fieldCache[fieldName];

					// no special error handling here
					throw err;
				});
		}

		// use enigma to check if field exists and capability API for the response
		return this._fieldCache[fieldName].then(() => this.app.field(fieldName));
	}

	/**
	 * Unlocks a field which was previously locked
	 *
	 * @param {string} fieldName - Name of the field to be unlocked
	 *
	 * @return {Promise<*>}
	 */
	unlockField(fieldName){
		return this.getField(fieldName).then((field) => field.unlock());
	}

	/**
	 * Clears all selections in all fields of the current Qlik Sense app.
	 *
	 * @param {boolean} [lockedAlso]
	 * @param {string} [state] - Alternate state name. (default: $)
	 *
	 * @return {{field: Object}|*|Promise<any>}
	 */
	clearAll(lockedAlso, state){
		return this.app.clearAll(lockedAlso, state);
	}

	/**
	 * Locks all selections.
	 *
	 * @param {string} [state] - Alternate state name. (default: $)
	 *
	 * @return {{field: Object}|*|Promise<any>}
	 */
	lockAll(state){
		return this.app.lockAll(state);
	}

	/**
	 * Unlocks all selections that has previously been locked.
	 *
	 * @param {string} [state] - Alternate state name. (default: $)
	 *
	 * @return {{field: Object}|*|Promise<any>}
	 */
	unlockAll(state){
		return this.app.unlockAll(state);
	}
}

/**
	 * Qlick list provider class
	 * @return {Function}
	 */
class ListProvider{
	constructor(qlikService, app){
		// Cache for the responses (no need to request lists multiple time)
		var cache = {};

		/**
		 * Possible list names for qlik lists
		 * @type {{FieldList: string, MeasureList: string, DimensionList: string, BookmarkList: string, SelectionObject: string,
		 * 			SnapshotList: string, MediaList: string, MasterObject: string, VariableList: string, SheetList: string, StoryList: string}}
		 */
		var supportedQlikLists = {
			AppList: 'hicoAppList',
			FieldList: 'qFieldList',
			MeasureList: 'qMeasureList',
			DimensionList: 'qDimensionList',
			BookmarkList: 'qBookmarkList',
			SelectionObject: 'qSelectionObject',
			SnapshotList: 'qSnapshotList',
			MediaList: 'qMediaList',
			MasterObject: 'qMasterObject',
			VariableList: 'qVariableList',
			story: 'qAppObjectList',
			sheet: 'qAppObjectList'
		};

		this.getList = getList;
		this.getListData = getListData;
		this.getListItems = getListItems;


		/**
		 * Gets a list of internal Qlik Sense objects
		 * @param name {string}	The requested list name
		 * @returns Promise {*} Returns requested list object in a promise
		 */
		function getList(name){
			return isSupported(name).then(function(){
				if(cache[name] === undefined){
					var listDef = getListDef(name);
					if(listDef === null){
						switch(name){
							case 'AppList':
								cache[name] = new Promise(resolve => qlikService.getAppList(list => resolve({
									layout: {hicoAppList: {qItems: list}}
								})));
								break;
						}
					}else if(listDef.qInfo.qId){
						cache[name] = qlikService.createSessionObject(listDef);
					}else{
						cache[name] = app.getList(listDef).catch(qlikService.engineErrorHandler(app, 'getList', [listDef]));
					}
				}
				return cache[name];
			});
		}

		function getListData(name){
			return isSupported(name).then(function(qListName){
				return getList(name).then(function(listObj){
					return listObj.layout[qListName];
				});
			});
		}

		function getListItems(name){
			return isSupported(name).then(function(qListName){
				return getList(name).then(function(listObj){
					return listObj.layout[qListName].qItems;
				});
			});
		}

		function isSupported(name){
			var qListName = supportedQlikLists[name];
			return qListName !== undefined ? Promise.resolve(qListName) : Promise.reject();
		}

		function getListDef(name){
			switch(name){
				case 'AppList':
					return null;
				case 'BookmarkList':
					return {
						'qInfo': {'qId': prefix + 'BookmarkList', 'qType': 'BookmarkList'},
						'qBookmarkListDef': {
							'qType': 'bookmark',
							'qData': {'title': '/qMetaDef/title', 'description': '/qMetaDef/description'}
						}
					};
				case 'DimensionList':
					return {
						'qInfo': {'qId': prefix + 'DimensionList', 'qType': 'DimensionList'},
						'qDimensionListDef': {
							'qType': 'dimension',
							'qData': {'title': '/qMetaDef/title', 'tags': '/qMetaDef/tags', 'grouping': '/qDim/qGrouping', 'info': '/qDimInfos'}
						}
					};
				case 'FieldList':
					return {
						'qInfo': {'qId': prefix + 'FieldList', 'qType': 'FieldList'},
						'qFieldListDef': {
							'qShowSystem': false,
							'qShowHidden': true,
							'qShowSrcTables': true,
							'qShowSemantic': true,
							'qShowDerivedFields': true
						}
					};
				case 'MasterObject':
					return {
						'qInfo': {'qId': prefix + 'MasterObjectList', 'qType': 'MasterObjectList'},
						'qAppObjectListDef': {
							'qType': 'masterobject',
							'qData': {'name': '/qMetaDef/title', 'visualization': '/visualization', 'tags': '/qMetaDef/tags'}
						}
					};
				case 'MeasureList':
					return {
						'qInfo': {'qId': prefix + 'MeasureList', 'qType': 'MeasureList'},
						'qMeasureListDef': {'qType': 'measure', 'qData': {'title': '/qMetaDef/title', 'tags': '/qMetaDef/tags'}}
					};
				case 'MediaList':
					return {'qInfo': {'qId': prefix + 'MediaList', 'qType': 'MediaList'}, 'qMediaListDef': {}};
				case 'SelectionObject':
					return {'qInfo': {'qId': prefix + 'CurrentSelection', 'qType': 'SelectionObject'}, 'qSelectionObjectDef': {}};
				case 'sheet':
					return {
						'qInfo': {'qId': prefix + 'SheetList', 'qType': 'SheetList'},
						'qAppObjectListDef': {
							'qType': 'sheet',
							'qData': {
								'title': '/qMetaDef/title',
								'description': '/qMetaDef/description',
								'thumbnail': '/thumbnail',
								'cells': '/cells',
								'rank': '/rank',
								'columns': '/columns',
								'rows': '/rows'
							}
						}
					};
				case 'SnapshotList':
					return {
						'qInfo': {'qId': prefix + 'SnapshotList', 'qType': 'SnapshotList'},
						'qBookmarkListDef': {
							'qType': 'snapshot',
							'qData': {
								'title': '/title',
								'libraryTitle': '/qMetaDef/title',
								'description': '/qMetaDef/description',
								'sourceObjectId': '/sourceObjectId',
								'visualizationType': '/visualizationType',
								'timestamp': '/timestamp',
								'snapshotData': '/snapshotData',
								'isClone': '/isClone'
							}
						}
					};
				case 'story':
					return {
						'qInfo': {'qId': prefix + 'StoryList', 'qType': 'StoryList'},
						'qAppObjectListDef': {
							'qType': 'story',
							'qData': {'title': '/qMetaDef/title', 'description': '/qMetaDef/description', 'thumbnail': '/thumbnail', 'rank': '/rank'}
						}
					};
				case 'VariableList':
					return {
						'qInfo': {'qId': prefix + 'VariableList', 'qType': 'VariableList'},
						'qVariableListDef': {'qType': 'variable', 'qData': {'tags': '/tags'}}
					};
				default: {
					var qListNameDef = 'q' + name + 'Def',
						listDef = {'qInfo': {'qType': name}};

					listDef[qListNameDef] = {};
					return listDef;
				}
			}
		}
	}
}

class ExpressionProvider {
	constructor(qlikService){
		var _this = this,
			_expressionValueList = null,
			_timeout,
			_requests = [],
			_patches = [],
			_requestBuffer = [],
			_expressions = {},
			_ready = qlik.Promise.defer();

		// Public methodes
		_this.getReady = getReady;
		_this.evalExpression = evalExpression;
		_this.getValueObject = getValueObject;

		// Initialize
		if(!QlikService.isPrinting()){
			init();
		}

		/**
		 * Initialize the expression values list
		 * @returns {*} expressions collection sessionObject in a Promise
		 */
		function init(){
			if(QlikService.isPrinting()){
				return setReady();
			}
			qlikService.createSessionObject({qInfo: {qId: 'hicoExpressionValueList', qType: 'GenericObject'}, exprList: {}}).then(function(reply){
				_expressionValueList = reply;

				_expressionValueList.Validated.bind(onValidated);
				_expressionValueList.Invalidated.bind(onInvalidated);
				onValidated.apply(_expressionValueList);
			});
		}

		function getExpressionDef(expr){
			if(typeof expr === 'string' && expr.indexOf('=') === 0){
				return hash(expr);
			}else if(expr && typeof expr === 'object' && expr.hasOwnProperty('qStringExpression')){
				return hash(typeof expr.qStringExpression === 'string' ? expr.qStringExpression : expr.qStringExpression.qExpr);
			}else{
				return null;
			}

			function hash(str) {
				var hash = 0, i, chr;
				if (str.length === 0){
					return hash;
				}
				for (i = 0; i < str.length; i++) {
					chr   = str.charCodeAt(i);
					hash  = ((hash << 5) - hash) + chr;
					hash |= 0; // Convert to 32bit integer
				}
				return {key: 'e' + hash, def: str};
			}
		}


		/**
		 * Returns the session object of the expression value list
		 * @return {*} expressionObject (sessionObject) in a promise
		 */
		function getValueObject(){
			return getReady().then(function(){
				return _expressionValueList;
			});
		}

		/**
		 * Evaluates a sense expression and returns the result in a promise
		 * @param expression {*} expression to be evaluated
		 * @return {*} Promise of the evaluated expression
		 */
		function evalExpression(expression){
			// Service needs to be ready
			return getReady().then(function(){
				var exprObj = _expressionValueList,
					expr = getExpressionDef(expression);

				if(expr === null){
					// No valid expression definition found -> not an expression? -> return the origial text
					return expression;
				}

				if(exprObj.properties.exprList && exprObj.properties.exprList.hasOwnProperty(expr.key)
					&& exprObj.properties.exprList[expr.key].qStringExpression !== expr.def){
					console.error('Collision found..., it seems like we need a better hash algorythm: ' + expr.key);
					console.warn(expr.expr,  exprObj.properties.exprList[expr.key]);
				}

				if(exprObj.layout.exprList.hasOwnProperty(expr.key)){
					return exprObj.layout.exprList[expr.key];

				}else if(_expressions.hasOwnProperty(expr.key)){
					return _expressions[expr.key];

				}else{
					return addExpression(expr);
				}
			});
		}

		function addExpression(expr){
			var d = qlik.Promise.defer();

			// Stop previous request
			clearTimeout(_timeout);

			_expressions[expr.key] = d.promise;
			_patches.push({qPath: '/exprList/' + expr.key, qOp: 'add', qValue: JSON.stringify({qStringExpression: expr.def})});
			_requests.push({key: expr.key, promise: d});

			// Trigger delayed request
			_timeout = setTimeout(triggerDelayedRequest, 20);

			return d.promise;
		}

		function getReady(){
			return _ready.promise;
		}

		function setReady(value){
			if(value === false && _ready.resolved){
				_ready = qlik.Promise.defer();
			}else if(value !== false){
				_ready.resolved = true;
				_ready.resolve(_this);
			}
		}

		function triggerDelayedRequest(){
			var patches = _patches;
			var requests = _requests;
			_patches = [];
			_requests = [];
			_requestBuffer.push(requests.slice());

			getReady().then(function(){
				qlikService.applyPatches(_expressionValueList, patches, true);
			});
		}

		/**
		 * Executes on Validated events of expressionValueList
		 */
		function onValidated(){
			var exprList = this.layout.exprList;
			while(_requestBuffer.length > 0){
				var requests = _requestBuffer.shift();
				requests.forEach(function(request){
					request.promise.resolve(exprList[request.key]);
				});
			}
			setReady();
		}

		/**
		 * Executes on Invalidated events of expressionValueList
		 */
		function onInvalidated(){
			setReady(false);
		}

	}

}

class VariableProvider {
	constructor (qlikService, app){
		var _this = this,
			_variableValueList,
			_usedVariables = [],
			_setValueRequests = [],
			_setValueTimeout,
			_setValueDelay = 20,
			_updateTimeout,
			_updateDelay = 20,
			_updatePromise = qlik.Promise.defer(),
			_ready = qlik.Promise.defer();

		this.getReady = getReady;
		this.getValue = getValue;
		this.getValueList = getValueList;
		this.getValueObject = getValueObject;
		this.setStringValue = setStringValue;
		this.setUsedVariables = setUsedVariables;

		this.profile = profile;

		if(!QlikService.isPrinting()){
			init();
		}

		/**
		 * Initialize the variable values list
		 * @returns {*} variables collection sessionObject in a Promise
		 */
		function init(){
			return qlikService.createSessionObject({qInfo: {qId: prefix + 'VariableValueList', qType: 'GenericObject'}, varValueList: {}}).then(function(reply){
				_variableValueList = reply;

				_variableValueList.Validated.bind(onValidated);
				_variableValueList.Invalidated.bind(onInvalidated);

				setReady();
			});
		}

		/**
		 * Set used variables and update variablesValueList
		 * @param {Array} [variables] Array of variable names, which must be evaluated
		 */
		function setUsedVariables(variables){
			if(variables){
				_usedVariables = variables;
			}

			return getReady().then(update);
		}

		function delayedUpdate(){
			clearTimeout(_updateTimeout);

			if(_updatePromise.resolved){
				_updatePromise = qlik.Promise.defer();
			}
			_updateTimeout = setTimeout(function(){
				getReady().then(update).then(function(){
					_updatePromise.resolved = true;
					_updatePromise.resolve();
				});
			}, _updateDelay);

			return _updatePromise.promise;
		}

		/**
		 * Updates the variableValueList
		 */
		function update(){
			var patches = generatePatches(_variableValueList.layout.varValueList, _usedVariables);

			if(patches.length > 0){
				setReady(false);  // applyPatches will invalidate _variableValueList, so it will be not ready now
				qlikService.applyPatches(_variableValueList, patches, true);
			}
			return getReady();
		}

		/**
		 * Checks if a variable name was already processed by the service or not
		 * @param name {string} Name of the variable
		 * @return {boolean} true if variable wasn't processed before, false otherwise
		 */
		function isNew(name){
			return _usedVariables.indexOf(name) === -1;
		}

		/**
		 * Add a new variable to variable value list
		 * @param name {string} Name of the variable
		 * @return {*} Promise
		 */
		function addVariable(name){
			_usedVariables.push(name);
		}

		/**
		 * Returns an array of patch objects containing new and obsolete variables
		 * @param varList {object} A variable value list
		 * @param variableNames {Array} A list of variable names
		 * @return {Array.<*>}
		 */
		function generatePatches(varList, variableNames){
			var i, name, key, keys, expr, qValue,
				addPatches = [],
				removePatches = [],
				existingVars = {};

			// generate patches for new variables
			for(i = 0; i < variableNames.length; i++){
				name = variableNames[i];
				key = 'v' + slashInNameEscaper(name);
				if(varList[key] === undefined){
					expr = prefix === 'tcmenu' ? name : ('$(' + name + ')'); // do not evaluate variable content for tcmenu
					qValue = {qName: name, str: {qStringExpression: {qExpr: expr}}};

					if(prefix !== 'tcmenu'){ // not used in tcmenu
						qValue.fallback = {qStringExpression: {qExpr: name}};
					}
					addPatches.push(
						{
							qPath: '/varValueList/' + key,
							qOp: 'add',
							qValue: JSON.stringify(qValue)
						}
					);
				}else{
					existingVars[key] = true;
				}
			}

			// generate patches for obsolete variables
			keys = Object.keys(varList);
			for(i = 0; i < keys.length; i++){
				key = keys[i];
				if(!existingVars[key]){
					removePatches.push({qPath: '/varValueList/' + key, qOp: 'remove'});
				}
			}

			return addPatches.concat(removePatches);
		}

		/**
		 * Returns a current value of given variable
		 * @param {string} name Name of the variable
		 * @return {*} Value of the variable in a primise
		 */
		function getValue(name){
			var promise;
			if(isNew(name)){
				addVariable(name);
				promise = delayedUpdate().then(getReady);
			}else{
				promise = getReady();
			}
			return Promise.resolve(promise).then(function(){
				var variable = _variableValueList.layout.varValueList['v' + slashInNameEscaper(name)];
				return variable !== undefined ? variable.str : getValue(name); // retry if something went wrong
			});
		}

		/**
		 * Sets variable string value.
		 * @param {string} name Variable name
		 * @param {string} value Variable value
		 *
		 * @returns {Promise<*>}
		 */
		function setStringValue(name, value){
			const request = new Deferred();

			clearTimeout(_setValueTimeout);

			_setValueRequests.push(() => {
				app.variable.setStringValue(name, value)
					.catch(qlikService.engineErrorHandler(app.variable, 'setStringValue', [name, value]))
					.then(request.resolve);
			});

			_setValueTimeout = setTimeout(() =>{
				for(const callback of _setValueRequests){
					callback();
				}
				_setValueRequests = [];
			}, _setValueDelay);

			return request.promise;
		}

		/**
		 * Returns a list of variable values
		 * @return {*} variable list in a promise
		 */
		function getValueList(){
			return getReady().then(function(){
				return _variableValueList.layout.varValueList;
			});
		}

		/**
		 * Returns the sesson object of the variable value list
		 * @return {*} variableObject (sessionObject) in a promise
		 */
		function getValueObject(){
			return getReady().then(function(){
				return _variableValueList;
			});
		}

		function getReady(){
			return _ready.promise;
		}

		function setReady(value){
			if(value === false && _ready.resolved){
				_ready = qlik.Promise.defer();
				_ready.startTime = Date.now();
			}else if(value !== false){
				_ready.resolved = true;
				_ready.resolve(_this);
			}
		}

		function onValidated(){
			_ready.startTime && Logger.info('Variables validated after: ' + (Date.now() - _ready.startTime) / 1000 + 's');
			setReady();
		}

		function onInvalidated(){
			_ready.resolved !== undefined && Logger.info('Variables invalidated');
			setReady(false);
		}

		/**
		 * QS parses paths and convert 'obj1/obj2' to obj1.obj2. Therefore if name of a variable contains slash, QS assumes that these are object and subobject.
		 * This function is a simple workaround for that.
		 * There is exactly the same function in QSConnector, please, keep them in sync!
		 */
		function slashInNameEscaper(name){
			return name.replace(/\//g, 'hico$$.$$hico');
		}

		/**
		 * Profile variable performance
		 */
		function profile(evaluate){
			getReady().then(getValueList).then(function(valueList){
				var keys = Object.keys(valueList),
					appModel = app.model,
					i = 0,
					key = keys[i],
					len = keys.length,
					name = (valueList[key] || {}).qName,
					timings = {},
					startTime = Date.now();


				console.info('Start profiling variables (' + prefix + ')');
				evalExp(name, key).then(function(){
					console.info('Finish profiling variables (' + prefix + ') after: ' + (Date.now() - startTime)/1000 + 's');
					var sortable = [];
					for (var name in timings) {
						sortable.push({name: name, calcTime: timings[name].calcTime, value: timings[name].value});
					}

					sortable.sort(function(a, b) {
						return b.calcTime - a.calcTime;
					});
					console.info(
						{
							all: sortable,
							errors: sortable.filter(function(v){return v.value.indexOf('Error') > -1;}),
							invalid: sortable.filter(function(v){return v.value === '-';})
						}
					);
				});

				function evalExp(name, key){
					if(!name){
						return qlik.Promise.resolve();
					}
					var exp = evaluate === false ? ('=' + name) : ('=$(' + name + ')');
					timings[name] = Date.now();
					return appModel.evaluateExpression(exp).catch(qlikService.engineErrorHandler(appModel, 'evaluateExpression', [exp])).then(function(value){
						timings[name] = {calcTime: Date.now() - timings[name], value: value};
						i++;
						if(i < len){
							key = keys[i];
							name = valueList[key].qName;
							return evalExp(name, key);
						}
					});
				}
			});
		}
	}
}

class SelectionProvider {
	constructor(qlikService, app){
		let _requests = {},
			_selections = [],
			_fieldCache = {},
			_selectedFields = [];

		this.getField = qlikService.getField.bind(qlikService);
		this.select = select;
		this._getSelections = () => _selections;

		// Ready for initialization
		if(!QlikService.isPrinting()){
			init();
		}

		function init(){

			// Register on selection handler
			app.selectionState().OnData.bind(function(){
				_selections = this.selections;
				_fieldCache = this.qapp.fieldCache; // contains fields, which are hidden by data scripts

				// Update selected fields list
				_selectedFields = new Array(_selections.length);
				for(var i = 0, len = _selections.length; i < len; i++){
					_selectedFields[i] = _selections[i].fieldName;
				}
			});
		}

		function select(fieldName, values, toggle, softLock, keep){
			var self = this,
				currArgs = arguments,
				prevRequest = _requests[fieldName],
				validParams = typeof fieldName === 'string' && fieldName.length > 0 && values.constructor === Array && values.length > 0;

			if(!validParams){
				return Promise.reject('No valid parameters', arguments);
			}

			if(!prevRequest || !prevRequest.pending){ // first request, or a finished last one
				if(keep && isSelected(fieldName)){
					return Promise.resolve(true); // Field is already selected -> keep selection -> return success = true
				}
				prevRequest = _requests[fieldName] = {
					promise: app.field(fieldName).select(values, !!toggle, !!softLock)
						.catch(qlikService.engineErrorHandler(app.field(fieldName), 'select', [values, !!toggle, !!softLock])),
					arguments: currArgs,
					pending: true,
					counter: 0
				};
			}

			return Promise.resolve(prevRequest.promise).then(function(success){
				prevRequest.pending = false;
				if(!success){
					if(prevRequest.counter > 2){
						console.warn('Selection of fieldName "'+ prevRequest.arguments[0] +'" failed ' + prevRequest.counter + ' times, request aborted...', prevRequest.arguments);
						return false;
					}
					console.warn('Selection of fieldName "'+ prevRequest.arguments[0] +'" wasn\'t successfull, try again', prevRequest.arguments);
					prevRequest.counter++;
					return select.apply(self, prevRequest.arguments); // Repeat selection if previous call failed
				}else{
					var prevArgs = prevRequest.arguments;
					if(arraysDiffers(prevArgs[1], currArgs[1]) && !keep){ // Make new selection if previous select values differs
						console.info('Override previous selection', {prev: prevArgs, curr: currArgs});
						select.apply(self, currArgs);
					}
				}
			});
		}

		/**
		 * Determines if a field has selected values
		 * @param fieldName
		 */
		function isSelected(fieldName){
			var request = _requests[fieldName],
				selected = _selectedFields.indexOf(fieldName) > -1,
				field = _fieldCache && _fieldCache[fieldName];
			if(!selected && !field){
				return !!(request && request.pending);
			}
			return selected;
		}
	}

	/**
	 * Returns current selections as an array of {fieldName: selectedValues} object
	 *
	 * @return {{fieldName: string, selectedValues: string[]}}
	 */
	getCurrentSelections(){
		return this._getSelections().map(sel =>({
			fieldName: sel.fieldName,
			selectedValues: sel.selectedValues.map(val => val.qName)
		}));
	}

	/**
	 * Clear the selections of a specific field.
	 *
	 * @param {string} fieldName
	 *
	 * @return {{field: Object}|*|Promise<any>}
	 */
	clearField(fieldName){
		return this.getField(fieldName).then((field) => field.clear());
	}

	/**
	 * Clear the selections in all fields except the current field.
	 *
	 * @param {string} fieldName
	 * @param {boolean} [softLock]
	 *
	 * @return {{field: Object}|*|Promise<any>}
	 */
	clearOther(fieldName, softLock){
		return this.getField(fieldName).then((field) => field.clearOther(softLock));
	}

	/**
	 * Locks all selected values of a specific field.
	 *
	 * @param {string} fieldName
	 *
	 * @return {{field: Object}|*|Promise<any>}
	 */
	lockField(fieldName){
		return this.getField(fieldName).then((field) => field.lock());
	}

	/**
	 * Selects all values of a field. Excluded values are also selected.
	 * @param {string} fieldName
	 * @param {boolean} [softLock]
	 *
	 * @return {{field: Object}|*|Promise<any>}
	 */
	selectAll(fieldName, softLock){
		return this.getField(fieldName).then((field) => field.selectAll(softLock));
	}

	/**
	 * Selects all alternatives values in a specific field.
	 *
	 * @param {string} fieldName
	 * @param {boolean} [softLock]
	 *
	 * @return {{field: Object}|*|Promise<any>}
	 */
	selectAlternative(fieldName, softLock){
		return this.getField(fieldName).then((field) => field.selectAlternative(softLock));
	}

	/**
	 * Inverts the current selections.
	 *
	 * @param {string} fieldName
	 * @param {boolean} [softLock]
	 *
	 * @return {{field: Object}|*|Promise<any>}
	 */
	selectExcluded(fieldName, softLock){
		return this.getField(fieldName).then((field) => field.selectExcluded(softLock));
	}

	/**
	 * Selects matching field values.
	 *
	 * @param {string} fieldName
	 * @param {string} value
	 * @param {boolean} [softLock]
	 *
	 * @return {{field: Object}|*|Promise<any>|Promise<never>}
	 */
	selectMatch(fieldName, value, softLock){
		return this.getField(fieldName).then((field) => field.selectMatch(value, softLock));
	}

	/**
	 * Selects all possible values in a specific field.
	 *
	 * @param {string} fieldName
	 * @param {boolean} [softLock]
	 *
	 * @return {{field: Object}|*|Promise<any>}
	 */
	selectPossible(fieldName, softLock){
		return this.getField(fieldName).then((field) => field.selectAll(softLock));
	}

	/**
	 * Selects some values in a field, by entering the values to select.
	 *
	 * @param {string} fieldName
	 * @param {string[] | number[]} values
	 * @param {boolean} [toggle]
	 * @param {boolean} [softLock]
	 *
	 * @return {{field: Object}|*|Promise<any>}
	 */
	selectValues(fieldName, values, toggle, softLock){
		return this.getField(fieldName).then((field) => field.selectValues(values, toggle, softLock));
	}
}

function arraysDiffers(arrA, arrB){
	return arrA.length === arrB.length && contains(arrA, arrB) && contains(arrB, arrA) && false;

	function contains(a, b){
		for(var i = 0, len = b.length; i < len; i++){
			if(a.indexOf(b[i]) === -1) return true;
		}
		return false;
	}
}

export {
	qlik
};

// DEPRECATED: QlikService as the angular service is available for support reason only (some users are using it in buttons custom actions)
qvangular.service(prefix + 'QlikService', () => QlikService.getInstance());