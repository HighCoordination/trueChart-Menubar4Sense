import {translation} from '../../resource/translations/translations';
import {ListItem} from '../classes/ListItem';
import {loadEditor} from '../lib/hico/hico-button';
import {Logger} from '../lib/hico/logger';
import UpdateService from './Services/UpdateService';
import {QlikService, qlik} from '../lib/hico/services/qlik-service';
import {Utils} from '../lib/hico/common/utils';

const qvangular = require('qvangular'),
	$ = require('jquery'),
	updateService = UpdateService.getInstance();

export function Extension(){

	this.controller = controller;
	this.paint = paint;
	this.updateData = updateData;

	// initialize default logger for tcmenu
	Logger.init({
		level: '##LOG_LEVEL##',
		username: 'Anonymous',
		hasService: '##HAS_SERVICE##',
		serviceUrl: '##SERVICE_URL##',
	});

	const qlikService = QlikService.getInstance();

	/**
	 * Controller function of the extension
	 * @param $scope
	 * @param $element
	 * @param utilService
	 * @param apiService
	 */
	function controller($scope, $element, utilService, apiService){

		// $scope does not always work (not in any QS version)
		let _app = qlik.currApp(/*$scope*/), // reference must have backandApi as property ($scope -> backendApi -> model)
			_waitForUpdates, // Promise, which will be resolved, when updates are finished
			_model = $scope.backendApi.model,
			_originalModel = $scope.backendApi.model, // keep the original model for future usage (if needed)
			_waitForVariable = qlik.Promise.resolve(),
			_selectionsInProgress = false,
			_ready = qlik.Promise.defer(),
			_eventListener = {}; // collect "unbind" callbacks for added eventListener with object id as key

		$scope.getElement = () => $element;
		$scope.$ctrl = this;
		$scope.utilService = utilService;
		$scope.apiService = apiService;
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

		$scope.isPrinting = qlikService.isPrinting();
		$scope.isPublished = !$scope.isPrinting && _app.model.layout.published === true;

		//##################### Updates #######################
		if(!$scope.isPrinting){
			_waitForUpdates = updateService.checkUpdates(_model);

			// Watch selection state and update selection labels
			$scope.selState = _app.selectionState();
			$scope.selState.OnData.bind(updateSelectionLabels);
		}else{
			_waitForUpdates = Promise.resolve({});
		}
		//##################### End Updates ###################

		$element.on('$destroy', onDestroy);

		$element.on('mouseenter', function(){
			$element.parents("article").css("z-index", 5);
		});
		$element.on('mouseleave', function(){
			$element.parents("article").css("z-index", 0);
		});


		$scope._listObjects = {}; // collection of listObject promises with dimId as key and listObject in a promise as value
		$scope._selectItems = {}; // collection of select items (only) with dimId as key
		$scope._selections = []; // selection callbacks
		$scope._selectionTimeout = 0;
		$scope._selectionDelay = 100; // wait max 100 ms for all list items to register (addSelecton) their default selections
		$scope.listItemsDub = [];
		$scope.initReady = false;
		$scope.wasEditMode = false;
		$scope.onSheet = qlikService.onSheet;
		$scope.inEditMode = qlikService.inEditMode;
		$scope.inStoryMode = qlikService.inStoryMode;
		$scope.isUpdatable = true; // assume extension is updatable, if not, updater should return the "valid" value
		$scope.isMasterItem = qlikService.isMasterItem(_model);
		$scope.isMasterObject = qlikService.isMasterObject(_model);
		// do not evaluate button states for snapshots
		$scope.evaluateStates = !qlikService.isSnapshotObject(_model) && !qlikService.isPrinting();
		$scope.editComponentsRequired = true; // some components are only required in edit mode

		$scope.getReady = getReady;
		$scope.setReady = setReady;
		$scope.initListObjects = initListObjects;
		$scope.destroyListObjects = destroyListObjects;
		$scope.updateSelectItems = updateSelectItems;
		$scope.calculateGaps = calculateGaps;
		$scope.addSelection = addSelection.bind($scope);
		$scope.applySelection = applySelection;
		$scope.applyStyles = applyStyles;
		$scope.applyColors = applyColors;
		$scope.toggleSenseBars = toggleSenseBars;
		$scope.updateSelectionLabels = updateSelectionLabels;
		$scope.handleButtonStates = handleButtonStates;
		$scope.updateListItemsProps = updateListItemsProps;
		$scope.checkAndUpdateListObjects = checkAndUpdateListObjects;
		$scope.checkExpressionCondition = utilService.checkExpressionCondition;

		if($element.parents(".qv-gridcell").length > 0){
			let cellStyle = $element.parents(".qv-gridcell")[0].style;
			$scope.defaultCellStyleTop = cellStyle.top.substring(cellStyle.top.indexOf("%"));
			$scope.defaultCellStyleBottom = cellStyle.height.substring(cellStyle.height.indexOf("%"));
			$scope.defaultCellStyleLeft = cellStyle.left.substring(cellStyle.left.indexOf("%"));
			$scope.defaultCellStyleWidth = cellStyle.width.substring(cellStyle.width.indexOf("%"));

			$scope.topCorrection = Number(cellStyle.top.substring(cellStyle.top.indexOf("+") + 1, cellStyle.top.indexOf("p")));
			$scope.heightCorrection = Number(cellStyle.height.substring(cellStyle.height.indexOf("-") + 1, cellStyle.height.indexOf("p")));
			$scope.leftCorrection = Number(cellStyle.left.substring(cellStyle.left.indexOf("+") + 1, cellStyle.left.indexOf("p")));
			$scope.widthCorrection = Number(cellStyle.width.substring(cellStyle.width.indexOf("-") + 1, cellStyle.width.indexOf("p")));
		}

		//##################### Initialization #####################
		_waitForUpdates.then(updateObj =>{
			if(updateObj.isUpdatable === false){
				// update isUpdatable property with "real" values. In case of required updates, but not updatable model (published app) it will be false
				$scope.isUpdatable = updateObj.isUpdatable;

				// use updated model in case of not updatable extension
				_model = updateObj.model;

				// use layout from updated model (session object) in case of no updatable model, otherwise it comes from scopes prototype
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

			let listObjects = updateObj.listObjects,
				objectIds = listObjects
					? listObjects.map(obj => obj.id)
					: _originalModel.layout.qChildList.qItems.map(item => item.qInfo.qId);

			// set active select items
			setSelectItems($scope, $scope.layout.listItems);
			$scope.applyColors($scope.layout);
			$scope.applyStyles($scope.layout.appearance);

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
					}else{
						return Promise.resolve(null);
					}

					return waitForObject.then(listObject => $scope._listObjects[dimId] = listObject);
				});
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
				cId = qDimension.qDef.cId;

			return {
				qInfo: {
					qType: 'listObject',
				},
				dimId: cId, // IMPROVE: redundant, can be replaced by qChildLists path: /qListObjectDef/qDef/cId
				listDef: qDimension.qDef, // IMPROVE: redundant, can be replaced by qChildLists path: /qListObjectDef/qDef
				listLibId: qDimension.qLibraryId, // IMPROVE: redundant, can be replaced by qChildLists path: /qListObjectDef/qDef/qLibraryId
				qListObjectDef: {
					qStateName: '$',
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
					qlikService.getLayout(this);
				}));

				// Listen to Validated event of the listObject and apply default selection if required
				listener.push(qlikService.bindListener(listObject, 'Validated', function(){
					let listObj = this;
					// Wait until extension layout is validated (required for correct expression evaluation of default select values)
					getReady().then($scope =>{
						const defaultSelection = ListItem.getDefaultSelection($scope.layout.listItems, dimId);

						if(defaultSelection !== null && activeSelects.some(item => utilService.checkExpressionCondition(item.showCondition))){
							return applySelection(listObj, defaultSelection, false, true).catch(err => Logger.warn('could not apply default selection', err));
						}
					}).catch(err => Logger.warn('Error occured while trying to apply default selection', err, err && err.stack));
				}));

				_eventListener[listObject.id] = listener;

				const defaultSelection = ListItem.getDefaultSelection($scope.layout.listItems, dimId),
					selectionAllowed =  activeSelects.some(item => utilService.checkExpressionCondition(item.showCondition));

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

		function calculateGaps(layout){
			var parentElement = $element.parents(".qv-gridcell");
			if(parentElement.length === 0 || !layout.appearance){
				return;
			}

			var appearance = layout.appearance;
			var cellElementStyle = parentElement[0].style;
			var parentArticle = $element.parents("article");

			appearance.gapTop === true ? parentArticle.css("border-top", 0) : parentArticle.css("border-top", 1);
			appearance.gapBottom === true ? parentArticle.css("border-bottom", 0) : parentArticle.css("border-bottom", 1);
			appearance.gapLeft === true ? parentArticle.css("border-left", 0) : parentArticle.css("border-left", 1);
			appearance.gapRight === true ? parentArticle.css("border-right", 0) : parentArticle.css("border-right", 1);

			setOffsets(appearance.gapTop, appearance.gapBottom, appearance.gapTopSize, appearance.gapBottomSize, cellElementStyle.top, cellElementStyle.height
				, $scope.defaultCellStyleTop, $scope.defaultCellStyleBottom, $scope.topCorrection, $scope.heightCorrection, 'top', 'height');
			setOffsets(appearance.gapLeft, appearance.gapRight, appearance.gapLeftSize, appearance.gapRightSize, cellElementStyle.left, cellElementStyle.width
				, $scope.defaultCellStyleLeft, $scope.defaultCellStyleWidth, $scope.leftCorrection, $scope.widthCorrection, 'left', 'width');

			function setOffsets(gapDirection1, gapDirection2, gapSizeValue1, gapSizeValue2, style1, style2, defaultVal1, defaultVal2, cor1, cor2, prop1, prop2){
				var styles = {};
				if(gapDirection1 || gapDirection2){

					gapSizeValue1 = isNaN(gapSizeValue1) ? 0 : gapSizeValue1;
					gapSizeValue2 = isNaN(gapSizeValue2) ? 0 : gapSizeValue2;

					var calcVal1 = style1.substring(0, style1.indexOf("%"));
					var calcVal2 = style2.substring(0, style2.indexOf("%"));

					gapSizeValue1 = Math.abs(gapSizeValue1);
					gapSizeValue2 = Math.abs(gapSizeValue2);

					if(gapDirection1 && !gapDirection2){
						gapSizeValue1 *= -1;
						gapSizeValue2 = cor2 - gapSizeValue1;
						gapSizeValue1 -= (cor2 + cor1);
					}else if(!gapDirection1 && gapDirection2){
						gapSizeValue1 = cor1;
						gapSizeValue2 += cor2;
					}else if(gapDirection1 && gapDirection2){
						var gapSize1Copy = gapSizeValue1;
						gapSizeValue1 *= -1;
						gapSizeValue1 -= (cor2 + cor1);
						gapSizeValue2 += 3 * cor2 + gapSize1Copy;
					}

					styles[prop1] = calcVal1 + '% + ' + gapSizeValue1 + 'px)';
					styles[prop2] = calcVal2 + '% + ' + gapSizeValue2 + 'px)';

					parentElement.css(styles);
				}else{
					styles[prop1] = style1.substring(0, style1.indexOf("%")) + defaultVal1;
					styles[prop2] = style2.substring(0, style2.indexOf("%")) + defaultVal2;

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
				labelStyle = {
					'font-family': appearance.textFamily || '"QlikView Sans", sans-serif',
					'font-size': Utils.getDynamicFontSize(appearance.textSize) || 13,
					'font-weight': appearance.textWeight || 'bold',
					'font-style': appearance.textStyle || 'normal'
				},

				selectionStyle = {
					'font-family': appearance.textSelectionFamily || '"QlikView Sans", sans-serif',
					'font-size': Utils.getDynamicFontSize(appearance.textSelectionSize) || 11,
					'font-weight': appearance.textSelectionWeight || 'normal',
					'font-style': appearance.textSelectionStyle || 'normal'
				};

			// Update text styles for every item/subitem
			(listItems || []).forEach(function(listItem){
				listItem.labelStyle = labelStyle;
				listItem.selectionStyle = selectionStyle;

				['variableItems', 'subItems', 'groupItems'].forEach(function(type){
					(listItem[type] || []).forEach(function(item){
						item.labelStyle = labelStyle;
						item.selectionStyle = selectionStyle;
					});
				});
			});
		}

		function applyColors(){
			setColor('backgroundColor', "rgb(245,245,245)");
			setColor("subItemBackgroundColor", "rgb(217,217,217)");
			setColor("hoverActiveColor", "rgb(159,159,159)");
			setColor("hoverSubItemColor", "rgb(165,165,165)");
			setColor("borderSeparatorColor", "rgb(179,179,179)");
			setColor("subItemSeparatorColor", "rgb(150,150,150)");
			setColor("textColor", "rgb(89,89,89)");
			setColor("textHoverColor", "rgb(89,89,89)");
			setColor("textSubColor", "rgb(89,89,89)");
			setColor("textHoverSubColor", "rgb(89,89,89)");
		}

		function toggleSenseBars(layout, inEditMode){
			var appearance = layout.appearance,
				showMenuBar = appearance.displaySenseMenuBar,
				showSelectionBar = appearance.displaySenseSelectionBar,
				showTitleBar = appearance.displaySenseTitleBar,
				showMenuBarExpr = appearance.displaySenseMenuBarExpr || '',
				showSelectionBarExpr = appearance.displaySenseSelectionBarExpr || '',
				showTitleBarExpr = appearance.displaySenseTitleBarExpr || '',
				menuBar = document.getElementById("qv-toolbar-container"),
				selectionBar = document.getElementsByClassName("qvt-selections")[0],
				titleBar = document.getElementsByClassName("sheet-title-container")[0],
				triggerHicoRepaint = false; // if menus are toggled trueChart repaint must be triggered manually

			if(menuBar){
				var qvPanelStage = document.getElementsByClassName("qv-panel-stage")[0];
				if(qvPanelStage){
					if((showMenuBar === '0' || !utilService.checkExpressionCondition(showMenuBarExpr)) && !inEditMode){
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

		function setColor(colorName, defaultColor){
			let appearance = $scope.layout.appearance,
				colors = $scope.colors;

			if(!appearance[colorName]){
				colors[colorName] = defaultColor;
			}else if(colors[colorName] !== convertIfSense(appearance[colorName])){
				colors[colorName] = convertIfSense(appearance[colorName]);
			}
		}

		function convertIfSense(colorString){
			var startIndex = colorString.indexOf(',');
			var endIndex = colorString.indexOf('(');

			if(colorString.indexOf("ARGB") > -1){
				var opcaityLength = startIndex - endIndex - 1;
				var opacity = Number(colorString.substr(endIndex + 1, opcaityLength)) / 255;

				return 'rgba(' + colorString.substr(startIndex + 1, colorString.length - startIndex - 2) + ',' + opacity + ')';
			}else{
				return colorString
			}
		}

		function updateSelectionLabels(listItems){
			let retValue = '';

			(listItems || $scope.listItemsDub).forEach(function(item){
				if(item.type === 'Group'){
					let value = updateSelectionLabels(item.groupItems);
					item.props.selectedValue = value.substring(0, value.length - 2);
				}else if(item.type === 'Single Select' || item.type === 'Sense Select'){
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
		 * @return {jQuery.promise|*|promise}
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

		/**
		 * Clean up when extension was destroyed (removed from sheet)
		 */
		function onDestroy(){
			if($scope.isPrinting){
				return;
			}

			$scope.selState && $scope.selState.OnData.unbind(updateSelectionLabels);
			// $scope.destroyListObjects(); // Reuse listObjects during sheet navigation

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

		function updateListItemsProps(listItemsDub, listItems, qDimensionInfo){
			listItemsDub.forEach(function(listItem, index){
				let dimTitle = getDimTitle(listItem.props.dimId, qDimensionInfo);

				if(listItem.type === 'Group'){
					updateListItemsProps(listItem.groupItems, listItems[index].groupItems, qDimensionInfo)
				}

				listItem.props.itemLabel = listItems[index].props.itemLabel === '' ? dimTitle : listItems[index].props.itemLabel;
				listItem.props.selectionLabel = listItems[index].props.selectionLabel;
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
		$scope.applyColors(layout);
		$scope.applyStyles(layout.appearance);

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

		if($scope.isPrinting){
			$scope.listItemsDub = layout.exportListItemsDub;
			$scope._listObjects = layout.exportListObjects;

			paintingPromise.resolve();

			return $scope.apiService.getPromise().then(function(){
				console.log('finished painting tcMenubar', layout.title);
			});
		}

		$scope.onSheet() && $scope.toggleSenseBars(layout, $scope.inEditMode());

		if($scope.wasEditMode && !$scope.inEditMode()){
			$scope.wasEditMode = false;

			$scope.$broadcast('leaveEditMode');

			setSelectItems($scope, $scope.layout.listItems);
			$scope.updateSelectItems($scope._selectItems);

		}else if($scope.inEditMode()){
			if(!$scope.wasEditMode){
				$scope.wasEditMode = true;
				// close all menus
				$scope.utilService.closeMenus($scope.listItemsDub);
			}

			setSelectItems($scope, $scope.layout.listItems);
			$scope.checkAndUpdateListObjects().then(proms => Promise.all(proms)).then(listObjects => $scope.initListObjects(listObjects))
				.catch(err => err && Logger.error(err))
				.then(() => $scope.updateSelectionLabels());

		}

		$scope.applyColors(layout);
		$scope.applyStyles(layout.appearance);

		// load (dynamically) components which are required in edit mode only
		if($scope.editComponentsRequired && $scope.inEditMode()){
			$scope.editComponentsRequired = false;
			loadEditor().catch(err => Logger.error('Error ocurred while button-editor was loaded', err));
		}

		$scope.updateListItemsProps($scope.listItemsDub, $scope.layout.listItems, layout.qHyperCube.qDimensionInfo);
		$scope.updateSelectionLabels();

		if(!$scope.isPrinting){
			layout.exportListItemsDub = $scope.listItemsDub.slice();
			layout.exportListObjects = {};

			$scope._listObjects && Object.keys($scope._listObjects).forEach(function(key) {
				if($scope._listObjects[key]){
					layout.exportListObjects[key] = $scope._listObjects[key].layout;
				}
			});


		}

		paintingPromise.resolve();

		return $scope.apiService.getPromise().then(function(){
			console.log('finished painting tcMenubar', layout.title);
		});
	}

	/**
	 * Sets selectItems to the scope
	 *
	 * @param {Object} $scope - Extensions scope
	 * @param {Array} listItems
	 */
	function setSelectItems($scope, listItems){
		if(!listItems || !$scope){
			return; // no listItems/$scope to deal with
		}

		// get shadow copy of listItems to be undependend of layout invalidations
		$scope.listItemsDub = listItems.slice();

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
	 * @param {string|number} value - value to select as text or index (qElemNumber)
	 * @param {boolean} [optional] - apply selection only if nothing already selected
	 * @param {boolean} isElemNumber - if true, value must be a qElemNumber of type number
	 *
	 * @return {Promise<boolean>} - returns true if selection was
	 */
	function applySelection(listObject, value, isElemNumber, optional){
		if(!listObject || !listObject.layout){
			return Promise.resolve();
		}

		const qList = listObject.layout.qListObject;
		if(!qList || qList.qDimensionInfo && optional && qList.qDimensionInfo.qStateCounts.qSelected){
			return Promise.resolve(); // already selected, no selection required
		}

		const valIndex = isElemNumber ? value : getIndexByText(qList.qDataPages, value), // get element number (qElemNumber)
			args = ['/qListObjectDef', [valIndex], false, false]; // path, values, toggle, softLock

		if(typeof valIndex !== 'number'){
			Logger.warn('trying to select a value that does not exists in dimension', value);
			return Promise.resolve();
		}

		// select value (without toggle/softLock flags)
		return listObject.selectListObjectValues(...args).catch(qlikService.engineErrorHandler(listObject, 'selectListObjectValues', ...args));
	}

	/**
	 * Get index from given qDataPages object by given text value
	 *
	 * @param qDataPages Qlik qDataPages object (from ListObject, or HyperCube)
	 * @param text {string} Text value
	 *
	 * @return {*} Number if index was found, null otherwise
	 */
	function getIndexByText(qDataPages, text){
		let i, j, entries, pages;

		if(qDataPages.length === 0 || !text){
			return null;
		}

		for(i = 0, pages = qDataPages.length; i < pages; i++){
			let page = qDataPages[i];
			for(j = 0, entries = page.qMatrix.length; j < entries; j++){
				let entry = page.qMatrix[j][0];
				if(entry.qText === text){
					return entry.qElemNumber;
				}
			}
		}
		return null;
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