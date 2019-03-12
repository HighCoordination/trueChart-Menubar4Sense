import {Logger} from '../../classes/utils/Logger';

export class ApiService {
	static _instance;

	/**
	 * Returns the instance of the ApiService
	 * @return {ApiService}
	 */
	static get Instance(){
		return ApiService._instance || new ApiService();
	}

	constructor(){
		ApiService._instance = this;
		let _res,
			_tcPaintedEventName = 'tcMenubarPainted',
			_evnt = document.createEvent('CustomEvent'),
			_promiseArray = [],
			_promiseTimeout = 0,
			_apiService = this,
			_prom = new Promise(resolve => _res = resolve);

		this.getPromise = getPromise;
		this.createNewPromise = createNewPromise;

		init();

		function init(){
			_evnt.initEvent(_tcPaintedEventName, true, true);
			window.HiCo = window.HiCo || {};
			HiCo.API = HiCo.API || {};
			HiCo.API.Menu = HiCo.API.Menu || {};

			HiCo.API.Menu = {
				paintingPromise: _apiService.getPromise,
				istrueChartMenubarPainted: false
			};
		}

		function getPromise(){
			return _prom;
		}

		function createNewPromise(){
			window.clearTimeout(_promiseTimeout);
			_promiseTimeout = window.setTimeout(() =>{
				Promise.all(_promiseArray).then(resolvePromises);
			}, 2500);

			let divTcMenuPainted = document.getElementById(_tcPaintedEventName);
			if(divTcMenuPainted){
				divTcMenuPainted.parentElement.removeChild(divTcMenuPainted);
			}

			_prom.then(() => _prom = new Promise(resolve => _res = resolve));

			let deferred = {},
				promise = new Promise((resolve) =>{
					deferred.resolve = resolve;
				});

			HiCo.API.Menu.istrueChartMenubarPainted = false;
			_promiseArray.push(promise);

			return deferred;
		}

		function resolvePromises(){
			Logger.info('finish painting');
			let divTcMenuPainted = document.getElementById(_tcPaintedEventName);
			if(!divTcMenuPainted){
				divTcMenuPainted = document.createElement('div');
				divTcMenuPainted.id = _tcPaintedEventName;
				divTcMenuPainted.style.display = 'none';
				document.body.appendChild(divTcMenuPainted);
			}

			_promiseArray = [];
			HiCo.API.Menu.istrueChartMenubarPainted = true;
			_res();

			// DispatchEvent needs some time, that's why we call it async via timeout
			window.setTimeout(() =>{
				document.body.dispatchEvent(_evnt);
			}, 0);
		}
	}
}