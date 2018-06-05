define(['qvangular'], function(qvangular){
	return qvangular.directive('ngEnter', function () {
		return function (scope, element, attrs) {
			element.bind("keydown keypress", function (event) {
				if (event.which === 13) {
					scope.$apply(function () {
						scope.$event = event;
						scope.$eval(attrs.ngEnter);
					});
					event.preventDefault();
				}
			});
		};
	});
});