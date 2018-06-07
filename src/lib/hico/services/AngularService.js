export const AngularService = (function(qvangular, angular){
	// NO AngularService in QV for now
	if (qvangular === undefined){
		return {
			$compile(__element){
				return function(){};
			},
			$timeout(cb){
				window.setTimeout(cb, 0);
			},
			getScope: (__element) =>{
				return {};
			},
			compile: (element, __scope, __options) =>{
				return element;
			}
		};
	}

	/**
	 * Angular Service
	 * @constructor
	 */
	function AngularService(){
//		this.$injector = angular.injector(['ng']);
//		this.$compile = this.$injector.get('$compile');
//		this.$timeout = this.$injector.get('$timeout');

		// we must use qvangular instead of angular module!
		this.$compile = qvangular.getService('$compile');
		this.$timeout = qvangular.getService('$timeout');
	}

	AngularService.prototype = {

		/**
		 * Gets the scope of an HTMLElement
		 * @param element HTMLElement
		 * @return {$scope}
		 */
		getScope: function(element){
			return angular.element(element).scope();
		},


		/**
		 * Compiles angular template with given scope
		 * @param element HTMLElement|string
		 * @param scope
		 * @param options
		 * @return {*}
		 */
		compile: function(element, scope, options){
			options = angular.extend({}, {
				ngElement: false
			}, options);

			element = typeof element === 'string' ? angular.element(element) : element;

			var $element = this.$compile(element)(scope);
			scope.$apply();

			return options.ngElement === true ? $element : $element[0];
		}

	};

	return new AngularService();
})(window.qvangularGlobal, window.angular);