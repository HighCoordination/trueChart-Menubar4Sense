import * as $ from 'jquery';
import * as qvangular from 'qvangular';
import {QlikService} from '../../lib/hico/services/qlik-service';

export class UtilService {
	static getInstance(){
		return qvangular.getService('utilService');
	}

	constructor(){

		this.isMobile = false;
		this.copyStorage = null;
		this.screenWidth = !QlikService.isPrinting() ? window.innerWidth : 1000;
		this.panelWidth = 200;

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

		this.getDropdownOffset = function(element){
			let	clientRect = element[0].getBoundingClientRect(),
				screenWidth = window.innerWidth,
				positionCorrection = this.panelWidth - (screenWidth - clientRect.left),
				positionCorrectionRight = (screenWidth - clientRect.right),
				retVal = 0;

			if(screenWidth - clientRect.left < this.panelWidth){
				retVal = -(positionCorrection + positionCorrectionRight);
			}

			return retVal;
		}
	}

	checkExpressionCondition(expression){
		expression = expression ? expression.toString().toLowerCase() : '';
		return expression === ''
			|| expression === 'true'
			|| expression === '1'
			|| expression === '-1';
	}

	generateGuid(){
		return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c){
			let r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
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
				case 'buttonState': case 'subButton': case 'Button':
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
}

qvangular.service('utilService', [UtilService]);