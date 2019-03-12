import MigrationService from './MigrationService';
import {QlikService} from '@highcoordination/common-sense';
import {UtilService} from './UtilService';
import {Logger} from '../../classes/utils/Logger';
import {Constants} from '../../global/Constants';

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
						!_qlikService.isPublished() &&  this.updateAllExtensions(force); // update all extensions only in NOT published apps
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
			needsUpdate(1, 2, 2) && updates.push(update122);
			needsUpdate(1, 3, 0) && updates.push(update130);
			needsUpdate(1, 4, 0) && updates.push(update140);

			//!!!Important allways push the latest update when adding a new one
			//Make sure that the update can be applied multiple times!!!
			if(force && !updates.length){
				updates.push(update140);
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

			// remove "invalid" dimensions from dimension list (they are not convertable)
			properties.dimensions = properties.dimensions.filter((dimension) => dimension.dropdownDim !== 'no dimension');

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
		 * Updates for all extensions created before release 1.2.2
		 *
		 * @param {UpdateService_updateObject} updateObject - Update object containing all update related data
		 *
		 * @return {Promise<UpdateService_updateObject>} - Updated extension properties in a Promise
		 */
		function update122(updateObject){
			updateObject.properties.qHyperCubeDef.qMode = 'K';
			updateObject.properties.qHyperCubeDef.qMaxStackedCells = 0;

			return Promise.resolve(updateObject);
		}

		/**
		 * Updates for all extensions created before release 1.3.2
		 *
		 * @param {UpdateService_updateObject} updateObject - Update object containing all update related data
		 *
		 * @return {Promise<UpdateService_updateObject>} - Updated extension properties in a Promise
		 */
		function update130(updateObject){
			updateObject.properties.appearance.selectionSelected = Constants.selectionSelected;
			updateObject.properties.appearance.selectionNormal = Constants.selectionNormal;
			updateObject.properties.appearance.selectionAlternative = Constants.selectionAlternative;
			updateObject.properties.appearance.selectionSelectedBorder = Constants.selectionSelectedBorder;
			updateObject.properties.appearance.selectionNormalBorder = Constants.selectionNormalBorder;
			updateObject.properties.appearance.selectionAlternativBorder = Constants.selectionAlternativBorder;
			updateObject.properties.appearance.selectionExcludedBorder = Constants.selectionExcludedBorder;
			updateObject.properties.appearance.selectionSelectedText = Constants.selectionSelectedText;
			updateObject.properties.appearance.selectionNormalText = Constants.selectionNormalText;
			updateObject.properties.appearance.selectionAlternativeText = Constants.selectionAlternativeText;
			updateObject.properties.appearance.selectionExcludedText = Constants.selectionExcludedText;
			updateObject.properties.appearance.selectionExcluded = Constants.selectionExcluded;
			updateObject.properties.appearance.datePickerButtonsColor = Constants.datePickerButtonsColor;
			updateObject.properties.appearance.datePickerActiveColor = Constants.datePickerActiveColor;
			updateObject.properties.appearance.datePickerSelectedStartColor = Constants.datePickerSelectedStartColor;
			updateObject.properties.appearance.datePickerSelectedEndColor = Constants.datePickerSelectedEndColor;
			updateObject.properties.appearance.datePickerNotAllowedColor = Constants.datePickerNotAllowedColor;

			updateObject.properties.appearance.datePickerButtonHoverColor = Constants.datePickerButtonHoverColor;
			updateObject.properties.appearance.datePickerPickerHoverColer = Constants.datePickerPickerHoverColer;

			updateObject.properties.appearance.datePickerButtonsText = Constants.datePickerButtonsText;
			updateObject.properties.appearance.datePickerElementText = Constants.datePickerElementText;
			updateObject.properties.appearance.datePickerActiveText = Constants.datePickerActiveText;
			updateObject.properties.appearance.datePickerSelectedStartText = Constants.datePickerSelectedStartText;
			updateObject.properties.appearance.datePickerSelectedEndText = Constants.datePickerSelectedEndText;
			updateObject.properties.appearance.datePickerInactiveText = Constants.datePickerInactiveText;
			updateObject.properties.appearance.datePickerNotAllowedText = Constants.datePickerNotAllowedText;

			updateObject.properties.appearance.datePickerButtonHoverText = Constants.datePickerButtonHoverText;
			updateObject.properties.appearance.datePickerPickerHoverText = Constants.datePickerPickerHoverText;

			updateObject.properties.appearance.variableSliderBackground = Constants.variableSliderBackground;
			updateObject.properties.appearance.variableSliderTrack = Constants.variableSliderTrack;
			updateObject.properties.appearance.variableSliderHandle = Constants.variableSliderHandle;
			updateObject.properties.appearance.variableSliderSteps = Constants.variableSliderSteps;
			updateObject.properties.appearance.variableSliderActiveSteps = Constants.variableSliderActiveSteps;

			updateObject.properties.appearance.variableInputBackground = Constants.variableInputBackground;
			updateObject.properties.appearance.variableInputText = Constants.variableInputText;
			updateObject.properties.appearance.variableInputPlaceholder = Constants.variableInputPlaceholder;
			updateObject.properties.appearance.variableInputFocus = Constants.variableInputFocus;
			updateObject.properties.appearance.variableInputInvalid = Constants.variableInputInvalid;

			return Promise.resolve(updateObject);
		}

		/**
		 * Updates for all extensions created before release 1.4.0
		 *
		 * @param {UpdateService_updateObject} updateObject - Update object containing all update related data
		 *
		 * @return {Promise<UpdateService_updateObject>} - Updated extension properties in a Promise
		 */
		function update140(updateObject){
			if(updateObject.properties.title === 'trueChart-Menubar' || updateObject.properties.title === null){
				updateObject.properties.title = 'Menubar';
			}

			const appearance = updateObject.properties.appearance;

			if(appearance){
				appearance.dynamicFontLabelSize = checkAndGetProperty(appearance.dynamicFontLabelSize, Constants.defaultFontScalingFactor);
				appearance.dynamicFontLabelMinSize = checkAndGetProperty(appearance.dynamicFontLabelMinSize, Constants.defaultFontLabelMinSize);
				appearance.dynamicFontSelectionMinSize = checkAndGetProperty(appearance.dynamicFontSelectionMinSize, Constants.defaultFontSelectionMinSize);
				appearance.dynamicFontSelectionSize = checkAndGetProperty(appearance.dynamicFontSelectionSize, Constants.defaultFontScalingFactor);
				appearance.dynamicFontCalculation = checkAndGetProperty(appearance.dynamicFontCalculation, Constants.dynamicFontCalculation);
				appearance.styleSheetBackgroundActive = checkAndGetProperty(appearance.styleSheetBackgroundActive, Constants.styleSheetBackgroundActive);
				appearance.sheetBackgroundOpacityImage = checkAndGetProperty(appearance.sheetBackgroundOpacityImage, 100);
				appearance.sheetBackgroundOpacityColor = checkAndGetProperty(appearance.sheetBackgroundOpacityColor, 100);
				appearance.sheetBackgroundImage = checkAndGetProperty(appearance.sheetBackgroundImage, Constants.menubarLogoPath);
				appearance.sheetBackgroundColor = checkAndGetProperty(appearance.sheetBackgroundColor, 'white');
				appearance.sheetBackgroundOpacity = checkAndGetProperty(appearance.sheetBackgroundOpacity, 100);
				appearance.sheetBackgroundHorizontalPosition = checkAndGetProperty(appearance.sheetBackgroundHorizontalPosition, 'center');
				appearance.sheetBackgroundVerticalPosition = checkAndGetProperty(appearance.sheetBackgroundVerticalPosition, 'center');
				appearance.sheetBackgroundSize = checkAndGetProperty(appearance.sheetBackgroundSize, '');
				appearance.sheetBackgroundRepeat = checkAndGetProperty(appearance.sheetBackgroundRepeat, 'initial');
				appearance.sheetBackgroundDisplayType = checkAndGetProperty(appearance.sheetBackgroundDisplayType, 'original');

				appearance.borderUniform = checkAndGetProperty(appearance.borderUniform, 'uniform');
				appearance.borderWidthUniform = checkAndGetProperty(appearance.borderWidthUniform, '0');
				appearance.borderWidthTop = checkAndGetProperty(appearance.borderWidthTop, '0');
				appearance.borderWidthRight = checkAndGetProperty(appearance.borderWidthRight, '0');
				appearance.borderWidthBottom = checkAndGetProperty(appearance.borderWidthBottom, '0');
				appearance.borderWidthLeft = checkAndGetProperty(appearance.borderWidthLeft, '0');

				appearance.borderColorUniform = checkAndGetProperty(appearance.borderColorUniform, 'rgb(0,0,0)');
				appearance.borderColorTop = checkAndGetProperty(appearance.borderColorUniform, 'rgb(0,0,0)');
				appearance.borderColorRight = checkAndGetProperty(appearance.borderColorUniform, 'rgb(0,0,0)');
				appearance.borderColorBottom = checkAndGetProperty(appearance.borderColorUniform, 'rgb(0,0,0)');
				appearance.borderColorLeft = checkAndGetProperty(appearance.borderColorUniform, 'rgb(0,0,0)');

				appearance.paddingUniform = checkAndGetProperty(appearance.paddingUniform, 'uniform');
				appearance.paddingWidthUniform = checkAndGetProperty(appearance.paddingWidthUniform, '0');
				appearance.paddingWidthTop = checkAndGetProperty(appearance.paddingWidthTop, '0');
				appearance.paddingWidthRight = checkAndGetProperty(appearance.paddingWidthRight, '0');
				appearance.paddingWidthBottom = checkAndGetProperty(appearance.paddingWidthBottom, '0');
				appearance.paddingWidthLeft = checkAndGetProperty(appearance.paddingWidthLeft, '0');

				appearance.marginUniform = checkAndGetProperty(appearance.marginUniform, 'uniform');
				appearance.marginWidthUniform = checkAndGetProperty(appearance.marginWidthUniform, '0');
				appearance.marginWidthTop = checkAndGetProperty(appearance.marginWidthTop, '0');
				appearance.marginWidthRight = checkAndGetProperty(appearance.marginWidthRight, '0');
				appearance.marginWidthBottom = checkAndGetProperty(appearance.marginWidthBottom, '0');
				appearance.marginWidthLeft = checkAndGetProperty(appearance.marginWidthLeft, '0');
			}

			updateObject.properties.listItems && updateObject.properties.listItems.forEach((item) => {
				if(!item.props.colors){
					updateIndividualDefaultColors(item);
				}

				item.props.showOnMobile = checkAndGetProperty(item.props.showOnMobile, true);

				if(item.type === 'Button Container'){
					item.subItems.forEach((subItem) => {
						subItem.props.showBorder = checkAndGetProperty(subItem.props.showBorder, true);
					})
				}


				item.groupItems && item.groupItems.forEach((groupItem) => {
					if(!groupItem.props.colors){
						updateIndividualDefaultColors(groupItem);
					}

					groupItem.props.height = checkAndGetProperty(groupItem.props.height, 56);
					groupItem.props.showOnMobile = checkAndGetProperty(groupItem.props.showOnMobile, true);

					if(groupItem.type === 'Button Container'){
						groupItem.subItems.forEach((subItem) => {
							subItem.props.showBorder = checkAndGetProperty(subItem.props.showBorder, true);
						})
					}
				});
			});

			function updateIndividualDefaultColors(item){
				const colors = item.props.colors = {};

				if(item.type === 'Field Slider' || item.type === 'Variable Slider'){
					colors.variableSliderBackground = Constants.variableSliderBackground;
					colors.variableSliderTrack = Constants.variableSliderTrack;
					colors.variableSliderHandle = Constants.variableSliderHandle;
					colors.variableSliderSteps = Constants.variableSliderSteps;
					colors.variableSliderActiveSteps = Constants.variableSliderActiveSteps;
				}else if(item.type === 'Variable Input'){
					colors.variableInputBackground = Constants.variableInputBackground;
					colors.variableInputText = Constants.variableInputText;
					colors.variableInputPlaceholder = Constants.variableInputPlaceholder;
					colors.variableInputFocus = Constants.variableInputFocus;
					colors.variableInputInvalid = Constants.variableInputInvalid;
				}else if(item.type === 'Variable Dropdown'){
					colors.subItemBackgroundColor = Constants.subItemBackgroundColor;
					colors.hoverSubItemColor = Constants.hoverSubItemColor;
					colors.textSubColor = Constants.textSubColor;
					colors.textHoverSubColor = Constants.textHoverSubColor;
					colors.subItemSeparatorColor = Constants.subItemSeparatorColor;
				}

				colors.backgroundColor = Constants.backgroundColor;
				colors.hoverActiveColor = Constants.hoverActiveColor;
				colors.textColor = Constants.textColor;
				colors.textHoverColor = Constants.textHoverColor;
				colors.borderSeparatorColor = Constants.borderSeparatorColor;
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
							qSortByAscii: dimension.qSortByAsciiCheck && !dimension.customSortOrder ? dimension.sortByAscii : 1,
							qSortByState: dimension.qSortByStateCheck && !dimension.customSortOrder ? dimension.sortByState : 0,
							qSortByFrequency: dimension.qSortByFrequencyCheck && !dimension.customSortOrder ? dimension.sortByFrequency : 0,
							qSortByExpression: dimension.qSortByExpressionCheck && !dimension.customSortOrder ? dimension.sortByExpression : 0,
							qSortByLoadOrder: dimension.sortByLoadOrderCheck && !dimension.customSortOrder ? dimension.sortByLoadOrder : 1,
							qSortByNumeric: dimension.qSortByNumericCheck && !dimension.customSortOrder ? dimension.sortByNumeric : 0,
						}
					],
				},
			};
		}

		function checkAndGetProperty(property, value){
			if(property === undefined){
				return value;
			}
			return property;
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
	updateAllExtensions(force){
		_migrationService.getList('extension').then(extensionList =>{
			// run updates sequentially to minimize engine load
			extensionList.reduce((promise, extension) => promise.then(() =>{
				const qExtendsId = extension.properties ? extension.properties.qExtendsId : undefined;

				// check if update was already performed
				if(_updatedObjectIds.indexOf(qExtendsId || extension.id) === -1){

					// in case we have a master item, we need to get the sourceObject before we trigger the update
					if(qExtendsId){
						return _qlikService.getMasterObjectProperties(extension)
							.then(sourceObject => this.checkUpdates(sourceObject, force))
							.catch(err => Logger.warn('Update failed', err));
					}

					// update normal extension
					return this.checkUpdates(extension, force).catch(err => Logger.warn('Update failed', err));
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