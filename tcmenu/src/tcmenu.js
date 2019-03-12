import '../lib/hico/button-editor';
import 'bootstrap';
import 'jquery-ui/ui/widgets/sortable';
import 'leonardo-ui';

import './classes/utils/polyfills';
import './js/Services';
import './js/Directives';

import * as template from './templates/tcmenu.html';
import {Extension} from './js/init';
import {properties as props} from './properties';
import {registerCommonDirectives, Button} from '@highcoordination/common-sense';

// load style
import './less/style.less';
export default new function(){
	'use strict';

	// register common directives here
	registerCommonDirectives();
	Button.init();

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
				],
				qMaxStackedCells: 0,
				qMode: 'K',
			},
		},
		definition: props,
		support : {
			snapshot: true,
			export: true,
			exportData : false
		},
		controller : ['$scope', '$element', ext.controller],
		paint: ext.paint,
		updateData: ext.updateData
	};
};
