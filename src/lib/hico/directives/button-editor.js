import {Toastr} from '../common/toastr';
import {prefix} from '../prefix';

requirejs.config({
	bundles: {
		'assets/client/client': [
			'general.services/media-library/media-library',
			'client.property-panel/components/string/string',
			'client.property-panel/components/slider/slider'
		]
	}
});

define([
	'require',
	'angular',
	'qvangular',
	'jquery',
	'ng!$timeout',
	'./button-editor.html',
	'./button',
	'./media-library',
	'../translations/translation',
	'../services/qlik-service',
	'leonardo-ui',
	'./codemirror',
	'jquery-slimscroll',
	'../common/icons-fa',
	'../common/icons-lui'
], function(require, angular, qvangular, $, $timeout, template, Button, MediaLibrary, translation, QlikService, leonardoui){

	const qlikService = QlikService.getInstance(),
		exampleImage = prefix === 'tcmenu' ? 'tcmenu/img/tcmenu_logo.jpg' : 'trueChart/img/logo.png';

	/** Register an angular directive for <div data-hico-button-editor></div> element */
	qvangular.directive(prefix + 'ButtonEditor', [ButtonEditor]);

	/**
	 * ButtonEditor component
	 *
	 * @return {*}
	 */
	function ButtonEditor(){
		return {
			restrict: 'A',
			scope: {
				state: '<',
				condition: '<',
				buttonName: '<',
				defaultStyles: '<'
			},
			controller: ['$scope', '$element', prefix + 'ActionService', ButtonEditorController],
			controllerAs: '$ctrl',
			template: template
		};
	}

	/**
	 * ButtonEditor Controller
	 * @constructor
	 */
	function ButtonEditorController($scope, $element, actionService){
		var ctrl = this,
			watchers = [];

		$element.on('$destroy', onDestroy);

		ctrl.ready = false;
		ctrl.getReady = Promise.resolve(); // ready by default
		ctrl.state = JSON.parse(JSON.stringify($scope.state)); // keep the original untouched (to make cancel possible)
		ctrl.actionService = actionService;
		ctrl.trans = translation.getTranslation;
		ctrl.openMediaLibrary = openMediaLibrary;

		if (!$scope.buttonName){
			watchers.push($scope.$watch('$ctrl.state.text', this.evalEditorTitle));
		}else{
			$scope.title = $scope.buttonName;
		}

		// Make sure this components are required only in Qlik Sense client mode (dependencies in client.js which must be already loaded)
		this.qComponents = {};
		if(qlikService.inClient()){
			this.getReady = new Promise(resolve =>{
				requirejs(['client.property-panel/components/string/string', 'client.property-panel/components/slider/slider'], (string, slider) =>{
					this.qComponents = {string, slider};
					resolve();
				});
			});
		}

		this.getScope = () => $scope;

		this.apply = function(){
			// Check if all required inputs are valid
			if(this.check()){
				$($element).trigger({type: 'apply', state: this.state});
				this.close();
			}else{
				Toastr.info(ctrl.trans('FILL_ALL_REQUESTED_FIELDS'));
			}
		};

		this.cancel = function(){
			$($element).trigger({type: 'cancel'});
			this.close();
		};

		this.check = function(){
			return $element.find('input[required]').filter(function(){
				return this.value === '';
			}).length === 0;
		};

		/**
		 * Closes the button editor
		 */
		this.close = function(){
			$element.remove();
			$scope.$destroy();
		};

		$timeout(function(){
			// Apply leonardo ui tabset
			$element.find('[data-tabset]').each(function(){
				leonardoui.tabset({element: this});
			});

			// Apply slimscroll plugin
			$element.find('.slimscroll').slimScroll({
				height: '100%',
				width: '100%'
			});

			$element.find('.editor').draggable({handle: ' .lui-dialog__header'});

			registerSortableActions();
		});

		ctrl.getReady.then(() =>{
			$timeout(function(){
				ctrl.ready = true;
				$element.removeClass('hidden');
			});
		});

		function onDestroy(){
			// unwatch watchers
			watchers.forEach(function(unwatch){
				unwatch();
			});
		}


		/**
		 * Opens trueChart media library
		 */
		function openMediaLibrary(){
			var style = ctrl.state && ctrl.state.style;

			let imageUrl = style && style.background.image;
			qlikService.evalExpression(imageUrl).then(function(reply){
				MediaLibrary.show({
					scope: $scope,
					mediaUrl: reply,
					onConfirm: function(url){
						ctrl.setBackgroundImageUrl(url);
					},
					onCancel: function(){
						// nothing to do...
						angular.noop();
					}
				});
			});
		}

	}

	ButtonEditorController.prototype = {
		/**
		 * Adds a trigger to the given trigger list
		 * @param triggers {Array} List of triggers
		 */
		addTrigger: function(triggers){
			var i,
				trigger = new Button.Trigger(),
				availableTriggers = this.triggers,
				usedTriggers = this.usedTriggers;

			if(!usedTriggers){
				triggers.push(trigger);
			}else if(usedTriggers.length < availableTriggers.length - 1){ // available triggers without custom trigger
				// get next unused trigger
				for(i = 0; i < availableTriggers.length; i++){
					if(usedTriggers.indexOf(availableTriggers[i].type) === -1){
						trigger.type = availableTriggers[i].type;
						triggers.push(trigger);
						break;
					}
				}
			}else{
				// only multiple custom triggers are alowed, when not empty
				trigger.type = 'custom';
				triggers.filter(function(trigger){ return trigger.type === 'custom' && !trigger.name; }).length === 0 && triggers.push(trigger) || Toastr.warning(
					'Please enter a valid trigger name, before a new custom trigger can be added'
				);
			}
			this.updateUsedTriggers();
		},

		/**
		 * Removes a given trigger from the given trigger list
		 * @param triggers {Array} List of trigger
		 * @param trigger {Object} Trigger to be removed
		 */
		removeTrigger: function(triggers, trigger){
			triggers.splice(triggers.indexOf(trigger), 1);
			this.updateUsedTriggers();
		},

		/**
		 * Updates the list of triggers, that are in use
		 */
		updateUsedTriggers: function(){
			this.usedTriggers = this.state.triggers.filter(function(trigger){
				// custom trigger can be defined more then once
				return trigger.type !== 'custom';
			}).map(function(trigger){
				return trigger.type;
			});
		},

		/**
		 * Returns triggers, which trigger at least one allowed action
		 * @param triggers {Array} Triggers to be filtered
		 */
		getEditableTriggers: function(triggers){
			var _this = this;
			return triggers.filter(function(trigger){
				return _this.getAllowedActions(trigger.actions).length > 0 || trigger.actions.length === 0;
			});
		},

		/**
		 * Checks if given trigger can be used or not
		 * @param {type: string} trigger Trigger to be checked
		 * @param {array.<{name: string>} [triggerActions] Trigger actions which also needs be supported
		 * @return {boolean} true if trigger is usable, fals otherwise
		 */
		isUsableTrigger: function(trigger, triggerActions){
			return this.usedTriggers.indexOf(trigger.type) === -1 // trigger is not in use
				&& (!triggerActions || !triggerActions.some(function(entry){ // no unsupported triggerActions there
					var action = this.actions[entry.name];
					return !!action.supportedTriggers && action.supportedTriggers.indexOf(trigger.type) === -1;
				}, this));
		},

		/**
		 * Callback which is executed, when user selects another trigger
		 */
		onTriggerChange: function(){
			this.updateUsedTriggers();
		},

		/**
		 * Adds an action to the given action list
		 * @param actions {Array} List of actions
		 * @param index {number} Index of the action after the new action will be inserted
		 */
		addAction: function(actions, index){
			index = index === undefined ? 0 : (index + 1);
			actions.splice(index, 0, new Button.Action());
			registerSortableActions(); // make new action also sortable
		},

		/**
		 * Removes a given action from the given action list
		 * @param actions {Array} List of action
		 * @param action {Object} action to be removed
		 */
		removeAction: function(actions, action){
			actions.splice(actions.indexOf(action), 1);
		},

		/**
		 * Returns actions, which are not blacklisted
		 * @param triggers {Array} actions to be filtered
		 */
		getAllowedActions: function(actions){
			var _this = this;
			return actions.filter(function(action){
				return !!_this.actions[action.name];
			});
		},


		/**
		 * Returns an action list, which contains only actions, that are not hidden
		 * @param {object} actions Action list
		 * @param {string} [triggerType] type of trigger which needs be supporte
		 * @return {*}
		 */
		getUsableActions: function(actions, triggerType){
			var action, name, visibleActions = {};
			for(name in actions){
				action = actions[name];
				if(action.isHidden !== true && (!triggerType || !action.supportedTriggers || action.supportedTriggers.indexOf(triggerType) !== -1)){
					visibleActions[name] = action;
				}
			}
			return visibleActions;
		},


		toggleCollapsible: function(evt){
			angular.element(evt.currentTarget).find('.lui-icon').toggleClass('lui-icon--arrow-up lui-icon--arrow-down');
			return false;
		},

		setCustomStyle: function(style, target){
			if(target === 'expression' && typeof style.custom !== 'object' ){
				let qExpr = style.custom || '';

				if(qExpr.indexOf('=') !== 0){
					qExpr = '=' + qExpr;
				}
				style.custom = {qStringExpression: {qExpr: qExpr}};
			}else if(target === 'plain' && style.custom && style.custom.qStringExpression){
				let qExpr = style.custom.qStringExpression.qExpr;
				style.custom = qExpr.indexOf('=') !== 0 ? qExpr : qExpr.substr(1, qExpr.length - 1);
			}
		},

		resetCustomStyle: function(){
			this.state.style.custom = this.parameters.styles.custom.value;
		},

		resetBackgroundImage: function(){
			this.state.style.background.image = this.parameters.styles.image.value;
		},

		setBackgroundImageUrl: function(url){
			this.state.style.background.image = url;
		},

		setIcon: function(className){
			this.state.icon = className;
		},

		setIconPosition: function(value){
			angular.extend(this.state.layout, {icon: {position: value}});
		},

		getIconPosition: function(){
			try {
				return this.state.layout.icon.position || 'left';
			}catch(e){
				return 'left';
			}
		},

		toggleExecutionOrder: function(action){
			action.inOrder = !action.inOrder;
		},

		// Properties which reuse qlik components
		definitions: {
			text: {type: 'string', ref: 'text', expression: 'optional'},
			tooltip: {type: 'string', ref: 'tooltip', expression: 'optional'},
			icon: {type: 'string', ref: 'icon', expression: 'optional'},
			buttonState: {type: 'string', ref: 'buttonState', expression: 'optional'},
			style: {
				font: {
					hoverColor: {type: 'string', ref: 'style.font.hoverColor', expression: 'optional'},
					color: {type: 'string', ref: 'style.font.color', expression: 'optional'},
					family: {type: 'string', ref: 'style.font.family', expression: 'optional'},
					size: {type: 'string', ref: 'style.font.size', expression: 'optional'},
					weight: {type: 'string', ref: 'style.font.weight', expression: 'optional'},
					style: {type: 'string', ref: 'style.font.style', expression: 'optional'}
				},
				icon: {
					size: {type: 'slider', ref: 'style.icon.size', min: 0, max: 5, defaultValue: 0},
					hoverColor: {type: 'string', ref: 'style.icon.hoverColor', expression: 'optional'},
					color: {type: 'string', ref: 'style.icon.color', expression: 'optional'}
				},
				background: {
					color: {type: 'string', ref: 'style.background.color', expression: 'optional'},
					hoverColor: {type: 'string', ref: 'style.background.hoverColor', expression: 'optional'},
					image: {type: 'string', ref: 'style.background.image', expression: 'optional', defaultValue: '../extensions/' + exampleImage},
					position: {type: 'string', ref: 'style.background.position', expression: 'optional'}
				},
				border: {
					hoverColor: {type: 'string', ref: 'style.border.hoverColor', expression: 'optional'},
					color: {type: 'string', ref: 'style.border.color', expression: 'optional'}
				},
				custom: {type: 'string', ref: 'style.custom', expression: 'optional'}
			}
		},

		$onInit: function(){
			setDefaults(this.state);
			var ctrl = this,
				faIcons = require('../common/icons-fa').default,
				luiIcons = require('../common/icons-lui').default;

			this.actions = this.getUsableActions(this.actionService.getActions());
			this.triggers = this.actionService.getTriggers();
			this.actionService.getParameters().then(function(params){
				ctrl.params = params;
			});

			this.parameters = getParameters();

			this.tooltips = {
				triggers: this.triggers.reduce(function(tooltips, trigger){ tooltips[trigger.type] = trigger.tooltip; return tooltips; })
			};

			this.faIcons = [];
			for (var key in faIcons){
				this.faIcons.push({value: key, label: faIcons[key]});
			}

			this.luiIcons = [];
			for (var key in luiIcons){
				this.luiIcons.push({value: key, label: luiIcons[key]});
			}

			this.isTrue = function(){return true;};

			// Create property definitions for string expressions with number as ref
			for(var i = 0; i < 10; i++){
				this.definitions['param' + i] = {type: 'string', ref: i.toString(), expression: 'optional'};
			}

			this.updateUsedTriggers();
		},

		evalEditorTitle: function(newText, oldText, $scope){
			qlikService.evalExpression(newText).then(function(text){
				$scope.title = text || 'Button';
			});
		},

		setBorder: function(value){
			var border = this.state.style.border || {};
			border.enabled = value;
			if(value === true){
				border.width = border.width || 1;
				border.style = border.style || 'solid';
				border.color = border.color || 'gray';
			}
			this.state.style.border = border;
		},

		setHeight: function(value){
			this.state.layout.height = this.state.layout.height === value ? undefined : value;
		},

		setWidth: function(value){
			this.state.layout.width = this.state.layout.width === value ? undefined : value;
		},

		/**
		 * Callback which is executed, when an editor-tab was selected
		 *
		 * @param {string} tabId - Id of the selected tab
		 */
		onTabSelected: function(tabId){
			switch(tabId){
				case 'general':
				case 'actions':
					// refresh codeMirror otherwise it would remain blank, until it becomes focused by clicking on it
					this.getScope().$broadcast('CodeMirror', codeMirror => $timeout(() => codeMirror.refresh()));
					break;
			}
		},

	};

	function setDefaults(/*state*/){
		// Set default values (style, layout, etc.)
	}

	/**
	 * Register jquery-ui sortable plugin for the action list
	 */
	function registerSortableActions(){
		angular.element('.editor #hico-action-triggers ul.action-list > li > ul.lui-list')
			.sortable({axis: 'y', handle: ' .sortable-handle', placeholder: 'action-item-placeholder', forcePlaceholderSize: true, stop: reorderActions});
	}

	/**
	 * Reorder actions of a specific trigger
	 */
	function reorderActions() {
		var action,
			list = angular.element(this),
			actions = list.find('li.action-item.ng-scope'),
			scope = list.scope(),
			trigger = scope.trigger;

		for (var i = 0, len = actions.length; i < len; i++){
			action = actions[i];
			action.style.top = '';  // remove inline styles for top|left, which are added by jquery-ui
			action.style.left = ''; // and cause "hidden" sorting-handles on next sorting try
			trigger.actions[i] = angular.element(action).scope().action;
		}
	}

	function getParameters(){
		return {

			styles: {
				'custom': {type: 'css', value: 'background: transparent url(../extensions/' + exampleImage + ') no-repeat center'},
				'image': {type: 'image', value: 'url(../extensions/' + exampleImage + ')'}
			},

			buttonTypes: Button.types,

			buttonStates: {
				'normal': {value: undefined, label: 'normal'},
				'active': {value: 'active', label: 'active'},
				'disabled': {value: 'disabled', label: 'disabled'}
			},

			fontFamilies: function(){
				try{
					return HiCo.Utils.GlobalFunctions.getFontTypes().map(function(font){
						return {value: font.id, label: font.translation};
					});
				}catch(e){
					return [
						{value: "Arial", label: "Arial"},
						{value: "Arial Unicode MS", label: "Arial Unicode MS"},
						{value: "Calibri", label: "Calibri"},
						{value: "Tahoma", label: "Tahoma"},
						{value: "Verdana", label: "Verdana"},
						{value: "QlikView Sans", label: "QlikView Sans"}
					];
				}
			}(),

			fontWeights: {
				normal: {value: 'normal', label: 'normal'},
				bold: {value: 'bold', label: 'bold'},
				bolder: {value: 'bolder', label: 'bolder'},
				lighter: {value: 'lighter', label: 'lighter'},
				number: {value: '100', label: 'number (100-900)'}
			},

			fontStyles: {
				normal: {value: 'normal', label: 'normal'},
				italic: {value: 'italic', label: 'italic'},
				oblique: {value: 'oblique', label: 'oblique'}
			},

			xPositions: {
				'center': {value: undefined, label: 'center'},
				'left': {value: 'left', label: 'left'},
				'right': {value: 'right', label: 'right'}
			},
			yPositions: {
				'center': {value: undefined, label: 'center'},
				'top': {value: 'top', label: 'top'},
				'bottom': {value: 'bottom', label: 'bottom'}
			},

			bgImageSizes: {
				'original': {value: undefined, label: 'original'},
				'cover': {value: 'cover', label: 'cover'},
				'contain': {value: 'contain', label: 'contain'},
				'stretch': {value: '100% 100%', label: 'stretch'}
			},

			bgRepeateOptions: {
				'repeat': {value: 'repeat', label: 'repeat'},
				'repeat-x': {value: 'repeat-x', label: 'repeat-x'},
				'repeat-y': {value: 'repeat-y', label: 'repeat-y'},
				'no-repeat': {value: 'no-repeat', label: 'no-repeat'},
				'initial': {value: 'initial', label: 'initial'},
				'inherit': {value: 'inherit', label: 'inherit'}
			},

			/**
			 * Possible widths of a button
			 */
			widthList: {
				'auto': {value: undefined, label: 'auto'},	// auto: depends on the content
				'full': {value: '100%', label: 'full'},		// full: 100% width
				'custom': {value: '100px', label: 'custom'} 	// custom: userspecific width (as valid css in px|%|em)
			},

			/**
			 * Possible heights of a button
			 */
			heightList: {
				'auto': {value: undefined, label: 'auto'},
				'full': {value: '100%', label: 'full'},
				'custom': {value: '40px', label: 'custom'}
			}
		};
	}

	ButtonEditor.getParameters = getParameters;

	return ButtonEditor;
});