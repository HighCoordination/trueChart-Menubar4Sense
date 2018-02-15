import {Logger} from '../../lib/hico/logger';
import {UtilService} from './UtilService';

const _utilService = UtilService.getInstance();


export class RepairService {
	static getInstance(){
		return this._instance || new RepairService();
	}

	_uniqueIds;
	_errors;
	_uniqueIdError;

	constructor(){

		this._uniqueIds = [];
		this._errors = [];
		this._uniqueIdError = false;

		RepairService._instance = this;
	}

	startRepair(properties){

		this.initRepair();
		this.parseIdsUnique(properties.listItems);
		this.logErrors();

		if(this._uniqueIdError){
			_utilService.replaceListItemsIdsRecursiv(properties.listItems);
			Logger.warn('repaired listItem element ids');
		}
	}

	initRepair(){
		this._uniqueIds = [];
		this._errors = [];
		this._uniqueIdError = false;
	}

	parseIdsUnique(listItems){
		listItems.forEach(listItem =>{
			this.checkUniqueIds(listItem.cId, listItem);

			if(listItem.type === 'Group'){
				this.parseIdsUnique(listItem.groupItems);
			}

			listItem.subItems && listItem.subItems.forEach(subItem =>{
				this.checkUniqueIds(subItem.cId, subItem);

				subItem.stateItems && subItem.stateItems.forEach(stateItem =>{
					this.checkUniqueIds(stateItem.cId, );
				});
			});

			listItem.variableItems && listItem.variableItems.forEach(variableItem =>{
				this.checkUniqueIds(variableItem.cId, variableItem);
			});

			listItem.stateItems && listItem.stateItems.forEach(stateItem =>{
				this.checkUniqueIds(stateItem.cId, stateItem);
			});
		});
	}

	checkUniqueIds(searchString, obj){
		if(!searchString){
			this._uniqueIdError = true;
			this.writeError('Object has no Id');
			console.log(obj);
		}else if(this._uniqueIds.indexOf(searchString) > -1){
			this._uniqueIdError = true;
			this.writeError('duplicate Id found: ' + searchString);
			console.log(obj);
		}else{
			this._uniqueIds.push(searchString);
		}
	}

	writeError(message){
		this._errors.push(message);
	}

	logErrors(){

		if(this._errors.length === 0){
			Logger.warn('No Errors found in tcMenubar');
		}

		this._errors.forEach(error =>{
			Logger.warn(error)
		})
	}
}