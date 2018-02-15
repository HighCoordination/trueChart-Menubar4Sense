import MigrationService from './MigrationService';
import {QlikService} from '../../lib/hico/services/qlik-service';
import {UtilService} from './UtilService';
import {Logger} from '../../lib/hico/logger';

/**
 * @typedef {Object} UpdateService_updateObject - model that contain all update relevant data
 * @property {Object[]} [listObjects]
 * @property {Object} properties
 * @property {Object} model - original model, or a session object model in case of not updatable properties
 * @property {boolean} [isUpdatable] - true when it can be updated
 * @property {Function[]} updates - update functions that need to be done
 */


const _currentVersion = '##VERSION##', // will be replaced with current version in a format: x.x.x_(buildNumber|dev)
	_qlikService = QlikService.getInstance(),
	_migrationService = MigrationService.getInstance(),
	_updatedObjectIds = [], // Collection of object ids, which were already updated so tey shouldn't be updated again
	_updateObjects = {}, // Collection of updateObjects (Promises) with object.id as key
	_utilSerivce = UtilService.getInstance();

export default class UpdateService {
	/*
	 For every new update follow this steps:
	 1. Create new update function or use an existing one if it wasn't already released, which gets an updateObject as parameter and returns it in a Promise
	 2. Add new if check in runUpdates and push (add) your update to the updates array
	*/

