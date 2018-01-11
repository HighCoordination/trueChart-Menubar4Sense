import * as LI from './IListItem';

export class ListItem {

	/**
	 * Returns an array with select items only
	 *
	 * @param {Array} listItems - List items array containing all list items
	 *
	 * @return {Array} - Select items in an array
	 */
	static getSelectItems(listItems: LI.TListItems){
		const selectTypes = ['Single Select', 'Sense Select', 'Multi Select'];

		return (listItems || [])
			.filter(item => selectTypes.indexOf(item.type) !== -1)
			.reduce((list, item) =>{
				item.type === 'Multi Select'
					? (<LI.IMultiSelect>item).selectItems.forEach(selectItem => list.push(selectItem))
					: list.push(item);
				return list;
			}, []);
	}

	/**
	 * Returns default selection for a dimension by given dimension id
	 *
	 * @param {TListItems} listItems - Extensions $scope
	 * @param {string} dimId - cId of target dimension
	 *
	 * @return {*}
	 */
	static getDefaultSelection(listItems: LI.TListItems, dimId: string){
		let defaultSelection = null;

		// get the first list item, which uses current dimension
		const selectItem = ListItem.getSelectItems(listItems).filter(item =>{
			return item.props.dimId === dimId && item.props.alwaysSelectValue;
		})[0];

		if(selectItem){
			defaultSelection = selectItem.props.selectValue;
		}

		return defaultSelection;
	}
}