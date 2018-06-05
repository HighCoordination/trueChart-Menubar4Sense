import * as $ from 'jquery';
import * as qvangular from 'qvangular';
import {$timeout} from './AngularService';
import * as moment from 'moment';
import {QlikService} from '../../lib/hico/services/qlik-service';

Date.prototype.addDays = function(days){
	let dat = new Date(this.valueOf());
	dat.setDate(dat.getDate() + days);
	return dat;
};

Date.prototype.addMonths = function(months){
	let dat = new Date(this.valueOf());
	dat.setMonth(dat.getMonth() + months);
	return dat;
};

Date.prototype.addYears = function(years){
	let dat = new Date(this.valueOf());
	dat.setFullYear(dat.getFullYear() + years);
	return dat;
};

Date.prototype.getUtcTimeStamp = function(){
	let todayDate = new Date(this.valueOf()),
		dat = new Date(todayDate.getFullYear(),todayDate.getMonth(),todayDate.getDate()),
		timeZoneOffset = dat.getTimezoneOffset(),
		offSetPositive = timeZoneOffset > 0,
		offSet = Math.abs(timeZoneOffset) / 60,
		msOffset = offSet * 60 * 60 * 1000,
		utcTimeStamp;

	if(offSetPositive){
		utcTimeStamp = dat.getTime() - msOffset;
	}else{
		utcTimeStamp = dat.getTime() + msOffset;
	}

	return utcTimeStamp;
};

Date.prototype.isValid = function () {
	return !isNaN(this.getTime());
};

export class UtilService {
	static getInstance(){
		return qvangular.getService('utilService');
	}

	static menuId = 0;
	static panelWidth = 200;
	static dayInMs = 86400000; //exact amount of ms of one day! Today you learned :)

	constructor(){

		this.isMobile = false;
		this.copyStorage = null;
		this.screenWidth = !QlikService.isPrinting() ? window.innerWidth : 1000;


		if(/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)){
			this.isMobile = true;
		}

		this.setCopyStorage = function(copyStorage){
			this.copyStorage = copyStorage;
		};

		this.getCopyStorage = function(){
			return this.copyStorage;
		};

		this.closeMenus = function(listItems, cId){
			listItems.forEach(function(listitem){
				if(listitem.cId !== cId){
					listitem.isOpen = false;
					listitem.show = false;
					qvangular.$rootScope.tcmenuNoScroll = true;
				}
			});
		};

		this.handleMenuScroll = function(itemId){
			let $item = $('#item_' + itemId)[0];
			let $menu = this.findParentByIdPrefix($item, 'hico-menu-vertical_');

			if(!$menu){
				// horizontal menu is special
				$menu = this.findParentByIdPrefix($item, 'panel_');
				if($menu){
					$menu = $menu.children[0];
				}
			}

			let offset = $item.offsetTop;
			let $parentItem = this.findParentByIdPrefix($item, 'item_');
			if($parentItem){
				offset += $parentItem.offsetTop;
			}

			if($menu){
				$($menu).animate({scrollTop: offset}, {
					duration: 'slow',
					easing: 'swing'
				});
			}
		};

		this.findParentByIdPrefix = function($item, idPrefix){
			let $parent = $item.parentElement;
			if($parent === null){
				return null;
			}

			if($parent.id && $parent.id.indexOf(idPrefix) === 0){
				return $parent;
			}

			return this.findParentByIdPrefix($parent, idPrefix);
		};

