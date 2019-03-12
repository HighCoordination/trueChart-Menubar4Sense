import * as qvangular from 'qvangular';
import * as template from '../../templates/datePicker.html';
import {Logger} from "../../classes/utils/Logger";
import * as Datepicker from '../Components/DatePicker/bundle';
import {translation} from '../../../resource/translations/translations';
import {UtilService} from "../Services/UtilService";
import {QlikService} from '@highcoordination/common-sense';
import {ContentManager} from '../Components/Managers/ContentManager';
import {updateColors} from '../Components/Common/BaseComponent';

new function(){
	const qlikService = QlikService.getInstance();

	return qvangular.directive('datepicker', [
		'utilService', function(utilService){
			return {
				restrict: 'E',
				scope: {
					item: '<',
					itemindex: '<',
					groupitem: '<',
					parentscope: '<',
				},
				replace: true,
				template: template,
				controller: [
					'$scope', '$element', '$window', function($scope, $element){
						$scope.layout = $scope.parentscope.layout;
						$scope.colors = $scope.parentscope.colors;
						$scope.itemId = $scope.layout.qInfo.qId + '-' + $scope.item.cId;
						$scope.utilService = utilService;

						$scope.item.props.startDate = '-';
						$scope.item.props.endDate = '-';

						$scope.showDropdown = false;

						$scope.appearance = $scope.layout.appearance;

						const uniqueID = utilService.generateGuid();
						let _colors = '';

						const defaultMondayWeek = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'],
							defaultSundayWeek = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

						$scope.$watch('item.cId', function(){
							$scope.itemId = $scope.layout.qInfo.qId + '-' + $scope.item.cId;
						});

						function update(){
							updateColors($scope, $element, _colors).then((colors) => _colors = colors);
						}

						this.$onInit = function(){
							ContentManager.registerComponent(uniqueID, {update});

							update();
						};

						this.$onDestroy = function(){
							ContentManager.unregisterComponent(uniqueID);
						};

						$scope.openDatePicker = function(e){
							e.preventDefault();
							e.stopPropagation();
							const props = $scope.item.props,
								appearance = $scope.layout.appearance,
								dateProps = props.date,
								format = dateProps.format === 'custom' ? dateProps.customFormat : dateProps.format,
								type = dateProps.type;

							if(qlikService.inEditMode()){
								return;
							}

							if(!props.dimId){
								Logger.warn('no dimension selected');
								return;
							}

							const formatedDates = $scope.getAllSelectedDates().map(date =>{
								let realDate = new Date(date);
								return UtilService.createFormatedDate(format, realDate.getDate(), realDate.getMonth(), realDate.getFullYear())
							});

							if(!$scope.maxDate){
								$scope.maxDate = $scope.getMaxDate();
							}

							if(!$scope.minDate){
								$scope.minDate = $scope.getMinDate();
							}

							$scope.allDates = $scope.getAllDates();


							const datePickerConfig = {
								weekdaysOrder: dateProps.weekdayOrder === 'Sun' ? defaultSundayWeek : defaultMondayWeek,
								months: [],
								format: format,
								useDefaultPresets: dateProps.usePredefines && dateProps.useDefaultPredefines,
								customPresets: dateProps.usePredefines && dateProps.useCustomPredefines ? dateProps.predefines : [],
								minDate: $scope.minDate,
								maxDate: $scope.maxDate,
								translations: {
									weekdays: dateProps.weekdayOrder === 'Sun' ? translation.arrays.weekdaysSun : translation.arrays.weekdaysMon,
									months: translation.arrays.months,
									monthsShort: translation.arrays.monthsShort,
								},
								style: {
									fontFamily: appearance.textFamily,
								},
								colors: {
									buttons: appearance.datePickerButtonsColor,
									selectedStart: appearance.datePickerSelectedStartColor,
									selectedEnd: appearance.datePickerSelectedEndColor,
									active: appearance.datePickerActiveColor,
									foreignSelected: appearance.selectionSelected,
									notAllowed: appearance.datePickerNotAllowedColor,

									buttonHoverColor: appearance.datePickerButtonHoverColor,
									pickerHoverColor: appearance.datePickerPickerHoverColer,

									buttonText: appearance.datePickerButtonsText,
									pickerText: appearance.datePickerElementText,
									activeText: appearance.datePickerActiveText,
									inActiveText: appearance.datePickerInactiveText,
									selectedStartText: appearance.datePickerSelectedStartText,
									selectedEndText: appearance.datePickerSelectedEndText,
									foreignSelectedText: appearance.selectionSelectedText,
									notAllowedText: appearance.datePickerNotAllowedText,

									buttonHoverText: appearance.datePickerButtonHoverText,
									pickerHoverText: appearance.datePickerPickerHoverText,
								}
							};

							let element;
							if($scope.layout.appearance.orientation === 'btn-inline' && !$scope.groupitem){
								element = document.getElementById('hico-item-horizontal_' + $scope.itemId).getBoundingClientRect();
							}else{
								element = document.getElementById('item_' + $scope.itemId).getBoundingClientRect();
							}

							let displayMin,
								displayMax;

							if(formatedDates.length === 0){
								const today = new Date(),
									listMinDate = UtilService.stringToDate($scope.minDate, format),
									listMaxDate = UtilService.stringToDate($scope.maxDate, format);

								if(listMinDate > today){
									const listMinDateNext = listMinDate.addMonths(1);
									displayMin = UtilService.createFormatedDate(format, listMinDate.getDate(), listMinDate.getMonth(), listMinDate.getFullYear());
									displayMax = UtilService.createFormatedDate(format, listMinDateNext.getDate(), listMinDateNext.getMonth(), listMinDateNext.getFullYear());
								}else if(listMaxDate < today){
									const listMaxDateBefore = listMaxDate.addMonths(-1);
									displayMax = UtilService.createFormatedDate(format, listMaxDate.getDate(), listMaxDate.getMonth(), listMaxDate.getFullYear());
									if(type === 'single' || type === 'multi'){
										displayMin = displayMax;
									}else{
										displayMin = UtilService.createFormatedDate(format, listMaxDateBefore.getDate(), listMaxDateBefore.getMonth(), listMaxDateBefore.getFullYear());
									}
								}else{
									const next = today.addMonths(1);
									displayMin = UtilService.createFormatedDate(format, today.getDate(), today.getMonth(), today.getFullYear());
									displayMax = UtilService.createFormatedDate(format, next.getDate(), next.getMonth(), next.getFullYear());
								}

							}else{
								displayMin = formatedDates[0];
								displayMax = formatedDates[formatedDates.length - 1];
							}

							const configuration = {
								config: datePickerConfig,
								displayStartDate: displayMin,
								displayEndDate: displayMax,
								top: (element.top + element.height) + 'px',
								left: element.left + 'px',
								type: type,
								selectedDates: formatedDates,
								possibleDates: $scope.allDates,
								customDates: $scope.allDates,
								onConfirm: $scope.onDatePickerConfirm,
							};

							Datepicker.DatePicker.show(configuration);
						};

						$scope.onDatePickerConfirm = function(startDate, endDate, unformatedStartDate, unformatedEndDate){
							const parentScope = $scope.parentscope,
								listObject = parentScope._listObjects[$scope.item.dimId],
								qlistObject = listObject.layout.qListObject,
								dateProps = $scope.item.props.date,
								format = dateProps.format === 'custom' ? dateProps.customFormat : dateProps.format;

							let dates = [];

							if(dateProps.type === 'range'){
								dates = utilService.getDates(new Date(unformatedStartDate), new Date(unformatedEndDate), format);
							}else{
								if(unformatedStartDate instanceof Array && unformatedStartDate.length > 0){
									unformatedStartDate.forEach(date =>{
										dates.push(new Date(date));
									});
								}else if(typeof unformatedStartDate === 'string'){
									dates.push(new Date(unformatedStartDate));
								}else{
									listObject.clearSelections();
									return;
								}
							}

							let indexes = UtilService.getItemIndexArray(dates, qlistObject, format);
							$scope.handleSelect(indexes);
						};

						$scope.handleSelect = function(indexes){
							let parentScope = $scope.parentscope,
								listObject = parentScope._listObjects[$scope.item.dimId];

							listObject
								? parentScope.applySelection(listObject, indexes, true)
								: Logger.warn('No listObject found with dimId', $scope.item.dimId);

						};

						$scope.getAllSelectedDates = function(){
							const parentScope = $scope.parentscope,
								listObject = parentScope._listObjects[$scope.item.dimId].layout.qListObject,
								listItems = listObject.qDataPages[0].qMatrix,
								dateProps = $scope.item.props.date,
								format = dateProps.format === 'custom' ? dateProps.customFormat : dateProps.format;

							let dates = [];

							listItems.forEach((listitem) =>{
								if(listitem[0].qState === 'S'){
									dates.push(UtilService.stringToDate(listitem[0].qText, format).toString());
								}
							});

							return dates;
						};

						$scope.getAllDates = function(){
							const parentScope = $scope.parentscope,
								listObject = parentScope._listObjects[$scope.item.dimId].layout.qListObject,
								listItems = listObject.qDataPages[0].qMatrix;

							return listItems.map((listitem) => ({
								date: listitem[0].qText,
								color: UtilService.getSenseBackroundColorFromState(listitem[0].qState, $scope.layout.appearance),
								text: UtilService.getSenseTextColorFromState(listitem[0].qState, $scope.layout.appearance)
							}));
						};

						$scope.getMaxDate = function(){
							const parentScope = $scope.parentscope,
								listObject = parentScope._listObjects[$scope.item.dimId].layout.qListObject,
								qMatrix = listObject.qDataPages[0].qMatrix,
								dateProps = $scope.item.props.date,
								format = dateProps.format === 'custom' ? dateProps.customFormat : dateProps.format;

							let maxValue = 0,
								retItem = undefined;

							qMatrix.forEach((row) =>{
								let item = row[0];

								if(item.qNum > maxValue){
									maxValue = item.qNum;
									retItem = item;
								}
							});

							let date = UtilService.stringToDate(retItem.qText, format);

							return UtilService.createFormatedDate(format, date.getDate(), date.getMonth(), date.getFullYear());
						};

						$scope.getMinDate = function(){
							const parentScope = $scope.parentscope,
								listObject = parentScope._listObjects[$scope.item.dimId].layout.qListObject,
								qMatrix = listObject.qDataPages[0].qMatrix,
								dateProps = $scope.item.props.date,
								format = dateProps.format === 'custom' ? dateProps.customFormat : dateProps.format;

							let minValue = undefined,
								retItem = undefined;

							qMatrix.forEach((row) =>{
								let item = row[0];

								if(!minValue || item.qNum < minValue){
									minValue = item.qNum;
									retItem = item;
								}
							});

							let date = UtilService.stringToDate(retItem.qText, format);

							return UtilService.createFormatedDate(format, date.getDate(), date.getMonth(), date.getFullYear());
						};
					}
				]
			}
		}
	]);
};