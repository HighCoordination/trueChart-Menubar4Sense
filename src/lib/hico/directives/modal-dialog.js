import {prefix} from '../prefix';
import {AngularService} from '../services/AngularService';

define([
	'qvangular',
	'./modal-dialog.html'
], function(qvangular, template){
	qvangular.directive(prefix + 'ModalDialog', Modal);

	/**
	 * Compiles modal dialog component and attaches it to the documents body
	 * @param {object} [options] - Options
	 * @param {string} [options.title] - Title content of the dialog
	 * @param {string} [options.body] - Body content of the dialog
	 * @param {string} [options.footer] - Footer content of the dialog
	 * @param {object} [options.scope] - angular scope which will be used as parent scope of the component
	 */
	Modal.show = function(options){
		let template, element,
			opts = typeof options === 'object' ? options : {},
			scope = opts.scope || qvangular.$rootScope.$new();

		scope.title = opts.title;
		scope.body = opts.body;
		scope.footer = opts.footer;
		scope.buttons = opts.buttons;
		template = '<' + prefix + '-modal-dialog class="hico-lui hico-fa"></' + prefix + '-modal-dialog>';
		element = AngularService.$compile(template)(scope);
		document.body.appendChild(element[0]);
	};

	return Modal;

	function Modal(){
		return {
			controller: ['$scope', '$element', ModalController],
			controllerAs: '$ctrl',
			template: template
		};
	}

	function ModalController($scope, $element ){

		$scope.handle = handle;
		$scope.close = close;

		/**
		 * Closes the dialog
		 */
		function close(){
			$element.remove();
		}


		/**
		 * Triggers button handler function and closes the dialog
		 * @param {{handler: function}} button - Button definition
		 */
		function handle(button){
			if(button && typeof button.handler === 'function'){
				button.handler();
			}
			close();
		}
	}
});