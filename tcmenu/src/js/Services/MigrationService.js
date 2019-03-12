import {Deferred} from '@highcoordination/common-utils';
import {QlikService} from '@highcoordination/common-sense';
import * as config from '../../../resource/config';
import {RepairDialog} from '../Directives/RepairDialog';

const _qlikService = QlikService.getInstance();

export default class MigrationService {
	constructor(){
		MigrationService._instance = this;

		this._sheets = null;
		this._fields = null;
		this._dimensions = null;
		this._extensions = null;
		this._pendingMigrations = {};
		this._updates = {
			'1.1.0': {
				dimensions: {},
				expressionMap: config.expressionMigration
			}
		};
	}

	static getInstance(){
		return this._instance || new MigrationService();
	}

	getSheets(){
		return this._sheets ? Promise.resolve(this._sheets) : this.getList('sheet');
	}

	getFields(){
		return this._fields ? Promise.resolve(this._fields) : this.getList('FieldList');
	}

	getDimensions(){
		return this._dimensions ? Promise.resolve(this._dimensions) : this.getList('DimensionList');
	}

	getExtensions(){
		return this._extensions ? Promise.resolve(this._extensions) : this.getList('extension');
	}

	getList(type){
		switch(type){
			case 'sheet':
				return this._sheets = _qlikService.listProvider.getListItems(type);
			case 'DimensionList':
				return this._dimensions = _qlikService.listProvider.getListItems(type);
			case 'FieldList':
				return this._fields = _qlikService.listProvider.getListItems(type);
			case 'extension':
				return this._extensions = this.getSheets().then(sheets =>{
					return Promise.all(sheets.map(sheet => sheet.qData.cells)
						.reduce((acc, cells) => acc.concat(cells))
						.filter(cell => cell.type === 'tcmenu')
						.map(cell => _qlikService.getObjectProperties(cell.name)));
				});
		}
	}

	/**
	 * Runs the migration required for the specific version
	 *
	 * @param {string} toVersion - target version
	 * @param {boolean} [interactive] - if true, migration dialog will be shown, otherwise not
	 *
	 * @return {Promise<*>}
	 */
	migrate(toVersion, interactive){
		switch(toVersion){
			case '1.1.0':
				return this.migrate110(interactive);
			default:
				return Promise.resolve(); // nothing to migrate
		}
	}

	/**
	 * Runs migration required for version 1.1.0
	 *
	 * @param {boolean} interactive - if true, migration dialog will be shown, otherwise not
	 *
	 * @return {Promise<*>}
	 */
	migrate110(interactive){
		const version = '1.1.0';
		let deferred,
			pendingMigration = this._pendingMigrations[version];

		if(!pendingMigration){ // initial run
			this._pendingMigrations[version] = deferred = pendingMigration = new Deferred();
			pendingMigration.isInteractive = interactive;

		}else if(!interactive || pendingMigration.isInteractive){
			return pendingMigration.promise; // second+ run (normal case)

		}else{
			// first interactive run, if it wasn't the case on initial run (i.e. on sheet duplication of a published app)
			deferred = new Deferred();
			deferred.promise.then(pendingMigration.resolve); // resolve the previous/original promise after interactive migration
			pendingMigration.isInteractive = interactive;
			pendingMigration.willBeResolved = true; // make sure we do not resolve our migration promise twice
		}

		return Promise.all([
			this.getFields(),
			this.getDimensions(),
			this.getExtensions()
		]).then(data =>{
			let fields = data[0].map(item => ({expr: item.qName})), // create an array of available fields names
				dimensions = data[1].map(item => item.qData.grouping === 'H' || item.qData.grouping === 'N' // drilldown/master dimensions
					? {expr: item.qData.info.map(i => i.qName).join('~'), qLibraryId: item.qInfo.qId}
					: {expr: item.qData.title, qLibraryId: item.qInfo.qId}
				), // create an array of available dimensions
				extensions = data[2],

				// create one single list containing fields and dimensions, put master dimensions on top to use them if possible
				availableDims = this._updates[version].dimensions = fields.concat(dimensions).sort((a, b) => a.qLibraryId && !b.qLibraryId ? -1 : 1),

				// get a list of used dimensions (expressions)
				uniqueDims = extensions.map(obj => (obj.properties.dimensions || []).map(dimension => dimension.dim && dimension.dim.qStringExpression
					? dimension.dim.qStringExpression.qExpr
					: dimension.dim || dimension.dimTitle))
					.reduce((acc, dims) => acc.concat(dims.filter(dim => dim && acc.indexOf(dim) === -1)), []),

				// get dimensions, which are not in the available dimensions list and must be checked therefore
				expressionMap = this._updates[version].expressionMap,
				suspiciousDims = uniqueDims.filter(dim => !availableDims.some(aDim => aDim.expr === dim) && !expressionMap[dim]);

			// continue with "manual" migration steps
			if(suspiciousDims.length > 0 && (interactive || pendingMigration.isInteractive)){
				// show update dialog and giv the user a chance to fix suspicious dimensions
				const options = {};
				options.dialogdatas = suspiciousDims.map(dim =>{
					return {
						text: dim,
						oldValue: dim,
						fixed: false,
						maxLength: 500,
						textTemplate: 'dialog_update_1_1_0'
					};
				});
				options.dimensions = availableDims.map(dim => dim.expr);
				options.onSave = (dialogdatas) =>{
					dialogdatas.forEach(data =>{
						this._updates[version].expressionMap[data.oldValue] = data.text;
					});
					!deferred.willBeResolved && deferred.resolve();
				};

				RepairDialog.show(options);
			}else{
				!deferred.willBeResolved && deferred.resolve();
			}

			return deferred.promise;
		});
	}

	/**
	 * Returns required update data for specific update
	 * @param version
	 * @return {*|{}}
	 */
	getUpdateData(version){
		return this._updates[version] || {};
	}


}