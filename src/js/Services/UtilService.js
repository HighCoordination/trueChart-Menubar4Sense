import {prefix} from '../../lib/hico/prefix';

define(['jquery', 'qvangular', '../../lib/hico/services/qlik-service'], function($, qvangular){
	return qvangular.service("utilService", [prefix + 'QlikService', UtilService]);

	function UtilService(qlikService){

		this.isMobile = false;
		this.screenWidth = !qlikService.isPrinting() ? window.innerWidth : 1000;

		if( /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ) {
			this.isMobile = true;
		}

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
				if($menu)
					$menu = $menu.children[0];
			}

			let offset = $item.offsetTop;
			let $parentItem = this.findParentByIdPrefix($item, 'item_');
			if($parentItem)
				offset += $parentItem.offsetTop;

			if($menu){
				$($menu).animate({scrollTop: offset}, {
					duration: 'slow',
					easing: 'swing'
				});
			}
		};

		this.findParentByIdPrefix = function($item, idPrefix){
			let $parent = $item.parentElement;
			if($parent === null)
				return null;

			if($parent.id && $parent.id.indexOf(idPrefix) === 0)
				return $parent;

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
		}
	}
});