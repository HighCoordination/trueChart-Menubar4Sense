define(['./qlik-service'], function (QlikService) {

	var _instances = {}; // holds MediaService instances with appId as key
	var TCML = 'tcml:'; // trueChart media library url prefix
	var CODES = {
		BAD_REQUEST: 400,
		NOT_FOUND: 404,
		CONFLICT: 409
	};

	/**
  * Returns the app specific MediaService instance
  * @param {string} appId - App ID to wich the service instance belongs
  * @return {object}
  */
	MediaService.getInstance = function (appId) {
		if (typeof appId !== 'string' || !appId) {
			throw new Error('appId must be a not empty string');
		}

		if (!_instances[appId]) {
			_instances[appId] = new MediaService(appId);
		}
		return _instances[appId];
	};

	return MediaService;

	/**
  * Media Service
  * @constructor
  */
	function MediaService(appId) {
		var _instance = this,
		    _qlikService = QlikService.getInstance(appId);

		/* Public/privileged functions definition */
		this.mediaProvider = new MediaProvider(_qlikService);
		this.getReady = getReady;

		/**
   * Returns the instance in a promise when service is ready to use
   * @returns {Promise.<object>} - Instance of the service in a promise
   */
		function getReady() {
			return Promise.all([_instance.mediaProvider.getReady()]).then(function () {
				return _instance;
			});
		}
	}

	/**
  * Media Provider
  * @param qlikService
  * @constructor
  */
	function MediaProvider(qlikService) {
		var _mediaProvider = this,
		    _ready = new defer(),
		    _tcMediaStore = {},
		    _mediaItems = [],
		    _mediaItemsMap = {},
		    _cache = {};

		this.getReady = getReady;
		this.getMediaItems = getMediaItems;
		this.getMediaItemByName = getMediaItemByName;
		this.getMediaData = getMediaData;
		this.getMediaDataByUrl = getMediaDataByUrl;
		this.addMediaFromUrl = addMediaFromUrl;
		this.addMediaFromFile = addMediaFromFile;
		this.removeMedia = removeMedia;
		this.renameMedia = renameMedia;
		this.isTcMediaUrl = isTcMediaUrl;
		this.fileToData = fileToData;
		this.downloadMedia = downloadMedia;
		this.isDownloadSupported = isDownloadSupported;

		init();

		/**
   * Initialization
   */
		function init() {
			var storeId = 'tcMediaStore',
			    tcMediaStoreDef = {
				qInfo: { qId: storeId, qType: storeId },
				qChildListDef: {
					qData: {
						lastModified: '/tcMedia/lastModified',
						name: '/tcMedia/name',
						size: '/tcMedia/size',
						source: '/tcMedia/source',
						url: '/tcMedia/url'
					}
				},
				version: 1
			};

			qlikService.getObject(storeId).then(function (tcMediaStore) {
				if (!tcMediaStore) {
					// is null, when object not found
					return qlikService.createObject(tcMediaStoreDef);
				} else {
					return tcMediaStore;
				}
			}, function (err) {
				if (err && err.code === 2) {
					// object not found
					return qlikService.createObject(tcMediaStoreDef);
				} else {
					return Promise.reject(err);
				}
			}).then(function (tcMediaStore) {
				_tcMediaStore = tcMediaStore;

				/** @property _tcMediaStore.Invalidated */
				tcMediaStore.Invalidated.bind(function () {
					setReady(false);
					qlikService.getLayout(this); // we need to "getLayout" manually here! QS do not handle it for us here
				});

				/** @property _tcMediaStore.Validated */
				tcMediaStore.Validated.bind(function () {
					setMediaItems(qlikService.getChildItems(this.layout));
					setReady(true);
				});

				return qlikService.getLayout(tcMediaStore);
			}).then(function (layout) {
				setMediaItems(qlikService.getChildItems(layout));
				setReady(true);
			}).catch(function (err) {
				console.error(err);
			});
		}

		/**
   * Returns mediaItems (without data)
   * @returns {Promise.<{objId: string, tcMedia: {name: string, url: string}}[]>}
   */
		function getMediaItems() {
			return getReady().then(function () {
				return _mediaItems;
			});
		}

		/**
   * Sets mediaItems variable
   * @param {Array<{id: string, type: string, data: {name: string, url: string}}>} items - Media items
   */
		function setMediaItems(items) {
			_mediaItemsMap = {};
			_mediaItems = items.map(function (item) {
				var mediaItem = {
					id: item.id,
					type: item.type,
					tcMedia: item.data
				};
				_mediaItemsMap[mediaItem.tcMedia.name] = mediaItem;
				return mediaItem;
			});
		}

		/**
   * Returns a media object with its properties in a promise
   * @param {string} name - Name of the requested media
   * @return {Promise.<{properties: {tcMedia: object}}|null>}
   */
		function getMedia(name) {
			return getReady().then(function () {
				if (!_cache[name] && _mediaItems.length > 0) {
					var mediaItem = getMediaItemByName(name);
					if (mediaItem) {
						_cache[name] = qlikService.getObjectProperties(mediaItem.id);
					}
				}
				return _cache[name] || Promise.resolve(null);
			});
		}

		/**
   * Returns data of a tcMedia object by given name
   * @param {string} name - Name of the media
   * @return {Promise.<null|string>} - dataURL in a promise
   */
		function getMediaData(name) {
			return getMedia(name).then(function (obj) {
				if (!obj) {
					return null;
				}
				return obj.properties.tcMedia.data;
			});
		}

		/**
   * Returns data of a tcMedia object by given tcMediaUrl
   * @param {string} url - Url of the media
   * @return {Promise.<null|string>} - Data in a promise
   */
		function getMediaDataByUrl(url) {
			var name = extractNameFromUrl(url);

			return getMediaData(name);
		}

		/**
   * Creates or updates existing media object
   * @param {string} name - Name of the media
   * @param {object} props - Properties of the media
   * @param {boolean} [replace] - If true existing media will be replaced
   * @returns {Promise.<object>}
   */
		function createOrUpdateMedia(name, props, replace) {
			return new Promise(function (resolve, reject) {
				if (replace === true) {
					updateMedia(name, props).then(resolve, reject);
				} else if (replace === false && getMediaItemByName(name)) {
					reject(createError('name "' + name + '" is in use!', CODES.CONFLICT));
				} else {
					createMedia(getTargetName(name), props).then(resolve, reject);
				}
			});
		}

		/**
   * Creates a new media object
   * @param {string} name - Name of the media
   * @param {object} props - Properties of the media
   * @returns {Promise.<object>} - Created media item
   */
		function createMedia(name, props) {
			return new Promise(function (resolve, reject) {
				var mediaDef = createTCMediaDef(name, props);
				qlikService.createChild(_tcMediaStore, mediaDef).then(getReady).then(function () {
					resolve(getMediaItemByName(name));
				}, reject);
			});
		}

		/**
   * Updates existing media object
   * @param {string} name - Name of the media
   * @param {object} props - Properties of the media
   * @returns {Promise.<object>} - Updated media item
   */
		function updateMedia(name, props) {
			return new Promise(function (resolve, reject) {
				var mediaItem = getMediaItemByName(name);
				if (!mediaItem) {
					reject(createError('No media found with name: ' + name, CODES.NOT_FOUND));
				}

				qlikService.getObjectProperties(mediaItem.id).then(function (obj) {
					obj.properties.tcMedia = createTCMediaDef(name, props).tcMedia;
					return qlikService.setProperties(obj, obj.properties);
				}).then(getReady).then(function () {
					resolve(getMediaItemByName(name));
				}, reject);
			});
		}

		/**
   * Renames the name of the existing media item
   * @param {string} name - Name of the media to be renamed
   * @param {string} targetName - Target name
   * @returns {Promise.<object>} - Renamed media item
   */
		function renameMedia(name, targetName) {
			return getMedia(name).then(function (obj) {
				if (obj === null) {
					throw createError('No media found with name: ' + name, CODES.NOT_FOUND);
				} else if (getMediaItemByName(targetName)) {
					throw createError('Target name "' + targetName + '" is already in use!', CODES.CONFLICT);
				}
				delete _cache[name];
				obj.properties.tcMedia.name = targetName;
				obj.properties.tcMedia.url = TCML + targetName;
				return qlikService.setProperties(obj, obj.properties).then(getReady).then(function () {
					return getMediaItemByName(targetName);
				});
			});
		}

		/**
   * Removes media from tcMediaStore
   * @param {string} name - Name of the media to be removed
   * @returns {Promise.<boolean>} - true if media was successfully removed, otherwise false
   */
		function removeMedia(name) {
			return getReady().then(function () {
				var mediaItem = getMediaItemByName(name);
				if (mediaItem) {
					delete _cache[name];
					return qlikService.removeChild(_tcMediaStore, mediaItem.id).then(function () {
						return true;
					});
				} else {
					return false; // media can't be removed, because it's not existing
				}
			});
		}

		/**
   * Adds media to MediaStore from url
   * @param {string} url - URL which content should be added
   * @param {boolean} [replace] - Replacement flag, if true existing media will be replaced
   * @returns {Promise.<object>} - new media item
   */
		function addMediaFromUrl(url, replace) {
			return new Promise(function (resolve, reject) {
				if (typeof url !== 'string' || url.length === 0) {
					throw createError('URL must be a valid string', CODES.BAD_REQUEST);
				}
				urlToData(url).then(function (reply) {
					createOrUpdateMedia(extractNameFromUrl(url), reply, replace).then(resolve, reject);
				}, reject);
			});
		}

		/**
   * Adds media to MediaStore from file
   * @param {File} file - Input file which content should be added
   * @param {boolean} [replace] - Replacement flag, if true existing media will be replaced
   * @returns {Promise.<object>} new media item
   */
		function addMediaFromFile(file, replace) {
			return new Promise(function (resolve, reject) {
				if (file instanceof File !== true) {
					throw createError('file must be an instance of "File"', CODES.BAD_REQUEST);
				}
				fileToData(file).then(function (reply) {
					createOrUpdateMedia(file.name, reply, replace).then(resolve, reject);
				}, reject);
			});
		}

		/**
   * Checks if the given url is a valid tcMedia url
   * @param {string} url - Url to be checked
   * @returns {boolean} - true if url is a valid tcMedia url, otherwise false
   */
		function isTcMediaUrl(url) {
			return typeof url === 'string' && url.indexOf(TCML) === 0;
		}

		/**
   * Returns a tcMedia definition object
   * @param {string} name - Name of the media
   * @param {Object} props - dataURL of the media
   * @return {{[qInfo]: {[qId]: string, qType: string}, tcMedia: {data: string, name: string, type: string, url: string}}}
   */
		function createTCMediaDef(name, props) {
			var def = qlikService.createGenericObjectDef({ type: 'tcMedia' });

			def.tcMedia = {
				data: props.data,
				lastModified: props.lastModified,
				name: name,
				size: props.size,
				source: props.source,
				url: TCML + name
			};

			return def;
		}

		/**
   * Returns media item by given name
   * @param {string} name - Name of the mediaItem
   * @return {null|object} - mediaItem if found any, null otherwise
   */
		function getMediaItemByName(name) {
			return _mediaItemsMap[name] || null;
		}

		/**
   * Get next possible (unused) name
   * @param {string} name - Source name
   * @returns {string}
   */
		function getTargetName(name) {
			var i = 1,
			    parts = name.split('.'),
			    ext = parts.pop(),
			    basename = parts.join('.'),
			    targetName = name;
			while (getMediaItemByName(targetName)) {
				targetName = basename + '(' + i + ').' + ext;
				i++;
			}
			return targetName;
		}

		/**
   * Extracts (file) name from url
   * @param {string} url - Source url
   * @returns {string} - Returns the name or an empty string
   */
		function extractNameFromUrl(url) {
			var name = 'Unknown';
			if (isTcMediaUrl(url)) {
				name = url.substr(TCML.length);
			} else if (url.indexOf('data:') !== 0) {
				name = url.split('?').shift().split('/').pop();
			}
			return name;
		}

		/**
   * Returns the main ready promise, which will be resolved, when provider is ready
   * @returns {Promise.<object>}
   */
		function getReady() {
			return _ready.promise;
		}

		/**
   * Resolves/renews the main ready promise
   * @param {boolean} ready - Renew the promise if it is unresolved and ready is false, resolves it otherwise
   */
		function setReady(ready) {
			if (ready === false && _ready.resolved) {
				_ready = new defer();
			} else if (ready !== false) {
				_ready.resolved = true;
				_ready.resolve(_mediaProvider);
			}
		}

		/**
   * Reads file content and returns it as dataURL in a promise
   * @param {File} file - Input file
   * @returns {Promise<object>} - Output dataURL
   */
		function fileToData(file) {
			return new Promise(function (resolve, reject) {
				var reader = new FileReader();
				reader.onerror = function (err) {
					reject(err);
				};
				reader.onload = function () {
					var reply = {
						name: file.name,
						data: this.result,
						lastModified: file.lastModifiedDate,
						type: file.type,
						size: file.size,
						source: 'file://' + file.name
					};
					resolve(reply);
				};
				reader.readAsDataURL(file);
			});
		}

		/**
   * Loads content behind the url and converts it to a dataURL
   * @param {string} url - URL to be converted to dataURL by downloading the content
   * @returns {Promise.<string>} - dataURL
   */
		function urlToData(url) {
			return new Promise(function (resolve, reject) {

				//				$.get(url).then(function(response, status, jXHR){
				//					let type = jXHR.getResponseHeader('content-type');
				//
				//					debugger;
				//					resolve(reply);
				//
				//					let reader = new FileReader();
				//					reader.onload = function(){
				//						reply.data = this.result;
				//						resolve(reply);
				//					};
				//					reader.readAsDataURL(new Blob([response], {type: reply.type}));
				//
				//				}, reject);

				var xhr = new XMLHttpRequest();

				xhr.onerror = function () {
					reject(createError(this.statusText, this.status));
				};

				xhr.onload = function () {
					var reply = {
						data: null,
						lastModified: this.getResponseHeader('last-modified'),
						type: this.getResponseHeader('content-type'),
						size: this.response.size,
						source: url
					};

					var reader = new FileReader();
					reader.onload = function () {
						reply.data = this.result;
						resolve(reply);
					};
					reader.readAsDataURL(this.response);
				};

				xhr.open('GET', url);
				xhr.responseType = 'blob';
				xhr.send();
			});
		}

		/**
   * Resizes an image from dataURL
   * @param {string} data - Original image data as dataURL or url
   * @param {number} width - target width
   * @param {number} height - target height
   * @returns {Promise.<string>} - Resized image data as dataURL
   */
		//		function resampleImage(data, width, height){
		//			return new Promise(function(resolve, reject){
		//				let canvas = document.createElement('canvas'),
		//					ctx = canvas.getContext('2d'),
		//					image = new Image();
		//
		//				image.src = data;
		//
		//				image.onerror = function(){
		//					reject(createError(this.statusText, this.status));
		//				};
		//
		//				image.onload = function(){
		//					canvas.width = width;
		//					canvas.height = height;
		//
		//					ctx.drawImage(image,
		//						0, 0, image.width, image.height,
		//						0, 0, width, height
		//					);
		//					resolve(canvas.toDataURL());
		//				};
		//			});
		//		}


		/**
   * Provides a media for download
   * @param {string} name - Media name
   * @returns {Promise.<*>} - Will be resolved when download starts
   */
		function downloadMedia(name) {
			return getReady().then(function (instance) {
				return instance.getMediaData(name).then(function (data) {
					download(name, data);
				});
			});

			function download(filename, data) {
				var elem = document.createElement('a');
				elem.setAttribute('href', data);
				elem.setAttribute('download', filename);

				if (document.createEvent) {
					var event = document.createEvent('MouseEvents');
					event.initEvent('click', true, true);
					elem.dispatchEvent(event);
				} else {
					elem.click();
				}
			}
		}

		/**
   * Checks if download is supported or not
   * @returns {boolean} - true, if supported, false otherwise
   */
		function isDownloadSupported() {
			var a = document.createElement('a');
			return typeof a.download !== 'undefined';
		}
	}

	/**
  * Deferred object based on native Promise (if not polyfilled) implementation
  * @constructor
  */
	function defer() {
		var _this = this;
		_this.promise = new Promise(function (resolve, reject) {
			_this.resolve = resolve;
			_this.reject = reject;
		});
	}

	/**
  * Returns a new Error object with given message and code properties
  * @param {string} msg - Error message
  * @param {number} [code] - Error code
  * @returns {Error}
  */
	function createError(msg, code) {
		var err = new Error(msg);
		err.code = code;
		return err;
	}
});