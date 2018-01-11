import {prefix} from '../prefix';

define([
	'qlik',
	'require',
	'qvangular',
	'ng!$compile',
	'ng!$timeout',
	'./media-library.html',
	'./modal-dialog',
	'../translations/translation',
	'../services/qlik-service',
	'../services/media-service',
	'leonardo-ui'
], function(qlik, require, qvangular, $compile, $timeout, template, Modal, translation, QlikService, MediaService, leonardoui){

	const _mediaService = !QlikService.isPrinting() ? MediaService.getInstance(qlik.currApp().id) : {};
	const _mediaProvider = _mediaService.mediaProvider;
	const STATES = {
		DEFAULT: 'DEFAULT',
		HIDDEN: 'HIDDEN',
		NOT_IN_LIBRARY: 'NOT_IN_LIBRARY',
		NO_MEDIA_IN_LIBRARY: 'NO_MEDIA_IN_LIBRARY',
		NO_MEDIA_SELECTED: 'NO_MEDIA_SELECTED',
		CHOOSE_MEDIA_SOURCE: 'CHOOSE_MEDIA_SOURCE',
		ADD_FROM_LIB: 'ADD_FROM_LIB',
		ADD_FROM_FILE: 'ADD_FROM_FILE',
		ADD_FROM_URL: 'ADD_FROM_URL',
		EDIT_MEDIA_LIST: 'EDIT_MEDIA_LIST',
		EDIT_CURRENT_MEDIA: 'EDIT_CURRENT_MEDIA',
		MEDIA_NOT_FOUND: 'MEDIA_NOT_FOUND'
	};

	/** Register an angular directive for <hico-media-library></hico-media-library> element */
	qvangular.directive(prefix + 'MediaLibrary', [MediaLibrary]);


	/**
	 * Compiles media library component and attaches it to the documents body
	 * @param {object} [options] - Options
	 * @param {function} [options.onConfirm] - Callback which will be executed on confirmation with url as parameter
	 * @param {function} [options.onCancel] - Callback which will be executed on dialog cancel
	 * @param {string} [options.mediaUrl] - Initial media url
	 * @param {object} [options.scope] - angular scope which will be used as parent scope of the component
	 */
	MediaLibrary.show = function(options){
		let template, element,
			opts = typeof options === 'object' ? options : {},
			scope = opts.scope || qvangular.$rootScope.$new();

		scope.onConfirm = opts.onConfirm;
		scope.onCancel = opts.onCancel;
		scope.mediaUrl = opts.mediaUrl;
		template = '<' + prefix + '-media-library on-confirm="onConfirm(url)" on-cancel="onCancel()" media-url="mediaUrl"></' + prefix + '-media-library>';
		element = $compile(template)(scope);
		document.body.appendChild(element[0]);
	};

	return MediaLibrary;


	/**
	 * MediaLibrary angular directive
	 * @return {*}
	 */
	function MediaLibrary(){
		return {
			scope: {
				mediaUrl: '<',
				onConfirm: '&',
				onCancel: '&'
			},
			controller: ['$scope', '$element', Controller],
			controllerAs: '$ctrl',
			template: template
		};
	}

	/**
	 * MediaLibrary Controller
	 * @constructor
	 */
	function Controller($scope, $element){
		let _this = this;

		$scope.trans = translation.getTranslation;
		$scope.STATES = STATES;
		$scope.state = STATES.DEFAULT; // current state of the media library
		$scope.prevState = STATES.DEFAULT; // previous state of the media library

		$scope.mediaItems = []; // all available media items of the trueChart media library
		$scope.currentItem = null; // current selected media
		$scope.selectedItems = []; // currently selected media items
		$scope.selected = {}; // (multi)selected media items with name as key and boolean as value (true -> selected, otherwise unselected)
		$scope.filtered = []; // names matching search string
		$scope.fileList = []; // file items (created during import from files)
		$scope.importUrl = ''; // URL string for URL-imports

		$scope.isDownloadable = _mediaProvider.isDownloadSupported();

		this.apply = apply;
		this.cancel = cancel;
		this.inStates = inStates;
		this.addMedia = addMedia;
		this.downloadMedia = downloadMedia;
		this.applyChanges = applyChanges;
		this.onNameInputChage = onNameInputChage;

		$element.on('$destroy', function(){
			$scope.$destroy();
			_this.elements = null;
		});


		/**
		 * Initialization of the component
		 */
		this.$onInit = function(){
			this.elements = {
				$fileInput: $element.find('.hico-file-input'),
				$filesPreview: $element.find('.files-preview'),
				chooseMediaSource: $element.find('#choose-media-source').get(0),
				previewImage: $element.find('#hico-media-lib-preview-img').get(0)
			};

			this.elements.$fileInput.on('change', onFileInputChange);

			!QlikService.isPrinting() && updateMediaItems($scope.mediaUrl);
		};


		this.previewMedia = function(mediaItem){
			if(!mediaItem || !mediaItem.name){
				return;
			}

			if(!inStates([STATES.DEFAULT, STATES.EDIT_MEDIA_LIST])){
				setState(STATES.DEFAULT);
			}

			if(!mediaItem.data){
				_mediaProvider.getMediaData(mediaItem.name).then(function(data){
					mediaItem.data = data;
					_this.setPreviewSource(data);
				});
			}else{
				_this.setPreviewSource(mediaItem.data);
			}

			$scope.currentItem = mediaItem;
		};


		this.setPreviewSource = function(dataUrl){
			_this.elements.previewImage.src = dataUrl || '';
		};


		/**
		 * Previews files of given fileList
		 * @param {FileList} fileList - File list to be previewed
		 */
		this.previewFiles = function(fileList){
			let $filesPreview = this.elements.$filesPreview,
				promises = [];

			$scope.fileList = fileList;

			for(let i = 0, len = fileList.length; i < len; i++){
				promises.push(_mediaProvider.fileToData(fileList[i]));
			}

			Promise.all(promises).then(function(fileData){
				let fragment = document.createDocumentFragment();

				fileData.forEach(function(fileItem){
					let img = new Image();
					img.alt = fileItem.name;
					img.src = fileItem.data;
					img.className = 'bg-checkered';

					let span = document.createElement('span');
					span.innerText = fileItem.name;

					let div = document.createElement('div');
					div.appendChild(img);
					div.appendChild(span);

					fragment.appendChild(div);
				});

				$timeout(function(){
					$filesPreview.empty();
					$filesPreview.append(fragment);
				});
			}, function(err){
				console.error(err);
			});
		};


		/**
		 * Fill selectedItems array with currently selected items
		 * @param {object} [selected] - Key value pair with name as key and selected flag (boolean) as value
		 */
		this.setSelectedItems = function(selected){
			if(!selected){
				$scope.selectedItems = [];
				return;
			}

			$scope.selectedItems = $scope.mediaItems.filter(function(item){
				return selected.hasOwnProperty(item.name) && selected[item.name];
			});
		};


		/**
		 * Selects/deselects all (filtered) media
		 * @param {boolean} select - Selects if true, otherwise deselects
		 */
		this.selectAllMedia = function(select){
			let selected = $scope.selected;
			$scope.filtered.forEach(function(item){
				selected[item.name] = select;
			});
			this.setSelectedItems(selected);
		};



		this.addFromUrl = function(url){
			addUrls([url], false).then(resolveConflicts).then(function(mediaItems){
				let url = mediaItems && mediaItems.length && mediaItems[mediaItems.length - 1].tcMedia.url;
				$timeout(function(){
					updateMediaItems(url);
					$scope.importUrl = '';
				});
			});
		};

		this.addFromFiles = function(fileList){
			if(!fileList || !fileList.length){
				return;
			}

			let _this = this,
				files = [].slice.apply(fileList);

			addFiles(files, false).then(resolveConflicts).then(function(mediaItems){
				let url = mediaItems && mediaItems.length && mediaItems[mediaItems.length - 1].tcMedia.url;
				$timeout(function(){
					updateMediaItems(url);
					_this.elements.$fileInput.get(0).value = '';
					_this.elements.$filesPreview.empty();
					$scope.fileList = [];
				});
			}).catch(function(err){console.error(err);});
		};



		function onFileInputChange(evt){
			let fileInput = evt.target,
				files = fileInput.files;

			$timeout(function(){
				if(files.length){
					_this.importFilesInputString = files.length === 1 ? files[0].name : (files.length + ' ' + $scope.trans('FILES'));
					_this.previewFiles(files);
				}else{
					_this.importFilesInputString = '';
				}
			});
		}


		function onNameInputChage(evt){
			let currentItem = $scope.currentItem,
				nameInUse = _mediaProvider.getMediaItemByName(currentItem.targetName),
				differentName = currentItem.name !== currentItem.targetName;

			if(evt){
				switch(evt.keyCode){
					case 13: // RETURN
						_this.applyChanges();
						break;
					case 27: // ESC
						_this.resetEditingMedia(true);
						break;
				}
			}

			currentItem.targetNameInUse = differentName && nameInUse;
		}


		function showBIMediaLibrary(){
			require(['general.services/media-library/media-library'], function(BIMediaLibrary){
				$timeout(function(){
					let prevState = $scope.state;
					setState(STATES.HIDDEN);
					BIMediaLibrary.show({
						onConfirm: function(url){
							_this.addFromUrl(url);
							setState(STATES.DEFAULT);
						},
						onCancel: function(){
							setState(prevState);
						}
					});
				});
			});
		}


		/**
		 * Removes media from the library
		 * @param {object[]} itemsToRemove - Media items to be removed
		 */
		this.removeMedia = function(itemsToRemove){
			if(!itemsToRemove || !itemsToRemove.length){
				return;
			}
			let trans = $scope.trans,
				names = itemsToRemove.map(function(item){
					return item.name;
				}).join('\', \'');

			Modal.show({
				title: trans('DELETE_MEDIA') + '?',
				body: '\'' + names + '\' ' + trans('DELETE_MEDIA_BODY'),
				buttons: [
					{
						text: trans('DELETE'),
						handler: function(){
							let promises = [],
								currentItem = null,
								removableItems = $scope.mediaItems;

							for(let i = removableItems.length - 1; i >= 0; i--){
								currentItem = removableItems[i];

								let removeIndex = itemsToRemove.indexOf(currentItem);
								if(removeIndex !== -1){
									promises.push(_mediaProvider.removeMedia(currentItem.name));
									itemsToRemove.splice(removeIndex, 1);
									currentItem = null;
								}else if(!itemsToRemove.length){
									break;
								}
							}

							Promise.all(promises).then(function(){
								updateMediaItems(currentItem && currentItem.url);
							});
						}
					},
					{
						text: trans('CANCEL')
					}
				]
			});
		};


		this.startEditingMediaList = function(){
			setState(STATES.EDIT_MEDIA_LIST);
		};

		this.stopEditingMediaList = function(){
			$scope.selected = {};
			this.setSelectedItems();
			this.selectAllMedia(false);
			setState(STATES.DEFAULT);
		};


		/**
		 * Starts editing current media
		 * @param {object} mediaItem - Media item to be edited
		 */
		this.startEditingMedia = function(mediaItem){
			this.resetEditingMedia();

			if(!mediaItem){
				return;
			}

			mediaItem.targetName = mediaItem.name;
			mediaItem.targetNameInUse = false;

			this.editingMedia = mediaItem;
			setState(STATES.EDIT_CURRENT_MEDIA);
		};


		this.resetEditingMedia = function(cancelEditing){
			if(this.editingMedia){
				this.editingMedia.targetName = this.editingMedia.name;
			}

			if(cancelEditing){
				setState(STATES.DEFAULT);
			}
		};


		/**
		 * Stops editing media item and apply changes
		 * @param {object} mediaItem
		 */
		function applyChanges(mediaItem){
			let trans = $scope.trans;

			renameMediaItem(mediaItem).then(function(renamedItem){
				$timeout(function(){
					_this.previewMedia(renamedItem.tcMedia);
					setState(STATES.DEFAULT);
				});
			}).catch(function(err){
				if(err && err.code === 409){
					$timeout(function(){
						Modal.show({
							title: trans('ATTENTION'),
							body: trans('MEDIA_ALREADY_EXISTS'),
							buttons: [{text: trans('OK')}]
						});
					});
				}else if(err === false){
					$timeout(function(){
						setState(STATES.DEFAULT);
					});
				}else{
					console.error(err);
				}
			});
		}


		/**
		 * Renames a media item
		 * @param {Object} mediaItem - Media item to be renamed
		 * @returns {Promise.<Object>}
		 */
		function renameMediaItem(mediaItem){
			return new Promise(function(resolve, reject){
				if(!mediaItem || mediaItem.name === mediaItem.targetName){
					reject(false); // nothing to rename
				}else{
					_mediaProvider.renameMedia(mediaItem.name, mediaItem.targetName).then(resolve, reject);
				}
			});
		}


		/**
		 * Resets media item changes
		 * @param {object} mediaItem - Media item which changes should be reset
		 */
		this.resetChages = function(mediaItem){
			mediaItem.targetName = mediaItem.name;
			onNameInputChage();
		};


		function addMedia(source){
			switch(source){
				case 'from-lib':
					showBIMediaLibrary();
					break;
				case 'from-file':
					setState(STATES.ADD_FROM_FILE);
					break;
				case 'from-url':
					setState(STATES.ADD_FROM_URL);
					break;
				default:
					var popover = leonardoui.popover({
						content: _this.elements.chooseMediaSource.innerHTML,
						closeOnEscape: true,
						dock: 'top',
						alignTo: source.target
					});
					popover.element.parentElement.className = 'hico-lui hico-fa';

					[].slice.apply(popover.element.querySelectorAll('[data-add-media]')).forEach(function(element){
						element.addEventListener('click', function(){
							let source = this.getAttribute('data-add-media');
							$timeout(function(){
								addMedia(source);
							});
							popover.close();
						});
					});
			}
		}

		/**
		 * Downloads media items from library
		 * @param {Array.<Object>} mediaItems - Array of media items to be downloaded
		 */
		function downloadMedia(mediaItems){
			if(!$scope.isDownloadable || !mediaItems || !mediaItems.length){
				return;
			}

			mediaItems.forEach(function(item){
				_mediaProvider.downloadMedia(item.name);
			});
		}


		/**
		 * Add media items to media library from url
		 * @param {Array.<string>} urls - Array of urls to be added
		 * @param {boolean} [replace] - Replace flag, if true existing media will be replaced, otherwise renamed
		 * @returns {Promise.<{added: Array.<Object>, rejected: Array.<string>}>} - Added media items and rejected urls in a Promise
		 */
		function addUrls(urls, replace){
			let rejectedUrls = [];

			return Promise.all(urls.map(function(url){
				return _mediaProvider.addMediaFromUrl(url, replace).catch(function(reason){
					if(reason && reason.code === 409){
						rejectedUrls.push(url);
					}else{
						throw reason;
					}
				});
			})).then(function(mediaItems){
				return {
					added: mediaItems.filter(function(item){return typeof item !== 'undefined';}),
					rejected: rejectedUrls
				};
			});
		}


		/**
		 * Adds media items to media library from file list
		 * @param {Array.<File>} files - Files to be added
		 * @param {boolean} [replace] - Replace flag, if true existing media will be replaced, otherwise renamed
		 * @returns {Promise.<{added: Array.<Object>, rejected: Array.<File>}>} - Object in a promise with added/rejected files
		 */
		function addFiles(files, replace){
			let rejectedFiles = [];

			return Promise.all(files.map(function(file){
				return _mediaProvider.addMediaFromFile(file, replace).catch(function(reason){
					if(reason && reason.code === 409){
						rejectedFiles.push(file);
					}else{
						throw reason;
					}
				});
			})).then(function(mediaItems){
				return {
					added: mediaItems.filter(function(item){return typeof item !== 'undefined';}),
					rejected: rejectedFiles
				};
			});
		}


		/**
		 * Add rejected media (files/urls) to library by renaming new ones or replacing existing ones
		 * @param {{added: Array.<Object>, rejected: Array.<string|File>}} mediaItems - Object with added media items or rejected source items (urls, files)
		 * @param {boolean} [replace] - Replacement flag, if true existing media items will be replaced, otherwise they will be renamed
		 * @returns {Promise.<Array.<Object>>} - Added media items
		 */
		function addRejected(mediaItems, replace){
			return new Promise(function(resolve, reject){
				let rejected = mediaItems.rejected;
				if(!rejected || !rejected.length){
					resolve(mediaItems.added);
				}else{
					let add = rejected[0] instanceof File ? addFiles : addUrls;
					add(rejected, replace).then(function(replacedItems){
						return mediaItems.added.concat(replacedItems.added);
					}, reject).then(resolve, reject);
				}
			});
		}


		/**
		 * Resolves conflicts during media import
		 * @param {{added: Array.<Object>, rejected: Array.<string|File>}} mediaItems - Media items collection with added media or rejected source urls/files
		 * @returns {Promise.<Array.<Object>>} - Added media items
		 */
		function resolveConflicts(mediaItems){
			let trans = $scope.trans;
			return new Promise(function(resolve, reject){
				let rejectedItems = mediaItems.rejected;
				if(!rejectedItems.length){
					resolve(mediaItems.added);
					return;
				}

				$timeout(function(){
					let rejected = rejectedItems.map(function(item){
						return item.name || item;
					}).join('\',<br> \'');

					Modal.show({
						title: trans('MEDIA_ALREADY_EXISTS'),
						body: '\'' + rejected + '\'<br>' + trans('RESOLVE_MEDIA_CONFLICT_BODY'),
						buttons: [
							{
								text: trans('REPLACE'),
								handler: function(){
									addRejected(mediaItems, true).then(resolve, reject);
								}
							},
							{
								text: trans('RENAME'),
								handler: function(){
									addRejected(mediaItems).then(resolve, reject);
								}
							},
							{
								text: trans('CANCEL')
							}
						]
					});
				});

			});
		}


		/**
		 * Syncs local media items with media store
		 * @param {string} url - Url which should be displayed after update
		 */
		function updateMediaItems(url){
			_mediaProvider.getMediaItems().then(function(items){
				let previewItem = null,
					mediaUrl = $scope.mediaUrl,
					useUrl = url || mediaUrl,
					isTcMediaUrl = _mediaProvider.isTcMediaUrl(mediaUrl),
					mediaItems = items.map(function(item){
						let tcMedia = item.tcMedia;
						// preview the matching item if url was specified
						if(useUrl === tcMedia.url){
							previewItem = tcMedia;
						}
						return tcMedia;
					});

				// clear currentItem when it is not in mediaItems array
				if(mediaItems.indexOf($scope.currentItem) === -1){
					$scope.currentItem = null;
				}

				$timeout(function(){
					if(previewItem){
						// default case
						setState(STATES.DEFAULT);
						_this.previewMedia(previewItem);
					}else if(!mediaItems.length && !mediaUrl){
						// no media in lib and no initial url specified
						setState(STATES.NO_MEDIA_IN_LIBRARY);
						_this.setPreviewSource('');
					}else if(mediaUrl){
						// no media in lib, but initial url specified
						if(isTcMediaUrl){
							setState(STATES.MEDIA_NOT_FOUND);
							_this.setPreviewSource('');
						}else{
							setState(STATES.NOT_IN_LIBRARY);
							_this.setPreviewSource(mediaUrl);
						}
					}else{
						// lib is not empty but nothing to preview
						setState(STATES.NO_MEDIA_SELECTED);
					}
				});

				$scope.mediaItems = mediaItems;
			}, function(err){
				console.warn('Error occurred during media update of trueChart media library', err);
			});
		}


		function apply(){
			$scope.onConfirm({url: $scope.currentItem.url});
			$element.remove();
		}


		function cancel(){
			$scope.onCancel();
			$element.remove();
		}


		/**
		 * Set current State
		 * @param {string} state - State of the media library
		 */
		function setState(state){
			$scope.prevState = $scope.state;
			$scope.state = state || 'DEFAULT';
		}

		/**
		 * Returns true if the current state is one of the given states
		 * @param {Array.<string>} states - Possible states
		 * @returns {boolean} - true if current state is in the list, otherwise false
		 */
		function inStates(states){
			return states.indexOf($scope.state) !== -1;
		}
	}

});