var userLang = navigator.language;
var lang;
switch (userLang) {
	case 'de':
	case 'de-DE':
		// IE
		lang = 'de_de';
		break;
	case 'us':
	case 'en-US':
		lang = 'en_us';
		break;
	default:
		lang = 'en_us';
}

define(['qlik', 'qvangular', 'jquery', 'ng!$timeout', './translations/' + lang + '/translations', './lib/hico/services/qlik-service'], function (qlik, qvangular, $, $timeout, translation, QlikService) {

	var qlikService = QlikService.getInstance();

	/**
  * Controller function of the extension
  * @param $scope
  * @param $element
  * @param utilService
  * @param qlikService
  */
	function controller($scope, $element, utilService, qlikService, updateService, apiService) {
		// $scope does not always work (not in any QS version)
		var _app = qlik.currApp(),
		    // reference must have backandApi as property ($scope -> backendApi -> model)
		_waitForUpdates = void 0,
		    // Promise, which will be resolved, when updates are finished
		_model = $scope.backendApi.model,
		    _waitForVariable = qlik.Promise.resolve(),
		    _selectionsInProgress = false,
		    _ready = qlik.Promise.defer(),
		    _eventListener = []; // collect "unbind" callbacks for added eventListener

		$scope.$ctrl = this;
		this.qlikService = qlikService;
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

		//utilService.screenMode = $scope.layout.appearance.orientation;

		//##################### Updates #######################
		$scope.showUpdateDialog = false;
		$scope.updateText = translation.text.updateText;

		_waitForUpdates = updateService.checkUpdates(_model);
		//##################### End Updates ###################

		$element.on('$destroy', onDestroy);

		$element.on('mouseenter', function () {
			$element.parents("article").css("z-index", 5);
		});
		$element.on('mouseleave', function () {
			$element.parents("article").css("z-index", 0);
		});

		$scope.listItemsDub = [];
		$scope.selState = _app.selectionState();
		$scope.wasEditMode = false;
		$scope.onSheet = qlikService.onSheet;
		$scope.inEditMode = qlikService.inEditMode;
		$scope.inStoryMode = qlikService.inStoryMode;
		$scope.evaluateStates = $scope.layout.qInfo.qType !== 'embeddedsnapshot'; // evaluate button states (expressions) when not a snapshot

		// Watch selection state and update selection labels
		$scope.selState.OnData.bind(updateSelectionLabels);

		$scope.getReady = getReady;
		$scope.setReady = setReady;
		$scope.initListObjects = initListObjects;
		$scope.updateListObjects = updateListObjects;
		$scope.destroyListObjects = destroyListObjects;
		$scope.calculateGaps = calculateGaps;
		$scope.applyStyles = applyStyles;
		$scope.applyColors = applyColors;
		$scope.toggleSenseBars = toggleSenseBars;
		$scope.updateSelectionLabels = updateSelectionLabels;
		$scope.handleButtonStates = handleButtonStates;

		if ($element.parents(".qv-gridcell").length > 0) {
			var cellStyle = $element.parents(".qv-gridcell")[0].style;
			$scope.defaultCellStyleTop = cellStyle.top.substring(cellStyle.top.indexOf("%"));
			$scope.defaultCellStyleBottom = cellStyle.height.substring(cellStyle.height.indexOf("%"));
			$scope.defaultCellStyleLeft = cellStyle.left.substring(cellStyle.left.indexOf("%"));
			$scope.defaultCellStyleWidth = cellStyle.width.substring(cellStyle.width.indexOf("%"));

			$scope.topCorrection = Number(cellStyle.top.substring(cellStyle.top.indexOf("+") + 1, cellStyle.top.indexOf("p")));
			$scope.heightCorrection = Number(cellStyle.height.substring(cellStyle.height.indexOf("-") + 1, cellStyle.height.indexOf("p")));
			$scope.leftCorrection = Number(cellStyle.left.substring(cellStyle.left.indexOf("+") + 1, cellStyle.left.indexOf("p")));
			$scope.widthCorrection = Number(cellStyle.width.substring(cellStyle.width.indexOf("-") + 1, cellStyle.width.indexOf("p")));
		}

		// Initialize single/multiselects as soon as possible and make selections
		_waitForUpdates.then(function () {
			if (!$scope.inEditMode()) {
				setDimensionForListItems($scope.layout, []);
				initListObjects($scope.layout).then(function () {
					setReady();
				});
			} else {
				setReady();
			}
		});

		/**
   * Create a listObject for 'Single Selects'
   * @param layout Layout of the extension
   * @param dimIndex {number} Dimension index
   * @param lItemIndex {number} listItem index
   * @param sItemIndex {number|undefined} selectItem index
   * @return {*}
   */
		function createListObj(layout, dimIndex, lItemIndex, sItemIndex) {
			var dimensionArray = [],
			    height = 10000,
			    // get maximum possible rows
			dimension = layout.dimensions[dimIndex],
			    listItem = sItemIndex !== undefined ? layout.listItems[lItemIndex].selectItems[sItemIndex] : layout.listItems[lItemIndex];

			if (!~listItem.props.dim.indexOf("~")) {
				dimensionArray.push(listItem.props.dim);
			} else {
				dimensionArray = listItem.props.dim.split('~');
			}

			if (!dimension.customSortOrder) {
				if (!dimension.qSortByStateCheck) {
					dimension.sortByState = 0;
				}
				if (!dimension.qSortByFrequencyCheck) {
					dimension.sortByFrequency = 0;
				}
				if (!dimension.qSortByNumericCheck) {
					dimension.sortByNumeric = 0;
				}
				if (!dimension.qSortByAsciiCheck) {
					dimension.sortByAscii = 0;
				}
				if (!dimension.sortByLoadOrderCheck) {
					dimension.sortByLoadOrder = 0;
				}
				if (!dimension.qSortByExpressionCheck) {
					dimension.sortByExpression = 0;
				}
			} else {
				dimension.sortByState = 0;
				dimension.sortByFrequency = 0;
				dimension.sortByNumeric = 0;
				dimension.sortByAscii = 0;
				dimension.sortByLoadOrder = 0;
				dimension.sortByExpression = 0;
			}

			return _app.createGenericObject({
				// WORKAROUND: In QS 2017.7 creation of session objects is broken, when a SessionObject was created with a specific qId it is not possible
				// to recreate it with the same id, after it was destroyed.
				// Therefore no qId will be specified here. Enable it again after QS bug was fixed!
				//				"qInfo": {
				//					"qId": ($scope.layout.qExtendsId || $scope.layout.qInfo.qId) + '##' + listItem.cId + '##list',
				//					"qType": "GenericObject"
				//				},
				"qListObjectDef": {
					"qStateName": "$",
					"qLibraryId": "",
					"qDef": {
						"qGrouping": "N",
						"qFieldDefs": dimensionArray,
						"qFieldLabels": dimensionArray,
						"qSortCriterias": [{
							"qSortByState": dimension.sortByState,
							"qSortByFrequency": dimension.sortByFrequency,
							"qSortByNumeric": dimension.sortByNumeric,
							"qSortByAscii": dimension.sortByAscii,
							"qSortByLoadOrder": dimension.sortByLoadOrder,
							"qSortByExpression": dimension.sortByExpression,
							"qExpression": {
								"qv": dimension.sortExpression
							}
						}],
						"qNumberPresentations": [{
							"qType": "U",
							"qnDec": 10,
							"qUseThou": 0,
							"qFmt": "",
							"qDec": ".",
							"qThou": " "
						}]
					},
					"qAutoSortByState": {
						"qDisplayNumberOfRows": -1
					},
					"qFrequencyMode": "NX_FREQUENCY_VALUE",
					"qShowAlternatives": true,
					"qInitialDataFetch": [{
						"qTop": 0,
						"qLeft": 0,
						"qHeight": height, // TODO: when field has more then 10.000 entries, we need to handle this somehow! It's not handled yet!!!
						"qWidth": 1
					}]

				}
			}).then(function (reply) {
				listItem.selectValues = reply.layout.qListObject;
				listItem.listInfo = reply.layout.qInfo;

				if (listItem.selectValues.qDimensionInfo.qError) {
					console.warn("invalid dimension selected: ", listItem.props.dimTitle);

					if (listItem.selectValues.qDataPages.length === 0) {
						listItem.selectValues.qDataPages = [{ qMatrix: [] }];
					}
				}

				// Listen to Validated event of the listObject and apply default selection if required
				_eventListener.push(addListener(reply, 'Validated', function () {
					var listObj = this.layout.qListObject;
					// Wait until extension layout is validated (required for correct expression evaluation of default select values)
					getReady().then(function ($scope) {
						applySelection($scope.layout, listObj, lItemIndex, sItemIndex);
					});
				}));

				if (_selectionsInProgress === false && listItem.props.alwaysSelectValue) {
					_selectionsInProgress = true;
					if (!listItem.selectValues.qDimensionInfo.qStateCounts.qSelected) {
						_waitForVariable = setVariable($scope.layout.calCondVariable, '0');
					}
				}
				// return a selection callback instead of applying selection instantly
				return function () {
					return applySelection(layout, reply.layout.qListObject, lItemIndex, sItemIndex);
				};
			});
		}

		function initListObjects(layout, changedItems) {
			var i,
			    j,
			    listItem,
			    selectItem,
			    selectItems,
			    promises = [],
			    dimIndex = 0,
			    dimensionNames = [],
			    dimensions = layout.dimensions || [],
			    listItems = layout.listItems || [];

			// Get used dimension names
			for (i = 0; i < dimensions.length; i++) {
				dimensionNames.push(dimensions[i].dim);
			}

			// Create dimension lists for each used dimension
			for (i = 0, listItem = listItems[i]; i < listItems.length; i++, listItem = listItems[i]) {
				if (listItem.type === 'Single Select' && (dimIndex = dimensionNames.indexOf(listItem.props.dim)) > -1) {
					promises.push(createListObj(layout, dimIndex, i));
				} else if (listItem.type === 'Multi Select' && listItem.selectItems) {
					selectItems = listItem.selectItems;
					for (j = 0, selectItem = selectItems[j]; j < selectItems.length; j++, selectItem = selectItems[j]) {
						if ((dimIndex = dimensionNames.indexOf(selectItem.props.dim)) > -1) {
							promises.push(createListObj(layout, dimIndex, i, j));
						}
					}
				}
			}

			return qlik.Promise.all(promises).then(function (selections) {
				// wait for variable to be ready before continuing with selections
				return _waitForVariable.then(function () {
					if (layout.sequentialSelections) {
						// apply one selection after another "sequential"
						return selections.reduce(function (prevSelection, nextSelection) {
							return prevSelection.then(nextSelection);
						}, qlik.Promise.resolve());
					} else {
						// apply selections "parallel"
						return qlik.Promise.all(selections.map(function (selection) {
							return selection();
						}));
					}
				});
			}).then(function () {
				if (_selectionsInProgress) {
					_selectionsInProgress = false;
					return setVariable($scope.layout.calCondVariable, '1');
				}
				// Register event handler for Validated|Invalidated events of extension model
				_eventListener.push(addListener(_model, 'Validated', function () {
					setReady();
				}));
				_eventListener.push(addListener(_model, 'Invalidated', function () {
					setReady(false);
				}));
			});
		}

		function updateListObjects(layout, changedItems) {
			destroyListObjects(changedItems).then(function () {
				initListObjects(layout, changedItems);
			});
		}

		function calculateGaps(layout) {
			var parentElement = $element.parents(".qv-gridcell");
			if (parentElement.length === 0 || !layout.appearance) {
				return;
			}

			var appearance = layout.appearance;
			var cellElementStyle = parentElement[0].style;
			var parentArticle = $element.parents("article");

			appearance.gapTop === true ? parentArticle.css("border-top", 0) : parentArticle.css("border-top", 1);
			appearance.gapBottom === true ? parentArticle.css("border-bottom", 0) : parentArticle.css("border-bottom", 1);
			appearance.gapLeft === true ? parentArticle.css("border-left", 0) : parentArticle.css("border-left", 1);
			appearance.gapRight === true ? parentArticle.css("border-right", 0) : parentArticle.css("border-right", 1);

			setOffsets(appearance.gapTop, appearance.gapBottom, appearance.gapTopSize, appearance.gapBottomSize, cellElementStyle.top, cellElementStyle.height, $scope.defaultCellStyleTop, $scope.defaultCellStyleBottom, $scope.topCorrection, $scope.heightCorrection, 'top', 'height');
			setOffsets(appearance.gapLeft, appearance.gapRight, appearance.gapLeftSize, appearance.gapRightSize, cellElementStyle.left, cellElementStyle.width, $scope.defaultCellStyleLeft, $scope.defaultCellStyleWidth, $scope.leftCorrection, $scope.widthCorrection, 'left', 'width');

			function setOffsets(gapDirection1, gapDirection2, gapSizeValue1, gapSizeValue2, style1, style2, defaultVal1, defaultVal2, cor1, cor2, prop1, prop2) {
				var styles = {};
				if (gapDirection1 || gapDirection2) {

					gapSizeValue1 = isNaN(gapSizeValue1) ? 0 : gapSizeValue1;
					gapSizeValue2 = isNaN(gapSizeValue2) ? 0 : gapSizeValue2;

					var calcVal1 = style1.substring(0, style1.indexOf("%"));
					var calcVal2 = style2.substring(0, style2.indexOf("%"));

					gapSizeValue1 = Math.abs(gapSizeValue1);
					gapSizeValue2 = Math.abs(gapSizeValue2);

					if (gapDirection1 && !gapDirection2) {
						gapSizeValue1 *= -1;
						gapSizeValue2 = cor2 - gapSizeValue1;
						gapSizeValue1 -= cor2 + cor1;
					} else if (!gapDirection1 && gapDirection2) {
						gapSizeValue1 = cor1;
						gapSizeValue2 += cor2;
					} else if (gapDirection1 && gapDirection2) {
						var gapSize1Copy = gapSizeValue1;
						gapSizeValue1 *= -1;
						gapSizeValue1 -= cor2 + cor1;
						gapSizeValue2 += 3 * cor2 + gapSize1Copy;
					}

					styles[prop1] = calcVal1 + '% + ' + gapSizeValue1 + 'px)';
					styles[prop2] = calcVal2 + '% + ' + gapSizeValue2 + 'px)';

					parentElement.css(styles);
				} else {
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
		function applyStyles(appearance) {
			var listItems = this.listItemsDub,
			    labelStyle = {
				'font-family': appearance.textFamily || '"QlikView Sans", sans-serif',
				'font-size': appearance.textSize || 13,
				'font-weight': appearance.textWeight || 'bold',
				'font-style': appearance.textStyle || 'normal'
			},
			    selectionStyle = {
				'font-family': appearance.textSelectionFamily || '"QlikView Sans", sans-serif',
				'font-size': appearance.textSelectionSize || 11,
				'font-weight': appearance.textSelectionWeight || 'normal',
				'font-style': appearance.textSelectionStyle || 'normal'
			};

			// Update text styles for every item/subitem
			(listItems || []).forEach(function (listItem) {
				listItem.labelStyle = labelStyle;
				listItem.selectionStyle = selectionStyle;

				['variableItems', 'dropdownItems', 'selectItems', 'subItems'].forEach(function (type) {
					(listItem[type] || []).forEach(function (item) {
						item.labelStyle = labelStyle;
						item.selectionStyle = selectionStyle;
					});
				});
			});
		}

		function applyColors() {
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

		function toggleSenseBars(layout, inEditMode) {
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

			if (menuBar) {
				var qvPanelStage = document.getElementsByClassName("qv-panel-stage")[0];
				if (qvPanelStage) {
					if ((showMenuBar === '0' || !checkExpressionCondition(showMenuBarExpr)) && !inEditMode) {
						qvPanelStage.style.height = '100%';
					} else {
						qvPanelStage.style.height = '';
					}
				}
				triggerHicoRepaint = showOrHideSenseBar(menuBar, showMenuBar, showMenuBarExpr, inEditMode) || triggerHicoRepaint;
			}

			if (selectionBar) {
				triggerHicoRepaint = showOrHideSenseBar(selectionBar, showSelectionBar, showSelectionBarExpr, inEditMode) || triggerHicoRepaint;
			}

			if (titleBar) {
				triggerHicoRepaint = showOrHideSenseBar(titleBar, showTitleBar, showTitleBarExpr, inEditMode) || triggerHicoRepaint;
			}

			if (triggerHicoRepaint) {
				qvangular.$rootScope.$broadcast('hico-repaint');
			}
		}

		function showOrHideSenseBar(element, elementCondition, elementExpression, inEditMode) {
			var display,
			    changed = false;
			if (elementCondition && elementCondition === '1' || inEditMode) {
				changed = element.style.display !== 'block';
				element.style.display = 'block';
			} else if (elementCondition && elementCondition === '0') {
				changed = element.style.display !== 'none';
				element.style.display = 'none';
			} else if (elementCondition && elementCondition === '2') {
				display = checkExpressionCondition(elementExpression) ? 'block' : 'none';
				changed = element.style.display !== display;
				element.style.display = display;
			} else {
				changed = element.style.display !== 'block';
				element.style.display = 'block';
			}

			return changed;
		}

		function checkExpressionCondition(expression) {
			expression = expression.toString().toLowerCase();
			return expression === '' || expression === 'true' || expression === '1' || expression === '-1';
		}

		function setColor(colorName, defaultColor) {
			var appearance = $scope.layout.appearance;
			var colors = $scope.colors;

			if (!appearance[colorName]) {
				colors[colorName] = defaultColor;
			} else if (colors[colorName] !== convertIfSense(appearance[colorName])) {
				colors[colorName] = convertIfSense(appearance[colorName]);
			}
		}

		function convertIfSense(colorString) {
			var startIndex = colorString.indexOf(',');
			var endIndex = colorString.indexOf('(');

			if (colorString.indexOf("ARGB") > -1) {
				var opcaityLength = startIndex - endIndex - 1;
				var opacity = Number(colorString.substr(endIndex + 1, opcaityLength)) / 255;

				return 'rgba(' + colorString.substr(startIndex + 1, colorString.length - startIndex - 2) + ',' + opacity + ')';
			} else {
				return colorString;
			}
		}

		function updateSelectionLabels() {
			$scope.listItemsDub.forEach(function (item) {
				item.props.selectedValue = '';
				if (item.type === 'Single Select' || item.type === 'Sense Select') {
					$scope.selState.selections.forEach(function (selection) {
						if (selection.fieldName === item.props.dim) {
							item.props.selectedValue = getSelectionString(selection);
						}
					});
				} else if (item.type === 'Multi Select' && item.selectItems) {
					item.selectItems.forEach(function (selectItem) {
						selectItem.props.selectedValue = '';
						$scope.selState.selections.forEach(function (selection) {
							if (selection.fieldName === selectItem.props.dim) {
								selectItem.props.selectedValue = getSelectionString(selection);
								item.props.selectedValue += selectItem.props.selectedValue + ', ';
							}
						});
					});
					item.props.selectedValue = item.props.selectedValue.substring(0, item.props.selectedValue.length - 2);
				}
			});
		}

		function getSelectionString(selection) {
			if (selection.qSelected === 'ALL') {
				return translation.text.all;
			} else if (selection.selectedCount > 2) {
				return selection.selectedCount + ' ' + translation.text.of + ' ' + selection.totalCount;
			} else {
				// Concat all selections by qName to single string -> "field1, field2, field3"
				return selection.selectedValues.map(function (value) {
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
		function setVariable(name, value) {
			if (name) {
				return qlikService.getVariableValue(name).then(function (currValue) {
					if (currValue !== value) {
						if (value === '0') {
							// do not catch errors in case of '0', because it could be retried (request aborted), so '0' could be the end result
							return _app.variable.setStringValue(name, value).catch(function () {
								qlik.Promise.resolve();
							});
						} else {
							// in case of other values ('1') it is important that the variable is set despite errors
							return _app.variable.setStringValue(name, value).catch(qlikService.engineErrorHandler(_app.variable, 'setStringValue', [name, value]));
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
		function getReady() {
			return _ready.promise;
		}

		/**
   * Resolves the "ready" promise, or renew it
   * @param yes|undefined {boolean} Renew ready promise if false, resolves it otherwise
   */
		function setReady(yes) {
			if (yes === false && _ready.resolved) {
				_ready = qlik.Promise.defer();
			} else {
				_ready.resolved = true;
				_ready.resolve($scope);
			}
		}

		/**
   * Clean up when extension was destroyed (removed from sheet)
   */
		function onDestroy() {
			$scope.selState && $scope.selState.OnData.unbind(updateSelectionLabels);
			// $scope.destroyListObjects(); // Reuse listObjects during sheet navigation

			// WORKAROUND: Because of broken support of session objects in QS release 2017.7 we must destroy them when extension gets also destroyed (i.e. on
			// sheet navigation)
			destroyListObjects(); // remove this after bug was fixed

			//			removeListener(_eventListener);  // enable this after bug was fixed
			//			_eventListener = []; // enable this after bug was fixed
		}

		//destroy listObjects and return promise
		function destroyListObjects(listItems) {
			var promises = [];

			removeListener(_eventListener);
			_eventListener = [];

			listItems && listItems.forEach(function (listItem) {
				listItem.isOpen = false;
				listItem.show = false;

				switch (listItem.type) {
					case 'Single Select':
						if (listItem.listInfo) {
							promises.push(_app.destroySessionObject(listItem.listInfo.qId));
							delete listItem.listInfo;
						}
						break;
					case 'Multi Select':
						listItem.selectItems && listItem.selectItems.forEach(function (selectItem) {
							if (selectItem.listInfo) {
								promises.push(_app.destroySessionObject(selectItem.listInfo.qId));
								delete selectItem.listInfo;
							}
						});
						break;
					case 'Sense Select':
						if (listItem.listBox) {
							promises.push(_app.destroySessionObject(listItem.listBox.id));
							delete listItem.listBox;
							$('#QV05_' + $scope.layout.qInfo.qId + '-' + listItem.cId).empty();
						}
						break;
				}
			});

			return qlik.Promise.all(promises);
		}

		/**
   * Assigns active button states to the extensions layout (required for snapshots)
   * @param {Object} activeStates
   * @param {Object} currItem
   */
		function handleButtonStates(activeStates, currItem) {
			currItem.activeStates = activeStates;

			// update layout data (requred for snapshots)
			($scope.listItemsDub || []).some(function (item, index) {
				if (item === currItem) {
					$scope.layout.listItems[index].activeStates = item.activeStates;
					return true;
				}
			});
		}
	}

	/**
  * Paint function of the extension
  * @param $element Angular HTMLElement of the extension
  * @param layout Layout object
  */
	function paint($element, layout) {
		var $scope = this.$scope;
		$scope.layout = layout;

		HiCo.API.Menu.paintingPromise().then(function () {
			console.log('finished painting tcMenubar', layout.title);
		});

		var paintingPromis = $scope.apiService.createNewPromise();

		if ($element.parents(".qv-gridcell").length > 0 && layout.appearance) {
			$scope.calculateGaps(layout);
		}

		$scope.applyColors(layout);
		$scope.onSheet() && $scope.toggleSenseBars(layout, $scope.inEditMode());

		if (($scope.listItemsDub.length === 0 || $scope.wasEditMode) && !$scope.inEditMode()) {
			$scope.listItemsDub = layout.listItems.slice(0);

			setDimensionForListItems(layout, $scope.listItemsDub);

			if ($scope.wasEditMode) {
				// Create new listObjects only when coming from edit mode
				// console.info('select: initListObjects after edit');
				$scope.initListObjects(layout);
			}
			$scope.wasEditMode = false;

			$scope.utilService.closeMenus($scope.listItemsDub, undefined);
		} else if ($scope.listItemsDub.length !== 0 && !$scope.inEditMode()) {
			var changedItems = setDimensionForListItems(layout, $scope.listItemsDub);
			if (changedItems.length > 0) {

				$scope.updateListObjects(layout, changedItems);

				updateLayoutProperties(layout, $scope.listItemsDub, $scope.utilService);

				$scope.listItemsDub = layout.listItems.slice(0);
			}

			var qlikService = $scope.$ctrl.qlikService;
			$scope.listItemsDub.forEach(function (listItem, index) {
				listItem.props.itemLabel = layout.listItems[index].props.itemLabel;
				listItem.props.selectionLabel = layout.listItems[index].props.selectionLabel;

				(listItem.variableItems || []).forEach(function (variableItem, vIndex) {
					variableItem.props.itemLabel = layout.listItems[index].variableItems[vIndex].props.itemLabel;
					variableItem.props.selectionLabel = layout.listItems[index].variableItems[vIndex].props.selectionLabel;
					qlikService.getVariableValue(listItem.props.variableName).then(function (value) {
						variableItem.isActive = variableItem.props.variableValue === value;
					});
				});

				(listItem.dropdownItems || []).forEach(function (dropdownItem, vIndex) {
					dropdownItem.props.itemLabel = layout.listItems[index].dropdownItems[vIndex].props.itemLabel;
					dropdownItem.props.selectionLabel = layout.listItems[index].dropdownItems[vIndex].props.selectionLabel;
					dropdownItem.stateItems = layout.listItems[index].dropdownItems[vIndex].stateItems;
				});

				(listItem.selectItems || []).forEach(function (selectItem, vIndex) {
					selectItem.props.itemLabel = layout.listItems[index].selectItems[vIndex].props.itemLabel;
					selectItem.props.selectionLabel = layout.listItems[index].selectItems[vIndex].props.selectionLabel;
				});

				listItem.stateItems = layout.listItems[index].stateItems;

				(listItem.subItems || []).forEach(function (subItem, vIndex) {
					subItem.stateItems = layout.listItems[index].subItems[vIndex].stateItems;
				});
			});
		} else if ($scope.inEditMode()) {
			if (!$scope.wasEditMode) {
				// destroy session objects only once when switching in edit mode
				$scope.destroyListObjects($scope.listItemsDub);
			}
			$scope.wasEditMode = true;
			$scope.listItemsDub = layout.listItems.slice(0);
		}

		$scope.updateSelectionLabels();
		$scope.applyStyles(layout.appearance);

		paintingPromis.resolve();
	}

	/**
  * Get dim value from dimtitle for every object with a dimension value
  *
  * @param layout
  * @param listItemsDub
  * @return {Array} - changed listItems
  */
	function setDimensionForListItems(layout, listItemsDub) {
		if (!listItemsDub || listItemsDub.length === 0) {
			return;
		}
		var somethingChanged = [];
		layout.listItems.forEach(function (listItem, i) {
			if (listItem.type === "Single Select" || listItem.type === "Sense Select") {
				listItem.props.dimTitle = !listItem.props.dimTitle ? listItem.props.dim : listItem.props.dimTitle;

				var dimValue = getDimensionValueFromDimTitle(layout, listItem.props.dimTitle);

				listItem.props.dim = dimValue ? dimValue : listItem.props.dim;

				listItemsDub.forEach(function (item) {
					if (item.props.dimTitle === listItem.props.dimTitle && item.props.dim !== listItem.props.dim) {
						somethingChanged.push(item);
					}
				});
				// update properties
				listItemsDub[i].props = listItem.props;
			}

			(listItem.selectItems || []).forEach(function (selectItem, j) {
				selectItem.props.dimTitle = !selectItem.props.dimTitle ? selectItem.props.dim : selectItem.props.dimTitle;

				var dimValue = getDimensionValueFromDimTitle(layout, selectItem.props.dimTitle);
				selectItem.props.dim = dimValue ? dimValue : selectItem.props.dim;

				listItemsDub.forEach(function (item) {
					if (item.props.dimTitle === selectItem.props.dimTitle && item.props.dim !== selectItem.props.dim) {
						somethingChanged.push(item);
					}
				});

				// update properties
				listItemsDub[i].selectItems[j].props = selectItem.props;
			});
		});

		return somethingChanged;
	}

	//returns the dim value for a specific dimTitle
	function getDimensionValueFromDimTitle(layout, title) {
		var dimValue = undefined;
		layout.dimensions && layout.dimensions.some(function (dimension) {
			if (dimension.dimTitle === title) {
				dimValue = dimension.dim;
				return true;
			}
		});

		return dimValue;
	}

	//set menu open attributes in the new layout so that they are not lost and we dont get flickering effect
	function updateLayoutProperties(layout, listItems, utilService) {
		layout.listItems.forEach(function (listItem, index) {
			listItem.show = listItems[index].show;
			if (listItem.type === 'Single Select') {
				// set alignement property to the right value
				listItem.alignement = utilService.checkNumeric(listItems[index]);
			}

			(listItem.variableItems || []).forEach(function (variableItem, vIndex) {
				variableItem.show = listItems[index].variableItems[vIndex].show;
			});

			(listItem.dropdownItems || []).forEach(function (dropdownItem, vIndex) {
				dropdownItem.props.itemLabel = listItems[index].dropdownItems[vIndex].props.itemLabel;
			});

			(listItem.selectItems || []).forEach(function (selectItem, vIndex) {
				selectItem.show = listItems[index].selectItems[vIndex].show;
				// set alignement property to the right value
				selectItem.alignement = utilService.checkNumeric(listItems[index].selectItems[vIndex]);
			});

			listItem.stateItems = listItems[index].stateItems;

			(listItem.subItems || []).forEach(function (subItem, vIndex) {
				subItem.show = listItems[index].subItems[vIndex].show;
			});
		});
	}

	/**
  * Apply single (default) selection of a single select
  * @param layout {object} Layout of the extension
  * @param listObject {object} listObject of the dimension
  * @param lItemIndex {number} listItem index
  * @param sItemIndex {number|undefined} selectItem index
  * @return {*}
  */
	function applySelection(layout, listObject, lItemIndex, sItemIndex) {
		var item = sItemIndex !== undefined ? layout.listItems[lItemIndex].selectItems[sItemIndex] : layout.listItems[lItemIndex];

		if (item.props.alwaysSelectValue && !listObject.qDimensionInfo.qStateCounts.qSelected) {
			var selectionIndex = getIndexByText(listObject.qDataPages, item.props.selectValue);
			if (selectionIndex !== null) {
				return qlikService.select(listObject.qDimensionInfo.qFallbackTitle, [selectionIndex], false, false);
			}
		}
		return qlik.Promise.resolve();
	}

	/**
  * Get index from given qDataPages object by given text value
  * @param qDataPages Qlik qDataPages object (from ListObject, or HyperCube)
  * @param text {string} Text value
  * @return {*} Number if index was found, null otherwise
  */
	function getIndexByText(qDataPages, text) {
		var i, j, entry, entries, page, pages;

		if (qDataPages.length === 0 || !text) {
			return null;
		}

		for (i = 0, page = qDataPages[i], pages = qDataPages.length; i < pages; i++, page = qDataPages[i]) {
			for (j = 0, entry = page.qMatrix[j][0], entries = page.qMatrix.length; j < entries; j++, entry = page.qMatrix[j][0]) {
				if (entry.qText === text) {
					return entry.qElemNumber;
				}
			}
		}
		return null;
	}

	/**
  * Adds an event listener for a given object
  * @param obj Object
  * @param evt Event
  * @param callback Callback
  * @return {Function} Unbind function (unbinds the Listener, when called)
  */
	function addListener(obj, evt, callback) {
		obj[evt].bind(callback);
		return function () {
			obj[evt].unbind(callback);
		};
	}

	/**
  * Removes event listeners
  * @param evtListenerList {Array} An array of callbacks, which were returned by addListener method
  */
	function removeListener(evtListenerList) {
		if (!evtListenerList || evtListenerList.length === 0) {
			return;
		}

		try {
			for (var i = 0; i < evtListenerList.length; i++) {
				evtListenerList[i](); // Execute "unbind" callback
			}
		} catch (e) {
			console.warn('Error occured during unbinding of event listeners');
		}
	}

	return {
		controller: controller,
		paint: paint
	};
});