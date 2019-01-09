import {angular, $compile} from './js/Services/AngularService';
import * as qvangular from 'qvangular';
import * as tinycolor from 'tinycolor2';
import './lib/colorsliders/bootstrap.colorpickersliders';

import {QlikService, qlik} from './lib/hico/services/qlik-service';
import {UtilService} from './js/Services/UtilService';
import UpdateService from './js/Services/UpdateService';
import {RepairService} from './js/Services/RepairService';
import * as informationTemplate from './templates/informationComponent.html';
import * as multiOptionsTemplate from './templates/multiOptionsComponent.html';
import * as selectComponentTemplate from './templates/selectComponent.html';
import * as buttonGroupComponentTemplate from './templates/buttonGroupComponentTemplate.html';
import * as datePickerComponentTemplate from './templates/datePickerComponentTemplate.html';

import * as faIcons from './lib/general/icons-fa';
import {translation} from '../resource/translations/translations';
import * as Datepicker from '../src/js/Components/DatePicker/bundle';
import {
	createColorPickerComponent,
	createDisplayExpression,
	createLabelSeparator,
	createSeparator,
	createStringInput,
	createCheckbox
} from './js/Components/Factories/PropertiesFactory';

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
		_utilService = UtilService.getInstance(),
		_repairService = RepairService.getInstance(),
		_updateService = UpdateService.getInstance(),

		// Customize components for properties panel
		customCmp = customizePPComponents();

	const labelTrans = translation.label;

	function _getRefs(data, refName) {
		let ref = data,
			name = refName,
			props = refName.split('.');
		if(props.length > 0) {
			for(let i = 0; i < props.length - 1; ++i) {
				if(ref[props[i]])
					ref = ref[props[i]];
			}
			name = props[props.length - 1];
		}
		return {ref: ref, name :name};
	}

	function setRefValue(data, refName, value) {
		let  obj = _getRefs(data, refName);
		obj.ref[obj.name] = value;
	}

	function getRefValue(data, refName) {
		let obj = _getRefs(data, refName);
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

	let informationComponent = {
		template: informationTemplate,
		controller: ['$scope', '$element', function(scope){
			scope.translation = translation;
		}]
	};

	const DatePickerComponent = {
		template: datePickerComponentTemplate,
		controller: ['$scope', function(scope){
			scope.refValue = getRefValue(scope.data, scope.definition.ref);
			scope.showColorPicker = false;
			scope.qComponents = {
				string: requirejs('client.property-panel/components/string/string')
			};
			scope.text = {type: 'string', ref: scope.definition.ref, expression: 'optional'};

			scope.show = true;

			if(typeof scope.definition.show === 'function'){
				scope.show = scope.definition.show(scope.data);
			}

			scope.showDatePicker = function(){
				let clientRec = document.getElementById('datePicker_' + scope.$id).getBoundingClientRect(),
					data = scope.data,
					format = data.format ? data.format : (data.props.date.format === 'custom' ? data.props.date.customFormat : data.props.date.format);
				scope.refValue = getRefValue(scope.data, scope.definition.ref);

				const datePickerConfig = {
					format: format,
				};

				const configuration = {
					config: datePickerConfig,
					displayStartDate: scope.refValue,
					displayEndDate: '',
					type: 'single',
					left: clientRec.left + 'px',
					top: clientRec.top + 'px',
					selectedDates: [scope.refValue],
					onConfirm: scope.onDatePickerConfirm,
				};

				Datepicker.DatePicker.show(configuration);
			};

			scope.onDatePickerConfirm = function(startDate){
				let date = startDate instanceof Array ? startDate[0] : startDate;
				setRefValue(scope.data, scope.definition.ref, date);

				if(typeof scope.definition.change === 'function'){
					scope.definition.change(scope.data);
				}

				scope.update();
			};

			scope.update = function(){
				scope.$emit("saveProperties");
			};
		}]
	};

	const ButtonGroupComponent = {
		template: buttonGroupComponentTemplate,
		controller: ['$scope', function(scope){

			scope.show = true;

			if(typeof scope.definition.show === 'function'){
				scope.show = scope.definition.show(scope.data);
			}

			scope.updateButtons = function(){
				scope.definition.buttons.forEach(button =>{
					if(typeof button.active === 'function'){
						button.isActive = button.active(scope.data, scope.args.handler);
					}else{
						button.isActive = typeof button.active === 'boolean' ? button.active : true;
					}

					button.activeClass = button.isActive ? '' : 'lui-disabled hico-button-inactive';
				});
			};

			scope.update = function(){
				scope.$emit("saveProperties");
			};

			scope.updateButtons();
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

			if(typeof scope.definition.defaultValue === 'function'){
				scope.refValue = scope.definition.defaultValue(scope.data, scope.args.handler, scope.args);
			}else{
				scope.refValue = scope.options[getRefValue(scope.data, scope.definition.ref) || scope.definition.defaultValue];
			}

			if(typeof scope.definition.options === 'function'){
				scope.options = scope.definition.options(scope.data, scope.args.handler, scope.args);
			}else{
				scope.options = scope.definition.options;
				scope.definition.options.some(function(option){
					if(option.value === scope.refValue){
						scope.refValue = option;
						return true;
					}
				});
			}

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

			if(typeof scope.definition.defaultValue === 'function'){
				scope.refValue = getRefValue(scope.data, scope.definition.ref) || scope.definition.defaultValue(scope.data, scope.args.handler, scope.args);
			}else{
				scope.refValue = getRefValue(scope.data, scope.definition.ref) || scope.definition.defaultValue;
			}

			if(typeof scope.definition.options === 'function'){
				scope.options = scope.definition.options(scope.data, scope.args.handler, scope.args);
			}else{
				scope.options = scope.definition.options;
			}

			scope.options.some(function(option){
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

			if(!getRefValue(scope.data, scope.definition.ref)){
				scope.update();
			}
		}]
	};

	function compare(a,b) {
		if (a.label < b.label)
			return -1;
		if (a.label > b.label)
			return 1;
		return 0;
	}

	let icons = [];
	icons.push({value: 'noIcon', label: translation.label.noIcon});
	for(let key in faIcons){
		faIcons.hasOwnProperty(key) && icons.push({value: key, label: faIcons[key]});
	}

	function openModal(state){
		return qlik.Promise(function(resolve, reject){
			const scope = qvangular.$rootScope.$new();
			scope.state = state;
			scope.condition = state.condition.qStringExpression ? state.condition.qStringExpression.qExpr : state.condition;
			scope.onClose = (data) =>{
				data.type === 'apply' ? resolve() : reject();
			};

			const template = '<div data-tcmenu-button-editor on-close="onClose" condition="condition" state="state" trans="trans" is-true="isTrue"></div>',
				$editor = $compile(template)(scope);

			if(document.body.childNodes.length > 0){
				document.body.insertBefore($editor[0], document.body.childNodes[0]);
			}else{
				document.body.appendChild($editor[0]);
			}
		});
	}

	function State(){
		this.version = 1;
		this.type = 'buttonState'; // only for tcmenu (cpy/paste/duplicate)
		this.text = 'My Button';
		this.buttonType = 'simple';
		this.condition = conditionInput.defaultValue;
		this.triggers = [
			{
				type: 'click',
				actions: [
					{
						name: 'none',
						params: {},
						paramsExpr: {},
					}
				]
			}
		];
		this.style = {
			icon: {},
			font: {},
			background: {
				position: {},
				repeat: 'no-repeat',
			},
			border: {},
		};
		this.layout = {
			width: '100%',   // {string} width of the button -> 'auto'
			height: '100%',  // {string} height of the button -> 'default style'
			icon: {}
		};
	}

	// *****************************************************************************
	// Custom Definitions
	// *****************************************************************************

	let information = {
		type: "items",
		component: informationComponent,
		ref: ""
	};

	const repairButton = {
		component: ButtonGroupComponent,
		show: function(){
			return window.localStorage.getItem('__tcmenu_hidden_features__') === 'true';
		},
		buttons: [
			{
				label: translation.label.repairBtn,
				tooltip: translation.tooltip.repairBtnTp,
				action: function(data, handler, model, update){
					_repairService.startRepair(handler.properties);
					update();
				}
			}
		]
	};

	const updateButton = {
		component: ButtonGroupComponent,
		show: function(){
			return window.localStorage.getItem('__tcmenu_hidden_features__') === 'true';
		},
		buttons: [
			{
				label: translation.label.repeatUpdateBtn,
				tooltip: translation.tooltip.repeatUpdateBtn,
				action: function(data, handler, model){
					_updateService.forceLastUpdate(model);
				}
			}
		]
	};

	let copyPaste = {
		type: 'items',
		component: ButtonGroupComponent,
		buttons: [
			{
				icon: 'lui-icon lui-icon--insert',
				tooltip: translation.tooltip.duplicate,
				action: function(item, handler, model, update){
					_utilService.findAndDuplicateListItem(handler.properties.listItems, item);
					update();
				}
			},
			{
				icon: 'lui-icon lui-icon--copy',
				tooltip: translation.tooltip.copy,
				action: function(item){
					_utilService.setCopyStorage(JSON.parse(JSON.stringify(item)));
				}
			},
			{
				icon: 'lui-icon lui-icon--paste',
				tooltip: translation.tooltip.paste,
				active: function(){
					return !!_utilService.getCopyStorage();
				},
				action: function(item, handler, model, update){
					let copyItem = _utilService.getCopyStorage();

					if(copyItem){
						if(copyItem.type === 'buttonState' && item.type === 'buttonState' || copyItem.type !== 'buttonState' && item.type !== 'buttonState' ){
							if(item.type !== 'subButton' && copyItem.type === 'subButton'){
								copyItem.type = 'Button'
							}

							_utilService.replaceListItemsIdsRecursiv([copyItem]);
							Object.assign(item, copyItem);
							update();
						}
					}
				}
			}
		]
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
			switchSortCriterias(item.qDef);
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

	let qSortByStateCheckbox = {
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

	let qSortByState = {
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

	let qSortByFrequencyCheckbox = {
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

	let qSortByFrequency = {
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

	let qSortByNumericCheckbox = {
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

	let qSortByNumeric = {
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

	let qSortByAsciiCheckbox = {
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

	let qSortByAscii = {
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

	let qSortByExpressionCheckbox = {
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

	let sortExpression = {
		ref: "qDef.qExpression.qv",
		label: translation.label.expression,
		type: "number",
		expression: "always",
		expressionType: "ValueExpr",
		component: "expression",
		defaultValue: "",
		show: function (item) {
			if(item.qDef.qSortCriterias[item.qDef.currentDim || 0].qExpression){
				item.qDef.qExpression = item.qDef.qExpression ? item.qDef.qExpression : {qv: ''};
				item.qDef.qExpression.qv = item.qDef.qSortCriterias[item.qDef.currentDim || 0].qExpression.qv;
			}
			return !item.qDef.autoSort && item.qDef.qSortByExpressionCheck;
		},
		change: function(item){
			let expr = item.qDef.qExpression.qv.qStringExpression ? item.qDef.qExpression.qv.qStringExpression.qExpr : item.qDef.qExpression.qv;
			item.qDef.qSortCriterias[item.qDef.currentDim || 0].qExpression.qv = expr.qv;
			item.qDef.qSortCriterias[item.qDef.currentDim || 0].qSortByExpression = item.qDef.qSortByExpression || 1;
		},
	};

	let qSortByExpression = {
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

	let myTextBox = {
		ref: "props.itemLabel",
		label: "Label",
		type: "string",
		expression: "optional"
	};

	let calcCondVar = {
		type: 'string',
			label: translation.label.calcCondVar,
			//tooltip: translation.tooltip.calcCondVar,
			ref: 'calCondVariable',
			expression: 'optional'
	};

	let tooltipInput = {
		ref: "props.tooltip",
		label: translation.label.tooltip,
		type: "string",
		expression: "optional",
		show: function ( data ) {
			return  data.type !== 'Button Container' && data.type !== 'Button';
		}
	};

	let customSelectionSwitch ={
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
			return data.type !== 'Button Container' && data.type !== 'Button' && data.type !== 'Variable Input';
		}
	};

	let customSelectionSubSwitch ={
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

	let selectionLabelInput = {
		ref: "props.selectionLabel",
		label: translation.label.selectionLabel,
		type: "string",
		expression: "optional",
		defaultValue: "",
		show: function ( data ) {
			return data.props.isCustomSelection && data.type !== 'Variable Input';
		}
	};

	let selectionLabelSubInput = {
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

	let conditionInput = {
		ref: "condition",
		label: translation.label.condition,
		type: "string",
		expression: "optional",
		defaultValue: {qStringExpression: defaultConditionValue}
	};

	let showConditionInput = {
		ref: "showCondition",
		label: translation.label.showCondition,
		type: "string",
		expression: "optional",
		defaultValue: {qStringExpression: defaultConditionValue}
	};

	let itemLabel = {
		ref: "props.itemLabel",
		label: translation.label.label,
		type: "string",
		expression: "optional",
		show: function ( data ) {
			return  data.type !== 'Button Container' && data.type !== 'Button';
		}
	};

	let variableInput = {
		ref: "props.variableName",
		label: translation.label.variableName,
		type: "string",
		expression: "optional",
		show: function ( data ) {
			return data.type === "Variable Dropdown";
		}
	};

	let variableValueInput = {
		ref: "props.variableValue",
		label: translation.label.variableValue,
		type: "string",
		expression: "optional",
		show: function ( data ) {
			return  data.type !== 'Variable Dropdown';
		}
	};

	let sizeSwitch = {
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

	let sizeTypeGrp = {
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

	let widthItemInput = {
		type: "integer",
		label: translation.label.customWidth,
		ref: "props.width",
		defaultValue: 50,
		show: function ( data, layout ) {
			return  data.props.isCustomSize && layout.layout.appearance.orientation === 'btn-inline';
		}
	};

	let heightItemInput = {
		type: "integer",
		label: translation.label.customHeight,
		ref: "props.height",
		defaultValue: 50,
		show: function ( data, layout ) {
			return  data.props.isCustomSize && layout.layout.appearance.orientation === 'btn-block';
		}
	};

	let groupHeightItemInput = Object.assign({}, {
		show: function(data){
			return data.props.isCustomSize;
		}
	});

	let widthInput = {
		type: "integer",
		label: translation.label.panelWidth,
		ref: "appearance.width",
		defaultValue: 150,
		show: function ( data ) {
			return  data.appearance.orientation === 'btn-block' && data.appearance.widthSetting === 'custom';
		}
	};

	let heightInput = {
		type: "integer",
		label: translation.label.panelHeight,
		ref: "appearance.height",
		defaultValue: 150,
		show: function ( data ) {
			return data.appearance.orientation === 'btn-inline' && data.appearance.heightSetting === 'custom';
		}
	};

	let openeEditModal = {
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

	let selectValueCheckbox = {
		type: "boolean",
		label: translation.label.selectDimension,
		ref: "props.alwaysSelectValue",
		defaultValue: false,
		show: function (data) {
			return data.type === 'Single Select';
		}
	};

	let selectValueInput = {
		ref: "props.selectValue",
		type: "string",
		expression: "optional",
		show: function ( data ) {
			return data.props.alwaysSelectValue && data.type !== 'Date Picker';
		}
	};

	let textFamily = {
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

	let textWeight = {
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

	let textStyle = {
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

	let textSize = {
		type: "integer",
		label: translation.label.textSize,
		ref: "appearance.textSize",
		expression: "optional",
		defaultValue: 13
	};

	let textSelectionFamily = {
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

	let textSelectionWeight = {
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

	let textSelectionStyle = {
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

	let textSelectionSize = {
		type: "integer",
		label: translation.label.textSize,
		ref: "appearance.textSelectionSize",
		expression: "optional",
		defaultValue: 11
	};

	let gapTop = {
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

	let gapTopSize = {
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

	let gapBottom = {
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

	let gapBottomSize = {
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

	let gapRight = {
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

	let gapRightSize = {
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

	let gapLeft = {
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

	let gapLeftSize = {
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

	let iconsDropdown = {
		type: "items",
		show: function ( data ) {
			return  data.type !== 'Button Container' && data.type !== 'Button';
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

	let orientationGroup = {
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

	let verticalAlignmentDropdown = {
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

	let widthButtonGrp = {
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

	let vertHeightButtonGrp = {
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

	let heightButtonGrp = {
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

	let textOrientationGrp = {
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
			return  data.type !== 'Button' && data.type !== 'Button Container' && data.type !== 'Variable Input' && data.type !== 'Date Picker' || (data.type === 'Date Picker' && data.props.date && data.props.date.type !== 'range');
		}
	};

	let alignmentHorizontalLabel = {
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

	let alignmentVerticalValue = {
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

	let alignmentHorizontalSelectionLabel = {
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
			return  (data.props.textLayout === 'multi' || (data.type === 'Date Picker' && data.props.date && data.props.date.type === 'range')) && data.type !== 'Variable Input';
		}
	};

	let alignmentVerticalSelectionValue = {
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
			return  (data.props.textLayout === 'multi' || (data.type === 'Date Picker' && data.props.date && data.props.date.type === 'range')) && data.type !== 'Variable Input';
		}
	};

	let selectDimensions = {
		type: "items",
		show: function ( data ) {
			return data.type === "Sense Select" || data.type === "Single Select" || data.type === 'Date Picker';
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

	const dateFormat = {
		type: "items",
		component: selectComponent,
		label: translation.label.format,
		ref: "props.date.format",
		options: function(data, handler, objModel){
			return [
				{
					value: objModel.localeInfo.qDateFmt,
					label: 'Default'
				}, {
					value: "DD/MM/YYYY",
					label: "DD/MM/YYYY",
				}, {
					value: "MM/DD/YYYY",
					label: "MM/DD/YYYY",
				}, {
					value: "MM/YYYY",
					label: "MM/YYYY",
				}, {
					value: "custom",
					label: translation.label.custom,
				}
			];
		},
		defaultValue: function(data, handler, objModel){
			if(objModel){
				return objModel.localeInfo.qDateFmt;
			}
		},
		change: function(data){
			data.props.date.predefines.forEach( (predefine) => {
				if(data.props.date.format === 'custom'){
					predefine.date = data.props.date.customFormat;
				}else{
					predefine.date = data.props.date.format;
				}
			});
		}
	};

	const dateCustomFormat = {
		ref: "props.date.customFormat",
		show: function (data) {
			return data.props.date && data.props.date.format === 'custom';
		},
		label: translation.label.formatCustom,
		type: "string",
		expression: "optional",
		defaultValue: "DD/MM/YYYY",
		change: function(data){
			data.props.date.predefines.forEach( (predefine) => {
				predefine.date = data.props.date.customFormat;
			});
		}
	};

	const dateUseDefaultRange = {
		type: "boolean",
		label: translation.label.selectDimension,
		ref: "props.alwaysSelectValue",
		defaultValue: false
	};

	const dateDefaultStartRange = {
		component: DatePickerComponent,
		ref: "props.date.defaultStartDate",
		show: function (data) {
			return data.props.date && data.props.alwaysSelectValue && data.props.date.type === 'range';
		},
		label: translation.label.start,
		expression: "optional",
		defaultValue: "",
		change: function(data){
			if(data.props.date && (data.props.date.type === 'single' || data.props.date.type === 'multi')){
				data.props.date.defaultEndDate = data.props.date.defaultStartDate;
			}
		}
	};

	const dateDefaultStartSingle = {
		component: DatePickerComponent,
		ref: "props.date.defaultStartDate",
		show: function (data) {
			return data.props.date && data.props.alwaysSelectValue && data.props.date.type !== 'range';
		},
		label: translation.label.date,
		expression: "optional",
		defaultValue: "",
		change: function(data){
			if(data.props.date && (data.props.date.type === 'single' || data.props.date.type === 'multi')){
				data.props.date.defaultEndDate = data.props.date.defaultStartDate;
			}
		}
	};

	const dateDefaultEnd = {
		component: DatePickerComponent,
		ref: "props.date.defaultEndDate",
		show: function (data) {
			return data.props.date && data.props.alwaysSelectValue && data.props.date.type === 'range';
		},
		label: translation.label.end,
		expression: "optional",
		defaultValue: "",
	};

	const dateType = {
		type: "string",
		component: "buttongroup",
		label: translation.label.type,
		ref: "props.date.type",
		options: [{
			value: "single",
			label: translation.label.single,
			tooltip: translation.tooltip.single
		}, {
			value: "multi",
			label: translation.label.multi,
			tooltip: translation.tooltip.multi
		}, {
			value: "range",
			label: translation.label.range,
			tooltip: translation.tooltip.range
		}],
		defaultValue: "single"
	};

	const dateWeekDayOrder = {
		type: "string",
		component: "buttongroup",
		label: translation.label.dateFirstDayOfWeek,
		ref: "props.date.weekdayOrder",
		options: [{
			value: "Mon",
			label: translation.label.monday,
			tooltip: translation.tooltip.firstWeekdayMon
		}, {
			value: "Sun",
			label: translation.label.sunday,
			tooltip: translation.tooltip.firstWeekdaySun
		}],
		defaultValue: "Mon"
	};

	const dateUsePredefines = {
		type: "boolean",
		component: "switch",
		show: function (data) {
			return data.props.date.type === 'range';
		},
		label: translation.label.dateUsePredefines,
		ref: "props.date.usePredefines",
		options: [{
			value: true,
			label: translation.label.custom
		}, {
			value: false,
			label: translation.label.auto
		}],
		defaultValue: false
	};

	const useDefaultPredefines = {
		type: "boolean",
		show: function (data) {
			return data.props.date && data.props.date.usePredefines && data.props.date.type === 'range';
		},
		label: translation.label.defaultPredefines,
		ref: "props.date.useDefaultPredefines",
		defaultValue: true
	};

	const useCustomPredefines = {
		type: "boolean",
		show: function (data) {
			return data.props.date && data.props.date.usePredefines && data.props.date.type === 'range';
		},
		label: translation.label.customPredefines,
		ref: "props.date.useCustomPredefines",
		defaultValue: false
	};

	const datePredfineLabel = {
		ref: "label",
		label: translation.label.label,
		type: "string",
		expression: "optional",
		defaultValue: ""
	};

	const datePredfineStart = {
		component: DatePickerComponent,
		ref: "start",
		label: translation.label.start,
		expression: "optional",
		defaultValue: ""
	};

	const datePredfineEnd = {
		component: DatePickerComponent,
		ref: "end",
		label:translation.label.end,
		expression: "optional",
		defaultValue: ""
	};

	const customPredefinesList = {
		type: "array",
		show: function (data) {
			return data.props.date && data.props.date.usePredefines && data.props.date.useCustomPredefines && data.props.date.type === 'range';
		},
		ref: "props.date.predefines",
		label: translation.label.customPredefines,
		itemTitleRef: "label",
		allowAdd: true,
		allowRemove: false,
		addTranslation: translation.label.addPredefines,
		items: {
			datePredfineLabel: datePredfineLabel,
			datePredfineStart: datePredfineStart,
			datePredfineEnd: datePredfineEnd,
		},
		add: function(data, parentData){
			const parentProps = parentData.props.date;
			data.format = parentProps.format === 'custom' ? parentProps.customFormat : parentProps.format
		}
	};

	const datePickerProperties = {
		type: 'items',
		show: function (data) {
			return data.type === 'Date Picker';
		},
		items: {
			seperatorDateOptions: createLabelSeparator(labelTrans.dateOptions),
			dateType: dateType,
			dateWeekDayOrder: dateWeekDayOrder,
			dateFormat: dateFormat,
			dateCustomFormat: dateCustomFormat,
			dateUseDefaultRange: dateUseDefaultRange,
			dateDefaultStartRange: dateDefaultStartRange,
			dateDefaultStartSingle: dateDefaultStartSingle,
			dateDefaultEnd: dateDefaultEnd,
			dateUsePredefines: dateUsePredefines,
			useDefaultPredefines: useDefaultPredefines,
			useCustomPredefines: useCustomPredefines,
			customPredefinesList: customPredefinesList,
		}
	};

	const variableSliderType = {
		type: "string",
		component: "dropdown",
		label: translation.label.type,
		ref: "props.variableSlider.type",
		options: [{
			value: "single",
			label: translation.label.single,
			tooltip: translation.tooltip.single
		}, {
			value: "range",
			label: translation.label.range,
			tooltip: translation.tooltip.range
		}, {
			value: "multi",
			label: translation.label.multi,
			tooltip: translation.tooltip.multi
		}],
		defaultValue: "single"
	};

	const variableSliderOrientation = {
		type: "string",
		component: customCmp.buttongroup,
		label: translation.label.orientation,
		ref: "props.variableSlider.orientation",
		options: [
			{
				value: "vertical",
				label: translation.label.vertical
			}, {
				value: "horizontal",
				label: translation.label.horizontal
			}
		],
		defaultValue: "horizontal"
	};

	const variableSliderValueType = {
		type: "string",
		component: "dropdown",
		label: translation.label.dataType,
		ref: "props.variableSlider.valueType",
		options: [{
			value: "numeric",
			label: translation.label.numeric,
			tooltip: translation.tooltip.numeric
		}, {
			value: "date",
			label: translation.label.date,
			tooltip: translation.tooltip.date
		}, {
			value: "string",
			label: translation.label.string,
			tooltip: translation.tooltip.string
		}],
		defaultValue: "numeric",
	};

	const variableSliderDateFormat = {
		ref: "props.variableSlider.dateformat",
		show: function (data) {
			return data.props.variableSlider && data.props.variableSlider.valueType === 'date';
		},
		label: translation.label.format,
		type: "string",
		expression: "optional",
		defaultValue: "dd/mm/yyyy",
	};

	const variableSliderVariableName = {
		ref: "props.variableSlider.variable",
		show: function (data) {
			const variableSlider = data.props.variableSlider;
			return variableSlider && variableSlider.type === 'single';
		},
		label: translation.label.variableName,
		type: "string",
		expression: "optional",
		defaultValue: "",
	};

	const variableSliderVariableDefault = {
		ref: "props.variableSlider.variableDefault",
		show: function (data) {
			const variableSlider = data.props.variableSlider;
			return variableSlider && variableSlider.type === 'single';
		},
		label: translation.label.selectDimension,
		type: "string",
		expression: "optional",
		defaultValue: "",
	};

	const variableSliderStartVariableName = {
		ref: "props.variableSlider.variableStart",
		show: function (data) {
			return data.props.variableSlider && data.props.variableSlider.type === 'range';
		},
		label: translation.label.variableNameStart,
		type: "string",
		expression: "optional",
		defaultValue: "",
	};

	const variableSliderStartVariableDefault = {
		ref: "props.variableSlider.variableStartDefault",
		show: function (data) {
			return data.props.variableSlider && data.props.variableSlider.type === 'range';
		},
		label: translation.label.defaultStartValue,
		type: "string",
		expression: "optional",
		defaultValue: "0",
	};

	const variableSliderEndVariableName = {
		ref: "props.variableSlider.variableEnd",
		show: function (data) {
			return data.props.variableSlider && data.props.variableSlider.type === 'range';
		},
		label: translation.label.variableNameEnd,
		type: "string",
		expression: "optional",
		defaultValue: "",
	};

	const variableSliderEndVariableDefault = {
		ref: "props.variableSlider.variableEndDefault",
		show: function (data) {
			return data.props.variableSlider && data.props.variableSlider.type === 'range';
		},
		label: translation.label.defaultEndValue,
		type: "string",
		expression: "optional",
		defaultValue: "0",
	};

	const variableSliderMinValue = {
		ref: "props.variableSlider.minValue",
		label: translation.label.minValue,
		type: "string",
		expression: "optional",
		defaultValue: "0",
		change: function(data){
			data.props.variableSlider = data.props.variableSlider || {}; //intellij is unhappy when we dont check if the object exists
			const sliderProps = data.props.variableSlider,
				minValue = parseInt(sliderProps.minValue),
				maxValue = parseInt(sliderProps.maxValue),
				steps = parseInt(sliderProps.steps);

			if(minValue + steps > maxValue){
				data.props.variableSlider.maxValue = (minValue + steps).toString();
			}
		},
		show: function(data){
			return data.props.variableSlider && data.props.variableSlider.valueType !== 'string';
		}
	};

	const variableSliderMaxValue = {
		ref: "props.variableSlider.maxValue",
		label: translation.label.maxValue,
		type: "string",
		expression: "optional",
		defaultValue: "100",
		change: function(data){
			data.props.variableSlider = data.props.variableSlider || {}; //intellij is unhappy when we dont check if the object exists
			const sliderProps = data.props.variableSlider,
				minValue = parseInt(sliderProps.minValue),
				maxValue = parseInt(sliderProps.maxValue),
				steps = parseInt(sliderProps.steps);

			if(minValue + steps > maxValue){
				data.props.variableSlider.minValue = (maxValue - steps).toString();
			}
		},
		show: function(data){
			return data.props.variableSlider && data.props.variableSlider.valueType !== 'string';
		}
	};

	const variableSliderShowMinMax = {
		type: "boolean",
		component: "switch",
		label: translation.label.showMinMax,
		ref: "props.variableSlider.showMinMax",
		options: [{
			value: true,
			label: translation.label.on
		}, {
			value: false,
			label: translation.label.off
		}],
		defaultValue: false
	};

	const variableSliderShowValues = {
		type: "boolean",
		component: "switch",
		label: translation.label.showValues,
		ref: "props.variableSlider.showValues",
		options: [{
			value: true,
			label: translation.label.on
		}, {
			value: false,
			label: translation.label.off
		}],
		defaultValue: false
	};

	const variableSliderSteps = {
		ref: "props.variableSlider.steps",
		label: translation.label.frequency,
		type: "string",
		expression: "optional",
		defaultValue: "1",
		show: function(data){
			return data.props.variableSlider && data.props.variableSlider.valueType !== 'string';
		},
		change: function(data){
			if(data.props.variableSlider.steps < 0){
				data.props.variableSlider.steps = Math.abs(data.props.variableSlider.steps).toString();
			}else if(isNaN(data.props.variableSlider.steps)){
				data.props.variableSlider.steps = '1';
			}
		}
	};

	const variableSliderVariableNameMulti = {
		ref: "variableName",
		label: translation.label.variableName,
		type: "string",
		expression: "optional",
		defaultValue: "",
	};

	const variableSliderVariableMultiDefault = {
		ref: "variableDefault",
		label: translation.label.selectDimension,
		type: "string",
		expression: "optional",
		defaultValue: "0",
	};

	const variableSliderMultiHandles= {
		type: "array",
		show: function (data) {
			return data.props.variableSlider && data.props.variableSlider.type === 'multi';
		},
		ref: "props.variableSlider.multiHandles",
		label: translation.label.variableList,
		itemTitleRef: "variableName",
		allowAdd: true,
		allowRemove: false,
		addTranslation: translation.label.addVariable,
		items: {
			variableSliderVariableNameMulti: variableSliderVariableNameMulti,
			variableSliderVariableMultiDefault: variableSliderVariableMultiDefault,
		},
	};

	const variableSliderStrings = {
		type: 'array',
		show: function(data){
			return data.props.variableSlider && data.props.variableSlider.valueType === 'string';
		},
		ref: 'props.variableSlider.strings',
		label: translation.label.stringList,
		itemTitleRef: 'value',
		allowAdd: true,
		allowRemove: false,
		addTranslation: translation.label.addString,
		items: {
			variableSliderStringValue: createStringInput(labelTrans.variableValue, 'value', ''),
			variableSliderStringLabel: createStringInput(labelTrans.label, 'label', ''),
		},
	};

	const variableSliderProperties = {
		type: 'items',
		show: function (data) {
			return data.type === 'Variable Slider';
		},
		items: {
			seperatorVarSliderOptions: createLabelSeparator(labelTrans.variableSliderOptions),
			variableSliderType: variableSliderType,
			variableSliderValueType: variableSliderValueType,
			variableSliderOrientation: variableSliderOrientation,
			variableSliderDateFormat: variableSliderDateFormat,
			variableSliderVariableName: variableSliderVariableName,
			variableSliderVariableDefault: variableSliderVariableDefault,
			variableSliderStartVariableName: variableSliderStartVariableName,
			variableSliderStartVariableDefault: variableSliderStartVariableDefault,
			variableSliderEndVariableName: variableSliderEndVariableName,
			variableSliderEndVariableDefault: variableSliderEndVariableDefault,
			variableSliderMinValue: variableSliderMinValue,
			variableSliderMaxValue: variableSliderMaxValue,
			variableSliderShowMinMax: variableSliderShowMinMax,
			variableSliderShowValues: variableSliderShowValues,
			variableSliderSteps: variableSliderSteps,
			variableSliderMultiHandles: variableSliderMultiHandles,
			variableSliderStrings: variableSliderStrings,
		}
	};

	const variableInputType = {
		type: 'string',
		component: 'dropdown',
		label: translation.label.type,
		ref: 'props.variableInput.type',
		options: [
			{
				value: 'Text',
				label: translation.label.Text
			}, {
				value: 'Number',
				label: translation.label.numeric
			}, {
				value: 'Decimal',
				label: translation.label.decimal
			}, {
				value: 'Date',
				label: translation.label.date
			}
		],
		defaultValue: 'Text',
		change: function(data, handler, layout, objModel){
			if(data.props.variableInput.type === 'Decimal'){
				data.props.variableInput.decimalSep = objModel.localeInfo.qDecimalSep || ',';
			}
		}

	};

	const variableInputDateFormat = {
		ref: "props.variableInput.dateformat",
		show: function (data) {
			return data.props.variableInput && data.props.variableInput.type === 'Date';
		},
		label: translation.label.format,
		type: "string",
		expression: "optional",
		defaultValue: "dd/mm/yyyy",
	};

	const variableInputVariableName = {
		ref: "props.variableInput.variable",
		label: translation.label.variableName,
		type: "string",
		expression: "optional",
		defaultValue: "",
	};

	const variableInputVariableDefault = {
		ref: "props.variableInput.variableDefault",
		label: translation.label.selectDimension,
		type: "string",
		expression: "optional",
		defaultValue: "0",
	};

	const variableInputOrientation = {
		type: "string",
		component: customCmp.buttongroup,
		label: translation.label.labelAlignementVertical,
		ref: "props.variableInput.verAlignLabel",
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
		defaultValue: "center"
	};

	const variableInputOrientationHorizontal = {
		type: "string",
		component: customCmp.buttongroup,
		label: translation.label.labelAlignementHorizontal,
		ref: "props.variableInput.horAlignLabel",
		options: [
			{
				value: "left",
				label: translation.label.left,
				tooltip: translation.tooltip.left
			}, {
				value: "center",
				label: translation.label.center,
				tooltip: translation.tooltip.center
			}, {
				value: "right",
				label: translation.label.right,
				tooltip: translation.tooltip.right
			}
		],
		defaultValue: "center"
	};

	const variableInputProperties = {
		type: 'items',
		show: function (data) {
			return data.type === 'Variable Input';
		},
		items: {
			seperatorInputOptions: createLabelSeparator(labelTrans.variableInputOptions),
			variableInputType: variableInputType,
			variableInputDateFormat: variableInputDateFormat,
			variableInputVariableName: variableInputVariableName,
			variableInputVariableDefault: variableInputVariableDefault,
			variableInputPlaceholder: createStringInput(labelTrans.placeholder, 'props.variableInput.placeholder', ''),
			variableInputRequired: createCheckbox(labelTrans.required, 'props.variableInput.isRequired', true),
			variableInputOrientation: variableInputOrientation,
			variableInputOrientationHorizontal: variableInputOrientationHorizontal,
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

	let typeDropdown = {
		type: 'items',
		items: {
			MyDropdownProp: {
				type: 'string',
				component: 'dropdown',
				label: translation.label.type,
				ref: 'type',
				options: [
					{
						value: 'Button',
						label: translation.label.button
					}, {
						value: 'Button Container',
						label: translation.label.buttonContainer
					}, {
						value: 'Date Picker',
						label: translation.label.datePicker
					}, {
						value: 'Single Select',
						label: translation.label.singleSelect
					}, {
						value: 'Sense Select',
						label: translation.label.senseSelect
					}, {
						value: 'Variable Dropdown',
						label: translation.label.variableDropdown
					}, {
						value: 'Variable Slider',
						label: translation.label.variableSlider
					}, {
						value: 'Variable Input',
						label: translation.label.variableInput
					}, {
						value: 'Group',
						label: translation.label.group
					}
				],
				defaultValue: 'Button Container'
			}
		}
	};

	let groupTypeDropdown = {
		type: "items",
		items: {
			MyDropdownProp: {
				type: "string",
				component: "dropdown",
				label: translation.label.type,
				ref: "type",
				options: [
					{
						value: 'Button',
						label: translation.label.button
					}, {
						value: 'Button Container',
						label: translation.label.buttonContainer
					}, {
						value: 'Date Picker',
						label: translation.label.datePicker
					}, {
						value: 'Single Select',
						label: translation.label.singleSelect
					}, {
						value: 'Sense Select',
						label: translation.label.senseSelect
					}, {
						value: 'Variable Dropdown',
						label: translation.label.variableDropdown
					}, {
						value: 'Variable Slider',
						label: translation.label.variableSlider
					}, {
						value: 'Variable Input',
						label: translation.label.variableInput
					}
				],
				defaultValue: "Button Container"
			}
		}
	};

	let stateItem = {
		type: "items",
		get defaultValue(){
			return  new State();
		}
	};

	let stateItems = {
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
			let state = new State();
			delete state.condition;

			angular.extend(data, state);

			model.setProperties(model.properties);

			data.type = 'buttonState';
			data.cId = _utilService.generateGuid();
		},
		addTranslation: translation.label.addState,
		items: {
			copyPaste: copyPaste,
			openEditModal: openeEditModal,
			conditionInput: conditionInput,
			conditionNameInput: createStringInput(labelTrans.conditionNameInput, 'props.conditionName', ''),
			state: stateItem
		},
		defaultValue: [stateItem.defaultValue]
	};

	let singleButtonItem = {
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
			stateItems: JSON.parse(JSON.stringify(stateItems.defaultValue)),
			type: 'subButton'
		}
	};

	let buttonItem = {...singleButtonItem, items: {copyPaste: copyPaste, ...singleButtonItem.items}};

	let buttonItems = {
		component: customCmp.list,
		type: "array",
		ref: "subItems",
		itemTitleRef: 'props.buttonName',
		add: function(data){
			data.props.buttonName = data.stateItems[0].text;
			data.type = 'subButton';
			data.cId = _utilService.generateGuid();
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

	let singleButton = {
		type: "items",
		show: function ( data ) {
			return data.type === "Button" || data.subType === "Button";
		},
		items: {
			buttonItem: singleButtonItem
		}
	};

	let variableDropdown = {
		type: "items",
		show: function ( data ) {
			return data.type === "Variable Dropdown";
		},
		items: {
			MyList: {
				component: customCmp.list,
				type: "array",
				ref: "variableItems",
				add: function(item){
					item.cId = _utilService.generateGuid();
				},
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

	let buttonContainer = {
		type: "items",
		show: function ( data ) {
			return data.type === "Button Container";
		},
		itemTitleRef: 'props.buttonName',
		items: {
			buttons: buttonItems
		}
	};

	let group = {
		type: "items",
		show: function ( data ) {
			return data.type === "Group";
		},
		items: {
			MyList: {
				component: customCmp.list,
				type: 'array',
				allowAdd: true,
				allowRemove: false,
				allowMove: true,
				addTranslation: translation.label.addItem,
				add: function(item){
					_utilService.replaceListItemsIdsRecursiv([item]);
				},
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
				ref: 'groupItems',
				items: {
					copyPaste: copyPaste,
					groupTypeDropdown: groupTypeDropdown,
					buttonNameInput: createStringInput(labelTrans.buttonNameInput, 'props.buttonName', ''),
					showCondition: showConditionInput,
					variableName: variableInput,
					selectDimension: selectDimensions,
					showToolbar: showToolbar,
					selectValueCheckbox: selectValueCheckbox,
					selectValueInput: selectValueInput,
					widthSwitch: sizeSwitch,
					groupHeightItemInput: groupHeightItemInput,
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
					datePickerProperties: datePickerProperties,
					variableSliderProperties: variableSliderProperties,
					variableInputProperties: variableInputProperties,
					variableArray: variableDropdown,
					stateItems: singleButton,
					itemsArray: buttonContainer,
				}
			}
		}
	};

	const panelList = {
		component: customCmp.list,
		type: 'array',
		ref: 'listItems',
		add: function(item){
			_utilService.replaceListItemsIdsRecursiv([item]);
		},
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
			copyPaste: copyPaste,
			typedropwdown: typeDropdown,
			buttonNameInput: createStringInput(labelTrans.buttonNameInput, 'props.buttonName', ''),
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
			datePickerProperties: datePickerProperties,
			variableSliderProperties: variableSliderProperties,
			variableInputProperties: variableInputProperties,
			variableArray: variableDropdown,
			stateItems: singleButton,
			itemsArray: buttonContainer,
			groupElement: group
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
			seperator1: createSeparator(),
			qSortByLoadOrderCheckbox: qSortByLoadOrderCheckbox,
			qSortByLoadOrder: qSortByLoadOrder,
			seperator2: createSeparator(function (item) {return !item.qDef.autoSort;}),
			qSortByStateCheckbox: qSortByStateCheckbox,
			qSortByState: qSortByState,
			seperator3: createSeparator(function (item) {return !item.qDef.autoSort;}),
			qSortByFrequencyCheckbox: qSortByFrequencyCheckbox,
			qSortByFrequency: qSortByFrequency,
			seperator4: createSeparator(function (item) {return !item.qDef.autoSort;}),
			qSortByNumericCheckbox: qSortByNumericCheckbox,
			qSortByNumeric: qSortByNumeric,
			seperator5: createSeparator(function (item) {return !item.qDef.autoSort;}),
			qSortByAsciiCheckbox: qSortByAsciiCheckbox,
			qSortByAscii: qSortByAscii,
			seperator6: createSeparator(function (item) {return !item.qDef.autoSort;}),
			qSortByExpressionCheckbox: qSortByExpressionCheckbox,
			sortExpression: sortExpression,
			qSortByExpression: qSortByExpression,
		}
	};

	const hyperCubeModeSwitch = {
		type: "string",
		component: "switch",
		label: translation.label.dimensionCalculation,
		ref: "qHyperCubeDef.qMode",
		options: [{
			value: 'K',
			label: translation.label.off
		}, {
			value: 'S',
			label: translation.label.on
		}],
		defaultValue: 'K'
	};

	// *****************************************************************************
	// Panel section
	// *****************************************************************************
	let panelDefinitionSection = {
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
							calcCondVar: calcCondVar,
							hyperCubeModeSwitch,
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
							height: heightInput,
							verticalAlignment: verticalAlignmentDropdown,
						}
					},
					gaps: {
						type: "items",
						label: translation.label.gaps,
						items: {
							gapTop: gapTop,
							gapTopSize: gapTopSize,
							seperator: createSeparator(),
							gapBottom: gapBottom,
							gapBottomSize: gapBottomSize,
							seperator1: createSeparator(),
							gapLeft: gapLeft,
							gapLeftSize: gapLeftSize,
							seperator2: createSeparator(),
							gapRight: gapRight,
							gapRighttSize: gapRightSize
						}
					},
					colors: {
						type: "items",
						label: translation.label.colors,
						items: {
							seperatorLabelColorMain: createLabelSeparator(labelTrans.menuMain),
							backgroundColorPicker: createColorPickerComponent(labelTrans.backgroundColor,'appearance.backgroundColor','rgb(245,245,245)'),
							hoverActiveColorPicker: createColorPickerComponent(labelTrans.hoverActiveColor,'appearance.hoverActiveColor','rgb(159,159,159)'),
							textColorPicker: createColorPickerComponent(labelTrans.textColor,'appearance.textColor','rgb(89,89,89)'),
							colorPickerHoverText: createColorPickerComponent(labelTrans.textHoverColor,'appearance.textHoverColor','rgb(89,89,89)'),
							borderSeparatorColorPicker: createColorPickerComponent(labelTrans.borderSeperatorColor,'appearance.borderSeparatorColor','rgb(179,179,179)'),

							seperatorLabelColorSub: createLabelSeparator(labelTrans.menuSub),
							subItemBackgroundColorPicker: createColorPickerComponent(labelTrans.backgroundColor,'appearance.subItemBackgroundColor','rgb(217,217,217)'),
							hoverSubItemColorPicker: createColorPickerComponent(labelTrans.hoverActiveColor,'appearance.hoverSubItemColor','rgb(165,165,165)'),
							colorPickerSubText: createColorPickerComponent(labelTrans.textColor,'appearance.textSubColor','rgb(89,89,89)'),
							colorPickerHoverSubText: createColorPickerComponent(labelTrans.textHoverColor,'appearance.textHoverSubColor','rgb(89,89,89)'),
							subItemSeparatorColorPicker: createColorPickerComponent(labelTrans.borderSeperatorColor,'appearance.subItemSeparatorColor','rgb(150,150,150)'),

							seperatorLabelColorSelection: createLabelSeparator(labelTrans.selections),
							colorPickerSelectionSelected: createColorPickerComponent(labelTrans.selections,'appearance.selectionSelected','rgb(82, 204, 82)'),
							colorPickerSelectionNormal: createColorPickerComponent(labelTrans.normal,'appearance.selectionNormal','rgb(255, 255, 255)'),
							colorPickerSelectionAlternative: createColorPickerComponent(labelTrans.alternative,'appearance.selectionAlternative','rgb(221, 221, 221)'),
							colorPickerSelectionExcluded: createColorPickerComponent(labelTrans.excluded,'appearance.selectionExcluded','rgb(169, 169, 169)'),
							colorPickerSelectionSelectedBorder: createColorPickerComponent(labelTrans.selectionsBorder,'appearance.selectionSelectedBorder','rgb(255, 255, 255)'),
							colorPickerSelectionNormalBorder: createColorPickerComponent(labelTrans.normalBorder,'appearance.selectionNormalBorder', 'rgb(221,221,221)'),
							colorPickerSelectionAlternativeBorder: createColorPickerComponent(labelTrans.alternativeBorder,'appearance.selectionAlternativBorder','rgb(255, 255, 255)'),
							colorPickerSelectionExcludedBorder: createColorPickerComponent(labelTrans.excludedBorder,'appearance.selectionExcludedBorder','rgb(255, 255, 255)'),
							colorPickerSelectionSelectedText: createColorPickerComponent(labelTrans.selectionsText,'appearance.selectionSelectedText','rgb(255, 255, 255)'),
							colorPickerSelectionNormalText: createColorPickerComponent(labelTrans.normalText,'appearance.selectionNormalText','rgb(89, 89, 89)'),
							colorPickerSelectionAlternativeText: createColorPickerComponent(labelTrans.alternativeText,'appearance.selectionAlternativeText','rgb(89, 89, 89)'),
							colorPickerSelectionExcludedText: createColorPickerComponent(labelTrans.excludedText,'appearance.selectionExcludedText','rgb(89, 89, 89)'),

							seperatorLabelColorDatePicker: createLabelSeparator(labelTrans.datePicker),
							colorPickerDatePickerButtonsColor: createColorPickerComponent(labelTrans.buttons,'appearance.datePickerButtonsColor','rgb(255, 192, 96)'),
							colorPickerDatePickerSelectedStartColor: createColorPickerComponent(labelTrans.selectionStart,'appearance.datePickerSelectedStartColor','rgb(255, 65, 24)'),
							colorPickerDatePickerSelectedEndColor: createColorPickerComponent(labelTrans.selectionEnd,'appearance.datePickerSelectedEndColor','rgb(255, 5, 5)'),
							colorPickerDatePickerActiveColor: createColorPickerComponent(labelTrans.active,'appearance.datePickerActiveColor','rgb(255, 215, 140)'),
							colorPickerDatePickerNotAllowedColor: createColorPickerComponent(labelTrans.notAllowed,'appearance.datePickerNotAllowedColor','rgb(152, 152, 152)'),
							colorPickerDatePickerButtonHoverColor: createColorPickerComponent(labelTrans.buttonsHover,'appearance.datePickerButtonHoverColor','rgb(255, 133, 3)'),
							colorPickerDatePickerPickerHoverColer: createColorPickerComponent(labelTrans.datePickerHover,'appearance.datePickerPickerHoverColer','rgb(255, 133, 3)'),
							colorPickerDatePickerButtonsText: createColorPickerComponent(labelTrans.buttonsText,'appearance.datePickerButtonsText','rgb(0, 0, 0)'),
							colorPickerDatePickerElementText: createColorPickerComponent(labelTrans.elementText,'appearance.datePickerElementText','rgb(0, 0, 0)'),
							colorPickerDatePickerActiveText: createColorPickerComponent(labelTrans.activeText,'appearance.datePickerActiveText','rgb(0, 0, 0)'),
							colorPickerDatePickerSelectedStartText: createColorPickerComponent(labelTrans.selectionStartText,'appearance.datePickerSelectedStartText','rgb(0, 0, 0)'),
							colorPickerDatePickerSelectedEndText: createColorPickerComponent(labelTrans.selectionEndText,'appearance.datePickerSelectedEndText','rgb(0, 0, 0)'),
							colorPickerDatePickerInactiveText: createColorPickerComponent(labelTrans.inactiveText,'appearance.datePickerInactiveText','rgb(208, 207, 207)'),
							colorPickerDatePickerNotAllowedText: createColorPickerComponent(labelTrans.notAllowedText,'appearance.datePickerNotAllowedText','rgb(255, 255, 255)'),
							colorPickerDatePickerButtonHoverText: createColorPickerComponent(labelTrans.buttonsHoverText,'appearance.datePickerButtonHoverText','rgb(0, 0, 0)'),
							colorPickerDatePickerPickerHoverText: createColorPickerComponent(labelTrans.datePickerHoverText,'appearance.datePickerPickerHoverText','rgb(0, 0, 0)'),

							seperatorLabelSlider: createLabelSeparator(labelTrans.slider),
							colorPickerVariableSliderBackground: createColorPickerComponent(labelTrans.backgroundColor,'appearance.variableSliderBackground','rgb(233, 233, 233)'),
							colorPickerVariableSliderTrack: createColorPickerComponent(labelTrans.track,'appearance.variableSliderTrack','rgb(248, 152, 29)'),
							colorPickerVariableSliderHandle: createColorPickerComponent(labelTrans.handle,'appearance.variableSliderHandle','rgb(248, 152, 29)'),
							colorPickerVariableSliderSteps: createColorPickerComponent(labelTrans.steps,'appearance.variableSliderSteps','rgb(217, 217, 217)'),
							colorPickerVariableSliderActiveSteps: createColorPickerComponent(labelTrans.activeSteps,'appearance.variableSliderActiveSteps','rgb(248, 152, 29)'),

							seperatorVariableInput: createLabelSeparator(labelTrans.variableInput),
							colorPickerVariableInputBackground: createColorPickerComponent(labelTrans.backgroundColor,'appearance.variableInputBackground','rgb(255, 255, 255)'),
							colorPickerVariableInputText: createColorPickerComponent(labelTrans.text,'appearance.variableInputText','rgb(0, 0, 0)'),
							colorPickerVariableInputPlaceholder: createColorPickerComponent(labelTrans.placeholder,'appearance.variableInputPlaceholder','rgb(151, 151, 151)'),
							colorPickerVariableInputFocus: createColorPickerComponent(labelTrans.focus,'appearance.variableInputFocus','rgba(82, 162, 204, 0.7)'),
							colorPickerVariableInputInvalid: createColorPickerComponent(labelTrans.invalid,'appearance.variableInputInvalid','rgba(224,58,58,.7)'),
						}
					},
					text: {
						type: "items",
						label: translation.label.text,
						items: {
							seperatorLabelTextLabel: createLabelSeparator(labelTrans.label),
							textFamily: textFamily,
							textWeight: textWeight,
							textStyle: textStyle,
							textSize: textSize,

							seperatorLabelTextSub: createLabelSeparator(labelTrans.selectionLabel),
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
							seperator: createSeparator(),
							selectionBar: createDisplayBtnGrp('appearance.displaySenseSelectionBar', translation.label.senseSelectionBar),
							selectionBarExpr: createDisplayExpression('appearance.displaySenseSelectionBarExpr', '', function(data){
								return data.appearance && data.appearance.displaySenseSelectionBar === '2';
							}),
							seperator1: createSeparator(),
							titleBar: createDisplayBtnGrp('appearance.displaySenseTitleBar', translation.label.senseTitleBar),
							titleBarExpr: createDisplayExpression('appearance.displaySenseTitleBarExpr', '', function(data){
								return data.appearance && data.appearance.displaySenseTitleBar === '2';
							}),
							seperator2: createSeparator(),
							showSenseSnapshotButton: createDisplayBtnGrp('appearance.showSenseSnapshotButton', translation.label.senseSnapshotButton),
							showSenseSnapshotButtonExpr: createDisplayExpression('appearance.showSenseSnapshotButtonExpr', '', (data) =>{
								return data.appearance && data.appearance.showSenseSnapshotButton === '2';
							}),
							seperator3: createSeparator(),
							showSenseFullScreenButton: createDisplayBtnGrp('appearance.showSenseFullScreenButton', translation.label.senseFullScreenButton),
							showSenseFullScreenButtonExpr: createDisplayExpression('appearance.showSenseFullScreenButtonExpr', '', (data) =>{
								return data.appearance && data.appearance.showSenseFullScreenButton === '2';
							})
						}
					}
				}
			},
			information: {
				type: "items",
				label: translation.label.information,
				items: {
					information: information,
					updateButton: updateButton,
					repairButton: repairButton,
				}
			},
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
				let cmp;

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

	/**
	 * Resets sorting criterias to defaults
	 *
	 * @param qDef
	 */
	function switchSortCriterias(qDef){
		qDef.qSortCriterias.forEach((sortCrit, i) => {
			qDef.qSortCriterias[i].qSortByStateCheck = false;
			qDef.qSortCriterias[i].qSortByState = 0;
			qDef.qSortByState = 0;
			qDef.qSortByStateCheck = false;
			qDef.qSortCriterias[i].qSortByLoadOrderCheck = true;
			qDef.qSortCriterias[i].qSortByLoadOrder = 1;
			qDef.qSortByLoadOrder = 1;
			qDef.qSortByLoadOrderCheck = true;
			qDef.qSortCriterias[i].qSortByAsciiCheck = true;
			qDef.qSortCriterias[i].qSortByAscii = 1;
			qDef.qSortByAscii = 1;
			qDef.qSortByAsciiCheck = true;
			qDef.qSortCriterias[i].qSortByNumericCheck = false;
			qDef.qSortCriterias[i].qSortByNumeric = 0;
			qDef.qSortByNumeric = 0;
			qDef.qSortByNumericCheck = false;
			qDef.qSortCriterias[i].qSortByFrequencyCheck = false;
			qDef.qSortCriterias[i].qSortByFrequency = 0;
			qDef.qSortByFrequency = 0;
			qDef.qSortByFrequencyCheck = false;
			qDef.qSortCriterias[i].qSortByExpressionCheck = false;
			qDef.qSortCriterias[i].qExpression = { qv: ''};
			qDef.qExpression = { qv: ''};
			qDef.qSortByExpressionCheck = false;
		});
	}
}

export const properties = Properties();
