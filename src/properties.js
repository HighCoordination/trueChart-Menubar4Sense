import * as angular from 'angular';
import * as qvangular from 'qvangular';
import * as qlik from 'qlik';
import * as $timeout from 'ng!$timeout';
import * as tinycolor from 'tinycolor2';
import './lib/colorsliders/bootstrap.colorpickersliders';

import * as QlikService from './lib/hico/services/qlik-service';
import * as informationTemplate from './templates/informationComponent.html';
import * as colorPickerInputTemplate from './templates/colorPickerInputComponent.html';
import * as multiOptionsTemplate from './templates/multiOptionsComponent.html';
import * as selectComponentTemplate from './templates/selectComponent.html';
import * as seperatorLabelTemplate from './templates/seperatorLabelComponent.html';

import * as faIcons from './lib/general/icons-fa';
import {translation} from '../resource/translations/translations';

// make tinycolor available for bootstraps colorpickersliders
window.tinycolor = tinycolor;

// configure requirejs (MUST be "requirejs" instead of "require" otherwise webpack will handle it and it wouldn't work as expected)
requirejs.config({
	// extend require config and specify bundles configuration for qs-components in case of mashups, where client.js isn't loaded by default
	bundles: {
		'assets/client/client': [
			'client.property-panel/components/components',
			'client.property-panel/components/list/list',
			'client.property-panel/components/string/string',
			'client.property-panel/components/buttongroup/buttongroup'
		]
	}
});

