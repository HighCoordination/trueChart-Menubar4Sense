define(['jquery', 'qvangular', 'text!../templates/label.html'], function ($, qvangular, template) {

	return qvangular.directive('labeldirective', function () {
		return {
			restrict: 'E',
			scope: {
				item: '=',
				type: '=',
				layout: '='
			},
			template: template
		};
	});
});