	/**
	 * Constructor of the UpdateService Class
	 */
	constructor(){
		let updatesInProgress = false;

		/**
		 * Updates the extension model, if required
		 *
		 * @param {Object} model - Extension model with layout available (normally initially there)
		 * @param {boolean} force - Force the last update
		 *
		 * @return {Promise<UpdateService_updateObject | {}>} - updateObject if update were performed, empty object otherwise
		 */
		this.checkUpdates = function(model, force){
			const updates = getUpdates((model.layout && model.layout.qInfo ? model.layout : model.properties).version, force);

			// Run updates only if required
			if(updates.length > 0){
				// In case of master item we need to update properties of the master object!
				return _qlikService.getMasterObjectProperties(model).then((srcObject) =>{
					const srcId = srcObject.id;

					// Check if the object was already updated, so no need to update his properties again
					// In case of multiple extensions from same master item on the same sheet, update of the same sourceobject would be triggered multiple times
					if(_updatedObjectIds.indexOf(srcId) !== -1){
						Logger.info('object was already updated');
						return Promise.resolve(_updateObjects[srcId]); // resolve already existing updateObject
					}
					_updatedObjectIds.push(srcId);

					// trigger update for all tcMenu extensions when not already in progress
					if(!updatesInProgress){
						updatesInProgress = true;
						!_qlikService.isPublished() &&  this.updateAllExtensions(); // update all extensions only in NOT published apps
					}

					Logger.info('update is running');
					return _updateObjects[srcId] = updateSingleExtension(srcObject, updates); // add updateObject to the collection
				}).catch(function(err){
					Logger.error('HICO: Error occurred during tcmenu update', err, model);
					return Promise.reject();
				});
			}

			// otherwise no updates required
			return Promise.resolve({});
		};


		/**
		 * Executes the update for one instance of a tcMenu-Extensions
		 *
		 * @param {Object} srcObject - source object
		 * @param {Function[]} updates - update functions to run on the current model
		 *
		 * @return Promise<UpdateService_updateObject>
		 */
		function updateSingleExtension(srcObject, updates){
			return _qlikService.getProperties(srcObject, true)
				.then(properties => runUpdates({
					model: srcObject,
					isUpdatable: _qlikService.isUpdatable(srcObject),
					properties: JSON.parse(JSON.stringify(properties)), // keep our own (undependent) copy of properties
					updates: updates
				}))
				.then(updateObject =>{

					// Update version to the currentVersion
					updateObject.properties.version = _currentVersion;

					if(updateObject.isUpdatable){
						// Finally set properties and make changes persistent (in case the object is updatable)
						return _qlikService.setProperties(srcObject, updateObject.properties).then(() => updateObject);
					}else{
						// Otherwise create a session object with updated properties, to use it instead of not updatable model
						updateObject.properties.qInfo.qId += '_updated';
						return _qlikService.createSessionObject(updateObject.properties).then(obj => updateObject.model = obj).then(() => updateObject);
					}
				});
		}

		/**
		 * Returns updates in array, depending on current version
		 *
		 * @param {string | *} version
		 * @param {boolean} force last update flag
		 *
		 * @return {Array}
		 */
		function getUpdates(version, force){
			let verMajor = 1, verMinor = 0, verPatch = 0,
				updates = [];

			version = (typeof version === 'string' ? version : version.toString()).split('.');

			if(version){
				verMajor = parseInt(version[0]) || 1;
				verMinor = parseInt(version[1]) || 0;
				verPatch = parseInt(version[2]) || 0;
			}

			needsUpdate(1, 0, 2) && updates.push(update102);
			needsUpdate(1, 0, 4) && updates.push(update104);
			needsUpdate(1, 1, 0) && updates.push(migrate110) && updates.push(update110);
			needsUpdate(1, 2, 0) && updates.push(update120);

			//!!!Important allways push the latest update when adding a new one
			//Make sure that the update can be applied multiple times!!!
			if(force && !updates.length){
				updates.push(update120);
			}

			return updates;

			function needsUpdate(major, minor, patch){
				return verMajor < major ||
					(verMajor === major && verMinor < minor) ||
					(verMajor === major && verMinor === minor && verPatch < patch);
			}
		}


		/**
		 * Execute required updates to update extension properties
		 *
		 * @param {UpdateService_updateObject} updateObject - Update object containing all update related data
		 *
		 * @return {Promise<UpdateService_updateObject>} - Updated extension properties in a Promise
		 */
		function runUpdates(updateObject){
			const version = updateObject.properties.version,
				oldVersion = 'string' === typeof version ? version.split('_')[0] : '1.0.0';

			console.info('Update tcmenu from "' + oldVersion + '" to version "' + _currentVersion + '"');

			// Run updates sequentially
			return updateObject.updates.reduce((waitForUpdate, update) =>{
				return waitForUpdate.then(updateObject => update(updateObject));
			}, Promise.resolve(updateObject));
		}


		/**
		 * Updates for all extensions created before release 1.0.2
		 *
		 * @param {UpdateService_updateObject} updateObject - Update object containing all update related data
		 *
		 * @return {Promise<UpdateService_updateObject>} - Updated extension properties in a Promise
		 */
		function update102(updateObject) {
			const properties = updateObject.properties;

			// Create qHyperCubeDef which is required for qCalcCond in properties panel
			if(!properties.qHyperCubeDef){
				properties.qHyperCubeDef = {
					qCalcCond: {},
					qDimensions : [],
					qMeasures : [],
					qInitialDataFetch : [{ qWidth: 0, qHeight: 0 }]
				};
			}

			// Add default calcCondVariable propertie if not already defined
			if(!properties.calCondVariable){
				properties.calCondVariable = '';
			}

			// Return updated properties as a Promise
			return Promise.resolve(updateObject);
		}


		/**
		 * Updates for all extensions created before release 1.0.4
		 *
		 * @param {UpdateService_updateObject} updateObject - Update object containing all update related data
		 *
		 * @return {Promise<UpdateService_updateObject>} - Updated extension properties in a Promise
		 */
		function update104(updateObject){
			const properties = updateObject.properties;

			// remove unused properties
			delete properties.qFieldListDef;
			delete properties.qListObjectDef;

			return Promise.resolve(updateObject);
		}


		/**
		 * Prepare update for version 1.1.0
		 *
		 * @param {UpdateService_updateObject} updateObject - Update object containing all update related data
		 *
		 * @return {Promise<UpdateService_updateObject>} - Updated extension properties in a Promise
		 */
		function migrate110(updateObject){
			return _migrationService.migrate('1.1.0', updateObject.isUpdatable).then(() => updateObject);
		}


		/**
		 * Updates for all extensions created before release 1.1.0
		 *
		 * @param {UpdateService_updateObject} updateObject - Update object containing all update related data
		 *
		 * @return {Promise<UpdateService_updateObject>} - Updated extension properties in a Promise
		 */
		function update110(updateObject){
			const properties = updateObject.properties;

			// reset eventually existing qDimensions definition (there shouldn't be any)
			properties.qHyperCubeDef.qDimensions = [];

			// disable initial data fetch (data of the hyperCube will never be used, so no need to fetch it)
			properties.qHyperCubeDef.qInitialDataFetch = [
				{qWidth: 0, qHeight: 0}
			];

			// create qChildListDef for new (not session) listObjects
			properties.qChildListDef = {
				qData: {dimId: '/dimId', listDef: '/listDef', listLibId: '/listLibId'}
			};

			// add new property "Show Condition"
			(properties.listItems || []).forEach(listItem =>{
				if(listItem.showCondition === undefined){
					listItem.showCondition = '';
				}
			});

			// we can stop here, if we do not have any dimensions to update
			if(!properties.dimensions || !properties.dimensions.length){
				properties.dimensions = []; // make sure we have a valid dimensions array
				updateObject.listObjects = [];
				return Promise.resolve(updateObject);
			}

			// ensure correct mapping between dimensions and listItems by using dimensions cId as unique key
			updateDimensions(properties);

			// create/update qHyperCubeDef from dimensions
			updateHyperCube(properties);

			// finally create child/session list objects (asynchronous)
			return createListObjects(updateObject);


			function updateDimensions(properties){
				let dimensions = properties.dimensions || [],
					listItems = properties.listItems || [];

				dimensions.forEach(dimension =>{
					listItems.forEach(item =>{
						if(item.type === 'Single Select' || item.type === 'Sense Select'){
							setDimId(item, dimension);
						}else if(item.type === 'Multi Select' && item.selectItems){
							item.selectItems.forEach(item => setDimId(item, dimension));
						}
					});
				});

				function setDimId(item, dimension){
					if(item.props.dim === dimension.dimTitle || item.props.dim === dimension.dim || item.props.dimTitle === dimension.dimTitle){
						item.props.dimId = dimension.cId;
					}
				}
			}

			function updateHyperCube(properties){
				// get expressionMap which MUST contain all expressions, which need to be replaced, otherwise no replacements will beperformed
				const updateData = _migrationService.getUpdateData('1.1.0'),
					expressionMap = updateData.expressionMap,
					availableDimensions = updateData.dimensions,
					dimensions = properties.dimensions || [],
					qDimensions = properties.qHyperCubeDef.qDimensions; // qDimensions must be an empty array here

				dimensions.forEach(dimension =>{
					let dim = dimension.dim,
						dimTitle = typeof dim === 'undefined' && dimension.dimTitle, // fallback if no dim defined
						dimExpr = dim && dim.qStringExpression ? dim.qStringExpression.qExpr : dim || dimTitle,
						qLibraryId = undefined,
						validDim = availableDimensions.some(dimData => {
							if(dimData.expr === dimExpr){
								qLibraryId = dimData.qLibraryId;
								return true;
							}
						});

					// use corrected dimension expression if required/possible
					if(!validDim && expressionMap[dimExpr]){
						dimExpr = expressionMap[dimExpr];
					}

					qDimensions.push(convertDimensionToDefinition(dimExpr, dimension, qLibraryId));
				});
			}

			/**
			 * Creates ListObject
			 *
			 * @param {UpdateService_updateObject} updateObject
			 *
			 * @return {Promise<UpdateService_updateObject>}
			 */
			function createListObjects(updateObject){
				const properties = updateObject.properties,
					qDimensions = properties.qHyperCubeDef.qDimensions,
					model = updateObject.model,
					temporary = updateObject.isUpdatable ? undefined : true;

				// create list objects sequentially, do not stress the engine too much
				return qDimensions.reduce((resolve, qDimension) =>{
					return resolve.then(promises =>{
						promises.push(createListObject(model, qDimension, temporary));
						return Promise.all(promises);
					});
				}, Promise.all([])).then(listObjects =>{
					// collect created child/session objects and make them available after update
					updateObject.listObjects = listObjects;

					return updateObject;
				});
			}
		}

		/**
		 * Updates for all extensions created before release 1.2.0
		 *
		 * @param {UpdateService_updateObject} updateObject - Update object containing all update related data
		 *
		 * @return {Promise<UpdateService_updateObject>} - Updated extension properties in a Promise
		 */
		function update120(updateObject){
			const subItems = {
				'Multi Select': {type: 'Single Select', key: 'selectItems'},
				'Button Dropdown': {type: 'Button', key: 'dropdownItems'}
			};

			updateObject.properties.listItems.forEach(item => {
				if(item.type in subItems){
					const sub = subItems[item.type];

					item.groupItems = item[sub.key];
					item.type = 'Group';

					item.groupItems.forEach(groupItem => {
						groupItem.type = sub.type;
						groupItem.showCondition = item.showCondition;
					});

					// delete item[sub.key]; // TODO: this property should be deleted, but was kept for "backward compatibility".
					// it should be possible for user to clean up its tcmenu "manually" if required
				}
			});

			//add propper type name to every element
			updateTypesAndIds(updateObject.properties.listItems);

			function updateTypesAndIds(listItems){
				listItems.forEach(listItem => {
					listItem.cId = _utilSerivce.generateGuid();

					if(listItem.type === 'Group'){
						updateTypesAndIds(listItem.groupItems);
					}

					listItem.subItems && listItem.subItems.forEach(subItem => {
						subItem.cId = _utilSerivce.generateGuid();
						subItem.type = 'subButton';

						subItem.stateItems && subItem.stateItems.forEach(stateItem => {
							stateItem.cId = _utilSerivce.generateGuid();
							stateItem.type = 'buttonState';
						});
					});

					listItem.variableItems && listItem.variableItems.forEach(variableItem => {
						variableItem.cId = _utilSerivce.generateGuid();
					});

					listItem.stateItems && listItem.stateItems.forEach(stateItem => {
						stateItem.cId = _utilSerivce.generateGuid();
						stateItem.type = 'buttonState';
					});
				});
			}

			return Promise.resolve(updateObject);
		}

		/**
		 * Creates a ListObject
		 *
		 * @param {Object} model - srcObject
		 * @param {Object} qDimension
		 * @param {boolean} [temporary]
		 *
		 * @return {Object}
		 */
		function createListObject(model, qDimension, temporary){
			// If qLibraryId is available (master dimension) use it instead of the qDef,
			const qDef = qDimension.qLibraryId ? undefined : qDimension.qDef;

			let definition = {
				qInfo: {
					qType: 'qListObject',
				},
				temporary: temporary,
				dimId: qDimension.qDef.cId,
				listDef: qDef,
				listLibId: qDimension.qLibraryId,
				qListObjectDef: {
					qLibraryId: qDimension.qLibraryId,
					qDef: qDef,
					qShowAlternatives: true,
					qInitialDataFetch: [{qHeight: 10000, qWidth: 1}]
				}
			};

			// retry to create objects on failure (somtimes client.js resolves the promise with undefined object)
			return temporary
				? _qlikService.createSessionObject(definition)
				: _qlikService.createChild(model, definition);
		}

		/**
		 * Creates a hyperCubes dimension definiton Object
		 *
		 * @param {string} expr - Dimension expression
		 * @param {object} dimension - Dimension to be converted (old format)
		 */
		function convertDimensionToDefinition(expr, dimension, qLibraryId){
			const sortExpression = dimension.sortExpression,
				qv = typeof sortExpression === 'object' ? sortExpression.qStringExpression.qExpr : sortExpression;
			return {
				qLibraryId: qLibraryId,
				qDef: {
					autoSort: dimension.customSortOrder,
					cId: dimension.cId,
					qFieldDefs: [expr],
					qFieldLabels: [dimension.dimTitle],
					qNumberPresentations: [],
					qSortByAsciiCheck: dimension.qSortByAsciiCheck,
					qSortByStateCheck: dimension.qSortByStateCheck,
					qSortByFrequencyCheck: dimension.qSortByFrequencyCheck,
					qSortByExpressionCheck: dimension.qSortByExpressionCheck,
					qSortByLoadOrderCheck: dimension.sortByLoadOrderCheck,
					qSortByNumericCheck: dimension.qSortByNumericCheck,
					qExpression: {
						qv: qv
					},
					qSortCriterias: [
						{
							qExpression: {
								qv: qv,
								qExpr: qv
							},
							qSortByAscii: dimension.qSortByAsciiCheck && !dimension.customSortOrder ? dimension.sortByAscii : 0,
							qSortByState: dimension.qSortByStateCheck && !dimension.customSortOrder ? dimension.sortByState : 0,
							qSortByFrequency: dimension.qSortByFrequencyCheck && !dimension.customSortOrder ? dimension.sortByFrequency : 0,
							qSortByExpression: dimension.qSortByExpressionCheck && !dimension.customSortOrder ? dimension.sortByExpression : 0,
							qSortByLoadOrder: dimension.sortByLoadOrderCheck && !dimension.customSortOrder ? dimension.sortByLoadOrder : 0,
							qSortByNumeric: dimension.qSortByNumericCheck && !dimension.customSortOrder ? dimension.sortByNumeric : 0,
						}
					],
				},
			};
		}
	}