function Properties(){
	const qlikService = QlikService.getInstance(),

		// Customize components for properties panel
		customCmp = customizePPComponents();

	function _getRefs(data, refName) {
		var ref = data;
		var name = refName;
		var props = refName.split('.');
		if(props.length > 0) {
			for(var i = 0; i < props.length - 1; ++i) {
				if(ref[props[i]])
					ref = ref[props[i]];
			}
			name = props[props.length - 1];
		}
		return {ref: ref, name :name};
	}

	function setRefValue(data, refName, value) {
		var  obj = _getRefs(data, refName);
		obj.ref[obj.name] = value;
	}

	function getRefValue(data, refName) {
		var obj = _getRefs(data, refName);
		return obj.ref[obj.name];
	}

	function createDisplayBtnGrp(ref, label){
		return {
			type: "string",
			component: customCmp.buttongroup,
			label: label,
			ref: ref,
			options: [
				{
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
				}
			],
			defaultValue: "1"
		};
	}

	function createDisplayExpression(ref, label, show){
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
		template: "<div class='pp-component'><div class='lui-label'>{{translation.label.dimension}}</div>"
		+ "<input type='text' class='lui-input lui-disabled hico-property-seperator' disabled='disabled' value='{{data.dimTitle}}'/>"
		+ "</div>",
		controller: ['$scope', '$element', function(scope){
			scope.translation = translation;
			scope.$emit("saveProperties");
		}]
	};

	var informationComponent = {
		template: informationTemplate,
		controller: ['$scope', '$element', function(scope){
			scope.translation = translation;
		}]
	};

	const colorPickerComponent = !qlikService.inClient() ? 'string' : {
		template: colorPickerInputTemplate,
		controller: ['$scope', '$element', function(scope, $element){
			scope.showColorPicker = false;
			scope.qComponents = {
				string: requirejs('client.property-panel/components/string/string')
			};
			scope.text = {type: 'string', ref: scope.definition.ref, expression: 'optional'};
			scope.obj = _getRefs(scope.data, scope.definition.ref);
			scope.activeState = 'swatches';
			scope.colors = ['#FFFFFF', '#D9D9D9', '#B3B3B3', '#808080', '#4D4D4D', '#333333', '#000000', '#a8d7f0', '#52a2cc', '#214152', '#c0dca9', '#61a729',
							'#274310', '#fcd6a5', '#f8981d', '#633d0c', '#db94ca', '#cc66b3', '#522948', '#ffb0b0', '#f05555', '#522121', '#ffdd68', '#ffce26',
							'#66520f'
			];

			scope.isData = true;

			scope.$on("datachanged", function () {
				scope.isData = true;
				var refValue = getRefValue(scope.args.layout, scope.definition.ref);

				refValue = convertIfSense(refValue);

				$element.find("#hsvflat_" + scope.$id).trigger("colorpickersliders.updateColor", refValue);
				$element.find("#colorPalette_" + scope.$id).css("background-color", refValue);
				setPaletteIconColor(refValue);

			});

			scope.setColor = function(color){
				var tinColor = tinycolor(color);
				setRefValue(scope.data, scope.definition.ref, tinColor.toRgbString());
				$element.find("#colorPalette_" + scope.$id).css("background-color", tinColor.toRgbString());
				$element.find("#colorPaletteIcon_" + scope.$id).css("color", tinycolor.mostReadable( tinColor , ['#595959', '#fff']).toHexString());
				scope.$emit("saveProperties");
			};

			$timeout(function() {
				$element.find("#hsvflat_" + scope.$id).ColorPickerSliders(
					{
						color: convertIfSense(getRefValue(scope.args.layout, scope.definition.ref)),
						flat: true,
						sliders: false,
						swatches: false,
						hsvpanel: true,
						grouping: false,
						onchange: function(container, color){
							$timeout(function() {
								if(!scope.isData){
									setRefValue(scope.data, scope.definition.ref, color.tiny.toRgbString());
								}
								scope.isData = false;

								$element.find("#colorPalette_" + scope.$id).css("background-color",color.tiny.toRgbString());
								setPaletteIconColor(color);

								scope.$emit("saveProperties");

							});
						}
					});
			});

			function convertIfSense(colorString){
				if(colorString.indexOf("ARGB") > -1){
					var opcaityLength = colorString.indexOf(',') - colorString.indexOf('(') - 1;
					var opacity = Number(colorString.substr(colorString.indexOf('(') + 1,opcaityLength)) / 255;

					return'rgba(' + colorString.substr(colorString.indexOf(',') + 1, colorString.length - colorString.indexOf(',') - 2) + ',' +opacity + ')';
				}else{
					return colorString
				}
			}

			function setPaletteIconColor(color){
				var colorObj = {};

				if(!color.tiny){
					colorObj.tiny = tinycolor(color);
				}else{
					colorObj = color;
				}

				if(colorObj.tiny.getAlpha() < 0.5){
					$element.find("#colorPaletteIcon_" + scope.$id).css("color", '#595959');
				}else{
					$element.find("#colorPaletteIcon_" + scope.$id).css("color", tinycolor.mostReadable( colorObj.tiny , ['#595959', '#fff']).toHexString());
				}
			}

		}]
	};

	const MultiOptionsComponent = {
		template: multiOptionsTemplate,
		controller: ['$scope', function(scope){
			scope.refValue = getRefValue(scope.data, scope.definition.ref);
			scope.qComponents = {
				string: requirejs('client.property-panel/components/string/string')
			};
			scope.text = {type: 'string', ref: scope.definition.ref, expression: 'optional'};
			scope.options = [];

			scope.definition.options.some(function(option){
				if(option.value === scope.refValue){
					scope.refValue = option;
					return true;
				}
			});

			scope.update = function(){
				setRefValue(scope.data, scope.definition.ref, scope.refValue.value);

				if(scope.definition.change){
					scope.definition.change(scope.data)
				}

				scope.$emit("saveProperties");
			};
		}]
	};

	const selectComponent = {
		template: selectComponentTemplate,
		controller: ['$scope', function(scope){
			scope.show = scope.definition.show && scope.definition.show(scope.data, scope.args.handler);
			scope.options = [];

			if(typeof scope.definition.options === 'function'){
				scope.options = scope.definition.options(scope.data, scope.args.handler);
			}else{
				scope.options = scope.definition.options;
				scope.definition.options.some(function(option){
					if(option.value === scope.refValue){
						scope.refValue = option;
						return true;
					}
				});
			}

			scope.refValue = scope.options[getRefValue(scope.data, scope.definition.ref) || scope.definition.defaultValue];

			scope.update = function(){
				setRefValue(scope.data, scope.definition.ref, scope.refValue.value);

				if(scope.definition.change){
					scope.definition.change(scope.data)
				}

				scope.$emit("saveProperties");
			};
		}]
	};

	function compare(a,b) {
		if (a.label < b.label)
			return -1;
		if (a.label > b.label)
			return 1;
		return 0;
	}

	var icons = [];
	icons.push({value: 'noIcon', label: translation.label.noIcon});
	for(var key in faIcons){
		faIcons.hasOwnProperty(key) && icons.push({value: key, label: faIcons[key]});
	}

	function openModal(state){
		return qlik.Promise(function(resolve, reject){
			const scope = qvangular.$rootScope.$new();
			scope.state = state;
			scope.condition = state.condition.qStringExpression ? state.condition.qStringExpression.qExpr : state.condition;

			const compile = qvangular.getService('$compile'),
				template = '<div data-tcmenu-button-editor condition="condition" state="state" trans="trans" is-true="isTrue"></div>',
				$editor = compile(template)(scope);

			$editor.on('apply', function(evt){
				angular.extend(state, evt.state);
				resolve(evt.state);
				if(!scope.$$phase) {
					try{
						scope.$apply();
					}catch(err){
						console.log(err);
					}
				}
			});

			$editor.on('cancel', function(evt){
				reject();
			});

			if(document.body.childNodes.length > 0){
				document.body.insertBefore($editor[0], document.body.childNodes[0]);
			}else{
				document.body.appendChild($editor[0]);
			}
		});
	}

	function State(){
		this.version = 1;

		this.text = 'My Button';
		this.tooltip = undefined;
		this.icon = undefined;
		this.buttonType = 'simple';
		this.buttonState = undefined;

		this.condition = conditionInput.defaultValue;

		this.triggers = [
			{
				type: 'click',
				actions: [
					{
						name: 'none',
						params: {},
						paramsExpr: {}
					}
				]
			}
		];

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
				position: {x: undefined, y: undefined},
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
			vAlign: undefined,  // {string} vertical alignment of the button inside its container -> 'middle'
			hAlign: undefined,  // {string} horizontal alignment of the button inside its container -> 'center'
			vTextAlign: undefined,  // {string} vertical alignment of the button inside its container -> 'middle'
			hTextAlign: undefined,  // {string} horizontal alignment of the button inside its container -> 'center'
			vContentAlign: undefined,
			hContentAlign: undefined,
			width: '100%',   // {string} width of the button -> 'auto'
			height: '100%',  // {string} height of the button -> 'default style'
			icon: {
				position: undefined // {string} left|right|top|bottom -> undefined -> left as default
			}
		};
	}

	// *****************************************************************************
	// Custom Definitions
	// *****************************************************************************

	var information = {
		type: "items",
		component: informationComponent,
		ref: ""
	};

	/*const repairButton = {
		label: translation.label.repairBtn,
		tooltip: translation.label.repairBtnTp,
		component: "button",
		action: function(data){
			UpdateService.repairMenus(_app.model.layout.published === true);
		}
	};*/



	const seperator = {
		type: "string",
		component: seperatorComponent,
		ref: ""
	};

	const seperatorSort = {
		type: "string",
		component: seperatorComponent,
		ref: "",
		show: function (item) {
			return !item.qDef.autoSort;
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

	let customSortOrder = {
		type: "boolean",
		ref: "qDef.autoSort",
		component: "switch",
		label: translation.label.sortOrder,
		defaultValue: true,
		options: [{
			value: false,
			label: translation.label.userdefined
		}, {
			value: true,
			label: translation.label.automatic
		}],
		change: function(item){
			updateSortCriterias(item.qDef);
		}
	};

	let drilldownDims = {
		type: "string",
		component: selectComponent,
		label: "Data source",
		ref: "qDef.currentDim",
		defaultValue: 0,
		options: function(item, handler) {
			let dimension;

			item.qDef && handler.layout.qHyperCube.qDimensionInfo.some(dimInfo => {
				if(dimInfo.cId === item.qDef.cId){
					dimension = dimInfo;
					return true;
				}
			});

			return dimension && dimension.qGroupFieldDefs.map((fieldDef, index) => Object({
				value: index,
				label: fieldDef,
			})) || [];
		},
		show: function(item, handler){
			return item.qDef && handler.layout.qHyperCube.qDimensionInfo.some(dimInfo => dimInfo.cId === item.qDef.cId && dimInfo.qGroupFieldDefs.length > 1);
		},
		change: function(item){
			updateSortCriterias(item.qDef);
		}
	};

	let qSortByLoadOrderCheckbox = {
		type: "boolean",
		label: translation.label.sortByLoad,
		ref: "qDef.qSortByLoadOrderCheck",
		defaultValue: false,
		change: function(item){
			item.qDef.qSortCriterias[item.qDef.currentDim || 0].qSortByLoadOrder = item.qDef.qSortByLoadOrder = item.qDef.qSortByLoadOrderCheck ? 1 : 0;
		},
		show: function (item) {
			return !item.qDef.autoSort;
		}
	};

	let qSortByLoadOrder = {
		type: "numeric",
		component : "dropdown",
		ref : "qDef.qSortByLoadOrder",
		options : [{
			value : 1,
			label : translation.label.ascending
		}, {
			value : -1,
			label : translation.label.descending
		}],
		change: function(item){
			item.qDef.qSortCriterias[item.qDef.currentDim || 0].qSortByLoadOrder = item.qDef.qSortByLoadOrder;
		},
		defaultValue : 1,
		show: function (item) {
			return !item.qDef.autoSort && item.qDef.qSortByLoadOrderCheck;
		}
	};

	var qSortByStateCheckbox = {
		type: "boolean",
		label: translation.label.sortByState,
		ref: "qDef.qSortByStateCheck",
		defaultValue: false,
		change: function(item){
			item.qDef.qSortCriterias[item.qDef.currentDim || 0].qSortByState = item.qDef.qSortByState = item.qDef.qSortByStateCheck ? 1 : 0;
		},
		show: function (item) {
			return !item.qDef.autoSort;
		}
	};

	var qSortByState = {
		type: "numeric",
		component : "dropdown",
		ref : "qDef.qSortByState",
		options : [{
			value : 1,
			label : translation.label.ascending
		}, {
			value : -1,
			label : translation.label.descending
		}],
		change: function(item){
			item.qDef.qSortCriterias[item.qDef.currentDim || 0].qSortByState = item.qDef.qSortByState;
		},
		defaultValue : 1,
		show: function (item) {
			return !item.qDef.autoSort && item.qDef.qSortByStateCheck;
		}
	};

	var qSortByFrequencyCheckbox = {
		type: "boolean",
		label: translation.label.sortByFrequence,
		ref: "qDef.qSortByFrequencyCheck",
		defaultValue: false,
		change: function(item){
			item.qDef.qSortCriterias[item.qDef.currentDim || 0].qSortByFrequency = item.qDef.qSortByFrequency = item.qDef.qSortByFrequencyCheck ? 1 : 0;
		},
		show: function (item) {
			return !item.qDef.autoSort;
		}
	};

	var qSortByFrequency = {
		type: "numeric",
		component : "dropdown",
		ref : "qDef.qSortByFrequency",
		options : [{
			value : -1,
			label : translation.label.ascending
		}, {
			value : 1,
			label : translation.label.descending
		}],
		change: function(item){
			item.qDef.qSortCriterias[item.qDef.currentDim || 0].qSortByFrequency = item.qDef.qSortByFrequency;
		},
		defaultValue : 1,
		show: function (item) {
			return !item.qDef.autoSort && item.qDef.qSortByFrequencyCheck;
		}
	};

	var qSortByNumericCheckbox = {
		type: "boolean",
		label: translation.label.sortByNumeric,
		ref: "qDef.qSortByNumericCheck",
		defaultValue: false,
		change: function(item){
			item.qDef.qSortCriterias[item.qDef.currentDim || 0].qSortByNumeric = item.qDef.qSortByNumeric = item.qDef.qSortByNumericCheck ? 1 : 0;
		},
		show: function (item) {
			return !item.qDef.autoSort;
		}
	};

	var qSortByNumeric = {
		type: "numeric",
		component : "dropdown",
		ref : "qDef.qSortByNumeric",
		options : [{
			value : 1,
			label : translation.label.ascending
		}, {
			value : -1,
			label : translation.label.descending
		}],
		change: function(item){
			item.qDef.qSortCriterias[item.qDef.currentDim || 0].qSortByNumeric = item.qDef.qSortByNumeric;
		},
		defaultValue : 1,
		show: function (item) {
			return !item.qDef.autoSort && item.qDef.qSortByNumericCheck;
		}
	};

	var qSortByAsciiCheckbox = {
		type: "boolean",
		label: translation.label.sortByAscii,
		ref: "qDef.qSortByAsciiCheck",
		defaultValue: false,
		change: function(item){
			item.qDef.qSortCriterias[item.qDef.currentDim || 0].qSortByAscii = item.qDef.qSortByAscii = item.qDef.qSortByAsciiCheck ? 1 : 0;
		},
		show: function (item) {
			return !item.qDef.autoSort;
		}
	};

	var qSortByAscii = {
		type: "numeric",
		component : "dropdown",
		ref : "qDef.qSortByAscii",
		options : [{
			value : 1,
			label : translation.label.ascending
		}, {
			value : -1,
			label : translation.label.descending
		}],
		change: function(item){
			item.qDef.qSortCriterias[item.qDef.currentDim || 0].qSortByAscii = item.qDef.qSortByAscii;
		},
		defaultValue : 1,
		show: function (item) {
			return !item.qDef.autoSort && item.qDef.qSortByAsciiCheck;
		}
	};

	var qSortByExpressionCheckbox = {
		type: "boolean",
		label: translation.label.sortByExpression,
		ref: "qDef.qSortByExpressionCheck",
		defaultValue: false,
		change: function(item){
			if(!item.qDef.qSortByExpressionCheck){
				item.qDef.qSortCriterias[item.qDef.currentDim || 0].qExpression = item.qDef.qExpression = {};
			}else{
				item.qDef.qSortCriterias[item.qDef.currentDim || 0].qExpression = {qv: ''};
				item.qDef.qExpression = {qv: ''};
			}
		},
		show: function (item) {
			return !item.qDef.autoSort;
		}
	};

	var sortExpression = {
		ref: "qDef.qExpression.qv",
		label: translation.label.expression,
		type: "string",
		expression: "always",
		defaultValue: "",
		show: function (item) {
			return !item.qDef.autoSort && item.qDef.qSortByExpressionCheck;
		},
		change: function(item){
			let expr = item.qDef.qExpression.qv.qStringExpression ? item.qDef.qExpression.qv.qStringExpression.qExpr : item.qDef.qExpression.qv;
			item.qDef.qSortCriterias[item.qDef.currentDim || 0].qExpression.qv = expr;
		},
	};

	var qSortByExpression = {
		type: "numeric",
		component : "dropdown",
		ref : "qDef.qSortByExpression",
		options : [{
			value : 1,
			label : translation.label.ascending
		}, {
			value : -1,
			label : translation.label.descending
		}],
		change: function(item){
			item.qDef.qSortCriterias[item.qDef.currentDim || 0].qSortByExpression = item.qDef.qSortByExpression;
		},
		defaultValue : 1,
		show: function (item) {
			return !item.qDef.autoSort && item.qDef.qSortByExpressionCheck;
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

	var tooltipInput = {
		ref: "props.tooltip",
		label: translation.label.tooltip,
		type: "string",
		expression: "optional",
		show: function ( data ) {
			return  data.type !== 'Button Container' && data.type !== 'Button';
		}
	};

	var customSelectionSwitch ={
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
		show: function( data){
			return data.type !== 'Button Container' && data.type !== 'Button';
		}
	};

	var customSelectionSubSwitch ={
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
		show: function ( data ) {
			return data.props.isCustomSelection;
		}
	};

	var selectionLabelSubInput = {
		ref: "props.selectionLabel",
		label: translation.label.selectionLabel,
		type: "string",
		expression: "optional",
		defaultValue: "",
		show: function ( data ) {
			return data.props.isCustomSelection;
		}
	};

	const defaultConditionValue = `='true'
/*
 true -> show this condition
 false -> condition is never shown
 $(var) = 1 -> show this condition, if var is equal 1
 if($(var) = 1, true, false); -> show this condition, if var is equal 1
*/`;

	var conditionInput = {
		ref: "condition",
		label: translation.label.condition,
		type: "string",
		expression: "optional",
		defaultValue: {qStringExpression: defaultConditionValue}
	};

	var showConditionInput = {
		ref: "showCondition",
		label: translation.label.showCondition,
		type: "string",
		expression: "optional",
		defaultValue: {qStringExpression: defaultConditionValue}
	};

	var itemLabel = {
		ref: "props.itemLabel",
		label: translation.label.label,
		type: "string",
		expression: "optional",
		show: function ( data ) {
			return  data.type !== 'Button Container' && data.type !== 'Button';
		}
	};

	var variableInput = {
		ref: "props.variableName",
		label: translation.label.variableName,
		type: "string",
		expression: "optional",
		show: function ( data ) {
			return data.type === "Variable Dropdown";
		}
	};

	var variableValueInput = {
		ref: "props.variableValue",
		label: translation.label.variableValue,
		type: "string",
		expression: "optional",
		show: function ( data ) {
			return  data.type !== 'Variable Dropdown';
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
		options: [
			{
				value: "px",
				label: "PX",
				tooltip: translation.tooltip.pixel
			}, {
				value: "%",
				label: "%",
				tooltip: translation.tooltip.percent
			}
		],
		defaultValue: "%",
		show: function ( data, layout ) {
			return  data.props.isCustomSize && layout.layout.appearance.orientation === 'btn-inline';
		}
	};

	var widthItemInput = {
		type: "integer",
		label: translation.label.customWidth,
		ref: "props.width",
		defaultValue: 50,
		show: function ( data, layout ) {
			return  data.props.isCustomSize && layout.layout.appearance.orientation === 'btn-inline';
		}
	};

	var heightItemInput = {
		type: "integer",
		label: translation.label.customHeight,
		ref: "props.height",
		defaultValue: 50,
		show: function ( data, layout ) {
			return  data.props.isCustomSize && layout.layout.appearance.orientation === 'btn-block';
		}
	};

	var widthInput = {
		type: "integer",
		label: translation.label.panelWidth,
		ref: "appearance.width",
		defaultValue: 150,
		show: function ( data ) {
			return  data.appearance.orientation === 'btn-block' && data.appearance.widthSetting === 'custom';
		}
	};

	var heightInput = {
		type: "integer",
		label: translation.label.panelHeight,
		ref: "appearance.height",
		defaultValue: 150,
		show: function ( data ) {
			return data.appearance.orientation === 'btn-inline' && data.appearance.heightSetting === 'custom';
		}
	};

	var openeEditModal = {
		label: translation.label.stateSettings,
		component: "button",
		action: function(state, data, extension){
			openModal(state).then(function(state){
				extension.model.setProperties(data.properties)
			}).catch(function(){
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
		show: function (data) {
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
		show: function ( data ) {
			return data.props.alwaysSelectValue;
		}
	};

	var textFamily = {
		type: "items",
		component: MultiOptionsComponent,
		label: translation.label.textFamily,
		ref: "appearance.textFamily",
		expression: "optional",
		options: [
			{value: "Arial", label: "Arial"},
			{value: "Arial Unicode MS", label: "Arial Unicode MS"},
			{value: "Calibri", label: "Calibri"},
			{value: "Tahoma", label: "Tahoma"},
			{value: "Verdana", label: "Verdana"},
			{value: "'QlikView Sans', sans-serif", label: "QlikView Sans"}
		],
		defaultValue: "QlikView Sans"
	};

	var textWeight = {
		type: "items",
		component: MultiOptionsComponent,
		label: translation.label.textWeight,
		ref: "appearance.textWeight",
		expression: "optional",
		options: [
			{value: 'normal', label: 'normal'},
			{value: 'bold', label: 'bold'},
			{value: 'bolder', label: 'bolder'},
			{value: 'lighter', label: 'lighter'},
			{value: '100', label: 'number (100-900)'}
		],
		defaultValue: "bold"
	};

	var textStyle = {
		type: "items",
		component: MultiOptionsComponent,
		label: translation.label.textFont,
		ref: "appearance.textStyle",
		expression: "optional",
		options: [
			{value: 'normal', label: 'normal'},
			{value: 'italic', label: 'italic'},
			{value: 'oblique', label: 'oblique'}
		],
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
		options: [
			{value: "Arial", label: "Arial"},
			{value: "Arial Unicode MS", label: "Arial Unicode MS"},
			{value: "Calibri", label: "Calibri"},
			{value: "Tahoma", label: "Tahoma"},
			{value: "Verdana", label: "Verdana"},
			{value: "'QlikView Sans', sans-serif", label: "QlikView Sans"}
		],
		defaultValue: "QlikView Sans"
	};

	var textSelectionWeight = {
		type: "items",
		component: MultiOptionsComponent,
		label: translation.label.textWeight,
		ref: "appearance.textSelectionWeight",
		expression: "optional",
		options: [
			{value: 'normal', label: 'normal'},
			{value: 'bold', label: 'bold'},
			{value: 'bolder', label: 'bolder'},
			{value: 'lighter', label: 'lighter'},
			{value: '100', label: 'number (100-900)'}
		],
		defaultValue: "normal"
	};

	var textSelectionStyle = {
		type: "items",
		component: MultiOptionsComponent,
		label: translation.label.textFont,
		ref: "appearance.textSelectionStyle",
		expression: "optional",
		options: [
			{value: 'normal', label: 'normal'},
			{value: 'italic', label: 'italic'},
			{value: 'oblique', label: 'oblique'}
		],
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
		show: function(data){
			if(data.appearance){
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
		show: function(data){
			if(data.appearance){
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
		show: function(data){
			if(data.appearance){
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
		show: function(data){
			if(data.appearance){
				return data.appearance.gapLeft === true;
			}

		},
		defaultValue: 0
	};

	var iconsDropdown = {
		type: "items",
		show: function ( data ) {
			return  data.type !== 'Button Container' && data.type !== 'Button' && data.type !== 'Button Dropdown';
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
		options: [
			{
				value: "btn-block",
				label: translation.label.vertical
			}, {
				value: "btn-inline",
				label: translation.label.horizontal
			}
		],
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
				options: [
					{
						value: "center",
						label: translation.label.center
					}, {
						value: "left",
						label: translation.label.left
					}, {
						value: "right",
						label: translation.label.right
					}
				],
				defaultValue: "center"
			}
		},
		show: function ( data ) {
			return data.appearance.widthSetting === 'custom';
		}
	};

	var widthButtonGrp = {
		type: "string",
		component: customCmp.buttongroup,
		label: translation.label.widthSetting,
		ref: "appearance.widthSetting",
		options: [
			{
				value: "full",
				label: translation.label.fill,
				tooltip: translation.tooltip.fullWidth
			}, {
				value: "custom",
				label: translation.label.custom,
				tooltip: translation.tooltip.customWidth
			}
		],
		defaultValue: "full",
		show: function ( data ) {
			return data.appearance.orientation === 'btn-block';
		}
	};

	var vertHeightButtonGrp = {
		type: "string",
		component: customCmp.buttongroup,
		label: translation.label.heightSetting,
		ref: "appearance.vertHeightSetting",
		options: [
			{
				value: "100%",
				label: translation.label.fill,
				tooltip: translation.tooltip.fullWidth
			}, {
				value: "auto",
				label: translation.label.auto,
				tooltip: translation.tooltip.customWidth
			}
		],
		defaultValue: "100%",
		show: function ( data ) {
			return data.appearance.orientation === 'btn-block';
		}
	};

	var heightButtonGrp = {
		type: "string",
		component: customCmp.buttongroup,
		label: translation.label.heightSetting,
		ref: "appearance.heightSetting",
		options: [
			{
				value: "full",
				label: translation.label.fill,
				tooltip: translation.tooltip.fullHeight
			}, {
				value: "custom",
				label: translation.label.custom,
				tooltip: translation.tooltip.fullWidth
			}
		],
		defaultValue: "full",
		show: function ( data ) {
			return data.appearance.orientation === 'btn-inline';
		}
	};

	var textOrientationGrp = {
		type: "string",
		component: customCmp.buttongroup,
		label: translation.label.textLayout,
		ref: "props.textLayout",
		options: [
			{
				value: "single",
				label: translation.label.single
			}, {
				value: "multi",
				label: translation.label.multi
			}
		],
		defaultValue: "single",
		show: function ( data ) {
			return  data.type !== 'Button' && data.type !== 'Button Container';
		}
	};

	var alignmentHorizontalLabel = {
		type: "string",
		component: customCmp.buttongroup,
		label: translation.label.labelAlignementHorizontal,
		ref: "props.horAlignLabel",
		options: [
			{
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
			}
		],
		defaultValue: "center",
		show: function ( data ) {
			return  data.type !== 'Button' && data.type !== 'Button Container';
		}
	};

	var alignmentVerticalValue = {
		type: "string",
		component: customCmp.buttongroup,
		label: translation.label.labelAlignementVertical,
		ref: "props.verAlignLabel",
		options: [
			{
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
			}
		],
		defaultValue: "center",
		show: function ( data ) {
			return  data.type !== 'Button' && data.type !== 'Button Container';
		}
	};

	var alignmentHorizontalSelectionLabel = {
		type: "string",
		component: customCmp.buttongroup,
		label: translation.label.selectionLabelAlignementHorizontal,
		ref: "props.horAlignSelectionLabel",
		options: [
			{
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
			}
		],
		defaultValue: "center",
		show: function ( data ) {
			return  data.props.textLayout === 'multi';
		}
	};

	var alignmentVerticalSelectionValue = {
		type: "string",
		component: customCmp.buttongroup,
		label: translation.label.selectionLabelAlignementVertical,
		ref: "props.verAlignSelectionLabel",
		options: [
			{
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
			}
		],
		defaultValue: "center",
		show: function ( data ) {
			return  data.props.textLayout === 'multi';
		}
	};

	var selectDimensions = {
		type: "items",
		show: function ( data ) {
			return data.type === "Sense Select" || data.type === "Single Select" ;
		},
		items: {
			MyDropdownProp: {
				type: "string",
				component: "dropdown",
				label: translation.label.dimension,
				ref: "props.dimId",
				options: function(data, handler, objModel){
					return (objModel.layout.qHyperCube.qDimensionInfo || []).map(dimension => Object({
						value: dimension.cId,
						label: dimension.title || dimension.qFallbackTitle
					})).sort(compare);
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
				ref: "props.dimId",
				change: function(data, app, layout){
					app.layout.qHyperCube.qDimensionInfo.some(function(dimension){
						if(dimension.cId === data.props.dimId){
							data.props.dimTitle = dimension.title || dimension.qFallbackTitle;
							data.props.itemLabel = dimension.title || dimension.qFallbackTitle;
						}
					});
				},
				options: function(data, handler, objModel){
					return (objModel.layout.qHyperCube.qDimensionInfo || []).map(item => Object({
						value: item.cId,
						label: item.title || item.qFallbackTitle
					})).sort(compare);
				},
				defaultValue: translation.label.noDimension
			}
		}
	};

	const showToolbar = {
		type: 'boolean',
		label: 'Toolbar',
		ref: 'props.showToolbar',
		defaultValue: false,
		show: function(data){
			return data.type === 'Single Select';
		},
	};

	const showSubToolbar = {
		type: 'boolean',
		label: 'Toolbar',
		ref: 'props.showToolbar',
		defaultValue: false,
	};

	var typeDropdown = {
		type: "items",
		items: {
			MyDropdownProp: {
				type: "string",
				component: "dropdown",
				label: translation.label.type,
				ref: "type",
				options: [
					{
                        value: "Button",
                        label: translation.label.button
                    },	{
                        value: "Button Container",
                        label: translation.label.buttonContainer
                    },	{
                        value: "Button Dropdown",
                        label: translation.label.buttonDropdown
                    },	{
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
					}
					//, {
					//	value: "Calendar",
					//	label: "Calendar"
					//}
				],
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
		itemTitleRef: function(data){
			if(data.props && data.props.conditionName){
				return data.props.conditionName;
			}else{
				return data.condition;
			}

		},
		allowAdd: true,
		allowRemove: false,
		add: function(data, layout, model){
			var state = new State();
			delete state.condition;

			angular.extend(data, state);

			model.setProperties(model.properties);
		},
		addTranslation: translation.label.addState,
		items: {
			openEditModal: openeEditModal,
			conditionInput: conditionInput,
			conditionNameInput: conditionNameInput,
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
				show: function(data){
					return data.type !== 'Button'
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
		add: function(data){
			data.props.buttonName = data.stateItems[0].text;
		},
		allowAdd: true,
		allowRemove: false,
		addTranslation: translation.label.addButton,
		items: {
			buttonItem: buttonItem
		},
		defaultValue: [
			buttonItem.defaultValue
		]
	};

	var singleButton = {
		type: "items",
		show: function ( data ) {
			return data.type === "Button" || data.subType === "Button";
		},
		items: {
			buttonItem: buttonItem
		}
	};

	var variableDropdown = {
		type: "items",
		show: function ( data ) {
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
		show: function ( data ) {
			return data.type === "Button Dropdown" || data.subType === "Button Dropdown";
		},
		items: {
			MyList: {
				component: customCmp.list,
				type: "array",
				ref: "dropdownItems",
				label: translation.label.dropdownItems,
				itemTitleRef: 'props.buttonName',
				add: function(data){
					data.props.buttonName = data.stateItems[0].text;
				},
				allowAdd: true,
				allowRemove: false,
				addTranslation: translation.label.addDropdownItem,
				items: {
					buttonItem: buttonItem
				},
				defaultValue: [
					buttonItem.defaultValue
				]
			}
		}
	};

	var buttonContainer = {
		type: "items",
		show: function ( data ) {
			return data.type === "Button Container";
		},
		itemTitleRef: 'props.buttonName',
		items: {
			buttons: buttonItems
		}
	};

	var multiSelect = {
		type: "items",
		show: function ( data ) {
			return data.type === "Multi Select";
		},
		items: {
			MyList: {
				component: customCmp.list,
				type: "array",
				ref: "selectItems",
				itemTitleRef: function(data, index, handler){
					if(data.props.itemLabel === ''){
						let dimName = data.props.dimId;
						handler.layout.qHyperCube.qDimensionInfo.some(dimInfo =>{
							if(dimInfo.cId === data.props.dimId){
								dimName = dimInfo.title || dimInfo.qFallbackTitle;
								return true;
							}
						});
						return dimName;
					}else{
						return data.props.itemLabel;
					}
				},
				allowAdd: true,
				allowRemove: false,
				addTranslation: translation.label.addSingleSelect,
				items: {
					selectDimension: selectSubDimensions,
					showSubToolbar: showSubToolbar,
					selectSubValueCheckbox : selectSubValueCheckbox,
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


	const panelList = {
		component: customCmp.list,
		type: 'array',
		ref: 'listItems',
		itemTitleRef: function(data, index, handler){

			if(data.props && data.props.buttonName){
				return data.props.buttonName;
			}

			if(data.type === 'Single Select' || data.type === 'Sense Select'){
				let dimName = data.props.dimId;
				handler.layout.qHyperCube.qDimensionInfo.some(dimInfo => {
					if(dimInfo.cId === data.props.dimId){
						dimName = dimInfo.title || dimInfo.qFallbackTitle;
						return true;
					}
				});
				return data.type + ': ' + dimName;
			}else if(data.type === 'Variable Dropdown'){
				return data.type + ': ' + data.props.variableName;
			}
			return data.type
		},
		allowAdd: true,
		allowRemove: false,
		allowMove: true,
		addTranslation: translation.label.addItem,
		items: {
			typedropwdown: typeDropdown,
			buttonNameInput: buttonNameInput,
			showCondition: showConditionInput,
			variableName: variableInput,
			selectDimension: selectDimensions,
			showToolbar: showToolbar,
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

	let sorting = {
		component: customCmp.simpleList,
		label: translation.label.sort,
		type: "array",
		ref: "qHyperCubeDef.qDimensions",
		itemTitleRef: function(item, index, object){
			let retVal = '';

			object.layout.qHyperCube.qDimensionInfo.some(function(dim){
				if(dim.cId === item.qDef.cId){
					retVal = dim.qFallbackTitle;
					return true;
				}
			});

			return retVal;
		},
		allowAdd: false,
		allowRemove: false,
		allowMove: false,
		items: {
			customSortOrder:customSortOrder,
			drilldownDims: drilldownDims,
			seperator1: seperator,
			qSortByLoadOrderCheckbox: qSortByLoadOrderCheckbox,
			qSortByLoadOrder: qSortByLoadOrder,
			seperator2: seperatorSort,
			qSortByStateCheckbox: qSortByStateCheckbox,
			qSortByState: qSortByState,
			seperator3: seperatorSort,
			qSortByFrequencyCheckbox: qSortByFrequencyCheckbox,
			qSortByFrequency: qSortByFrequency,
			seperator4: seperatorSort,
			qSortByNumericCheckbox: qSortByNumericCheckbox,
			qSortByNumeric: qSortByNumeric,
			seperator5: seperatorSort,
			qSortByAsciiCheckbox: qSortByAsciiCheckbox,
			qSortByAscii: qSortByAscii,
			seperator6: seperatorSort,
			qSortByExpressionCheckbox: qSortByExpressionCheckbox,
			sortExpression: sortExpression,
			qSortByExpression: qSortByExpression,
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
			dimension2: {
				uses: "dimensions",
				min: 0,
			},

			realSort: sorting,

			panelsettings: panelDefinitionSection,

			addons: {
				uses: 'addons',
				items: {
					dataHandling : {
						uses : "dataHandling",
						items: {
							suppressZero: {
								show: false
							},
							calcCond: {
								show: true
							},
							calcCondVar: calcCondVar
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
							},
							titles: {
								type: 'items',
								ref: 'titles',
								show: true,
								items: {
									title: {
										defaultValue: 'trueChart-Menubar',
										show: true
									},
									subtitle: {
										show: function(data){
											return data.showTitles;
										}
									},
									footnote: {
										show: function(data){
											return data.showTitles;
										}
									}
								}
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
							menuBarExpr: createDisplayExpression('appearance.displaySenseMenuBarExpr', '', function(data){
								return data.appearance && data.appearance.displaySenseMenuBar === '2';
							}),
							seperator: seperator,
							selectionBar: createDisplayBtnGrp('appearance.displaySenseSelectionBar', translation.label.senseSelectionBar),
							selectionBarExpr: createDisplayExpression('appearance.displaySenseSelectionBarExpr', '', function(data){
								return data.appearance && data.appearance.displaySenseSelectionBar === '2';
							}),
							seperator1: seperator,
							titleBar: createDisplayBtnGrp('appearance.displaySenseTitleBar', translation.label.senseTitleBar),
							titleBarExpr: createDisplayExpression('appearance.displaySenseTitleBarExpr', '', function(data){
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
			},

			/*repair: {
				type: "items",
				label: translation.label.repair,
				items:{
					repairButton: repairButton,
				}
			}*/
		}
	};

	/**
	 * Customize properties panel components
	 * @return {object} Object with custom components identifiers
	 */
	function customizePPComponents(){
		let custom = useCustomComponents(true);

		if(qlikService.isPrinting() || !qlikService.inClient()){
			return useCustomComponents(false); // use default components
		}

		try{
			requirejs([
				'client.property-panel/components/components',
				'client.property-panel/components/list/list',
				'client.property-panel/components/buttongroup/buttongroup'
			], function(components){
				var cmp;

				// customize buttongroup component
				cmp = angular.merge({}, requirejs('client.property-panel/components/buttongroup/buttongroup'));
				cmp.template = cmp.template.replace('class="lui-button"', 'class="hico-button lui-button"');
				components.addComponent(custom.buttongroup, cmp);

				// improve qlik sense 'list' component, which is used for properties of type === 'array'
				cmp = angular.merge({}, requirejs('client.property-panel/components/list/list'));
				cmp.template = cmp.template
					// fix "watchers-bug" in properties panel list component
					.replace('ng-show="item.expanded"', 'ng-if="item.expanded"')
					// also change padding settings
					.replace('ng-if="item.expanded"', 'ng-if="item.expanded" style="padding: 5px"')
					// and add missing feature: hide remove button, when allowRemove === false
					.replace('qva-activate="removeItem(item.index)"', 'qva-activate="removeItem(item.index)" ng-if="definition.allowRemove"');
				components.addComponent(custom.list, cmp);

				// simplify qlik sense 'list' component, which can be used for properties of type === 'array'
				cmp = angular.merge({}, cmp);
				cmp.template = cmp.template
					// hide add button, when allowAdd === false
					.replace('qva-activate="addClicked()"', 'qva-activate="addClicked()" ng-if="definition.allowAdd"')
					// disable right click (context menu)
					.replace('qva-context-menu="openContextMenu($event, item)"', '');
				components.addComponent(custom.simpleList, cmp);
			});
		}catch(err){
			return useCustomComponents(false); // use default components
		}

		return custom;

		/**
		 * Returns an object with custom component identifiers
		 * @param yes {boolean} Decides which components should be returned
		 * @return {*} If true, returns custom identifiers, otherwise default identifiers will be used
		 */
		function useCustomComponents(yes){
			return {
				list: yes ? 'hico-list' : 'list',
				simpleList: yes ? 'hico-simpleList' : 'list',
				buttongroup: yes ? 'hico-buttongroup' : 'buttongroup'
			};
		}

	}

	/**
	 * Updates qDefs qSortCriterias depending on qDef.currentDim value
	 *
	 * @param {object} qDef - qDef of a dimension property
	 */
	function updateSortCriterias(qDef){
		let sortcrit = qDef.qSortCriterias[qDef.currentDim || 0];

		qDef.qSortByLoadOrderCheck = !!(qDef.qSortByLoadOrder = sortcrit.qSortByLoadOrder);
		qDef.qSortByStateCheck = !!(qDef.qSortByState = sortcrit.qSortByState);
		qDef.qSortByFrequencyCheck = !!(qDef.qSortByFrequency = sortcrit.qSortByFrequency);
		qDef.qSortByAsciiCheck = !!(qDef.qSortByAscii = sortcrit.qSortByAscii);
		qDef.qSortByNumericCheck = !!(qDef.qSortByNumeric = sortcrit.qSortByNumeric);
		qDef.qSortByExpressionCheck = (qDef.qExpression = sortcrit.qExpression).qv && sortcrit.qExpression.qv !== '';
		qDef.qSortByExpression = sortcrit.qSortByExpression;
	}
}

export const properties = Properties();
