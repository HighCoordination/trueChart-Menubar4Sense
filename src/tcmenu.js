import './lib/hico/entry';
import 'bootstrap';
import 'jquery-ui/ui/widgets/sortable';
import 'leonardo-ui';

import * as template from './templates/tcmenu.html';
import {Extension} from './js/init';
import {properties as props} from './properties';

// load components
import './js/Directives';
import './js/Services';

// load style
import './less/style.less';
define([], function(){
	'use strict';

	const ext = new Extension();

	return {
		template: template,
		initialProperties: {
			listItems: [],
			qChildListDef: {
				qData: {
					dimId: '/dimId',
					listDef: '/listDef',
					listLibId: '/listLibId',
				}
			},
			qHyperCubeDef: {
				qDimensions: [],
				qMeasures: [],
				qInitialDataFetch: [
					{
						qWidth: 0,
						qHeight: 0
					}
				]
			},
		},
		definition: props,
		support : {
			snapshot: true,
			export: true,
			exportData : false
		},
		controller : ['$scope', '$element', 'utilService', 'apiService',  ext.controller],
		/*resize: function( $element, layout ) {
			this.paint($element, layout);
		},*/
		paint: ext.paint,
		updateData: ext.updateData
	};
});
