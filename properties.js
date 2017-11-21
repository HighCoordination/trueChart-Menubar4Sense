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

define(['require', 'jquery', 'angular', 'qlik', 'ng!$q', 'ng!$http', 'ng!$timeout', 'qvangular', './translations/' + lang + '/translations', "text!./templates/informationComponent.html", "text!./templates/colorPickerInputComponent.html", "text!./templates/dropdownTemplate.html", "text!./templates/multiOptionsComponent.html", "text!./templates/seperatorLabelComponent.html", "./lib/hico/services/qlik-service", "./lib/general/icons-fa", "./lib/external/tinycolor/tinycolor-min", "./lib/colorsliders/bootstrap.colorpickersliders"], function (require, $, angular, qlik, $q, $http, $timeout, qvangular, translation, informationTemplate, colorPickerInputTemplate, dropdownTemplate, multiOptionsTemplate, seperatorLabelTemplate, QlikService, faIcons, tinycolor) {
	'use strict';

	// Customize components for properties panel

	var customCmp = customizePPComponents();

	window.tinycolor = tinycolor;
	var app = qlik.currApp(),
	    qlikService = QlikService.getInstance();

	function _getRefs(data, refName) {
		var ref = data;
		var name = refName;
		var props = refName.split('.');
		if (props.length > 0) {
			for (var i = 0; i < props.length - 1; ++i) {
				if (ref[props[i]]) ref = ref[props[i]];
			}
			name = props[props.length - 1];
		}
		return { ref: ref, name: name };
	}

	function setRefValue(data, refName, value) {
		var obj = _getRefs(data, refName);
		obj.ref[obj.name] = value;
	}

	function getRefValue(data, refName) {
		var obj = _getRefs(data, refName);
		return obj.ref[obj.name];
	}

	function createDisplayBtnGrp(ref, label) {
		return {
			type: "string",
			component: customCmp.buttongroup,
			label: label,
			ref: ref,
			options: [{
				value: "0",
				label: translation.label.displayHide,
				tooltip: translation.tooltip.displayHide
			}, {
				value: "1",
				label: translation.label.displayShow,
				tooltip: translation.tooltip.displayShow
			}, {
				value: "2",
				label: translation.label.displayOptional,
				tooltip: translation.tooltip.displayOptional
			}],
			defaultValue: "1"
		};
	}

	function createDisplayExpression(ref, label, show) {
		return {
			ref: ref,
			label: label,
			type: "string",
			expression: "optional",
			defaultValue: "true",
			show: show || false
		};
	}

	var seperatorComponent = {
		template: "<div class='hico-property-seperator'></div>"
	};

	var seperatorLabelComponent = {
		template: seperatorLabelTemplate
	};

	var dimensionStringMasterComponent = {
		template: "<div class='pp-component'><div class='lui-label'>{{translation.label.dimension}}</div>" + "<input type='text' class='lui-input lui-disabled hico-property-seperator' disabled='disabled' value='{{data.dimTitle}}'/>" + "</div>",
		controller: ['$scope', '$element', function (scope) {
			scope.translation = translation;
			scope.$emit("saveProperties");
		}]
	};

	var informationComponent = {
		template: informationTemplate,
		controller: ['$scope', '$element', function (scope) {
			scope.translation = translation;
		}]
	};

	var colorPickerComponent = {
		template: colorPickerInputTemplate,
		controller: ['$scope', '$element', function (scope, $element) {
			scope.showColorPicker = false;
			scope.qComponents = {
				string: require('client.property-panel/components/string/string')
			};
			scope.text = { type: 'string', ref: scope.definition.ref, expression: 'optional' };
			scope.obj = _getRefs(scope.data, scope.definition.ref);
			scope.activeState = 'swatches';
			scope.colors = ['#FFFFFF', '#D9D9D9', '#B3B3B3', '#808080', '#4D4D4D', '#333333', '#000000', '#a8d7f0', '#52a2cc', '#214152', '#c0dca9', '#61a729', '#274310', '#fcd6a5', '#f8981d', '#633d0c', '#db94ca', '#cc66b3', '#522948', '#ffb0b0', '#f05555', '#522121', '#ffdd68', '#ffce26', '#66520f'];

			scope.isData = true;

			scope.$on("datachanged", function () {
				scope.isData = true;
				var refValue = getRefValue(scope.args.layout, scope.definition.ref);

				refValue = convertIfSense(refValue);

				$element.find("#hsvflat_" + scope.$id).trigger("colorpickersliders.updateColor", refValue);
				$element.find("#colorPalette_" + scope.$id).css("background-color", refValue);
				setPaletteIconColor(refValue);
			});

			scope.setColor = function (color) {
				var tinColor = tinycolor(color);
				setRefValue(scope.data, scope.definition.ref, tinColor.toRgbString());
				$element.find("#colorPalette_" + scope.$id).css("background-color", tinColor.toRgbString());
				$element.find("#colorPaletteIcon_" + scope.$id).css("color", tinycolor.mostReadable(tinColor, ['#595959', '#fff']).toHexString());
				scope.$emit("saveProperties");
			};

			$timeout(function () {
				$element.find("#hsvflat_" + scope.$id).ColorPickerSliders({
					color: convertIfSense(getRefValue(scope.args.layout, scope.definition.ref)),
					flat: true,
					sliders: false,
					swatches: false,
					hsvpanel: true,
					grouping: false,
					onchange: function onchange(container, color) {
						$timeout(function () {
							if (!scope.isData) {
								setRefValue(scope.data, scope.definition.ref, color.tiny.toRgbString());
							}
							scope.isData = false;

							$element.find("#colorPalette_" + scope.$id).css("background-color", color.tiny.toRgbString());
							setPaletteIconColor(color);

							scope.$emit("saveProperties");
						});
					}
				});
			});

			function convertIfSense(colorString) {
				if (colorString.indexOf("ARGB") > -1) {
					var opcaityLength = colorString.indexOf(',') - colorString.indexOf('(') - 1;
					var opacity = Number(colorString.substr(colorString.indexOf('(') + 1, opcaityLength)) / 255;

					return 'rgba(' + colorString.substr(colorString.indexOf(',') + 1, colorString.length - colorString.indexOf(',') - 2) + ',' + opacity + ')';
				} else {
					return colorString;
				}
			}

			function setPaletteIconColor(color) {
				var colorObj = {};

				if (!color.tiny) {
					colorObj.tiny = tinycolor(color);
				} else {
					colorObj = color;
				}

				if (colorObj.tiny.getAlpha() < 0.5) {
					$element.find("#colorPaletteIcon_" + scope.$id).css("color", '#595959');
				} else {
					$element.find("#colorPaletteIcon_" + scope.$id).css("color", tinycolor.mostReadable(colorObj.tiny, ['#595959', '#fff']).toHexString());
				}
			}
		}]
	};

	var dropdownComponent = {
		template: dropdownTemplate,
		controller: ['$scope', '$element', function (scope) {
			scope.refValue = getRefValue(scope.data, scope.definition.ref);

			scope.definition.options().then(function (options) {
				scope.items = options;
				options.some(function (option) {
					if (option.label === scope.refValue.qName || scope.refValue.qData && option.label === scope.refValue.qData.title) {
						scope.refValue = option;
						return true;
					}
				});
			});

			scope.update = function () {
				setRefValue(scope.data, scope.definition.ref, scope.refValue.value);

				if (scope.definition.change) {
					scope.definition.change(scope.data);
				}

				scope.$emit("saveProperties");
			};
		}]
	};

	var MultiOptionsComponent = {
		template: multiOptionsTemplate,
		controller: ['$scope', '$element', function (scope, element) {
			scope.refValue = getRefValue(scope.data, scope.definition.ref);
			scope.qComponents = {
				string: require('client.property-panel/components/string/string')
			};
			scope.text = { type: 'string', ref: scope.definition.ref, expression: 'optional' };

			scope.definition.options.some(function (option) {
				if (option.value === scope.refValue) {
					scope.refValue = option;
					return true;
				}
			});

			scope.update = function () {
				setRefValue(scope.data, scope.definition.ref, scope.refValue.value);

				if (scope.definition.change) {
					scope.definition.change(scope.data);
				}

				scope.$emit("saveProperties");
			};
		}]
	};

	function compare(a, b) {
		if (a.label < b.label) return -1;
		if (a.label > b.label) return 1;
		return 0;
	}

	var getExtensionPath = function getExtensionPath(extensionUniqueName) {
		return window.location.pathname.substr(0, window.location.pathname.toLowerCase().lastIndexOf("/sense") + 1) + 'extensions/' + extensionUniqueName;
	};

	var icons = [];
	icons.push({ value: 'noIcon', label: translation.label.noIcon });
	for (var key in faIcons) {
		faIcons.hasOwnProperty(key) && icons.push({ value: key, label: faIcons[key] });
	}

	var getFieldNames = function getFieldNames() {
		return $q.all([qlikService.listProvider.getListData('DimensionList').then(function (dimensionList) {
			return dimensionList.qItems.map(function (item) {
				var dimensionString = '';

				item.qData.info.forEach(function (dimension) {
					dimensionString += dimension.qName + '~';
				});
				if (dimensionString.substr(dimensionString.length - 1) === '~') {
					dimensionString = dimensionString.substring(0, dimensionString.length - 1);
				}

				item.dimensionString = dimensionString;

				return {
					value: item,
					label: item.qData.title,
					group: translation.label.dimensions
				};
			});
		}), qlikService.listProvider.getListData('FieldList').then(function (fieldList) {
			return fieldList.qItems.map(function (item) {
				return {
					value: item,
					label: item.qName,
					group: translation.label.fields
				};
			});
		})]).then(function (list) {
			var dimensions = list[0].concat(list[1]);
			dimensions.sort(compare);
			return dimensions;
		});
	};

	var openModal = function openModal(state) {
		return qlik.Promise(function (resolve, reject) {
			var scope = qvangular.$rootScope.$new();
			scope.state = state;
			scope.condition = state.condition.qStringExpression ? state.condition.qStringExpression.qExpr : state.condition;

			var compile = qvangular.getService('$compile');
			var directive = $('<div data-tcmenu-button-editor condition="condition" state="state" trans="trans" is-true="isTrue"></div>');
			var $editor = compile(directive)(scope);

			$editor.on('apply', function (evt) {
				angular.extend(state, evt.state);
				resolve(evt.state);
				if (!scope.$$phase) {
					try {
						scope.$apply();
					} catch (err) {
						console.log(err);
					}
				}
			});

			$editor.on('cancel', function (evt) {
				reject();
			});

			if (document.body.childNodes.length > 0) {
				document.body.insertBefore($editor[0], document.body.childNodes[0]);
			} else {
				document.body.appendChild($editor[0]);
			}
		});
	};

	var State = function State() {
		this.version = 1;

		this.text = 'My Button';
		this.tooltip = undefined;
		this.icon = undefined;
		this.buttonType = 'simple';
		this.buttonState = undefined;

		this.condition = conditionInput.defaultValue;

		this.triggers = [{
			type: 'click',
			actions: [{
				name: 'none',
				params: {},
				paramsExpr: {}
			}]
		}];

		this.style = {
			custom: undefined, // custom css string
			icon: {
				color: undefined,
				hoverColor: undefined,
				size: undefined,
				position: undefined
			},
			font: {
				color: undefined, // font color
				hoverColor: undefined,
				size: undefined,
				weight: undefined,
				family: undefined
			},
			background: {
				color: undefined,
				hoverColor: undefined,
				image: undefined,
				position: { x: undefined, y: undefined },
				repeat: 'no-repeat',
				size: undefined
			},
			border: {
				color: undefined,
				hoverColor: undefined,
				enabled: undefined,
				width: undefined,
				radius: undefined,
				style: undefined
			},
			boxShadow: undefined
		};

		this.layout = {
			vAlign: undefined, // {string} vertical alignment of the button inside its container -> 'middle'
			hAlign: undefined, // {string} horizontal alignment of the button inside its container -> 'center'
			vTextAlign: undefined, // {string} vertical alignment of the button inside its container -> 'middle'
			hTextAlign: undefined, // {string} horizontal alignment of the button inside its container -> 'center'
			vContentAlign: undefined,
			hContentAlign: undefined,
			width: '100%', // {string} width of the button -> 'auto'
			height: '100%', // {string} height of the button -> 'default style'
			icon: {
				position: undefined // {string} left|right|top|bottom -> undefined -> left as default
			}
		};
	};

	// *****************************************************************************
	// Custom Definitions
	// *****************************************************************************

	var information = {
		type: "items",
		component: informationComponent,
		ref: ""
	};

	var seperator = {
		type: "string",
		component: seperatorComponent,
		ref: "",
		show: function show(data) {
			return !data.customSortOrder;
		}
	};

	var seperatorLabelColorMain = {
		type: "string",
		component: seperatorLabelComponent,
		label: translation.label.menuMain
	};

	var seperatorLabelColorSub = {
		type: "string",
		component: seperatorLabelComponent,
		label: translation.label.menuSub
	};

	var seperatorLabelTextLabel = {
		type: "string",
		component: seperatorLabelComponent,
		label: translation.label.label
	};

	var seperatorLabelTextSub = {
		type: "string",
		component: seperatorLabelComponent,
		label: translation.label.selectionLabel
	};

	var dimensionDropdown = {
		type: "string",
		component: dropdownComponent,
		label: translation.label.dimension,
		ref: "dropdownDim",
		options: getFieldNames,
		change: function change(data) {
			if (data.dropdownDim.qName) {
				data.dim = data.dropdownDim.qName;
				data.dimTitle = data.dropdownDim.qName;
			} else {
				data.dim = data.dropdownDim.dimensionString;
				data.dimTitle = data.dropdownDim.qMeta.title;
			}
		},
		defaultValue: "no dimension",
		show: function show(data) {
			//console.log(data);
			return true;
		}
	};

	var dimensionName = {
		ref: "dim",
		label: translation.label.dimension,
		type: "string",
		expression: "optional",
		defaultValue: "",
		change: function change(data) {
			if (data.dimTitle === '') {
				if (data.dropdownDim.qName) {
					data.dimTitle = data.dropdownDim.qName;
				} else {
					data.dimTitle = data.dropdownDim.qMeta.title;
				}
			}
		},
		show: function show(data) {
			if (data.dropdownDim === 'no dimension') {
				return false;
			}

			return !(data.dropdownDim.qData && data.dropdownDim.qData.grouping);
		}
	};

	var dimensionStringMaster = {
		component: dimensionStringMasterComponent,
		ref: "test",
		show: function show(data) {
			if (data.dropdownDim === 'no dimension') {
				return false;
			}

			return data.dropdownDim.qData && data.dropdownDim.qData.grouping;
		}
	};

	var dimensionTitle = {
		ref: "dimTitle",
		label: translation.label.dimensionTitel,
		type: "string"
	};

	var customSortOrder = {
		type: "boolean",
		ref: "customSortOrder",
		component: "switch",
		label: translation.label.sortOrder,
		defaultValue: true,
		options: [{
			value: false,
			label: translation.label.userdefined
		}, {
			value: true,
			label: translation.label.automatic
		}]
	};

	var qSortByLoadOrderCheckbox = {
		type: "boolean",
		label: translation.label.sortByLoad,
		ref: "sortByLoadOrderCheck",
		defaultValue: false,
		show: function show(data) {
			return !data.customSortOrder;
		}
	};

	var qSortByLoadOrder = {
		type: "numeric",
		component: "dropdown",
		ref: "sortByLoadOrder",
		options: [{
			value: 1,
			label: translation.label.ascending
		}, {
			value: -1,
			label: translation.label.descending
		}],
		defaultValue: 1,
		show: function show(data) {
			return !data.customSortOrder && data.sortByLoadOrderCheck;
		}
	};

	var qSortByStateCheckbox = {
		type: "boolean",
		label: translation.label.sortByState,
		ref: "qSortByStateCheck",
		defaultValue: false,
		show: function show(data) {
			return !data.customSortOrder;
		}
	};

	var qSortByState = {
		type: "numeric",
		component: "dropdown",
		ref: "sortByState",
		options: [{
			value: 1,
			label: translation.label.ascending
		}, {
			value: -1,
			label: translation.label.descending
		}],
		defaultValue: 1,
		show: function show(data) {
			return !data.customSortOrder && data.qSortByStateCheck;
		}
	};

	var qSortByFrequencyCheckbox = {
		type: "boolean",
		label: translation.label.sortByFrequence,
		ref: "qSortByFrequencyCheck",
		defaultValue: false,
		show: function show(data) {
			return !data.customSortOrder;
		}
	};

	var qSortByFrequency = {
		type: "numeric",
		component: "dropdown",
		ref: "sortByFrequency",
		options: [{
			value: -1,
			label: translation.label.ascending
		}, {
			value: 1,
			label: translation.label.descending
		}],
		defaultValue: 1,
		show: function show(data) {
			return !data.customSortOrder && data.qSortByFrequencyCheck;
		}
	};

	var qSortByNumericCheckbox = {
		type: "boolean",
		label: translation.label.sortByNumeric,
		ref: "qSortByNumericCheck",
		defaultValue: false,
		show: function show(data) {
			return !data.customSortOrder;
		}
	};

	var qSortByNumeric = {
		type: "numeric",
		component: "dropdown",
		ref: "sortByNumeric",
		options: [{
			value: 1,
			label: translation.label.ascending
		}, {
			value: -1,
			label: translation.label.descending
		}],
		defaultValue: 1,
		show: function show(data) {
			return !data.customSortOrder && data.qSortByNumericCheck;
		}
	};

	var qSortByAsciiCheckbox = {
		type: "boolean",
		label: translation.label.sortByAscii,
		ref: "qSortByAsciiCheck",
		defaultValue: false,
		show: function show(data) {
			return !data.customSortOrder;
		}
	};

	var qSortByAscii = {
		type: "numeric",
		component: "dropdown",
		ref: "sortByAscii",
		options: [{
			value: 1,
			label: translation.label.ascending
		}, {
			value: -1,
			label: translation.label.descending
		}],
		defaultValue: 1,
		show: function show(data) {
			return !data.customSortOrder && data.qSortByAsciiCheck;
		}
	};

	var qSortByExpressionCheckbox = {
		type: "boolean",
		label: translation.label.sortByExpression,
		ref: "qSortByExpressionCheck",
		defaultValue: false,
		show: function show(data) {
			return !data.customSortOrder;
		}
	};

	var sortExpression = {
		ref: "sortExpression",
		label: translation.label.formula,
		type: "string",
		expression: "always",
		defaultValue: "",
		show: function show(data) {
			return !data.customSortOrder && data.qSortByExpressionCheck;
		}
	};

	var qSortByExpression = {
		type: "numeric",
		component: "dropdown",
		ref: "sortByExpression",
		options: [{
			value: 1,
			label: translation.label.ascending
		}, {
			value: -1,
			label: translation.label.descending
		}],
		defaultValue: 1,
		show: function show(data) {
			return !data.customSortOrder && data.qSortByExpressionCheck;
		}
	};

	var myTextBox = {
		ref: "props.itemLabel",
		label: "Label",
		type: "string",
		expression: "optional"
	};

	var buttonNameInput = {
		ref: "props.buttonName",
		label: translation.label.buttonNameInput,
		type: "string",
		expression: ""
	};

	var conditionNameInput = {
		ref: "props.conditionName",
		label: translation.label.conditionNameInput,
		type: "string",
		expression: "optional"
	};

	var calcCondVar = {
		type: 'string',
		label: translation.label.calcCondVar,
		//tooltip: translation.tooltip.calcCondVar,
		ref: 'calCondVariable',
		expression: 'optional'
	};

	var sequentialSelections = {
		type: 'boolean',
		component: 'switch',
		label: translation.label.selectionMode,
		ref: 'sequentialSelections',
		options: [{
			value: false,
			label: translation.label.parallel
		}, {
			value: true,
			label: translation.label.sequential
		}],
		defaultValue: false
	};

	var tooltipInput = {
		ref: "props.tooltip",
		label: translation.label.tooltip,
		type: "string",
		expression: "optional",
		show: function show(data) {
			return data.type !== 'Button Container' && data.type !== 'Button';
		}
	};

	var customSelectionSwitch = {
		type: "boolean",
		component: "switch",
		label: translation.label.selectionLabel,
		ref: "props.isCustomSelection",
		options: [{
			value: true,
			label: translation.label.custom
		}, {
			value: false,
			label: translation.label.predefined
		}],
		defaultValue: false,
		show: function show(data) {
			return data.type !== 'Button Container' && data.type !== 'Button';
		}
	};

	var customSelectionSubSwitch = {
		type: "boolean",
		component: "switch",
		label: translation.label.selectionLabel,
		ref: "props.isCustomSelection",
		options: [{
			value: true,
			label: translation.label.custom
		}, {
			value: false,
			label: translation.label.predefined
		}],
		defaultValue: false
	};

	var selectionLabelInput = {
		ref: "props.selectionLabel",
		label: translation.label.selectionLabel,
		type: "string",
		expression: "optional",
		defaultValue: "",
		show: function show(data) {
			return data.props.isCustomSelection;
		}
	};

	var selectionLabelSubInput = {
		ref: "props.selectionLabel",
		label: translation.label.selectionLabel,
		type: "string",
		expression: "optional",
		defaultValue: "",
		show: function show(data) {
			return data.props.isCustomSelection;
		}
	};

	var conditionInput = {
		ref: "condition",
		label: translation.label.condition,
		type: "string",
		expression: "optional",
		defaultValue: { qStringExpression: "=/*" + " true -> show this condition\n" + " false -> condition is never shown\n" + " $(var) = 1 -> show this condition, if var is equal 1\n" + " if($(var) = 1, true, false); -> show this condition, if var is equal 1 */\n " + "'true'" }
	};

	var itemLabel = {
		ref: "props.itemLabel",
		label: translation.label.label,
		type: "string",
		expression: "optional",
		show: function show(data) {
			return data.type !== 'Button Container' && data.type !== 'Button';
		}
	};

	var variableInput = {
		ref: "props.variableName",
		label: translation.label.variableName,
		type: "string",
		expression: "optional",
		show: function show(data) {
			return data.type === "Variable Dropdown";
		}
	};

	var variableValueInput = {
		ref: "props.variableValue",
		label: translation.label.variableValue,
		type: "string",
		expression: "optional",
		show: function show(data) {
			return data.type !== 'Variable Dropdown';
		}
	};

	var selectItemLabel = {
		ref: "props.itemLabel",
		label: translation.label.label,
		type: "string",
		expression: "optional"
	};

	var sizeSwitch = {
		type: "boolean",
		component: "switch",
		label: translation.label.customSize,
		ref: "props.isCustomSize",
		options: [{
			value: true,
			label: translation.label.custom
		}, {
			value: false,
			label: translation.label.fill
		}],
		defaultValue: false
	};

	var sizeTypeGrp = {
		type: "string",
		component: customCmp.buttongroup,
		label: translation.label.widthSetting,
		ref: "props.sizeType",
		options: [{
			value: "px",
			label: "PX",
			tooltip: translation.tooltip.pixel
		}, {
			value: "%",
			label: "%",
			tooltip: translation.tooltip.percent
		}],
		defaultValue: "%",
		show: function show(data, layout) {
			return data.props.isCustomSize && layout.layout.appearance.orientation === 'btn-inline';
		}
	};

	var widthItemInput = {
		type: "integer",
		label: translation.label.customWidth,
		ref: "props.width",
		defaultValue: 50,
		show: function show(data, layout) {
			return data.props.isCustomSize && layout.layout.appearance.orientation === 'btn-inline';
		}
	};

	var heightItemInput = {
		type: "integer",
		label: translation.label.customHeight,
		ref: "props.height",
		defaultValue: 50,
		show: function show(data, layout) {
			return data.props.isCustomSize && layout.layout.appearance.orientation === 'btn-block';
		}
	};

	var widthInput = {
		type: "integer",
		label: translation.label.panelWidth,
		ref: "appearance.width",
		defaultValue: 150,
		show: function show(data) {
			return data.appearance.orientation === 'btn-block' && data.appearance.widthSetting === 'custom';
		}
	};

	var heightInput = {
		type: "integer",
		label: translation.label.panelHeight,
		ref: "appearance.height",
		defaultValue: 150,
		show: function show(data) {
			return data.appearance.orientation === 'btn-inline' && data.appearance.heightSetting === 'custom';
		}
	};

	var openeEditModal = {
		label: translation.label.stateSettings,
		component: "button",
		action: function action(state, data, extension) {
			openModal(state).then(function (state) {
				extension.model.setProperties(data.properties);
			}).catch(function () {
				console.log("cancel");
			});
		}
	};

	var colorPickerBackground = {
		type: "items",
		component: colorPickerComponent,
		label: translation.label.backgroundColor,
		ref: "appearance.backgroundColor",
		expression: "optional",
		defaultValue: "rgb(245,245,245)"
	};

	var colorPickerSubItemBackground = {
		type: "items",
		component: colorPickerComponent,
		label: translation.label.backgroundColor,
		ref: "appearance.subItemBackgroundColor",
		expression: "optional",
		defaultValue: "rgb(217,217,217)"
	};

	var colorPickerHoverActive = {
		type: "items",
		component: colorPickerComponent,
		label: translation.label.hoverActiveColor,
		ref: "appearance.hoverActiveColor",
		expression: "optional",
		defaultValue: "rgb(159,159,159)"
	};

	var colorPickerHoverSubItem = {
		type: "items",
		component: colorPickerComponent,
		label: translation.label.hoverActiveColor,
		ref: "appearance.hoverSubItemColor",
		expression: "optional",
		defaultValue: "rgb(165,165,165)"
	};

	var colorPickerBorderSeparator = {
		type: "items",
		component: colorPickerComponent,
		label: translation.label.borderSeperatorColor,
		ref: "appearance.borderSeparatorColor",
		expression: "optional",
		defaultValue: "rgb(179,179,179)"
	};

	var colorPickerSubBorderSeparator = {
		type: "items",
		component: colorPickerComponent,
		label: translation.label.borderSeperatorColor,
		ref: "appearance.subItemSeparatorColor",
		expression: "optional",
		defaultValue: "rgb(150,150,150)"
	};

	var colorPickerText = {
		type: "items",
		component: colorPickerComponent,
		label: translation.label.textColor,
		ref: "appearance.textColor",
		expression: "optional",
		defaultValue: "rgb(89,89,89)"
	};

	var colorPickerHoverText = {
		type: "items",
		component: colorPickerComponent,
		label: translation.label.textHoverColor,
		ref: "appearance.textHoverColor",
		expression: "optional",
		defaultValue: "rgb(89,89,89)"
	};

	var colorPickerSubText = {
		type: "items",
		component: colorPickerComponent,
		label: translation.label.textColor,
		ref: "appearance.textSubColor",
		expression: "optional",
		defaultValue: "rgb(89,89,89)"
	};

	var colorPickerHoverSubText = {
		type: "items",
		component: colorPickerComponent,
		label: translation.label.textHoverColor,
		ref: "appearance.textHoverSubColor",
		expression: "optional",
		defaultValue: "rgb(89,89,89)"
	};

	var selectValueCheckbox = {
		type: "boolean",
		label: translation.label.selectDimension,
		ref: "props.alwaysSelectValue",
		defaultValue: false,
		show: function show(data) {
			return data.type === 'Single Select';
		}
	};

	var selectSubValueCheckbox = {
		type: "boolean",
		label: translation.label.selectDimension,
		ref: "props.alwaysSelectValue",
		defaultValue: false
	};

	var selectValueInput = {
		ref: "props.selectValue",
		type: "string",
		expression: "optional",
		show: function show(data) {
			return data.props.alwaysSelectValue;
		}
	};

	var textFamily = {
		type: "items",
		component: MultiOptionsComponent,
		label: translation.label.textFamily,
		ref: "appearance.textFamily",
		expression: "optional",
		options: [{ value: "Arial", label: "Arial" }, { value: "Arial Unicode MS", label: "Arial Unicode MS" }, { value: "Calibri", label: "Calibri" }, { value: "Tahoma", label: "Tahoma" }, { value: "Verdana", label: "Verdana" }, { value: "'QlikView Sans', sans-serif", label: "QlikView Sans" }],
		defaultValue: "QlikView Sans"
	};

	var textWeight = {
		type: "items",
		component: MultiOptionsComponent,
		label: translation.label.textWeight,
		ref: "appearance.textWeight",
		expression: "optional",
		options: [{ value: 'normal', label: 'normal' }, { value: 'bold', label: 'bold' }, { value: 'bolder', label: 'bolder' }, { value: 'lighter', label: 'lighter' }, { value: '100', label: 'number (100-900)' }],
		defaultValue: "bold"
	};

	var textStyle = {
		type: "items",
		component: MultiOptionsComponent,
		label: translation.label.textFont,
		ref: "appearance.textStyle",
		expression: "optional",
		options: [{ value: 'normal', label: 'normal' }, { value: 'italic', label: 'italic' }, { value: 'oblique', label: 'oblique' }],
		defaultValue: "normal"
	};

	var textSize = {
		type: "integer",
		label: translation.label.textSize,
		ref: "appearance.textSize",
		expression: "optional",
		defaultValue: 13
	};

	var textSelectionFamily = {
		type: "items",
		component: MultiOptionsComponent,
		label: translation.label.textFamily,
		ref: "appearance.textSelectionFamily",
		expression: "optional",
		options: [{ value: "Arial", label: "Arial" }, { value: "Arial Unicode MS", label: "Arial Unicode MS" }, { value: "Calibri", label: "Calibri" }, { value: "Tahoma", label: "Tahoma" }, { value: "Verdana", label: "Verdana" }, { value: "'QlikView Sans', sans-serif", label: "QlikView Sans" }],
		defaultValue: "QlikView Sans"
	};

	var textSelectionWeight = {
		type: "items",
		component: MultiOptionsComponent,
		label: translation.label.textWeight,
		ref: "appearance.textSelectionWeight",
		expression: "optional",
		options: [{ value: 'normal', label: 'normal' }, { value: 'bold', label: 'bold' }, { value: 'bolder', label: 'bolder' }, { value: 'lighter', label: 'lighter' }, { value: '100', label: 'number (100-900)' }],
		defaultValue: "normal"
	};

	var textSelectionStyle = {
		type: "items",
		component: MultiOptionsComponent,
		label: translation.label.textFont,
		ref: "appearance.textSelectionStyle",
		expression: "optional",
		options: [{ value: 'normal', label: 'normal' }, { value: 'italic', label: 'italic' }, { value: 'oblique', label: 'oblique' }],
		defaultValue: "normal"
	};

	var textSelectionSize = {
		type: "integer",
		label: translation.label.textSize,
		ref: "appearance.textSelectionSize",
		expression: "optional",
		defaultValue: 11
	};

	var gapTop = {
		type: "boolean",
		component: "switch",
		label: translation.label.gapTop,
		ref: "appearance.gapTop",
		options: [{
			value: true,
			label: translation.label.custom
		}, {
			value: false,
			label: translation.label.auto
		}],
		defaultValue: false
	};

	var gapTopSize = {
		type: "integer",
		label: translation.label.gapTopSize,
		ref: "appearance.gapTopSize",
		expression: "optional",
		show: function show(data) {
			if (data.appearance) {
				return data.appearance.gapTop === true;
			}
		},
		defaultValue: 0
	};

	var gapBottom = {
		type: "boolean",
		component: "switch",
		label: translation.label.gapBottom,
		ref: "appearance.gapBottom",
		options: [{
			value: true,
			label: translation.label.custom
		}, {
			value: false,
			label: translation.label.auto
		}],
		defaultValue: false
	};

	var gapBottomSize = {
		type: "integer",
		label: translation.label.gapBottomSize,
		ref: "appearance.gapBottomSize",
		expression: "optional",
		show: function show(data) {
			if (data.appearance) {
				return data.appearance.gapBottom === true;
			}
		},
		defaultValue: 0
	};

	var gapRight = {
		type: "boolean",
		component: "switch",
		label: translation.label.gapRight,
		ref: "appearance.gapRight",
		options: [{
			value: true,
			label: translation.label.custom
		}, {
			value: false,
			label: translation.label.auto
		}],
		defaultValue: false
	};

	var gapRightSize = {
		type: "integer",
		label: translation.label.gapRightSize,
		ref: "appearance.gapRightSize",
		expression: "optional",
		show: function show(data) {
			if (data.appearance) {
				return data.appearance.gapRight === true;
			}
		},
		defaultValue: 0
	};

	var gapLeft = {
		type: "boolean",
		component: "switch",
		label: translation.label.gapLeft,
		ref: "appearance.gapLeft",
		options: [{
			value: true,
			label: translation.label.custom
		}, {
			value: false,
			label: translation.label.auto
		}],
		defaultValue: false
	};

	var gapLeftSize = {
		type: "integer",
		label: translation.label.gapLeftSize,
		ref: "appearance.gapLeftSize",
		expression: "optional",
		show: function show(data) {
			if (data.appearance) {
				return data.appearance.gapLeft === true;
			}
		},
		defaultValue: 0
	};

	var iconsDropdown = {
		type: "items",
		show: function show(data) {
			return data.type !== 'Button Container' && data.type !== 'Button' && data.type !== 'Button Dropdown';
		},
		items: {
			MyDropdownProp: {
				type: "string",
				component: "dropdown",
				label: translation.label.icon,
				ref: "props.icon",
				options: icons,
				defaultValue: "noIcon"
			}
		}
	};

	var orientationGroup = {
		type: "string",
		component: customCmp.buttongroup,
		label: translation.label.orientation,
		ref: "appearance.orientation",
		options: [{
			value: "btn-block",
			label: translation.label.vertical
		}, {
			value: "btn-inline",
			label: translation.label.horizontal
		}],
		defaultValue: "btn-block"
	};

	var verticalAlignmentDropdown = {
		type: "items",
		items: {
			MyDropdownProp: {
				type: "string",
				component: "dropdown",
				label: translation.label.verticalAlignment,
				ref: "appearance.verticalAlignment",
				options: [{
					value: "center",
					label: translation.label.center
				}, {
					value: "left",
					label: translation.label.left
				}, {
					value: "right",
					label: translation.label.right
				}],
				defaultValue: "center"
			}
		},
		show: function show(data) {
			return data.appearance.widthSetting === 'custom';
		}
	};

	var widthButtonGrp = {
		type: "string",
		component: customCmp.buttongroup,
		label: translation.label.widthSetting,
		ref: "appearance.widthSetting",
		options: [{
			value: "full",
			label: translation.label.fill,
			tooltip: translation.tooltip.fullWidth
		}, {
			value: "custom",
			label: translation.label.custom,
			tooltip: translation.tooltip.customWidth
		}],
		defaultValue: "full",
		show: function show(data) {
			return data.appearance.orientation === 'btn-block';
		}
	};

	var vertHeightButtonGrp = {
		type: "string",
		component: customCmp.buttongroup,
		label: translation.label.heightSetting,
		ref: "appearance.vertHeightSetting",
		options: [{
			value: "100%",
			label: translation.label.fill,
			tooltip: translation.tooltip.fullWidth
		}, {
			value: "auto",
			label: translation.label.auto,
			tooltip: translation.tooltip.customWidth
		}],
		defaultValue: "100%",
		show: function show(data) {
			return data.appearance.orientation === 'btn-block';
		}
	};

	var heightButtonGrp = {
		type: "string",
		component: customCmp.buttongroup,
		label: translation.label.heightSetting,
		ref: "appearance.heightSetting",
		options: [{
			value: "full",
			label: translation.label.fill,
			tooltip: translation.tooltip.fullHeight
		}, {
			value: "custom",
			label: translation.label.custom,
			tooltip: translation.tooltip.fullWidth
		}],
		defaultValue: "full",
		show: function show(data) {
			return data.appearance.orientation === 'btn-inline';
		}
	};

	var textOrientationGrp = {
		type: "string",
		component: customCmp.buttongroup,
		label: translation.label.textLayout,
		ref: "props.textLayout",
		options: [{
			value: "single",
			label: translation.label.single
		}, {
			value: "multi",
			label: translation.label.multi
		}],
		defaultValue: "single",
		show: function show(data) {
			return data.type !== 'Button' && data.type !== 'Button Container';
		}
	};

	var alignmentHorizontalLabel = {
		type: "string",
		component: customCmp.buttongroup,
		label: translation.label.labelAlignementHorizontal,
		ref: "props.horAlignLabel",
		options: [{
			value: "flex-start",
			label: translation.label.left,
			tooltip: translation.tooltip.left
		}, {
			value: "center",
			label: translation.label.center,
			tooltip: translation.tooltip.center
		}, {
			value: "flex-end",
			label: translation.label.right,
			tooltip: translation.tooltip.right
		}],
		defaultValue: "center",
		show: function show(data) {
			return data.type !== 'Button' && data.type !== 'Button Container';
		}
	};

	var alignmentVerticalValue = {
		type: "string",
		component: customCmp.buttongroup,
		label: translation.label.labelAlignementVertical,
		ref: "props.verAlignLabel",
		options: [{
			value: "flex-start",
			label: translation.label.top,
			tooltip: translation.tooltip.top
		}, {
			value: "center",
			label: translation.label.center,
			tooltip: translation.tooltip.center
		}, {
			value: "flex-end",
			label: translation.label.bottom,
			tooltip: translation.tooltip.bottom
		}],
		defaultValue: "center",
		show: function show(data) {
			return data.type !== 'Button' && data.type !== 'Button Container';
		}
	};

	var alignmentHorizontalSelectionLabel = {
		type: "string",
		component: customCmp.buttongroup,
		label: translation.label.selectionLabelAlignementHorizontal,
		ref: "props.horAlignSelectionLabel",
		options: [{
			value: "flex-start",
			label: translation.label.left,
			tooltip: translation.tooltip.left
		}, {
			value: "center",
			label: translation.label.center,
			tooltip: translation.tooltip.center
		}, {
			value: "flex-end",
			label: translation.label.right,
			tooltip: translation.tooltip.right
		}],
		defaultValue: "center",
		show: function show(data) {
			return data.props.textLayout === 'multi';
		}
	};

	var alignmentVerticalSelectionValue = {
		type: "string",
		component: customCmp.buttongroup,
		label: translation.label.selectionLabelAlignementVertical,
		ref: "props.verAlignSelectionLabel",
		options: [{
			value: "flex-start",
			label: translation.label.top,
			tooltip: translation.tooltip.top
		}, {
			value: "center",
			label: translation.label.center,
			tooltip: translation.tooltip.center
		}, {
			value: "flex-end",
			label: translation.label.bottom,
			tooltip: translation.tooltip.bottom
		}],
		defaultValue: "center",
		show: function show(data) {
			return data.props.textLayout === 'multi';
		}
	};

	var selectDimensions = {
		type: "items",
		show: function show(data) {
			return data.type === "Sense Select" || data.type === "Single Select";
		},
		items: {
			MyDropdownProp: {
				type: "string",
				component: "dropdown",
				label: translation.label.dimension,
				ref: "props.dim",
				change: function change(data, app, layout) {
					data.props.hicoPrevSelectDimension = data.props.hicoPrevSelectDimension || '';
					if (data.props.itemLabel === '' || data.props.itemLabel === data.props.hicoPrevSelectDimension) {
						data.props.itemLabel = data.props.dim;
					}
					data.props.hicoPrevSelectDimension = data.props.dim;

					app.layout.dimensions.some(function (dimension) {
						if (dimension.dimTitle === data.props.dim) {
							data.props.dimTitle = dimension.dimTitle;
						}
					});
				},
				options: function options(data, app, layout) {
					return layout.layout.dimensions && layout.layout.dimensions.map(function (item) {
						return {
							value: item.dimTitle,
							label: item.dimTitle
						};
					}).sort(compare) || [];
				},
				defaultValue: ""
			}
		}
	};

	var selectSubDimensions = {
		type: "items",
		items: {
			MyDropdownProp: {
				type: "string",
				component: "dropdown",
				label: translation.label.dimension,
				ref: "props.dim",
				change: function change(data, app, layout) {
					data.props.hicoPrevSelectSubDimension = data.props.hicoPrevSelectSubDimension || '';
					if (data.props.itemLabel === '' || data.props.itemLabel === data.props.hicoPrevSelectSubDimension) {
						data.props.itemLabel = data.props.dim;
					}
					data.props.hicoPrevSelectSubDimension = data.props.dim;

					app.layout.dimensions.some(function (dimension) {
						if (dimension.dimTitle === data.props.dim) {
							data.props.dimTitle = dimension.dimTitle;
						}
					});
				},
				options: function options(data, app, layout) {
					return layout.layout.dimensions && layout.layout.dimensions.map(function (item) {
						return {
							value: item.dimTitle,
							label: item.dimTitle
						};
					}).sort(compare) || [];
				},
				defaultValue: translation.label.noDimension
			}
		}
	};

	var typeDropdown = {
		type: "items",
		items: {
			MyDropdownProp: {
				type: "string",
				component: "dropdown",
				label: translation.label.type,
				ref: "type",
				options: [{
					value: "Button",
					label: translation.label.button
				}, {
					value: "Button Container",
					label: translation.label.buttonContainer
				}, {
					value: "Button Dropdown",
					label: translation.label.buttonDropdown
				}, {
					value: "Multi Select",
					label: translation.label.multiSelect
				}, {
					value: "Single Select",
					label: translation.label.singleSelect
				}, {
					value: "Sense Select",
					label: translation.label.senseSelect
				}, {
					value: "Variable Dropdown",
					label: translation.label.variableDropdown
					//, {
					//	value: "Calendar",
					//	label: "Calendar"
					//}
				}],
				defaultValue: "Button Container"
			}
		}
	};

	var stateItem = {
		type: "items",
		defaultValue: new State()
	};

	var stateItems = {
		component: customCmp.list,
		type: "array",
		ref: "stateItems",
		label: translation.label.states,
		itemTitleRef: function itemTitleRef(data) {
			if (data.props && data.props.conditionName) {
				return data.props.conditionName;
			} else {
				return data.condition;
			}
		},
		allowAdd: true,
		allowRemove: false,
		add: function add(data, layout, model) {
			var state = new State();
			delete state.condition;

			angular.extend(data, state);

			model.setProperties(model.properties);
		},
		addTranslation: translation.label.addState,
		items: {
			conditionInput: conditionInput,
			conditionNameInput: conditionNameInput,
			openEditModal: openeEditModal,
			state: stateItem
		},
		defaultValue: [stateItem.defaultValue]
	};

	var buttonItem = {
		type: "items",
		items: {
			buttonNameInput: {
				ref: "props.buttonName",
				label: translation.label.buttonNameInput,
				type: "string",
				expression: "",
				show: function show(data) {
					return data.type !== 'Button';
				}
			},
			stateItems: stateItems
		},
		defaultValue: {
			props: {
				buttonName: 'My Button'
			},
			stateItems: stateItems.defaultValue
		}
	};

	var buttonItems = {
		component: customCmp.list,
		type: "array",
		ref: "subItems",
		itemTitleRef: 'props.buttonName',
		add: function add(data) {
			data.props.buttonName = data.stateItems[0].text;
		},
		allowAdd: true,
		allowRemove: false,
		addTranslation: translation.label.addButton,
		items: {
			buttonItem: buttonItem
		},
		defaultValue: [buttonItem.defaultValue]
	};

	var singleButton = {
		type: "items",
		show: function show(data) {
			return data.type === "Button" || data.subType === "Button";
		},
		items: {
			buttonItem: buttonItem
		}
	};

	var variableDropdown = {
		type: "items",
		show: function show(data) {
			return data.type === "Variable Dropdown";
		},
		items: {
			MyList: {
				component: customCmp.list,
				type: "array",
				ref: "variableItems",
				itemTitleRef: "props.itemLabel",
				allowAdd: true,
				allowRemove: false,
				addTranslation: translation.label.addVariableValue,
				items: {
					variableInput: variableValueInput,
					textOrientationDropdown: textOrientationGrp,
					valueLabel: myTextBox,
					alignmentHorizontalLabel: alignmentHorizontalLabel,
					alignmentVerticalLabel: alignmentVerticalValue,
					customSelectionSubSwitch: customSelectionSubSwitch,
					selectionLabelSubInput: selectionLabelSubInput,
					alignmentHorizontalSelectionLabel: alignmentHorizontalSelectionLabel,
					alignmentVerticalSelectionValue: alignmentVerticalSelectionValue,
					tooltipInput: tooltipInput,
					iconsDropdown: iconsDropdown
				}
			}
		}
	};

	var buttonDropdown = {
		type: "items",
		show: function show(data) {
			return data.type === "Button Dropdown" || data.subType === "Button Dropdown";
		},
		items: {
			MyList: {
				component: customCmp.list,
				type: "array",
				ref: "dropdownItems",
				label: translation.label.dropdownItems,
				itemTitleRef: 'props.buttonName',
				add: function add(data) {
					data.props.buttonName = data.stateItems[0].text;
				},
				allowAdd: true,
				allowRemove: false,
				addTranslation: translation.label.addDropdownItem,
				items: {
					buttonItem: buttonItem
				},
				defaultValue: [buttonItem.defaultValue]
			}
		}
	};

	var buttonContainer = {
		type: "items",
		show: function show(data) {
			return data.type === "Button Container";
		},
		itemTitleRef: 'props.buttonName',
		items: {
			buttons: buttonItems
		}
	};

	var multiSelect = {
		type: "items",
		show: function show(data) {
			return data.type === "Multi Select";
		},
		items: {
			MyList: {
				component: customCmp.list,
				type: "array",
				ref: "selectItems",
				itemTitleRef: function itemTitleRef(data) {
					if (data.props.itemLabel === '') {
						return data.props.dim;
					} else {
						return data.props.itemLabel;
					}
				},
				allowAdd: true,
				allowRemove: false,
				addTranslation: translation.label.addSingleSelect,
				items: {
					selectDimension: selectSubDimensions,
					selectSubValueCheckbox: selectSubValueCheckbox,
					selectValueInput: selectValueInput,
					textOrientationDropdown: textOrientationGrp,
					iconsDropdown: iconsDropdown,
					labelInput: selectItemLabel,
					alignmentHorizontalLabel: alignmentHorizontalLabel,
					alignmentVerticalLabel: alignmentVerticalValue,
					customSelectionSubSwitch: customSelectionSubSwitch,
					selectionLabelInput: selectionLabelSubInput,
					alignmentHorizontalSelectionLabel: alignmentHorizontalSelectionLabel,
					alignmentVerticalSelectionValue: alignmentVerticalSelectionValue,
					tooltipInput: tooltipInput

				}
			}
		}
	};

	var panelList = {
		component: customCmp.list,
		type: "array",
		ref: "listItems",
		itemTitleRef: function itemTitleRef(data) {

			if (data.props && data.props.buttonName) {
				return data.props.buttonName;
			}

			if (data.type === 'Single Select' || data.type === 'Sense Select') {
				return data.type + ': ' + data.props.dim;
			} else if (data.type === 'Variable Dropdown') {
				return data.type + ': ' + data.props.variableName;
			}
			return data.type;
		},
		allowAdd: true,
		allowRemove: false,
		allowMove: true,
		addTranslation: translation.label.addItem,
		items: {
			typedropwdown: typeDropdown,
			buttonNameInput: buttonNameInput,
			variableName: variableInput,
			selectDimension: selectDimensions,
			selectValueCheckbox: selectValueCheckbox,
			selectValueInput: selectValueInput,
			widthSwitch: sizeSwitch,
			sizeTypeGrp: sizeTypeGrp,
			widthItemInput: widthItemInput,
			heightItemInput: heightItemInput,
			textOrientationDropdown: textOrientationGrp,
			iconsDropdown: iconsDropdown,
			labelInput: itemLabel,
			alignmentHorizontalLabel: alignmentHorizontalLabel,
			alignmentVerticalLabel: alignmentVerticalValue,
			customSelectionSwitch: customSelectionSwitch,
			selectionLabelInput: selectionLabelInput,
			alignmentHorizontalSelectionLabel: alignmentHorizontalSelectionLabel,
			alignmentVerticalSelectionValue: alignmentVerticalSelectionValue,
			tooltipInput: tooltipInput,
			variableArray: variableDropdown,
			stateItems: singleButton,
			dropdownItems: buttonDropdown,
			selectItemsArray: multiSelect,
			itemsArray: buttonContainer
		}

	};

	// *****************************************************************************
	// Panel section
	// *****************************************************************************
	var panelDefinitionSection = {
		label: translation.label.items,
		type: "items",
		items: {
			panelList: panelList

		}
	};

	// *****************************************************************************
	// Main properties panel definition
	// Only what is defined here is returned from properties.js
	// *****************************************************************************
	return {
		type: "items",
		component: "accordion",
		items: {
			dimension: {
				label: translation.label.dimensions,
				type: "items",
				items: {
					list: {
						component: customCmp.list,
						type: "array",
						ref: "dimensions",
						itemTitleRef: function itemTitleRef(data) {
							if (data.dimTitle) {
								return data.dimTitle;
							} else {
								return translation.label.noDimensions;
							}
						},
						allowAdd: true,
						allowRemove: false,
						allowMove: true,
						addTranslation: translation.label.addDimension,
						items: {
							dim: dimensionDropdown,
							dimensionString: dimensionName,
							dimensionStringMaster: dimensionStringMaster,
							dimensionTitelString: dimensionTitle,
							customSortOrder: customSortOrder,
							seperator: seperator,
							qSortByLoadOrderCheckbox: qSortByLoadOrderCheckbox,
							qSortByLoadOrder: qSortByLoadOrder,
							seperator1: seperator,
							qSortByStateCheckbox: qSortByStateCheckbox,
							qSortByState: qSortByState,
							seperator2: seperator,
							qSortByFrequencyCheckbox: qSortByFrequencyCheckbox,
							qSortByFrequency: qSortByFrequency,
							seperator3: seperator,
							qSortByNumericCheckbox: qSortByNumericCheckbox,
							qSortByNumeric: qSortByNumeric,
							seperator4: seperator,
							qSortByAsciiCheckbox: qSortByAsciiCheckbox,
							qSortByAscii: qSortByAscii,
							seperator5: seperator,
							qSortByExpressionCheckbox: qSortByExpressionCheckbox,
							sortExpression: sortExpression,
							qSortByExpression: qSortByExpression
						}
					}
				}
			},

			panelsettings: panelDefinitionSection,

			addons: {
				uses: 'addons',
				items: {
					dataHandling: {
						uses: "dataHandling",
						items: {
							suppressZero: {
								show: false
							},
							calcCond: {
								show: true
							},
							calcCondVar: calcCondVar
						}
					},
					selectionHandling: {
						type: 'items',
						label: translation.label.selectionHandling,
						items: {
							sequentialSelections: sequentialSelections
						}
					}
				}
			},

			settings: {
				uses: "settings",
				items: {
					general: {
						items: {
							showTitles: {
								defaultValue: false
							}
						}
					},
					layout: {
						type: "items",
						label: translation.label.layout,
						items: {
							myTextBox1: orientationGroup,
							widthSetting: widthButtonGrp,
							vertHeightButtonGrp: vertHeightButtonGrp,
							heightSetting: heightButtonGrp,
							width: widthInput,
							height: heightInput
						}
					},
					gaps: {
						type: "items",
						label: translation.label.gaps,
						items: {
							gapTop: gapTop,
							gapTopSize: gapTopSize,
							seperator: seperator,
							gapBottom: gapBottom,
							gapBottomSize: gapBottomSize,
							seperator1: seperator,
							gapLeft: gapLeft,
							gapLeftSize: gapLeftSize,
							seperator2: seperator,
							gapRight: gapRight,
							gapRighttSize: gapRightSize

						}
					},
					colors: {
						type: "items",
						label: translation.label.colors,
						items: {
							seperatorLabelColorMain: seperatorLabelColorMain,
							verticalAlignment: verticalAlignmentDropdown,
							backgroundColorPicker: colorPickerBackground,
							hoverActiveColorPicker: colorPickerHoverActive,
							textColorPicker: colorPickerText,
							colorPickerHoverText: colorPickerHoverText,
							borderSeparatorColorPicker: colorPickerBorderSeparator,

							seperatorLabelColorSub: seperatorLabelColorSub,
							subItemBackgroundColorPicker: colorPickerSubItemBackground,
							hoverSubItemColorPicker: colorPickerHoverSubItem,
							colorPickerSubText: colorPickerSubText,
							colorPickerHoverSubText: colorPickerHoverSubText,
							subItemSeparatorColorPicker: colorPickerSubBorderSeparator
						}
					},
					text: {
						type: "items",
						label: translation.label.text,
						items: {
							seperatorLabelTextLabel: seperatorLabelTextLabel,
							textFamily: textFamily,
							textWeight: textWeight,
							textStyle: textStyle,
							textSize: textSize,

							seperatorLabelTextSub: seperatorLabelTextSub,
							textSelectionFamily: textSelectionFamily,
							textSelectionWeight: textSelectionWeight,
							textSelectionStyle: textSelectionStyle,
							textSelectionSize: textSelectionSize
						}
					},
					display: {
						type: 'items',
						label: translation.label.display,
						items: {
							menuBar: createDisplayBtnGrp('appearance.displaySenseMenuBar', translation.label.senseMenuBar),
							menuBarExpr: createDisplayExpression('appearance.displaySenseMenuBarExpr', '', function (data) {
								return data.appearance && data.appearance.displaySenseMenuBar === '2';
							}),
							seperator: seperator,
							selectionBar: createDisplayBtnGrp('appearance.displaySenseSelectionBar', translation.label.senseSelectionBar),
							selectionBarExpr: createDisplayExpression('appearance.displaySenseSelectionBarExpr', '', function (data) {
								return data.appearance && data.appearance.displaySenseSelectionBar === '2';
							}),
							seperator1: seperator,
							titleBar: createDisplayBtnGrp('appearance.displaySenseTitleBar', translation.label.senseTitleBar),
							titleBarExpr: createDisplayExpression('appearance.displaySenseTitleBarExpr', '', function (data) {
								return data.appearance && data.appearance.displaySenseTitleBar === '2';
							})
						}
					},
					information: {
						type: "items",
						label: translation.label.information,
						items: {
							information: information
						}
					}
				}
			}
		}
	};

	/**
  * Customize properties panel components
  * @return {object} Object with custom components identifiers
  */
	function customizePPComponents() {
		var custom = useCustomComponents(true);

		try {
			require(['client.property-panel/components/components', 'client.property-panel/components/list/list', 'client.property-panel/components/buttongroup/buttongroup'], function (components) {
				var cmp;

				// customize buttongroup component
				cmp = angular.merge({}, require('client.property-panel/components/buttongroup/buttongroup'));
				cmp.template = cmp.template.replace('class="lui-button"', 'class="hico-button lui-button"');
				components.addComponent(custom.buttongroup, cmp);

				// improve qlik sense 'list' component, which is used for properties of type === 'array'
				cmp = angular.merge({}, require('client.property-panel/components/list/list'));
				cmp.template = cmp.template
				// fix "watchers-bug" in properties panel list component
				.replace('ng-show="item.expanded"', 'ng-if="item.expanded"')
				// also change padding settings
				.replace('ng-if="item.expanded"', 'ng-if="item.expanded" style="padding: 5px"')
				// and add missing feature: hide remove button, when allowRemove === false
				.replace('qva-activate="removeItem(item.index)"', 'qva-activate="removeItem(item.index)" ng-if="definition.allowRemove"');
				components.addComponent(custom.list, cmp);
			});
		} catch (err) {
			return useCustomComponents(false); // use default components
		}

		return custom;

		/**
   * Returns an object with custom component identifiers
   * @param yes {boolean} Decides which components should be returned
   * @return {*} If true, returns custom identifiers, otherwise default identifiers will be used
   */
		function useCustomComponents(yes) {
			return {
				list: yes ? 'hico-list' : 'list',
				buttongroup: yes ? 'hico-buttongroup' : 'buttongroup'
			};
		}
	}
});