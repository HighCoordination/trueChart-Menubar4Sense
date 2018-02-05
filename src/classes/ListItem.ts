import * as LI from './IListItem';
import {UtilService} from '../js/Services/UtilService';

const _utilService = UtilService.getInstance();

export class ListItem {

	/**
	 * Returns an array with select items only
	 *
	 * @param {Array} listItems - List items array containing all list items
	 *
	 * @return {Array} - Select items in an array
	 */
	static getSelectItems(listItems: LI.TListItems){
		const selectTypes = ['Single Select', 'Sense Select', 'Group'];

		return (listItems || [])
			.filter(item => selectTypes.indexOf(item.type) !== -1)
			.reduce((list, item) =>{
				switch(item.type){
					case 'Group':
						ListItem.getSelectItems(item.groupItems).forEach(selectItem => list.push(selectItem));
						break;
					default:
						list.push(item);
				}

				return list;
			}, []);
	}

	/**
	 * Returns default selection for a dimension by given dimension id
	 *
	 * @param {TListItems} listItems - Extensions $scope
	 * @param {string} dimId - cId of target dimension
	 * @param {boolean} [ignoreShowCondition] - if true showCondition will not be respected
	 *
	 * @return {*}
	 */
	static getDefaultSelection(listItems: LI.TListItems, dimId: string, ignoreShowCondition?: boolean){
		let defaultSelection = null;

		// get the first list item, which uses current dimension
		const selectItem = ListItem.getSelectItems(listItems).filter(item =>{
			return item.props.dimId === dimId && item.props.alwaysSelectValue
				&& (ignoreShowCondition || _utilService.checkExpressionCondition(item.showCondition));
		})[0];

		if(selectItem){
			defaultSelection = selectItem.props.selectValue;
		}

		return defaultSelection;
	}
}