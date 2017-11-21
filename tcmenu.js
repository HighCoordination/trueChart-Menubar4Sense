require.config({
	urlArgs: "1.0.8_152",
	// extend require config and specify bundles configuration for qs-components in case of mashups, where client.js isn't loaded by default
	bundles: {
		'assets/client/client': ['client.property-panel/components/components', 'client.property-panel/components/list/list', 'client.property-panel/components/buttongroup/buttongroup']
	}
});

define(["jquery", "qvangular", "text!./templates/tcmenu.html", "css!./style.css", "qlik", "./init", "./properties", "./lib/hico/prefix", "./lib/external/leonardo-ui/leonardo-ui", "./lib/hico/hico-button", "./directives/Calendar", "./directives/Label", "./directives/SingleSelect", "./directives/SenseSelect", "./directives/Dropdown", "./directives/VariableDropdown", "./directives/SelectDropdown", "./directives/Container", "./directives/Button", "./directives/ChangeBackground", "./directives/Scroll", "./services/UtilService", "./services/UpdateService", "./services/ApiService", "./lib/external/promise-polyfill/promise", "./lib/external/bootstrap/bootstrap", "./lib/external/jquery-ui/jquery-ui"], function ($, qvangular, template, styleCss, qlik, ext, props, prefix) {
	'use strict';

	$("<style>").html(styleCss).appendTo("head");
	return {
		template: template,
		initialProperties: {
			listItems: []
		},
		definition: props,
		support: {
			snapshot: true,
			export: true,
			exportData: true
		},
		controller: ['$scope', '$element', 'utilService', prefix + 'QlikService', 'updateService', 'apiService', ext.controller],
		/*resize: function( $element, layout ) {
  	this.paint($element, layout);
  },*/
		paint: ext.paint
	};
});