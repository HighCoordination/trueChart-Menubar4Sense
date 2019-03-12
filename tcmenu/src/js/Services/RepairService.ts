import {Logger} from '../../classes/utils/Logger';
import {UtilService} from './UtilService';
import {IListItem, TListItems, ISubItem, IButtonState} from '../../classes/IListItem';

interface ITcMenuProperties {
	listItems: TListItems
}

const _utilService = UtilService.getInstance();

export class RepairService {
	private static _instance: RepairService;

	static getInstance(){
		if(!this._instance){
			this._instance = new RepairService();
		}
		return this._instance;
	}

	private _uniqueIds: string[] = [];
	private _errors: string[] = [];
	private _uniqueIdError: boolean = false;

	public startRepair(properties: ITcMenuProperties){

		this.initRepair();
		this.parseIdsUnique(properties.listItems);
		this.logErrors();

		if(this._uniqueIdError){
			_utilService.replaceListItemsIdsRecursiv(properties.listItems);
			Logger.warn('repaired listItem element ids');
		}
	}

	private initRepair(){
		this._uniqueIds = [];
		this._errors = [];
		this._uniqueIdError = false;
	}

	private parseIdsUnique(listItems: TListItems){
		listItems.forEach(listItem =>{
			this.checkUniqueIds(listItem.cId, listItem);

			if(listItem.type === 'Group'){
				this.parseIdsUnique(listItem.groupItems);
			}

			listItem.subItems && listItem.subItems.forEach(subItem =>{
				this.checkUniqueIds(subItem.cId, subItem);

				subItem.stateItems && subItem.stateItems.forEach(stateItem =>{
					this.checkUniqueIds(stateItem.cId, stateItem);
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

	private checkUniqueIds(searchString: string, obj: IListItem | ISubItem | IButtonState){
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

	private writeError(message: string){
		this._errors.push(message);
	}

	private logErrors(){

		if(this._errors.length === 0){
			Logger.warn('No Errors found in tcMenubar');
		}

		this._errors.forEach(error =>{
			Logger.warn(error)
		})
	}
}
