define(['jquery', 'qvangular', 'text!../templates/button.html'], function ($, qvangular, template) {

	return qvangular.directive('statebutton', ['utilService', function (utilService) {
		return {
			restrict: 'E',
			scope: {
				item: '=',
				layout: '<',
				colors: '<'
			},
			replace: true,
			template: template,
			controller: ['$scope', function ($scope) {
				$scope.utilService = utilService;

				var Actions = {
					"openEditMode": function openEditMode() {
						qlik.navigation.setMode("edit");
					},
					"customJavascript": function customJavascript() {
						eval(element.props.customJavascript);
					}
				};

				$scope.handleAction = function (element) {
					if (element.type === 'action' || element.subType === 'action') {

						var action = Actions[element.props.action];
						action ? action() : console.log("undefined action");
					}
				};
			}]
		};
	}]);
});