	/**
	 * Returns the instance of updateService
	 *
	 * @return {UpdateService}
	 */
	static getInstance(){
		if(UpdateService._instance){
			return UpdateService._instance;
		}
		return UpdateService._instance = new UpdateService();
	}

	/**
	 * trigger the update for all tcMenu-extensions in the current app
	 */
	updateAllExtensions(){
		_migrationService.getList('extension').then(extensionList =>{
			// run updates sequentially to minimize engine load
			extensionList.reduce((promise, extension) => promise.then(() =>{
				const qExtendsId = extension.properties ? extension.properties.qExtendsId : undefined;

				// check if update was already performed
				if(_updatedObjectIds.indexOf(qExtendsId || extension.id) === -1){

					// in case we have a master item, we need to get the sourceObject before we trigger the update
					if(qExtendsId){
						return _qlikService.getMasterObjectProperties(extension)
							.then(sourceObject => this.checkUpdates(sourceObject))
							.catch(err => Logger.warn('Update failed', err));
					}

					// update normal extension
					return this.checkUpdates(extension).catch(err => Logger.warn('Update failed', err));
				}
			}), Promise.resolve());
		})
	}

	/**
	 * Run updates with atleast the latest update
	 *
	 * @param {Object} model - Extension model with layout available (normally initially there)
	 */
	forceLastUpdate(model){
		this.checkUpdates(model, true).catch(err => Logger.warn('Update failed', err));
	}
}