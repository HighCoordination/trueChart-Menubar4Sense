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
		const selectTypes = ['Single Select', 'Sense Select', 'Group', 'Date Picker', 'Field Slider'];

		return (listItems || [])
			.filter(item => selectTypes.indexOf(item.type) !== -1)
			.reduce((list, item) =>{
				switch(item.type){
					case 'Group':
						if(_utilService.checkExpressionCondition(item.showCondition) && _utilService.checkShowMobileCondition(item)){
							ListItem.getSelectItems(item.groupItems).forEach(selectItem => list.push(selectItem));
						}
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
	 * @param {any} [qListObject] - qListObject of the dimension
	 *
	 * @return {*}
	 */
	static getDefaultSelection(listItems: LI.TListItems, dimId: string, ignoreShowCondition?: boolean, qListObject?: any){
		let defaultSelection = null;

		// get the first list item, which uses current dimension
		const selectItem = ListItem.getSelectItems(listItems).filter(item =>{
			return item.props.dimId === dimId && (item.props.alwaysSelectValue || item.type === 'Field Slider')
				&& (ignoreShowCondition || _utilService.checkExpressionCondition(item.showCondition)) && _utilService.checkShowMobileCondition(item);
		})[0];

		if(selectItem){
			if(selectItem.type === 'Date Picker' && selectItem.props.date.type === 'range'){
				let dateProps = selectItem.props.date,
					startDate = new Date(UtilService.stringToDate(dateProps.defaultStartDate, dateProps.format)),
					endDate = new Date(UtilService.stringToDate(dateProps.defaultEndDate, dateProps.format));

				if(isNaN(startDate.getDate()) || isNaN(endDate.getDate())){
					return null;
				}

				const format = dateProps.format === 'custom' ? dateProps.customFormat : dateProps.format;

				defaultSelection = UtilService.getItemIndexArray(_utilService.getDates(startDate, endDate, format), qListObject, format);

				if(defaultSelection.length < 1){
					return null;
				}
			}else if(selectItem.type === 'Date Picker'){
				defaultSelection = selectItem.props.date.defaultStartDate;
			}else if(selectItem.type === 'Field Slider'){
				if(selectItem.props.fieldSlider.type === 'range'){
					const defStartValue = selectItem.props.fieldSlider.defaultValueStart,
						defEndValue = selectItem.props.fieldSlider.defaultValueEnd;

					if(defStartValue === '' || defEndValue === ''){
						return null;
					}

					defaultSelection = UtilService.getItemIndexArrayFromRange(defStartValue, defEndValue, qListObject);
					if(defaultSelection.length < 1){
						return null;
					}
				}else{
					defaultSelection = selectItem.props.fieldSlider.defaultValue;
				}
			}else{
				defaultSelection = selectItem.props.selectValue;
			}
		}

		return defaultSelection;
	}
}