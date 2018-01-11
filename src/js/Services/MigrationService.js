import {Deferred} from '../../lib/hico/common/global';

const _qlikService = require('../../lib/hico/services/qlik-service').getInstance();
import * as qvangular from 'qvangular';
import {prefix} from '../../lib/hico/prefix';
import * as config from '../../../resource/config';

export const serviceName = prefix + 'MigrationService';

export default class MigrationService {
	constructor(){
		const _updateScope = qvangular.$rootScope.$new();

		_updateScope.dialogdatas = [];
		_updateScope.dimensions = [];

		this._sheets = null;
		this._fields = null;
		this._dimensions = null;
		this._extensions = null;
		this._pendingMigrations = {};
		this._updates = {
			'1.1.0': {
				expressionMap: config.expressionMigration
			}
		};
	}

	static getInstance(){
		return qvangular.getService(serviceName);
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

	migrate(toVersion){
		let pendingMigration = this._pendingMigrations[toVersion];

		switch (toVersion){
			case '1.1.0':
				if(!pendingMigration){
					console.info('run migration for trueChart-Menubar version', toVersion);
					pendingMigration = this.migrate110();
				}
				break;
			default:
				pendingMigration = Promise.resolve(); // nothing to migrate
		}
		return pendingMigration;
	}

	migrate110(){
		const version = '1.1.0';

		return this._pendingMigrations[version] = Promise.all([
			this.getFields(),
			this.getDimensions(),
			this.getExtensions()
		]).then(data =>{
			let deferred = new Deferred(),
				fields = data[0].map(item => item.qName), // create an array of available fields names
				dimensions = data[1].map(item => item.qMeta.title), // create an array of available dimensions names
				extensions = data[2],

				// create one single list containing fields and dimensions names
				availableDims = this._updates[version].dimensions = fields.concat(dimensions),

				// get a list of used dimensions (expressions)
				uniqueDims = extensions.map(obj => (obj.properties.dimensions || []).map(dimension => dimension.dim && dimension.dim.qStringExpression
					? dimension.dim.qStringExpression.qExpr
					: dimension.dim || dimension.dimTitle))
					.reduce((acc, dims) => acc.concat(dims.filter(dim => acc.indexOf(dim) === -1)), []),

				// get dimensions, which are not in the available dimensions list and must be checked therefore
				expressionMap = this._updates[version].expressionMap,
				suspiciousDims = uniqueDims.filter(dim => availableDims.indexOf(dim) === -1 && !expressionMap[dim]);

			// continue with "manual" migration steps
			if(suspiciousDims.length > 0 && !_qlikService.isPublished() && _qlikService.inClient()){
				// show update dialog and giv the user a chance to fix suspicious dimensions
				const $scope = qvangular.$rootScope.$new(),
					compile = qvangular.getService('$compile'),
					template = '<repairdialogdirective dialogdatas="dialogdatas" on-save="save()" dimensions="dimensions"></repairdialogdirective>';



				$scope.dialogdatas = suspiciousDims.map(dim =>{
					return {
						text: dim,
						oldValue: dim,
						fixed: false,
						maxLength: 500,
						textTemplate: 'dialog_update_1_1_0'
					};
				});
				$scope.dimensions = availableDims;
				$scope.save = () =>{
					$scope.dialogdatas.forEach(data =>{
						this._updates[version].expressionMap[data.oldValue] = data.text;
					});
					deferred.resolve();
				};

				const $dialog = compile(template)($scope);
				document.body.appendChild($dialog[0]);
			}else{
				deferred.resolve();
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

qvangular.service(serviceName, [MigrationService]);