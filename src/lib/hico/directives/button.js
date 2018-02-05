import {prefix} from '../prefix';
import {QlikService} from '../services/qlik-service';
import {ActionService} from '../services/action-service';
import {MediaService} from '../services/media-service';
import {Utils} from '../common/utils';

define([
	'jquery',
	'qlik',
	'angular',
	'qvangular',
	'./button.html',
	'../services/action-service'
], function($, qlik, angular, qvangular, template){

	const qlikService = QlikService.getInstance(),
		actionService = ActionService.getInstance();

	/** Register an angular directive for <div data-hico-button></div> element */
	qvangular.directive(prefix + 'Button', Button);

	const Promise = qlik.Promise; // its required to use qlik.Promise instead of native one, so the preview is in sync!

	/**
	 * HiCo-Button Directive
	 * @return {*} angular directive
	 * @constructor
	 */
	function Button(){
		return {
			restrict: 'A',
			scope: {
				updateStates: '&onStatesUpdate',
				states: '<',
				isTrue: '<',
				evaluateStates: '<',
				activeStates: '<',
				maxStates: '<',
				inEditMode: '<',
				scrollingInfo: '<',
				defaultStyles: '<'
			},
			controller: ['$scope', '$element', ButtonController],
			controllerAs: '$ctrl',
			template: template
		};
	}

	/**
	 * HiCo-Button Controller
	 *
	 * @param $scope - angular $scope of the element
	 * @param $element - angular $element
	 * @constructor
	 */
	function ButtonController($scope, $element){
		var extScope = qlikService.getExtensionScope($scope),
			app = extScope && extScope.ext.model.app || qlikService.app;

		var ctrl = this;
		this.states = $scope.states;
		this.maxStates = $scope.maxStates || 1;

		this.evaluateStates = $scope.evaluateStates !== false; // evaluate states (expressions) on every paint if not explicitly disabled
		this.activeStates = $scope.activeStates || [];
		this.qlikService = qlikService;
		this.actionService = actionService;
		this.mediaProvider = !qlikService.isPrinting() ? MediaService.getInstance(app.id).mediaProvider : null;
		this.isTrue = typeof $scope.isTrue !== 'function' ? isTrue : $scope.isTrue;
		this.inEditMode = $scope.inEditMode;
		this.inSnapshotMode = qlikService.inStoryMode() || qlikService.inPlayMode();
		this.preventActions = this.qlikService.isPrinting() || this.inEditMode || this.inSnapshotMode;
		this.actionsRunning = {};

		this.getScope = () => $scope;
		this.getElement = () => $element;

		// register watchers
		this.unwatchChanges = $scope.$watchGroup(['states', 'defaultStyles'], function(newValues, oldValues/*, $scope*/){
			ctrl.states = newValues[0];
			ctrl.defaultStyles = newValues[1];
			ctrl.$onChanges({
				states: {
					currentValue: newValues[0],
					previousValue: oldValues[0]
				},
				defaultStyles: {
					currentValue: newValues[1],
					previousValue: oldValues[1]
				}
			});
		});

		// register on $destroy event ($onDestroy life cycle)
		$element.on('$destroy', this.onDestroy);

		// listen to paint (event from trueChart) and refresh active states
		$scope.$on('paint', function(){
			ctrl.refreshActiveStates();
		});

		// register custom trigger handler
		$scope.$on('performCustomTrigger', function(evt, data){
			ctrl.activeStates.forEach(function(state){
				angular.extend(evt, data);
				this.doAction(evt, state, 'custom');
			}, ctrl);
		});

		/**
		 * Apply styles and add classNames to active states and set them
		 * @param states {array} Array of states to be set as active
		 */
		this.setActiveStates = function(states){
			ctrl.applyStyles(states, false, $scope.defaultStyles, $scope.scrollingInfo);
			ctrl.applyClasses(states);
			ctrl.activeStates = states;

			// inform parent scope about updated states
			$scope.updateStates({states: states});
		};

	}

	/**
	 * Shared methodes and properties of the ButtonController
	 * @type {*}
	 */
	ButtonController.prototype = {

		doAction: function(evt, state, tType){
			var $ctrl = this;
			// Don't execute actions in edit mode
			if(this.preventActions || $ctrl.actionsRunning[tType] || this.qlikService.inEditMode()){
				//tType === 'click' && toastr.info('In "edit" mode the execution of button actions is disabled!');
				return;
			}

			this.actionService.getReady().then((actionService) =>{
				const trigger = state.triggers.filter(trigger => trigger.type === tType)[0];

				if(!trigger || trigger.type === 'custom' && evt.name !== trigger.name){
					return;
				}
				const contextType = {isMashUp: !qlik.navigation.inClient},
					actions = trigger.actions.slice(); // make a flat copy of actions array, because we will modify it

				// set "busy" flag for current trigger type
				this.actionsRunning[tType] = true;

				// execute actions by starting with parallel actions first
				return execute(actions, false).then(() =>{
					this.actionsRunning[tType] = false;
				}).catch(err =>{
					this.actionsRunning[tType] = false;
					console.warn('Error occured while actions were executed!', trigger.actions, err);
				});


				/**
				 * Executes given actions depending on inOrder flag.
				 * Calls itself recursively (with switching inOrder flag) until all actions were executed.
				 *
				 * @param {Array} actions - Array of actions to be executed
				 * @param {boolean} inOrder - If true, actions are executed sequentially, otherwise parallel
				 * @return {Promise}
				 */
				function execute(actions, inOrder){
					if(actions.length === 0){ // nothing to execute
						return Promise.resolve();
					}else if(inOrder){
						return executeSequential(collectActions(actions, inOrder)).then(() => execute(actions, !inOrder));
					}else{
						return executeParallel(collectActions(actions, inOrder)).then(() => execute(actions, !inOrder));
					}
				}

				/**
				 * Returns all actions with same "inOrder" value until first occurrence of mismatch
				 *
				 * @param {Array} actions - Array of actions, to get the collection from it
				 * @param {boolean} inOrder - Execution order flag
				 * @return {Array} - Array of actions with same inOrder value
				 */
				function collectActions(actions, inOrder){
					let collection = []; // parallel actions
					while(actions.length > 0 && !!actions[0].inOrder === inOrder){ // transform undefined inOrder value of old button states into a boolean
						collection.push(actions.shift());
					}
					return collection;
				}

				/**
				 * Executes all given actions in parallel
				 *
				 * @param {Array} actions - Array of actions to be executed
				 * @return {Promise.<*[]>|*}
				 */
				function executeParallel(actions){
					if(actions.length === 0){
						return Promise.resolve();
					}
					return Promise.all(actions.map(action =>{
						let args = [action.params, action.optionalParams],
							currAction = actionService.getAction(action.name);

						if(action.name === 'custom'){
							args = [$, qlik, $ctrl.getScope(), $ctrl.getElement(), contextType, evt, action.params, action.optionalParams];
						}

						return Promise.resolve(currAction.execute.apply(currAction, args))
							.catch($ctrl.qlikService.engineErrorHandler(currAction, 'execute', args));
					}));
				}

				/**
				 * Executes all given actions sequentially
				 *
				 * @param {Array} actions - Array of actions to be executed
				 * @param {number} [index] - start index
				 * @return {Promise}
				 */
				function executeSequential(actions, index){
					index = index || 0; // start with first action
					if(index >= 0 && index === actions.length){
						return Promise.resolve();
					}
					let action = actions[index],
						args = [action.params, action.optionalParams],
						currAction = actionService.getAction(action.name);

					index++;

					if(action.name === 'custom'){
						args = [$, qlik, $ctrl.getScope(), $ctrl.getElement(), contextType, evt, action.params, action.optionalParams];
					}

					return Promise.resolve(currAction.execute.apply(currAction, args))
						.catch($ctrl.qlikService.engineErrorHandler(currAction, 'execute', args))
						.then(() => executeSequential(actions, index));
				}
			});
		},

		/**
		 * Get evaluated and active button states
		 * @return {Promise} Array of states where the condition is fulfilled
		 */
		getActiveStates: function(states){
			var i = 0,
				activeStates = [];

			if(!this.evaluateStates){
				return Promise.all(this.activeStates);
			}

			while(i < states.length && activeStates.length < this.maxStates){
				this.isTrue(states[i].condition) && activeStates.push(states[i]);
				i++;
			}

			return Promise.all(activeStates.map(evalExpressions, this));
		},

		refreshActiveStates: function(){
			this.getActiveStates(this.states).then(this.setActiveStates);
		},

		applyStyles: function(states, hovering, defaults, scrollingInfo){
			states.forEach(function(state){
				if(!state.style){
					return;
				}

				var styles = {},
					iconStyles = {},
					containerStyles = {},
					layout = state.layout,
					border = state.style.border,
					background = state.style.background,
					iconStyle = state.style.icon,
					fontStyle = state.style.font,

					hover = hovering && state.hasActions && (!state.buttonState || state.buttonState === 'normal');

				// set default styles for all buttons
				styles = angular.extend({}, defaults);
				containerStyles = angular.extend({}, defaults);

				if((!state.buttonType || state.buttonType === 'simple') && prefix === 'hico' && hover){
					styles['background-color'] = 'rgba(159,159,159,0.4)'; // apply hover background-color for tc-buttons with actions only
				}

				if(fontStyle){
					let fontsize = !fontStyle.size || isNaN(fontStyle.size) && fontStyle.size.indexOf('px') === -1 ? fontStyle.size : Utils.getDynamicFontSize(fontStyle.size);
					styles['color'] = (hover ? fontStyle.hoverColor : fontStyle.color) || styles['color'];
					fontStyle.family && (styles['font-family'] = fontStyle.family);
					fontsize && !isNaN(styles['font-size'] = fontsize) && (styles['font-size'] += 'px');
					fontStyle.weight && (styles['font-weight'] = fontStyle.weight);
					fontStyle.style && (styles['font-style'] = fontStyle.style);
				}

				// use default color for lui-buttons (default) if no color was specified
				if((state.buttonType === 'lui-button' || state.buttonType === 'lui-fade-button') && (!fontStyle || !fontStyle.color)){
					styles['color'] = 'inherit';
				}

				let width = layout.width + (!isNaN(layout.width) ? 'px' : '');
				styles['width'] = width;
				styles['min-width'] = width;

				let height = layout.height + (!isNaN(layout.height) ? 'px' : '');
				styles['height'] = height;
				styles['min-height'] = height;
				styles['text-align'] = layout.hTextAlign;
				styles['vertical-align'] = layout.vAlign;
				styles['justify-content'] = layout.hContentAlign;
				styles['align-items'] = layout.vContentAlign;
				styles['padding'] = layout.padding === 'none' ? 0 : layout.padding;
				styles['margin'] = layout.margin === 'none' ? 0 : layout.margin;

				styles['box-shadow'] = state.style.boxShadow;

				if(scrollingInfo){
					containerStyles['justify-content'] = scrollingInfo.horizontal ? 'flex-start' : layout.hAlign;
					containerStyles['align-items'] = scrollingInfo.vertical ? 'flex-start' : layout.vAlign;
				}else{
					containerStyles['justify-content'] = layout.hAlign;
					containerStyles['align-items'] = layout.vAlign;
				}

				// Apply border styles
				if(border.enabled){
					styles['border-radius'] = border.radius;
					styles['border-color'] = hover ? border.hoverColor : border.color;
					styles['border-style'] = border.style;
					styles['border-width'] = border.width;
				}else if(border.enabled === false){
					styles['border-width'] = '0';
				}

				if(background){
					styles['background-color'] = (hover ? background.hoverColor : background.color) || styles['background-color'];
					if(state.buttonType === 'image'){
						styles['background-image'] = background.image ? ('url(' + background.image + ')') : null;
						if(background.position){
							styles['background-position-y'] = background.position.y;
							styles['background-position-x'] = background.position.x;
						}
						styles['background-repeat'] = background.repeat;
						styles['background-size'] = background.size;
					}
				}

				if(state.buttonType === 'custom' && typeof state.style.custom === 'string'){
					state.style.custom.split(';').forEach(function(s){
						var css = s.split(':');
						if(css.length < 2 || css[0].trim() === ''){
							return;
						}
						styles[css.shift().trim()] = css.join(':').trim();
					});
				}

				if(state.icon){
					if(iconStyle){
						iconStyles['color'] = hover ? iconStyle.hoverColor : iconStyle.color;
					}

					if(layout.icon && (layout.icon.position === 'top' || layout.icon.position === 'bottom')){
						iconStyles['display'] = 'block';
					}
				}

				// recalculate height when margin is used
				if(layout.margin && layout.margin !== 'none'
					&& (state.buttonType === 'simple' || state.buttonType === 'image' || layout.height)
					&& !(layout.height === 'auto' || layout.height && layout.height.indexOf('calc(') === 0)){

					let defaultHeight = '100%',
						margin = layout.margin.split(' '),
						corr = ' - ' + margin[0] + ' - ' + margin[margin.length < 3 ? 0 : 2];

					styles['height'] = 'calc(' + (layout.height || defaultHeight) + corr + ')';
				}

				state.styles = styles;
				state.iconStyles = iconStyles;
				state.containerStyles = containerStyles;

			});
		},

		applyClasses: function(states){
			states.forEach(function(state){

				if(!state.buttonType){
					return;
				}

				var classes = [];

				classes.push(Button.types[state.buttonType].class);
				classes.push(Button.types[state.buttonType].value);

				if(!state.hasActions){
					classes.push('no-action-button');
				}
				state.buttonState && classes.push('lui-' + state.buttonState);

				var iconClasses = [];
				var contentClasses = [];
				if (state.icon){
					state.icon.indexOf('fa-') === 0 && (iconClasses.push('fa'));
					state.icon.indexOf('lui-') === 0 && (iconClasses.push('lui-icon'));
					iconClasses.push(state.icon);

					if (state.style.icon){
						if(state.style.icon.size === 1){
							iconClasses.push('fa-lg');
						}else if(state.style.icon.size > 1){
							iconClasses.push('fa-' + state.style.icon.size + 'x');
						}
					}
					if(state.text){
						if (state.layout.icon){
							switch(state.layout.icon.position){
								case 'top':
								case 'bottom':
									break;
								case 'right':
									iconClasses.push('p-l-xs');
									contentClasses.push('flex-container');
									break;
								case 'left':
								default:
									iconClasses.push('p-r-xs');
									contentClasses.push('flex-container');
							}
						}else{
							// set padding for icon on left side as default
							iconClasses.push('p-r-xs');
							contentClasses.push('flex-container');
						}
					}
				}

				state.classes = classes;
				state.iconClasses = iconClasses;
				state.contentClasses = contentClasses;
			});
		},

		/**
		 * $onInit life cycle - executes after button controller was initialized
		 */
		$onInit: function(){
			var ctrl = this;

			this.onSelection = onSelection;
			this.registerOnSelectionHandler = registerOnSelectionHandler;

			// Register the onSelection handler, for onSelection trigger handling
			!this.qlikService.isPrinting() && this.qlikService.app.selectionState().OnData.bind(registerOnSelectionHandler);

			// update image path, when app was duplicated|copied|exported etc
			//this.states.forEach(function(state){
			//	// TODO: ...
			//	if(state.style && state.style.background && state.style.background.image){
			//		console.debug(state.style.background.image);
			//		console.debug(this.actionService.getAppList());
			//	}
			//}, this);

			this.getActiveStates(this.states).then(function(states){
				try{
					// Execute onLoad trigger actions
					states.forEach(function(state){
						if(!ctrl.inEditMode || qlik.navigation.getMode() !== 'edit'){
							ctrl.doAction({type: 'load'}, state, 'load');
						}
					});
				}catch(e){
					console.warn(e);
				}
			});

			/**
			 * Handler for onSelection events
			 */
			function onSelection(){
				var selectionState = this;
				ctrl.getActiveStates(ctrl.states).then(function(states){
					try{
						// Execute onSelection trigger actions
						states.forEach(function(state){
							ctrl.doAction(selectionState, state, 'selection');
						});
					}catch(e){
						console.warn(e);
					}
				});
			}

			/**
			 * Registers the onSelection handler
			 */
			function registerOnSelectionHandler(){
				// REVIEW: Is it ok to skip first OnData event in onSelection?
				this.OnData.unbind(registerOnSelectionHandler);
				this.OnData.bind(onSelection);
			}
		},

		/**
		 * On changes handler - handles state changes
		 * @param newVal
		 * @param oldVal
		 * @param $scope
		 */
		$onChanges: function(changes){
			if(changes){
				var i, j, len1, len2, state, triggers;

				this.states = changes.states.currentValue;
				this.defaultStyles = changes.defaultStyles.currentValue;

				// Check if button has actions defined
				for(i = 0, len1 = this.states.length; i < len1; i++){
					state = this.states[i];
					state.hasActions = false; // assume the button has no actions
					triggers = state.triggers;
					if(triggers.length > 0){
						for(j = 0, len2 = triggers.length; j < len2; j++){
							if(triggers[j].actions.length > 0){
								state.hasActions = true; // uless we find some
								break;
							}
						}
					}
				}

				this.refreshActiveStates();
			}
		},

		/**
		 * On destroy handler - clean up after button was destroyed (removed from DOM)
		 */
		onDestroy: function(){
			var app = qlik.currApp(),
				element = angular.element(this),
				scope = element.scope(), // parent scope (used to compile the button directive)
				ctrl = element.isolateScope().$ctrl;

			ctrl.activeStates.forEach(function(state){
				ctrl.doAction({type: 'beforeUnload'}, state, 'beforeUnload');
			}, ctrl);

			// de-register watchers
			ctrl.unwatchChanges();

			// Unbind the onSelection handler
			if(!ctrl.qlikService.isPrinting() && app){ // in some cases app can be "null" (i.e. when app was closed because of conection problems)
				var selectionState = app.selectionState();
				selectionState.OnData.unbind(ctrl.registerOnSelectionHandler); // when no selection was applied
				selectionState.OnData.unbind(ctrl.onSelection);
			}

			// delete reference to the $element property
			scope.$element = null;
		}
	};

	function evalExpressions(state){
		var style,
			ctrl = this,
			_state = JSON.parse(JSON.stringify(state)),
			promises = [],
			evalExpr = ctrl.qlikService.evalExpression,
			deferred = qlik.Promise.defer();

		state.text && promises.push(ctrl.qlikService.evalExpression(state.text).then(function(reply){ _state.text = reply; }));
		state.tooltip && promises.push(ctrl.qlikService.evalExpression(state.tooltip).then(function(reply){ _state.tooltip = reply; }));
		state.icon && promises.push(ctrl.qlikService.evalExpression(state.icon).then(function(reply){ _state.icon = reply; }));
		state.buttonState && promises.push(ctrl.qlikService.evalExpression(state.buttonState).then(function(reply){ _state.buttonState = reply !== '-' ? reply : 'normal'; }));

		if(state.style){
			style = state.style;
			if(style.background){
				style.background.color && promises.push(ctrl.qlikService.evalExpression(style.background.color).then(function(reply){ _state.style.background.color = reply !== '-' ? reply : undefined; }));
				style.background.hoverColor && promises.push(ctrl.qlikService.evalExpression(style.background.hoverColor).then(function(reply){ _state.style.background.hoverColor = reply !== '-' ? reply : undefined; }));
				style.background.image && promises.push(ctrl.qlikService.evalExpression(style.background.image).then(function(reply){
					if(reply === '-'){
						_state.style.background.image = undefined; // expression could not be validated
					}else if(!ctrl.mediaProvider.isTcMediaUrl(reply)){
						_state.style.background.image = reply; // not a tcMedia url -> usual url is assumed
					}else{
						return ctrl.mediaProvider.getMediaDataByUrl(reply).then(function(data){ _state.style.background.image = data; });
					}
				}));
			}

			if(style.icon){
				style.icon.color && promises.push(ctrl.qlikService.evalExpression(style.icon.color).then(function(reply){ _state.style.icon.color = reply !== '-' ? reply : undefined; }));
				style.icon.hoverColor && promises.push(ctrl.qlikService.evalExpression(style.icon.hoverColor).then(function(reply){ _state.style.icon.hoverColor = reply !== '-' ? reply : undefined; }));
			}

			if(state.style.font){
				style.font.color && promises.push(ctrl.qlikService.evalExpression(style.font.color).then(function(reply){ _state.style.font.color = reply !== '-' ? reply : undefined; }));
				style.font.hoverColor && promises.push(ctrl.qlikService.evalExpression(style.font.hoverColor).then(function(reply){ _state.style.font.hoverColor = reply !== '-' ? reply : undefined; }));
				style.font.family && promises.push(ctrl.qlikService.evalExpression(style.font.family).then(function(reply){ _state.style.font.family = reply !== '-' ? reply : undefined; }));
				style.font.size && promises.push(ctrl.qlikService.evalExpression(style.font.size).then(function(reply){ _state.style.font.size = reply !== '-' ? reply : undefined; }));
				style.font.weight && promises.push(ctrl.qlikService.evalExpression(style.font.weight).then(function(reply){ _state.style.font.weight = reply !== '-' ? reply : undefined; }));
				style.font.style && promises.push(ctrl.qlikService.evalExpression(style.font.style).then(function(reply){ _state.style.font.style = reply !== '-' ? reply : undefined; }));
			}

			if(style.border){
				style.border.hoverColor && promises.push(ctrl.qlikService.evalExpression(style.border.hoverColor).then(function(reply){ _state.style.border.hoverColor = reply !== '-' ? reply : undefined; }));
				style.border.color && promises.push(ctrl.qlikService.evalExpression(style.border.color).then(function(reply){ _state.style.border.color = reply !== '-' ? reply : undefined; }));
			}

			if(style.custom){
				promises.push(evalExpr(style.custom).then(reply =>{_state.style.custom = reply !== '-' ? reply : undefined;}));
			}
		}

		state.triggers && _state.triggers.forEach(function(trigger){
			trigger.actions.forEach(function(action){
				const {paramsExpr, optionalParamsExpr} = action;
				action.params = action.params || {};
				action.optionalParams = optionalParamsExpr ? action.optionalParams || [] : undefined;

				promises = [...promises, evalParams(paramsExpr, action.params)];

				// optional parameters, could be undefined
				optionalParamsExpr && optionalParamsExpr.forEach((paramExpr, i) =>{
					const param = action.optionalParams[i] = {type: paramExpr.type, params: {}};
					promises = [...promises, evalParams(paramExpr.parameters, param.params)];
				});
			});
		});

		Promise.all(promises).then(function(){deferred.resolve(_state);});

		return deferred.promise;
	}

	/**
	 * Evaluates parameters and returns an array of promises
	 *
	 * @param {{[key: string]: string}} paramsExpr - Parameters to be evaluated (expressions)
	 * @param {{[key: string]: string}} params - Evaluated parameters
	 * @return {Array}
	 */
	function evalParams(paramsExpr, params){
		const promises = [];
		for(var key in paramsExpr){
			if(paramsExpr.hasOwnProperty(key)){
				promises.push(((key) => qlikService.evalExpression(paramsExpr[key]).then((reply) => params[key] = reply))(key));
			}
		}
		return promises;
	}

	/**
	 * Checks if a condition (of a state) is true
	 */
	function isTrue(condition){
		condition  = condition.toString().toLowerCase();
		return condition === ''
			|| condition === 'true'
			|| condition === '1'
			|| condition === '-1';
	}

	Button.Trigger = function(){
		this.type = 'click';
		this.actions = [
			new Button.Action()
		];
	};

	Button.Action = function(){
		this.name = 'none';
		this.params = {};
		this.paramsExpr = {};
	};

	Button.types = {
		'simple': {group: 'General', class: 'simple lui-button', value: 'hico-custom-simple-button', label: 'simple'},
		'image': {group: 'General', class: 'image lui-button', value: 'hico-custom-image-button', label :'image'},
		'custom': {group: 'General', class: 'custom lui-button', value: 'hico-custom-css-button', label: 'custom'},

		'lui-button': {group: 'Sense Button', class: 'lui-button', value: 'lui-button', label: 'default'},
		'lui-button-danger': {group: 'Sense Button', class: 'lui-button', value: 'lui-button--danger', label: 'danger'},
		'lui-button-info': {group: 'Sense Button', class: 'lui-button', value: 'lui-button--info', label: 'info'},
		'lui-button-success': {group: 'Sense Button', class: 'lui-button', value: 'lui-button--success', label: 'success'},
		'lui-button-warning': {group: 'Sense Button', class: 'lui-button', value: 'lui-button--warning', label: 'warning'},

		'lui-fade-button': {group: 'Sense Fade Button', class: 'lui-fade-button', value: 'lui-fade-button', label: 'default'},
		'lui-fade-button-danger': {group: 'Sense Fade Button', class: 'lui-fade-button', value: 'lui-fade-button--danger', label: 'danger'},
		'lui-fade-button-info': {group: 'Sense Fade Button', class: 'lui-fade-button', value: 'lui-fade-button--info', label: 'info'},
		'lui-fade-button-success': {group: 'Sense Fade Button', class: 'lui-fade-button', value: 'lui-fade-button--success', label: 'success'},
		'lui-fade-button-warning': {group: 'Sense Fade Button', class: 'lui-fade-button', value: 'lui-fade-button--warning', label: 'warning'},

		'lui-overlay-button': {group: 'Overlay', class: 'lui-overlay-button', value: 'lui-overlay-button', label: 'overlay'}
	};

	Button.Controller = ButtonController;
	return Button;
});
