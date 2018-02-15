import {Logger} from '../logger';

/**
 * Creates a deferred object, which can be use for asynchronous purposes
 */
export class Deferred {
	promise: Promise<any>;
	resolve: (value?: any) => void;
	reject: (reason?: string | Error) => void;
	status: number;

	/**
	 * Constructor
	 * @param {*} [initialValue] - if provided, promise will be initially resolved with given value
	 */
	constructor(initialValue?: any){
		let _state = 0;
		this.promise = new Promise((resolve, reject) =>{
			this.resolve = (value) => this.pending && (_state = 1) && resolve(value) || undefined;
			this.reject = (reason) => this.pending && (_state = 2) && reject(reason) || undefined;
		});

		Object.defineProperties(this, {status: {get: () => _state}});

		initialValue && this.resolve(initialValue);
	}

	get pending(){return this.status === 0;}

	get resolved(){return this.status === 1;}

	get rejected(){return this.status === 2;}
}

/**
 * PaintingPromise Class
 */
export class PaintingPromise {
	addCallback: (callback: Function) => void;
	delayPromise: () => void;
	createNewPromise: () => void;
	getPromise: () => Promise<void>;
	resolveProm: () => void;

	constructor(){
		Logger.debug('create HiCoMVCInit');
		let _res: Function,
			_isResolved = false,
			_prom = newPromise(),
			_tcPaintedEventName = 'tcPainted',
			_callbacks: Function[] = [],
			_delayed = false;

		let evnt = document.createEvent('CustomEvent');
		evnt.initEvent(_tcPaintedEventName, true, true);

		function newPromise(){
			let intRes: Function,
				prom: Promise<void> = new Promise((resolve) =>{
					intRes = resolve;
				});

			_isResolved = false;

			_res = () =>{
				_isResolved = true;
				intRes();
			};

			return prom;
		}

		/**
		 * Add callbacks which will be executed before resolving the main promise
		 * @param {Function} callback
		 */
		this.addCallback = (callback) =>{
			_callbacks.push(callback);
		};

		this.delayPromise = () =>{
			Logger.debug('delay paintingPromise (because of cancelling of painting)');
			_delayed = true;
		};

		this.createNewPromise = () =>{
			if(_delayed){
				_delayed = false;
				return;
			}

			let divTcPainted = document.getElementById(_tcPaintedEventName);
			if(divTcPainted){
				document.body.removeChild(divTcPainted);
			}
			if(_isResolved){
				_prom = newPromise();
			}
		};

		this.getPromise = () =>{
			return _prom;
		};

		this.resolveProm = () =>{
			if(_delayed){
				return;
			}

			const callbacks = _callbacks;
			if(callbacks.length){
				_callbacks = [];
				window.setTimeout(() =>{
					Promise.all(callbacks.map((callback) => callback())).then(resolvePromise).catch((err) =>{
						Logger.warn('failed executing paintingPromise callbacks', err);
					});
				}, 0);
			}else{
				resolvePromise();
			}
		};

		function resolvePromise(){
			Logger.info('finish painting trueChart');

			let divTcPainted = document.getElementById(_tcPaintedEventName);
			if(!divTcPainted){
				divTcPainted = document.createElement('div');
				divTcPainted.id = _tcPaintedEventName;
				divTcPainted.style.display = 'none';
				document.body.appendChild(divTcPainted);
			}

			_res && _res();

			// DispatchEvent needs some time, that's why we call it async via timeout
			window.setTimeout(() =>{
				document.body.dispatchEvent(evnt);
			}, 0);
		}
	}
}

/**
 * PaintingPromise instance
 * @type {PaintingPromise}
 */
export const paintingPromise = new PaintingPromise();