		/**
		 * Check if item have numeric numeric data entries
		 * @param {object} item - listItem (i.e. Single Select)
		 * @return {boolean} - true, if data is numeric, otherwise false
		 */
		this.checkNumeric = function(item){
			let isNumeric = true;
			if(!item.selectValues){
				return false;  // no values to check
			}
			let qMatrix = item.selectValues.qDataPages[0].qMatrix;

			for(let i = 0; i < qMatrix.length && i < 5 && isNumeric; i++){ // check first 5 elements if they have numeric type (5 should be enough!?)

				if(qMatrix[i][0].qText){
					isNumeric = qMatrix[i][0].qText.match(/^[0-9.\-\/: ,]+$/g) !== null;
				}
			}
			return isNumeric;
		};
	}

	/**
	 * calculate the x position of the dropdown
	 * @param element
	 * @returns {number|undefined}
	 */
	static getDropdownOffsetX(element){
		let clientRect = element[0].getBoundingClientRect(),
			screenWidth = window.innerWidth,
			positionCorrection = UtilService.panelWidth - (screenWidth - clientRect.left),
			positionCorrectionRight = (screenWidth - clientRect.right),
			retVal = 0,
			rectLeft = clientRect.left;

		if(QlikService.getInstance().inPlayMode()){
			return undefined;
		}

		if(rectLeft + UtilService.panelWidth > screenWidth){
			retVal = rectLeft - (positionCorrection + positionCorrectionRight);
		}else{
			retVal = rectLeft;
		}

		return retVal;
	};

	/**
	 * calculate the y position of the dropdown
	 * @param element
	 * @param panel
	 * @returns {number}
	 */
	static getDropdownOffsetY(element, panel){

		let clientRect = element[0].getBoundingClientRect(),
			clientPanel = panel[0].getBoundingClientRect(),
			screenheight = window.innerHeight,
			retVal = -1;

		if(clientRect.bottom + clientPanel.height > screenheight){
			retVal = (clientRect.top - clientPanel.height);
		}else{
			retVal = clientRect.bottom;
		}

		return retVal;
	}

	/**
	 * Set dropdown position after panel is visible so we can use its calcucalted height and with
	 * @param $scope
	 * @param $element
	 * @param panel
	 */
	static setPanelOffsets($scope, $element, panel){
		$scope.panelDropdownOffsetX = -5000; // render panel outside of screen an then calculate the position this way the elements dont flicker
		$scope.panelDropdownOffsetY = -5000;
		$timeout(function() {
			$scope.panelDropdownOffsetX = UtilService.getDropdownOffsetX($element);
			$scope.panelDropdownOffsetY = UtilService.getDropdownOffsetY($element, panel);
		});
	}

	static isValidVariable(value){
		return value !== undefined && value.toLowerCase().indexOf('error') !== 0 && value !== '-';
	}

	static escapeSymbols(str){
		return str.replace(/([.?*+^$[\]\\(){}|-])/g, '\\$1');
	}

	static checkValidInput(value, type, required, dateformat, decimalSep){

		if(value === '' || value === undefined){
			return !required;
		}

		if(!decimalSep){
			decimalSep = '.';
		}

		let valid = false;

		switch(type) {
			case 'Text':
				valid = required ? value.length > 0 : true;
				break;
			case 'Number':
				valid = !isNaN(value) && value.indexOf('.') === -1;
				break;
			case 'Decimal':
				let regex = new RegExp(UtilService.escapeSymbols(decimalSep), 'g'),
					decimalValue = value.replace(regex, '.');
				valid = (!isNaN(decimalValue) && value.indexOf(decimalSep) !== -1) || (!isNaN(decimalValue) && decimalValue.indexOf('.') === -1);
				break;
			case 'Date':
				let date = UtilService.stringToDate(value, dateformat);
				valid = date && date.isValid();
				break;
			default:
				valid = false;
				break;
		}

		return valid;
	}

	static stringToDate(_date, _format){
		const date = moment(_date, _format.toUpperCase(), true);

		if(!date.isValid()){
			return;
		}

		return date.toDate();
	}

	getDates(startDate, stopDate, format){
		let dateArray = [],
			currentDate = startDate,
			formatLength = format ? format.length : 0;
		while(currentDate <= stopDate){
			dateArray.push(currentDate);

			if(formatLength > 7 || formatLength === 0){
				currentDate = currentDate.addDays(1);
			}else if(formatLength > 4){
				currentDate = currentDate.addMonths(1);
			}else if(formatLength <= 4){
				currentDate = currentDate.addYears(1);
			}else{
				currentDate = currentDate.addDays(1);
			}
		}
		return dateArray;
	}

	static createFormatedDate(formatDate, day, month, year){
		return moment(new Date(year, month, day)).format(formatDate.toUpperCase());
	}

	/**
	 * Return background color for qlik sense state
	 *
	 * @param {string} state - state of the list element
	 * @param {object} appearance - layout appearance object
	 *
	 * @returns {string|undefined}
	 */
	static getSenseBackroundColorFromState(state, appearance){
		switch(state){
			case 'S':
				return;
			case 'A':
				return appearance.selectionAlternative;
			case 'O':
				return appearance.selectionNormal;
			case 'X':
				return appearance.selectionExcluded;
		}
	}

	/**
	 * Return background color for qlik sense state
	 *
	 * @param {string} state - state of the list element
	 * @param {object} appearance - layout appearance object
	 *
	 * @returns {string|undefined}
	 */
	static getSenseTextColorFromState(state, appearance){
		switch(state){
			case 'S':
				return;
			case 'A':
				return appearance.selectionAlternativeText;
			case 'O':
				return appearance.selectionNormalText;
			case 'X':
				return appearance.selectionExcludedText;
		}
	}

	/**
	 * Finds all indexes in an qlik select values list for given dates
	 * @param dates {string[]}
	 * @param selectValues {Object}
	 * @param format {string}
	 * @returns {Array}
	 */
	static getItemIndexArray(dates, selectValues, format){
		let indexes = [];
		for(const date of dates){
			let formatedDate = UtilService.createFormatedDate(format, date.getDate(), date.getMonth(), date.getFullYear()),
				index = UtilService.getIndexByText(selectValues.qDataPages, formatedDate);

			if(typeof index === 'number'){
				indexes.push(index);
			}
		}

		return indexes;
	};

	/**
	 * Get index from given qDataPages object by given text value
	 *
	 * @param qDataPages Qlik qDataPages object (from ListObject, or HyperCube)
	 * @param text {string} Text value
	 *
	 * @return {*} Number if index was found, null otherwise
	 */
	static getIndexByText(qDataPages, text){
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

	static findIndexByKey(array, key, searchValue){
		let retIndex = undefined; //intelli need an initialized variable even if its undefined
		array.some((string, index) => {
			if(searchValue === string[key]){
				retIndex = index;
				return true;
			}
		});

		return retIndex;
	}

	/**
	 * Checks if an expresseion is true or false
	 * is true when string equals '', true, 1 or -1
	 * @param expression {string}
	 * @returns {boolean}
	 */
	checkExpressionCondition(expression){
		expression = expression ? expression.toString().toLowerCase() : '';
		return expression === ''
			|| expression === 'true'
			|| expression === '1'
			|| expression === '-1';
	}

	static getUniqueMenuId(){
		return ++UtilService.menuId;
	}

	/**
	 * generates a globally unique id
	 * @returns {string}
	 */
	generateGuid(){
		return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c){
			let r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
			return v.toString(16);
		});
	}

	findAndDuplicateListItem(listItems, searchItem){
		listItems && listItems.forEach((listItem) =>{

			switch(listItem.type){
				case 'Group':
					this.findAndDuplicateListItem(listItem.groupItems, searchItem);
					break;
				case 'Button Container':
					this.findAndDuplicateListItem(listItem.subItems, searchItem);
					break;
				case 'buttonState':
				case 'subButton':
				case 'Button':
					this.findAndDuplicateListItem(listItem.stateItems, searchItem);
					break;
			}

			if(searchItem.cId === listItem.cId){
				let copyItem = JSON.parse(JSON.stringify(searchItem));
				this.replaceListItemsIdsRecursiv([copyItem]);
				listItems.push(copyItem);
			}
		});
	}

	replaceListItemsIdsRecursiv(listItems){
		listItems && listItems.forEach(listItem =>{
			listItem.cId = this.generateGuid();

			if(listItem.type === 'Group'){
				this.replaceListItemsIdsRecursiv(listItem.groupItems);
			}

			listItem.subItems && listItem.subItems.forEach(subItem =>{
				subItem.cId = this.generateGuid();

				subItem.stateItems && subItem.stateItems.forEach(stateItem =>{
					stateItem.cId = this.generateGuid();
				});
			});

			listItem.variableItems && listItem.variableItems.forEach(variableItem =>{
				variableItem.cId = this.generateGuid();
			});

			listItem.stateItems && listItem.stateItems.forEach(stateItem =>{
				stateItem.cId = this.generateGuid();
			});
		});
	}

	static getRefs(data, refName) {
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

	static setRefValue(data, refName, value) {
		let  obj = UtilService.getRefs(data, refName);
		obj.ref[obj.name] = value;
	}

	static getRefValue(data, refName) {
		let obj = UtilService.getRefs(data, refName);
		return obj.ref[obj.name];
	}
}

qvangular.service('utilService', [UtilService]);