import * as qvangular from 'qvangular';
import {translation} from '../../resource/translations/translations';
import {ListItem} from '../classes/ListItem';
import {Logger} from '../classes/utils/Logger';
import UpdateService from './Services/UpdateService';
import {
	loadEditor,
	MediaService,
	qlik,
	QlikService
} from '@highcoordination/common-sense';
import {UtilService} from "./Services/UtilService";
import {ApiService} from './Services/ApiService';
import {ContentManager} from './Components/Managers/ContentManager';

export function Extension(){

	this.controller = controller;
	this.paint = paint;
	this.updateData = updateData;

	const percentRegex = /[0-9.+-]*?%/;
	const pixelRegex = /[0-9.]*?p/;
	const qlikService = QlikService.getInstance();
	const utilService = UtilService.Instance;

	/**
	 * Controller function of the extension
	 * @param $scope
	 * @param $element
	 * @param utilService
	 */
	function controller($scope, $element){

		// $scope does not always work (not in any QS version)
		let _app = qlik.currApp(/*$scope*/), // reference must have backandApi as property ($scope -> backendApi -> model)
			_waitForUpdates, // Promise, which will be resolved, when updates are finished
			_model = $scope.backendApi.model,
			_originalModel = $scope.backendApi.model, // keep the original model for future usage (if needed)
			_waitForVariable = qlik.Promise.resolve(),
			_selectionsInProgress = false,
			_ready = qlik.Promise.defer(),
			_eventListener = {}; // collect "unbind" callbacks for added eventListener with object id as key

		let oldStyleInputBackground,
			oldStyleInputText,
			oldStyleInputPlaceholder,
			oldStyletextSelectionFamily,
			oldStyletextSelectionSize,
			oldStyletextSelectionWeight,
			oldStyletextSelectionStyle;

		$scope.getElement = () => $element;
		$scope.$ctrl = this;
		$scope.utilService = utilService;
		$scope.apiService = ApiService.Instance;
		$scope.colors = {
			backgroundColor: '',
			subItemBackgroundColor: '',
			hoverActiveColor: '',
			hoverSubItemColor: '',
			borderSeparatorColor: '',
			textColor: '',
			textHoverColor: '',
			textSubColor: '',
			textHoverSubColor: ''
		};

		$scope.menubarStyle = {};

		$scope.articleElement = $element.parents('article')[0];

		$scope.isPrinting = qlikService.isPrinting();
		$scope.isPublished = !$scope.isPrinting && _app.model.layout.published === true;

		//##################### Updates #######################
		if(!$scope.isPrinting){
			_waitForUpdates = UpdateService.getInstance().checkUpdates(_model);

			// Watch selection state and update selection labels
			$scope.selState = _app.selectionState();
			$scope.selState.OnData.bind(updateSelectionLabels);

			if(qlikService.inPlayMode()){
				utilService.handlePlayMode();
			}

		}else{
			_waitForUpdates = Promise.resolve({});
		}
		//##################### End Updates ###################

		$scope._listObjects = {}; // collection of listObject promises with dimId as key and listObject in a promise as value
		$scope._selectItems = {}; // collection of select items (only) with dimId as key
		$scope._selections = []; // selection callbacks
		$scope._selectionTimeout = 0;
		$scope._selectionDelay = 100; // wait max 100 ms for all list items to register (addSelecton) their default selections
		$scope.listItemsDub = [];
		$scope.initReady = false;
		$scope.wasEditMode = false;
		$scope.menuOpen = false;
		$scope.onSheet = qlikService.onSheet;
		$scope.inEditMode = qlikService.inEditMode;
		$scope.inStoryMode = qlikService.inStoryMode;
		$scope.isUpdatable = true; // assume extension is updatable, if not, updater should return the "valid" value
		$scope.isMasterItem = qlikService.isMasterItem(_model);
		$scope.isMasterObject = qlikService.isMasterObject(_model);
		// do not evaluate button states for snapshots
		$scope.evaluateStates = !qlikService.isSnapshotObject(_model) && !qlikService.isPrinting();
		$scope.editComponentsRequired = true; // some components are only required in edit mode
		$scope.afterPaintTimeout = 0;
		$scope.afterPaintDelay = 1000;
		$scope.uniqueId = UtilService.getUniqueMenuId();
		$scope.elementWidth = $scope.getElement()[0].clientWidth;
		$scope.watchers = [];

		$scope.getReady = getReady;
		$scope.setReady = setReady;
		$scope.initListObjects = initListObjects;
		$scope.destroyListObjects = destroyListObjects;
		$scope.updateSelectItems = updateSelectItems;
		$scope.calculateGaps = calculateGaps;
		$scope.addSelection = addSelection.bind($scope);
		$scope.applySelection = applySelection;
		$scope.applyStyles = applyStyles;
		$scope.getMenubarStyle = getMenubarStyle;
		$scope.applySheetBackground = applySheetBackground;
		$scope.switchDynamicStyleSheet = switchDynamicStyleSheet;
		$scope.toggleSenseBars = toggleSenseBars;
		$scope.toggleNavBarButtons = toggleNavBarButtons;
		$scope.updateSelectionLabels = updateSelectionLabels;
		$scope.handleButtonStates = handleButtonStates;
		$scope.checkListObjectsValid = checkListObjectsValid;
		$scope.afterPaint = afterPaint;
		$scope.updateListItemsProps = updateListItemsProps;
		$scope.checkAndUpdateListObjects = checkAndUpdateListObjects;
		$scope.checkExpressionCondition = utilService.checkExpressionCondition;

		$element.on('$destroy', onDestroy);

		$scope.watchers.push($scope.$on('menubar-repaint', () => {
			const _this = $scope._this;
			_this && _this.paint.apply(_this, [$scope._$element, $scope.layout]);
		}));

		if($element.parents(".qv-gridcell").length > 0){
			let cellStyle = $element.parents(".qv-gridcell")[0].style;
			$scope.defaultCellStyleTop = getValue(cellStyle.top, '%');
			$scope.defaultCellStyleBottom = getValue(cellStyle.height, '%');
			$scope.defaultCellStyleLeft = getValue(cellStyle.left, '%');
			$scope.defaultCellStyleWidth = getValue(cellStyle.width, '%');

			$scope.topCorrection = Number(getValue(cellStyle.top, 'p'));
			$scope.heightCorrection = Number(getValue(cellStyle.height, 'p'));
			$scope.leftCorrection = Number(getValue(cellStyle.left, 'p'));
			$scope.widthCorrection = Number(getValue(cellStyle.width, 'p'));
		}

		//##################### Initialization #####################
		clearTimeout(UtilService.destroyTimeout);

		_waitForUpdates.then(updateObj =>{
			if(updateObj.isUpdatable === false){
				// update isUpdatable property with "real" values. In case of required updates, but not updatable model (published app) it will be false
				$scope.isUpdatable = updateObj.isUpdatable;

				// use updated model in case of not updatable extension
				_model = updateObj.model;

				// use layout from updated model (session object) in case of no updatable model, otherwise it comes from scopes prototype
				$scope.originalLayout = $scope.layout;
				$scope.layout = _model.layout;

				return updateObj;
			}else{
				return qlikService.getLayout(_model).then(() => updateObj);
			}
		}).then(updateObj =>{
			if($scope.isPrinting){
				$scope.initReady = true;
				return; // in case of printing, nothing more to do
			}

			/* updateObject can provide updated data (properties, updates, listObjects etc.) when an update was performed (depending on update).
			   If no updates were performed (normal scenario) updateObject should be an "empty" object */

			$scope.watchers.push(
				$scope.$watch('layout.appearance.styleSheetBackgroundActive', (oldValue, newValue) => {
					if(oldValue !== newValue){
						qvangular.$rootScope.$broadcast('menubar-repaint');
					}
				})
			);

			let listObjects = updateObj.listObjects,
				objectIds = listObjects
					? listObjects.map(obj => obj.id)
					: _originalModel.layout.qChildList.qItems.map(item => item.qInfo.qId);

			// set active select items
			setSelectItems($scope, $scope.layout.listItems);
			$scope.colors = UtilService.getColorsFromProps($scope.layout.appearance, 'all');
			$scope.menubarStyle = $scope.getMenubarStyle($scope.layout.appearance);
			ContentManager.updateComponents();
			$scope.applyStyles($scope.layout.appearance);
			$scope.applySheetBackground($scope.layout.appearance);
			$scope.switchDynamicStyleSheet($scope.layout.appearance);

			// Trigger a repaint after variable change
			qlikService.variableProvider.getValueObject().then(function(valObj){
				_eventListener['variableListener'] = [qlikService.bindListener(valObj, 'Validated', function(){
					if(!$scope.inEditMode()){
						let _this = $scope._this;
						_this && _this.paint && _this.paint.apply(_this, [$scope._$element, $scope.layout]);
					}
				})];
			});

			// after this step all listObjects should be used from $scope._listObjects
			return Promise.all(objectIds.map(id => qlikService.getObjectLayout(id))).then(listObjects => initListObjects(listObjects)).then(() => {
				$scope.updateSelectionLabels();
			});
		}).then(setReady).then(() => $scope.initReady = true);
		//################### End Initialization ###################

		/**
		 * Check and update list objects, while in edit mode (extensions property were changed)
		 */
		function checkAndUpdateListObjects(){
			const properties = _model.properties,
				qHyperCubeDef = properties && properties.qHyperCubeDef,
				stopHere = !qHyperCubeDef || !$scope.evaluateStates || $scope.isMasterItem || !$scope.isUpdatable;

			if(stopHere){
				return Promise.reject(undefined);
			}

			let needPropertiesUpdate = false;

			// use backendApi to get properties, because they are cached on the client side (no extra engine calls should be required)
			return $scope.backendApi.getProperties().then(properties =>{
				const qDimensions = properties.qHyperCubeDef.qDimensions;

				// clean obsolete child list objects first
				removeChildObjects(qDimensions);

				return qDimensions.map(qDimension =>{
					const dimId = qDimension.qDef.cId,
						listObject = $scope._listObjects[dimId];

					let waitForObject;
					if(listObject){
						waitForObject = updateListObject(listObject, qDimension);
					}else if(listObject === undefined){
						// make sure we do not create list objects twice by "reserving" dimId
						$scope._listObjects[dimId] = null;
						waitForObject = createListObject(qDimension);
						needPropertiesUpdate = true;
					}else{
						return Promise.resolve(null);
					}

					return waitForObject.then(listObject => $scope._listObjects[dimId] = listObject);
				});
			}).then((reply) => {
				if(needPropertiesUpdate){
					return qlikService.setProperties(_model, properties).then(() => reply);
				}
				return reply;
			});
		}

		/**
		 * Updates list objects properties, if required (different)
		 *
		 * @param {Object} listObject - List object to be updated
		 * @param {Object} qDimension - source dimension object
		 *
		 * @return {Promise<Object>} - updated List object in a promise
		 */
		function updateListObject(listObject, qDimension){
			return qlikService.getProperties(listObject, true).then(props =>{
				// "simple" check if definitions differ
				if(JSON.stringify(props.qListObjectDef.qDef) === JSON.stringify(qDimension.qDef)){
					return Promise.resolve(listObject); // definitions are qual, no updates needed
				}

				// update list objects properties
				props.qListObjectDef.qLibraryId = qDimension.qLibraryId;
				props.qListObjectDef.qDef = qDimension.qDef;
				props.listDef = qDimension.qDef;
				props.qListObjectDef.qStateName = qDimension.qDef.tcmStateName !== undefined ? qDimension.qDef.tcmStateName : props.qListObjectDef.qStateName;
				return qlikService.setProperties(listObject, props).then(() => qlikService.getObjectLayout(listObject.id));
			});
		}

		/**
		 * Generate object definition from given qDimension
		 *
		 * @param {Object} qDimension - qliks dimension property
		 *
		 * @return {Object} - listObject definition
		 */
		function generateObjectDefinition(qDimension){
			const qDef = qDimension.qLibraryId ? undefined : qDimension.qDef,
				cId = qDimension.qDef.cId,
				qStateName = $scope.layout.qStateName !== undefined ? $scope.layout.qStateName : '$';

			// set the state name of the (newly created dimension) to the object state name
			qDimension.qDef.tcmStateName = qStateName;

			return {
				qInfo: {
					qType: 'listObject',
				},
				dimId: cId, // IMPROVE: redundant, can be replaced by qChildLists path: /qListObjectDef/qDef/cId
				listDef: qDimension.qDef, // IMPROVE: redundant, can be replaced by qChildLists path: /qListObjectDef/qDef
				listLibId: qDimension.qLibraryId, // IMPROVE: redundant, can be replaced by qChildLists path: /qListObjectDef/qDef/qLibraryId
				qListObjectDef: {
					qStateName,
					qLibraryId: qDimension.qLibraryId,
					qDef: qDef,
					qAutoSortByState: {
						qDisplayNumberOfRows: -1
					},
					qFrequencyMode: 'EQ_NX_FREQUENCY_NONE',
					qShowAlternatives: true,
					qInitialDataFetch: [
						{
							qHeight: 10000, // use maximum possible data rows
							qWidth: 1 // listObjects have only one column
						}
					]
				}
			};
		}

		/**
		 * Create list object from given qDimension object
		 *
		 * @param {Object} qDimension - qDimension object
		 *
		 * @return {Promise<Object>} - List object in a Promise
		 */
		function createListObject(qDimension){
			const definition = generateObjectDefinition(qDimension);

			// create listoObject and cache it locally
			return qlikService.createChild(_model, definition).then(listObject =>{
				return Promise.resolve(qlikService.getObjectLayout(listObject.id));
			});
		}

		/**
		 * Create a listObject for 'Single Selects'
		 *
		 * @param {object} listObject - qListObject model
		 *
		 * @return {*}
		 */
		function initListObject(listObject){
			if(!listObject){
				return function(){ Logger.warn('No listObject provided'); };
			}

			const dimId = listObject.layout.dimId,
				activeSelects = $scope._selectItems[dimId],
				listener = _eventListener[listObject.id] || [];

			$scope._listObjects[dimId] = listObject;

			if(activeSelects && activeSelects.length){

				activeSelects.forEach(selectItem =>{
					selectItem.selectValues = listObject.layout.qListObject; // temporary
					selectItem.listInfo = listObject.layout.qInfo;
					selectItem.dimId = listObject.layout.dimId;

					if(selectItem.selectValues.qDimensionInfo.qError){
						Logger.warn("invalid dimension selected: ", selectItem.props.dimTitle);

						if(selectItem.selectValues.qDataPages.length === 0){
							selectItem.selectValues.qDataPages = [{qMatrix: []}]
						}
					}
				});

				// clear previous event listener first, before adding new once
				removeListener(_eventListener, listObject.id);

				listener.push(qlikService.bindListener(listObject, 'Invalidated', function(){
					// setTimeout(() => qlikService.getLayout(this), 0);  //reduces engine errors but selection labels are not correctly updated
					qlikService.getLayout(this);
				}));

				// Listen to Validated event of the listObject and apply default selection if required
				listener.push(qlikService.bindListener(listObject, 'Validated', function(){
					let listObj = this;
					// Wait until extension layout is validated (required for correct expression evaluation of default select values)
					getReady().then($scope =>{
						const defaultSelection = ListItem.getDefaultSelection($scope.layout.listItems, dimId, false, listObject.layout.qListObject);

						if(defaultSelection !== null && activeSelects.some(item => utilService.checkExpressionCondition(item.showCondition) && utilService.checkShowMobileCondition(item))){
							return applySelection(listObj, defaultSelection, false, true).catch(err => Logger.warn('could not apply default selection', err));
						}
					}).catch(err => Logger.warn('Error occured while trying to apply default selection', err, err && err.stack));
				}));

				_eventListener[listObject.id] = listener;

				const defaultSelection = ListItem.getDefaultSelection($scope.layout.listItems, dimId, false, listObject.layout.qListObject),
					selectionAllowed = activeSelects.some(item => utilService.checkExpressionCondition(item.showCondition) && utilService.checkShowMobileCondition(item));

				if(_selectionsInProgress === false && defaultSelection !== null && selectionAllowed){
					_selectionsInProgress = true;
					if(!listObject.layout.qListObject.qDimensionInfo.qStateCounts.qSelected){
						// default selection will be performed, so set calcCondVariable to '0' here
						_waitForVariable = setVariable($scope.layout.calCondVariable, '0');
					}
				}

				// return a selection callback instead of applying selection instantly
				if(defaultSelection !== null && selectionAllowed){
					return function(){ return applySelection(listObject, defaultSelection, false, true); };
				}

				return function(){ return Promise.resolve() }; // no default selections
			}
		}

		/**
		 * Initialize listObjects, register event handlers, apply default selections
		 *
		 * @param {Array<Object>} listObjects - Array of list objects in a promise
		 */
		function initListObjects(listObjects){
			return Promise.all(listObjects.map(obj => initListObject(obj))).then(selections =>{
				// wait for variable to be ready before continuing with selections
				return _waitForVariable.then(function(){
					// apply selections "parallel"
					return qlik.Promise.all(selections.map(function(selection){
						if(selection){
							return selection();
						}
					}));
				});
			}).then(function(){
				// Register event handler for Validated|Invalidated events of extension model
				removeListener(_eventListener, _model.id); // remove previous listener before adding new ones
				_eventListener[_model.id] = [
					qlikService.bindListener(_model, 'Validated', setReady),
				 	qlikService.bindListener(_model, 'Invalidated', () => setReady(false))
				];

				if(_selectionsInProgress){
					_selectionsInProgress = false;
					return setVariable($scope.layout.calCondVariable, '1');
				}
			});
		}

		/**
		 * Destroys a listObject (actually a child) when it is not required anymore (dimension was removed)
		 *
		 * @param {Object} qDimensions - Current qDimensions object
		 */
		function removeChildObjects(qDimensions){
			const listObjects = $scope._listObjects;

			// remove listObjects, when dimension was also removed
			for(let dimId in listObjects){
				if(!qDimensions.some(qDim => dimId === qDim.qDef.cId)){
					const listObject = $scope._listObjects[dimId];

					qlikService.removeChild(_model, listObject.id).catch(err => Logger.warn('Listobject could not be removed', err));

					// unbind all event listener of the current list object
					removeListener(_eventListener, listObject.id);

					delete $scope._listObjects[dimId];
				}
			}
		}

		function updateSelectItems(activeSelects){
			activeSelects && Object.keys(activeSelects).forEach(key => {
				activeSelects[key].forEach(selectItem =>{
					const listObject = $scope._listObjects[selectItem.props.dimId];

					if(!listObject){
						Logger.warn("No dimension selected for tcMenu Element");
						return;
					}

					selectItem.selectValues = listObject.layout.qListObject; // temporary
					selectItem.listInfo = listObject.layout.qInfo;
					selectItem.dimId = listObject.layout.dimId;

					if(selectItem.selectValues.qDimensionInfo.qError){
						Logger.warn("invalid dimension selected: ", selectItem.props.dimTitle);

						if(selectItem.selectValues.qDataPages.length === 0){
							selectItem.selectValues.qDataPages = [{qMatrix: []}]
						}
					}
				});
			})
		}

		function getValue(str, unit){
			const value = str.match(unit === '%' ? percentRegex : pixelRegex);
			return value && value && value[0].split(unit)[0] || '';
		}

		function calculateGaps(layout){
			let parentElement = $element.parents(".qv-gridcell");
			if(parentElement.length === 0 || !layout.appearance){
				return;
			}

			const appearance = layout.appearance;
			const cellElement = parentElement[0];
			const cellElementStyle = cellElement.style;
			const parentArticle = $element.parents("article");
			const inEditMode = $scope.inEditMode();
			const cellBorderWidth = 2; //magic 2 is the border with of every grid sense grid cell

			appearance.gapTop === true && inEditMode === false ? cellElement.style.borderTopWidth = 0 : cellElement.style.borderTopWidth = '';
			appearance.gapBottom === true && inEditMode === false ? cellElement.style.borderBottomWidth = 0 : cellElement.style.borderBottomWidth = '';
			appearance.gapLeft === true && inEditMode === false ? cellElement.style.borderLeftWidth = 0 : cellElement.style.borderLeftWidth = '';
			appearance.gapRight === true && inEditMode === false ? cellElement.style.borderRightWidth = 0 : cellElement.style.borderRightWidth = '';

			parentArticle.css("border-width", 0);

			setOffsets(appearance.gapTop, appearance.gapBottom, appearance.gapTopSize, appearance.gapBottomSize, cellElementStyle.top, cellElementStyle.height
				, $scope.topCorrection, $scope.heightCorrection, 'top', 'height');
			setOffsets(appearance.gapLeft, appearance.gapRight, appearance.gapLeftSize, appearance.gapRightSize, cellElementStyle.left, cellElementStyle.width
				, $scope.leftCorrection, $scope.widthCorrection, 'left', 'width');

			function setOffsets(gapDirection1, gapDirection2, gapSizeValue1, gapSizeValue2, style1, style2, cor1, cor2, prop1, prop2){
				let styles = {};
				if((gapDirection1 || gapDirection2) && !inEditMode){

					gapSizeValue1 = isNaN(gapSizeValue1) ? 0 : gapSizeValue1;
					gapSizeValue2 = isNaN(gapSizeValue2) ? 0 : gapSizeValue2;

					const calcVal1 = getValue(style1, '%');
					const calcVal2 = getValue(style2, '%');

					gapSizeValue1 = Math.abs(gapSizeValue1);
					gapSizeValue2 = Math.abs(gapSizeValue2);

					if(gapDirection1 && !gapDirection2){
						gapSizeValue1 *= -1;
						gapSizeValue2 = cor2 - gapSizeValue1 - cellBorderWidth;
						gapSizeValue1 -= (cor2 + cor1) - cellBorderWidth;
					}else if(!gapDirection1 && gapDirection2){
						gapSizeValue1 = cor1;
						gapSizeValue2 += cor2 - cellBorderWidth;
					}else if(gapDirection1 && gapDirection2){
						let gapSize1Copy = gapSizeValue1;
						gapSizeValue1 *= -1;
						gapSizeValue1 -= (cor2 + cor1) - cellBorderWidth;
						gapSizeValue2 += 3 * cor2 + gapSize1Copy - (cellBorderWidth * 2);
					}

					styles[prop1] = 'calc(' + calcVal1 + '% + ' + gapSizeValue1 + 'px)';
					styles[prop2] = 'calc(' + calcVal2 + '% + ' + gapSizeValue2 + 'px)';

					parentElement.css(styles);
				}else{
					const calcVal1 = getValue(style1, '%');
					const calcVal2 = getValue(style2, '%');

					styles[prop1] = 'calc(' + calcVal1 + '% + ' + cor1 + 'px)';
					styles[prop2] = 'calc(' + calcVal2 + '% - ' + cor2 + 'px)';

					parentElement.css(styles);
				}
			}
		}

		/**
		 * Applies cssStyles for every listItem
		 * @param appearance {*}
		 */
		function applyStyles(appearance){
			let listItems = this.listItemsDub,
				elementWidth = $scope.getElement()[0].clientWidth,
				buttonStyle = {
					default: UtilService.getLabelStyle(appearance, false, elementWidth),
					hover: UtilService.getLabelStyle(appearance, true, elementWidth)
				},
				labelStyle = UtilService.getLabelStyle(appearance, false, elementWidth),
				selectionStyle = UtilService.getSelectionStyle(appearance, elementWidth);

			// Update text styles for every item/subitem
			(listItems || []).forEach(function(listItem){
				listItem.buttonStyle = buttonStyle;
				listItem.labelStyle = labelStyle;
				listItem.selectionStyle = selectionStyle;

				['variableItems', 'subItems', 'groupItems'].forEach(function(type){
					(listItem[type] || []).forEach(function(item){
						item.buttonStyle = buttonStyle;
						item.labelStyle = labelStyle;
						item.selectionStyle = selectionStyle;
					});
				});
			});
		}

		function getMenubarStyle(appearance){
			const updatedStyle = {};

			if(appearance){
				if(appearance.borderUniform === 'uniform'){
					updatedStyle.border = appearance.borderWidthUniform + 'px solid ' + appearance.borderColorUniform;
				}else{
					updatedStyle.borderTop = appearance.borderWidthTop + 'px solid ' + appearance.borderColorTop;
					updatedStyle.borderRight = appearance.borderWidthRight + 'px solid ' + appearance.borderColorRight;
					updatedStyle.borderBottom = appearance.borderWidthBottom + 'px solid ' + appearance.borderColorBottom;
					updatedStyle.borderLeft = appearance.borderWidthLeft + 'px solid ' + appearance.borderColorLeft;
				}

				if(appearance.paddingUniform === 'uniform'){
					updatedStyle.padding = appearance.paddingWidthUniform + 'px';
				}else{
					updatedStyle.paddingTop = appearance.paddingWidthTop + 'px';
					updatedStyle.paddingRight = appearance.paddingWidthRight + 'px';
					updatedStyle.paddingBottom = appearance.paddingWidthBottom + 'px';
					updatedStyle.paddingLeft = appearance.paddingWidthLeft + 'px';
				}

				if(appearance.marginUniform === 'uniform'){
					updatedStyle.margin = appearance.marginWidthUniform + 'px';
				}else{
					updatedStyle.marginTop = appearance.marginWidthTop + 'px';
					updatedStyle.marginRight = appearance.marginWidthRight + 'px';
					updatedStyle.marginBottom = appearance.marginWidthBottom + 'px';
					updatedStyle.marginLeft = appearance.marginWidthLeft + 'px';
				}
			}

			return updatedStyle;
		}

		function applySheetBackground(appearance){
			if($scope.isPrinting){
				return;
			}

			let gridWrap;
			let grid;

			if(qlikService.inStoryMode()){
				let element = $scope.getElement()[0];
				while(element.parentElement){
					element = element.parentElement;
					if(element.classList.contains('qv-story-play-slide')){
						gridWrap = element;
						break;
					}
				}
			}else{
				gridWrap = document.getElementById('grid-wrap');
				grid = document.getElementById('grid');
			}

			if(!gridWrap){
				return;
			}

			let backgroundDivImage = gridWrap.querySelector('#menubar_background_div_image');
			if(!backgroundDivImage){
				backgroundDivImage = document.createElement("div");
				backgroundDivImage.id = 'menubar_background_div_image';
				backgroundDivImage.className = 'hico-absolute-overlay';
				gridWrap.insertBefore(backgroundDivImage, gridWrap.firstChild);
			}

			let backgroundDivColor = gridWrap.querySelector('#menubar_background_div_color');
			if(!backgroundDivColor){
				backgroundDivColor = document.createElement("div");
				backgroundDivColor.id = 'menubar_background_div_color';
				backgroundDivColor.className = 'hico-absolute-overlay';
				gridWrap.insertBefore(backgroundDivColor, gridWrap.firstChild);
			}

			if(appearance.styleSheetBackgroundActive){
				MediaService.getInstance(_app.id).mediaProvider.getReady().then((provider) => {
					provider.getMediaDataByUrl(appearance.sheetBackgroundImage || 'tcml:menubar_logo.png').then((data) => {
						backgroundDivImage.style.background = 'url(' + data + ')';
						backgroundDivImage.style.backgroundSize = appearance.sheetBackgroundSize || appearance.sheetBackgroundDisplayType;
						backgroundDivImage.style.backgroundRepeat = appearance.sheetBackgroundRepeat;
						backgroundDivImage.style.backgroundPositionX = appearance.sheetBackgroundHorizontalPosition;
						backgroundDivImage.style.backgroundPositionY = appearance.sheetBackgroundVerticalPosition;
						backgroundDivImage.style.opacity = appearance.sheetBackgroundOpacityImage / 100;
						backgroundDivColor.style.opacity = appearance.sheetBackgroundOpacityColor / 100;
						backgroundDivColor.style.background = appearance.sheetBackgroundColor;
					});
				});

				//versions before november 2018 grid has a background so we need to remove it
				if(grid){
					grid.style.background = 'rgba(1,1,1,0)';
				}

			}else {
				clearBackgroundDivs(gridWrap);
			}
		}

		function switchDynamicStyleSheet(appearance){
			const colors = $scope.colors;

			if(
				oldStyleInputBackground !== colors.variableInputBackground
				|| oldStyleInputText !== colors.variableInputText
				|| oldStyleInputPlaceholder !== colors.variableInputPlaceholder
				|| oldStyletextSelectionFamily !== colors.textSelectionFamily
				|| oldStyletextSelectionSize !== colors.textSelectionSize
				|| oldStyletextSelectionWeight !== colors.textSelectionWeight
				|| oldStyletextSelectionStyle !== colors.textSelectionStyle
				|| $scope.elementWidth !== $scope.getElement()[0].clientWidth
			){
				oldStyleInputPlaceholder = colors.variableInputPlaceholder;
				oldStyleInputText = colors.variableInputText;
				oldStyleInputBackground = colors.variableInputBackground;
				oldStyletextSelectionFamily = colors.textSelectionFamily;
				oldStyletextSelectionSize = colors.textSelectionSize;
				oldStyletextSelectionWeight = colors.textSelectionWeight;
				oldStyletextSelectionStyle = colors.textSelectionStyle;

				const elementWidth = $scope.getElement()[0].clientWidth;
				const scopeId = $scope.uniqueId,
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
						+ UtilService.createPlaceholderRule('::placeholder', scopeId, variableInputPlaceholder)
						+ '.hico-selectionstyle_' + scopeId + '{'
						+ 'font-family: ' + (colors.textSelectionFamily || '"QlikView Sans", sans-serif') + '!important;'
						+ 'font-size: ' + UtilService.getSelectionStyle(appearance, elementWidth)['font-size'] + '!important;'
						+ 'font-weight: ' + (colors.textSelectionWeight || 'normal') + '!important;'
						+ 'font-style: ' + (colors.textSelectionStyle || 'normal') + '!important;'
						+ '}',
					oldStyle = document.getElementById('tcMenuStylesSheet_' + scopeId);

				let newStyle = document.createElement('style');

				newStyle.type = 'text/css';
				newStyle.id = 'tcMenuStylesSheet_' + scopeId;
				newStyle.appendChild(document.createTextNode(dynamicCss));

				if(oldStyle){
					document.head.replaceChild(newStyle, oldStyle);
				}else{
					document.head.appendChild(newStyle);
				}
			}
		}

		function toggleSenseBars(layout, inEditMode){
			const appearance = layout.appearance;

			if(!appearance){
				return;
			}

			let	showMenuBar = appearance.displaySenseMenuBar,
				showSelectionBar = appearance.displaySenseSelectionBar,
				showTitleBar = appearance.displaySenseTitleBar,
				showMenuBarExpr = appearance.displaySenseMenuBarExpr || '',
				showSelectionBarExpr = appearance.displaySenseSelectionBarExpr || '',
				showTitleBarExpr = appearance.displaySenseTitleBarExpr || '',
				menuBar = document.getElementById("qv-toolbar-container") || document.getElementsByClassName("qs-toolbar-container")[0],
				selectionBar = document.getElementsByClassName("qvt-selections")[0],
				titleBar = document.getElementsByClassName("sheet-title-container")[0],
				triggerHicoRepaint = false; // if menus are toggled trueChart repaint must be triggered manually

			if(menuBar){
				var qvPanelStage = document.getElementsByClassName("qv-panel-stage")[0];
				if(qvPanelStage){
					if((showMenuBar === '0' || showMenuBar === '2' && !utilService.checkExpressionCondition(showMenuBarExpr)) && !inEditMode){
						qvPanelStage.style.height = '100%';
					}else{
						qvPanelStage.style.height = '';
					}
				}
				triggerHicoRepaint = showOrHideSenseBar(menuBar, showMenuBar, showMenuBarExpr, inEditMode) || triggerHicoRepaint;
			}

			if(selectionBar){
				triggerHicoRepaint = showOrHideSenseBar(selectionBar, showSelectionBar, showSelectionBarExpr, inEditMode) || triggerHicoRepaint;
			}

			if(titleBar){
				triggerHicoRepaint = showOrHideSenseBar(titleBar, showTitleBar, showTitleBarExpr, inEditMode) || triggerHicoRepaint;
			}

			if(triggerHicoRepaint){
				qvangular.$rootScope.$broadcast('hico-repaint');
			}
		}

		function showOrHideSenseBar(element, elementCondition, elementExpression, inEditMode){
			var display,
				changed = false;
			if(elementCondition && elementCondition === '1' || inEditMode){
				changed = element.style.display !== 'block';
				element.style.display = 'block';
			}else if(elementCondition && elementCondition === '0'){
				changed = element.style.display !== 'none';
				element.style.display = 'none';
			}else if(elementCondition && elementCondition === '2'){
				display = utilService.checkExpressionCondition(elementExpression) ? 'block' : 'none';
				changed = element.style.display !== display;
				element.style.display = display;
			}else{
				changed = element.style.display !== 'block';
				element.style.display = 'block';
			}

			return changed;
		}

		function showSenseBarsOnDestroy(){
			const menuBar = document.getElementById("qv-toolbar-container"),
				selectionBar = document.getElementsByClassName("qvt-selections")[0],
				titleBar = document.getElementsByClassName("sheet-title-container")[0];

			if(menuBar){
				const qvPanelStage = document.getElementsByClassName("qv-panel-stage")[0];
				if(qvPanelStage){
					qvPanelStage.style.height = '';
				}
				showOrHideSenseBar(menuBar, '1', '', true);
			}

			selectionBar && showOrHideSenseBar(selectionBar, '1', '', true);
			titleBar && showOrHideSenseBar(titleBar, '1', '', true);
		}

		function toggleNavBarButtons(){
			const {articleElement, layout} = $scope;

			if(articleElement){
				const {showSenseFullScreenButton, showSenseFullScreenButtonExpr, showSenseSnapshotButton, showSenseSnapshotButtonExpr} = layout.appearance,
					classList = articleElement.classList;

				showSenseFullScreenButton === '0' || showSenseFullScreenButton === '2' && !utilService.checkExpressionCondition(showSenseFullScreenButtonExpr)
					? !classList.contains('hico-tcmenu-not-zoomable') && classList.add('hico-tcmenu-not-zoomable')
					: classList.contains('hico-tcmenu-not-zoomable') && classList.remove('hico-tcmenu-not-zoomable');

				showSenseSnapshotButton === '0' || showSenseSnapshotButton === '2' && !utilService.checkExpressionCondition(showSenseSnapshotButtonExpr)
					? !classList.contains('hico-tcmenu-not-snapshotable') && classList.add('hico-tcmenu-not-snapshotable')
					: classList.contains('hico-tcmenu-not-snapshotable') && classList.remove('hico-tcmenu-not-snapshotable');
			}
		}

		function updateSelectionLabels(listItems){
			let retValue = '';

			(listItems || $scope.listItemsDub).forEach(function(item){
				const isSelectItem = item.type === 'Single Select' || item.type === 'Sense Select' || item.type === 'Field Slider',
					isDatePicker = item.type === 'Date Picker',
					isRangePicker = isDatePicker && item.props.date.type === 'range';

				if(!utilService.checkShowMobileCondition(item) || !utilService.checkExpressionCondition(item.showCondition || '')){
					return '';
				}

				if(item.type === 'Group'){
					let value = updateSelectionLabels(item.groupItems);
					item.props.selectedValue = value.substring(0, value.length - 2);
				}else if(isSelectItem || (isDatePicker && !isRangePicker)){
					let selectedValue = '',
						counter = 0;

					if(!item.selectValues){
						return;
					}

					if(item.selectValues.qDimensionInfo.qGroupFieldDefs.length > 1){
						selectedValue = getDrilldownSelectionLabel(item) || '';
						retValue += selectedValue;
						selectedValue = selectedValue.substring(0, selectedValue.length - 2);
					}else{
						item.selectValues.qDataPages[0].qMatrix.forEach((sItem) =>{
							let qItem = sItem[0];
							if(qItem && qItem.qState === "S"){
								counter++;
								selectedValue += qItem.qText + ', ';
							}
						});

						if(counter === item.selectValues.qDataPages[0].qMatrix.length){
							selectedValue = translation.text.all;
						}else if(counter > 2){
							selectedValue = counter + ' ' + translation.text.of + ' ' + item.selectValues.qDataPages[0].qMatrix.length;
						}else{
							selectedValue = selectedValue.substring(0, selectedValue.length - 2);
						}

						if(counter !== 0){
							retValue += selectedValue + ', ';
						}
					}

					item.props.selectedValue = selectedValue;
				}if(isRangePicker){
					let selectedItems = [];

					if(!item.selectValues){
						return;
					}

					item.selectValues.qDataPages[0].qMatrix.forEach((sItem) =>{
						let qItem = sItem[0];
						if(qItem && qItem.qState === "S"){
							selectedItems.push(qItem);
						}
					});

					if(selectedItems.length > 0){
						item.props.startDate = selectedItems[0].qText;
						item.props.endDate = selectedItems[selectedItems.length-1].qText;
					}else{
						item.props.startDate = '';
						item.props.endDate = '';
					}
				}
			});

			return retValue;
		}

		function getDrilldownSelectionLabel(item){
			let retValue = '';
			$scope.selState.selections.forEach(function(selection){
				$scope.layout.qHyperCube.qDimensionInfo.some(dimInfo =>{
					if(dimInfo.cId === item.props.dimId){
						if(dimInfo.qGroupFieldDefs.indexOf(selection.fieldName) > -1){
							let selectionString = getSelectionString(selection);
							if(selectionString !== ''){
								retValue += selectionString + ', ';
							}
						}
						return true;
					}
				});
			});

			return retValue;
		}

		function getSelectionString(selection){
			if(selection.qSelected === 'ALL'){
				return translation.text.all;
			}else if(selection.selectedCount > 2){
				return selection.selectedCount + ' ' + translation.text.of + ' ' + selection.totalCount;
			}else{
				// Concat all selections by qName to single string -> "field1, field2, field3"
				return selection.selectedValues.map(function(value){
					return value.qName;
				}).join(', ');
			}
		}

		/**
		 * Sets a specific variable to a given string value
		 * @param name Name of the variable
		 * @param value Value to be set
		 * @return Promise {*}
		 */
		function setVariable(name, value){
			if(name){
				return qlikService.getVariableValue(name).then(function(currValue){
					if(currValue !== value){
						if(value === '0'){
							// do not catch errors in case of '0', because it could be retried (request aborted), so '0' could be the end result
							return _app.variable.setStringValue(name, value).catch(function(){ qlik.Promise.resolve(); });
						}else{
							// in case of other values ('1') it is important that the variable is set despite errors
							return _app.variable.setStringValue(name, value)
								.catch(qlikService.engineErrorHandler(_app.variable, 'setStringValue', [name, value]));
						}
					}
				});
			}
			return qlik.Promise.resolve(); // nothing to do
		}

		/**
		 * Resolves when ready to paint
		 * @return {Promise<*>}
		 */
		function getReady(){
			return _ready.promise;
		}

		/**
		 * Resolves the "ready" promise, or renew it
		 * @param yes|undefined {boolean} Renew ready promise if false, resolves it otherwise
		 */
		function setReady(yes){
			if(yes === false && _ready.resolved){
				_ready = qlik.Promise.defer();
			}else{
				_ready.resolved = true;
				_ready.resolve($scope);
			}
		}

		function checkActiveMenubarBackgrounds(gridWrap){
			const menus = gridWrap.querySelectorAll('.menubar');

			for(let i = 0; i < menus.length; i++){
				const menuScope = angular.element(menus[i]).scope();

				if(menuScope && menuScope.layout && menuScope.layout.appearance.styleSheetBackgroundActive === true && menuScope.uniqueId !== $scope.uniqueId){
					return true;
				}
			}

			return false;
		}

		function clearBackgroundDivs(gridWrap){
			if(!checkActiveMenubarBackgrounds(gridWrap)){
				let backgroundDivImage = gridWrap.querySelector('#menubar_background_div_image');
				let backgroundDivColor = gridWrap.querySelector('#menubar_background_div_color');
				const grid = document.getElementById('grid');
				if(backgroundDivImage){
					gridWrap.removeChild(backgroundDivImage);
				}

				if(backgroundDivColor){
					gridWrap.removeChild(backgroundDivColor);
				}

				if(grid){
					grid.style.background = '';
				}
			}
		}

		/**
		 * Clean up when extension was destroyed (removed from sheet)
		 */
		function onDestroy(){
			if($scope.isPrinting){
				return;
			}

			if(!qlikService.inPlayMode()){
				const gridWrap = document.getElementById('grid-wrap');

				if(gridWrap){
					clearBackgroundDivs(gridWrap);
				}

				if(gridWrap && gridWrap.querySelectorAll('.menubar').length === 1){
					UtilService.destroyTimeout = setTimeout(function(){
						showSenseBarsOnDestroy();
					}, 500);
				}
			}

			const styleElement = document.getElementById('tcMenuStylesSheet_' + $scope.uniqueId);
			styleElement && styleElement.parentNode.removeChild(styleElement);

			$scope.selState && $scope.selState.OnData.unbind(updateSelectionLabels);
			// $scope.destroyListObjects(); // Reuse listObjects during sheet navigation

			$scope.watchers.forEach((unwatch) => unwatch());

			// WORKAROUND: Because of broken support of session objects in QS release 2017.7 we must destroy them when extension gets also destroyed (i.e. on
			// sheet navigation)
			destroyListObjects($scope.listItemsDub); // remove this after bug was fixed

//			removeListener(_eventListener);  // enable this after bug was fixed
//			_eventListener = []; // enable this after bug was fixed
		}

		//destroy listObjects and return promise
		function destroyListObjects(listItems){
			const promises = [];

			removeListener(_eventListener);

			listItems && listItems.forEach(function(listItem){
				listItem.isOpen = false;
				listItem.show = false;

			});

			return qlik.Promise.all(promises);
		}


		/**
		 * Assigns active button states to the extensions layout (required for snapshots)
		 * @param {Object} activeStates
		 * @param {Object} currItem
		 */
		function handleButtonStates(activeStates, currItem){
			currItem.activeStates = activeStates;

			// update layout data (requred for snapshots)
			($scope.listItemsDub || []).some(function(item, index){
				if(item === currItem && $scope.layout.listItems[index]){
					$scope.layout.listItems[index].activeStates = item.activeStates;
					return true;
				}
			});
		}

		function checkListObjectsValid(){
			const promises = [];

			for(const key in $scope._listObjects){
				const selectItems = $scope._selectItems[key];
				if(!$scope._listObjects.hasOwnProperty(key) || !selectItems){
					continue;
				}

				if(!$scope._listObjects[key].isValidating && !$scope._listObjects[key].isValid){
					Logger.warn('revive dead object with key and id', key, $scope._listObjects[key].id);
					promises.push(qlikService.getObjectLayout($scope._listObjects[key].id));
				}
			}

			return Promise.all(promises)
		}

		function afterPaint(){
			$scope.checkListObjectsValid().then(() => $scope.updateSelectionLabels());
		}

		function updateListItemsProps(listItemsDub, listItems, qDimensionInfo){
			listItemsDub.forEach(function(listItem, index){
				let dimTitle = getDimTitle(listItem.props.dimId, qDimensionInfo);

				if(listItem.type === 'Group'){
					updateListItemsProps(listItem.groupItems, listItems[index].groupItems, qDimensionInfo)
				}

				if(listItem.type === 'Variable Slider'){

					qlikService.variableProvider.getReady().then(() => {
						const sliderProps = listItem.props.variableSlider;

						if(sliderProps.type === 'single'){
							qlikService.getVariableValue(sliderProps.variable).then((value) =>{
								listItem.variableValue = value;
							});
						}else if(sliderProps.type === 'range'){
							qlikService.getVariableValue(sliderProps.variableStart).then((value) =>{
								listItem.variableValueStart = value;
							});

							qlikService.getVariableValue(sliderProps.variableEnd).then((value) =>{
								listItem.variableValueEnd = value;
							});
						}else if(sliderProps.type === 'multi'){
							Promise.all(sliderProps.multiHandles.map((handle) => qlikService.getVariableValue(handle.variableName))).then((values) =>{
								let multiVariables = [];
								for(const value of values){
									UtilService.isValidVariable(value) && multiVariables.push(value);
								}
								listItem.multiVariables = multiVariables;
							});
						}
					});
				}

				if(listItem.type === 'Variable Input'){
					qlikService.variableProvider.getReady().then(() =>{
						const inputProps = listItem.props.variableInput;

						if(inputProps.variable !== ''){
							qlikService.getVariableValue(inputProps.variable).then((value) =>{
								if(UtilService.isValidVariable(value)){
									listItem.variableValue = value;
								}else{
									Logger.warn('Wrong Variable Name: ' + inputProps.variable);
									listItem.variableValue = '';
								}
							});
						}else{
							listItem.variableValue = '';
						}
					});
				}

				listItem.props.itemLabel = listItems[index].props.itemLabel === '' ? dimTitle : listItems[index].props.itemLabel;
				listItem.props.selectionLabel = listItems[index].props.selectionLabel;
				listItem.props.colors = listItems[index].props.colors;
				listItem.props.selectValue = listItems[index].props.selectValue;
				listItem.showCondition = listItems[index].showCondition;

				(listItem.variableItems || []).forEach(function(variableItem, vIndex){
					variableItem.props.itemLabel = listItems[index].variableItems[vIndex].props.itemLabel;
					variableItem.props.selectionLabel = listItems[index].variableItems[vIndex].props.selectionLabel;
					qlikService.getVariableValue(listItem.props.variableName).then(function(value){
						variableItem.isActive = variableItem.props.variableValue === value;
					});
				});

				listItem.stateItems = listItems[index].stateItems;

				(listItem.subItems || []).forEach(function(subItem, vIndex){
					subItem.stateItems = listItems[index].subItems[vIndex].stateItems;
				});
			});
		}
	}

	function getDimTitle(dimId, dimensions){
		let dimTitle = '';
		dimensions.some(dim =>{
			if(dimId === dim.cId){
				dimTitle = dim.title || dim.qFallbackTitle;
				return true;
			}
		});

		return dimTitle;
	}

	/**
	 * update Data before trigger paint function
	 * @param layout
	 * @returns {Promise<object>} - layout of the extension
	 */
	function updateData(layout){
		let $scope = this.$scope;

		// apply layout specific stuff like styles/colors as soon as possible
		$scope.colors = UtilService.getColorsFromProps(layout.appearance, 'all');
		$scope.menubarStyle = $scope.getMenubarStyle($scope.layout.appearance);
		$scope.applyStyles(layout.appearance);
		$scope.applySheetBackground(layout.appearance);
		$scope.switchDynamicStyleSheet(layout.appearance);

		if($scope.getElement().parents(".qv-gridcell").length > 0 && layout.appearance){
			$scope.calculateGaps(layout);
		}

		return $scope.getReady().then(() =>{
			return Promise.resolve(layout);
		});
	}

	/**
	 * Paint function of the extension
	 *
	 * @param $element Angular HTMLElement of the extension
	 * @param layout Layout object
	 */
	function paint($element, layout){
		let $scope = this.$scope,
			paintingPromise = $scope.apiService.createNewPromise();

		$scope._this = this;
		$scope.isEditMode = $scope.inEditMode();

		if($scope.isPrinting){
			$scope.listItemsDub = layout.exportListItemsDub;
			$scope._listObjects = layout.exportListObjects;

			paintingPromise.resolve();

			return $scope.apiService.getPromise().then(function(){
				console.log('finished painting tcMenubar', layout.title);
			});
		}

		$scope.onSheet() && $scope.toggleSenseBars(layout, $scope.isEditMode);
		$scope.onSheet() && $scope.toggleNavBarButtons();

		if($scope.wasEditMode && !$scope.isEditMode){
			$scope.wasEditMode = false;

			setSelectItems($scope, $scope.layout.listItems);
			$scope.updateSelectItems($scope._selectItems);

			$scope.$broadcast('leaveEditMode');
			$scope.calculateGaps(layout);

		}else if($scope.isEditMode){
			if(!$scope.wasEditMode){
				$scope.wasEditMode = true;
				// close all menus
				$scope.calculateGaps(layout);
				$scope.utilService.closeMenus($scope.listItemsDub);
			}

			setSelectItems($scope, $scope.layout.listItems);

			$scope.checkAndUpdateListObjects().then(proms => Promise.all(proms)).then(listObjects => $scope.initListObjects(listObjects))
				.catch(err => err && Logger.error(err))
				.then(() => $scope.updateSelectionLabels());
		}else{
			setSelectItems($scope, $scope.layout.listItems, false);
			$scope.updateSelectItems($scope._selectItems);
		}

		$scope.colors = UtilService.getColorsFromProps(layout.appearance, 'all');
		$scope.menubarStyle = $scope.getMenubarStyle($scope.layout.appearance);
		$scope.applyStyles(layout.appearance);
		$scope.applySheetBackground(layout.appearance);
		$scope.switchDynamicStyleSheet(layout.appearance);

		// load (dynamically) components which are required in edit mode only
		if($scope.editComponentsRequired && $scope.isEditMode){
			$scope.editComponentsRequired = false;
			loadEditor().catch(err => Logger.error('Error ocurred while button-editor was loaded', err));
		}

		$scope.updateListItemsProps($scope.listItemsDub, $scope.layout.listItems, $scope.layout.qHyperCube.qDimensionInfo);
		$scope.updateSelectionLabels();

		ContentManager.updateComponents();

		if(!$scope.isPrinting){
			$scope._this = this;
			$scope._$element = $element;

			if($scope.originalLayout){
				$scope.originalLayout.exportListItemsDub = $scope.listItemsDub.slice();
				$scope.originalLayout.exportListObjects = {};
			}

			layout.exportListItemsDub = $scope.listItemsDub.slice();
			layout.exportListObjects = {};

			$scope._listObjects && Object.keys($scope._listObjects).forEach(function(key) {
				if($scope._listObjects[key]){
					layout.exportListObjects[key] = $scope._listObjects[key].layout;
				}
			});

			clearTimeout($scope.afterPaintTimeout);
			$scope.afterPaintTimeout = setTimeout($scope.afterPaint, $scope.afterPaintDelay);
		}

		$scope.elementWidth = $scope.getElement()[0].clientWidth;

		paintingPromise.resolve();

		return $scope.apiService.getPromise().then(function(){
			// console.log('finished painting tcMenubar', layout.title);
		});
	}

	/**
	 * Sets selectItems to the scope
	 *
	 * @param {Object} $scope - Extensions scope
	 * @param {Array} listItems
	 * @param {boolean} sliceItems
	 */
	function setSelectItems($scope, listItems, sliceItems = true){
		if(!listItems || !$scope){
			return; // no listItems/$scope to deal with
		}

		// get shadow copy of listItems to be undependend of layout invalidations
		if(sliceItems){
			$scope.listItemsDub = listItems.slice();
		}

		$scope._selectItems = ListItem.getSelectItems($scope.listItemsDub).reduce((list, elem) =>{
			!list[elem.props.dimId]
				? list[elem.props.dimId] = [elem]
				: list[elem.props.dimId].push(elem);
			return list;
		}, {});
	}

	function addSelection(...args){
		this._selections.push(function(){
			return applySelection(...args);
		});

		clearTimeout(this._selectionTimeout);

		this._selectionTimeout = setTimeout(() => {
			// execute selections "parallel"
			this._selections.forEach(selection => selection && selection());
			this._selections = [];
		}, this._selectionDelay);
	}

	/**
	 * Apply a selection by using the given listObject and given value
	 *
	 * @param {Object} listObject - list object on which selection must be applied
	 * @param {string|number|number[]} value - value to select as text or index (qElemNumber)
	 * @param {boolean} [optional] - apply selection only if nothing already selected
	 * @param {boolean} isElemNumber - if true, value must be a qElemNumber of type number
	 * @param {boolean} toggle - option to toggle the selected value (allows deselection :) )
	 *
	 * @return {Promise<boolean>} - returns true if selection was
	 */
	function applySelection(listObject, value, isElemNumber, optional, toggle = false){
		if(!listObject || !listObject.layout || qlikService.inEditMode()){
			return Promise.resolve();
		}

		const qList = listObject.layout.qListObject;
		if(!qList || qList.qDimensionInfo && optional && qList.qDimensionInfo.qStateCounts.qSelected){
			return Promise.resolve(); // already selected, no selection required
		}

		const valIndex = isElemNumber || Array.isArray(value) ? value : UtilService.getIndexByText(qList.qDataPages, value), // get element number (qElemNumber)
			args = ['/qListObjectDef', Array.isArray(valIndex) ? valIndex : [valIndex], toggle, false]; // path, values, toggle, softLock

		if(typeof valIndex !== 'number' && !Array.isArray(valIndex)){
			Logger.warn('trying to select a value that does not exists in dimension', value);
			return Promise.resolve();
		}

		// select value (without toggle/softLock flags)
		return listObject.selectListObjectValues(...args).catch(qlikService.engineErrorHandler(listObject, 'selectListObjectValues', ...args));
	}



	/**
	 * Removes event listeners
	 *
	 * @param {Object} evtListenerList - An array of callbacks, which were returned by addListener method
	 * @param {string} [objId] - Object id of the object whoose event listeners should be removed, otherwise all listener will be removed
	 */
	function removeListener(evtListenerList, objId){
		if(!evtListenerList || !Object.keys(evtListenerList).length){
			return; // no event listeners to remove
		}

		try{
			for(let id in evtListenerList){
				if(!objId || objId === id){
					evtListenerList[id].forEach(unbind => unbind()); // Execute "unbind" callback
					delete evtListenerList[id];
				}
			}
		}catch(e){
			Logger.warn('Error occured during unbinding of event listeners');
		}
	}
}