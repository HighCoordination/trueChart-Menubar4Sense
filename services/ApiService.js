define(['jquery', 'qlik', 'qvangular'], function ($, qlik, qvangular) {
	return qvangular.service("apiService", function () {

		var _res = void 0,
		    _tcPaintedEventName = 'tcMenubarPainted',
		    _evnt = document.createEvent('CustomEvent'),
		    _promiseArray = [],
		    _promiseTimeout = 0,
		    _menuCount = 0,
		    _app = qlik.currApp(),
		    _apiService = this,
		    _prom = new Promise(function (resolve) {
			return _res = resolve;
		});

		this.getPromise = getPromise;
		this.createNewPromise = createNewPromise;
		this.resolvePromises = resolvePromises;

		init();

		function init() {
			_evnt.initEvent(_tcPaintedEventName, true, true);
			window.HiCo = window.HiCo || {};
			HiCo.API = HiCo.API || {};
			HiCo.API.Menu = HiCo.API.Menu || {};

			HiCo.API.Menu = {
				paintingPromise: _apiService.getPromise,
				istrueChartMenubarPainted: false
			};
		}

		function getPromise() {
			return _prom;
		}

		function createNewPromise() {
			window.clearTimeout(_promiseTimeout);
			_promiseTimeout = window.setTimeout(function () {
				Promise.all(_promiseArray).then(resolvePromises);
			}, 2500);

			var divTcMenuPainted = document.getElementById(_tcPaintedEventName);
			if (divTcMenuPainted) {
				document.body.removeChild(divTcMenuPainted);
			}

			_prom.then(function () {
				return _prom = new Promise(function (resolve) {
					return _res = resolve;
				});
			});

			var deferred = {},
			    promise = new Promise(function (resolve) {
				deferred.resolve = resolve;
			});

			HiCo.API.Menu.istrueChartMenubarPainted = false;
			_promiseArray.push(promise);

			return deferred;
		}

		function resolvePromises() {
			console.log('finish painting tcMenu');
			var divTcMenuPainted = document.getElementById(_tcPaintedEventName);
			if (!divTcMenuPainted) {
				divTcMenuPainted = document.createElement('div');
				divTcMenuPainted.id = _tcPaintedEventName;
				divTcMenuPainted.style.display = 'none';
				document.body.appendChild(divTcMenuPainted);
			}

			_promiseArray = [];
			HiCo.API.Menu.istrueChartMenubarPainted = true;
			_res();

			// DispatchEvent needs some time, that's why we call it async via timeout
			window.setTimeout(function () {
				document.body.dispatchEvent(_evnt);
			}, 0);
		}
	});
});