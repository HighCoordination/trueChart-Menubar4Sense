import * as tinycolor from 'tinycolor2/tinycolor';
import {$timeout} from '../../Services/AngularService';

import {UtilService} from '../../Services/UtilService';

import * as colorPickerInputTemplate from '../../../templates/colorPickerInputComponent.html';

// configure requirejs (MUST be "requirejs" instead of "require" otherwise webpack will handle it and it wouldn't work as expected)
requirejs.config({
	// extend require config and specify bundles configuration for qs-components in case of mashups, where client.js isn't loaded by default
	bundles: {
		'assets/client/client': [
			'client.property-panel/components/components',
			'client.property-panel/components/list/list',
			'client.property-panel/components/string/string',
			'client.property-panel/components/buttongroup/buttongroup'
		]
	}
});

export const ColorPickerComponent = !qlikService.inClient() ? 'string' : {
	template: colorPickerInputTemplate,
	controller: ['$scope', '$element', function(scope, $element){
		scope.showColorPicker = false;
		scope.qComponents = {
			string: requirejs('client.property-panel/components/string/string')
		};
		scope.text = {type: 'string', ref: scope.definition.ref, expression: 'optional'};
		scope.obj = UtilService.getRefs(scope.data, scope.definition.ref);
		scope.activeState = 'swatches';
		scope.colors = ['#FFFFFF', '#D9D9D9', '#B3B3B3', '#808080', '#4D4D4D', '#333333', '#000000', '#a8d7f0', '#52a2cc', '#214152', '#c0dca9', '#61a729',
						'#274310', '#fcd6a5', '#f8981d', '#633d0c', '#db94ca', '#cc66b3', '#522948', '#ffb0b0', '#f05555', '#522121', '#ffdd68', '#ffce26',
						'#66520f'
		];

		scope.isData = true;

		scope.$on("datachanged", function () {
			scope.isData = true;
			let refValue = UtilService.getRefValue(scope.args.layout, scope.definition.ref);

			refValue = convertIfSense(refValue);

			$element.find("#hsvflat_" + scope.$id).trigger("colorpickersliders.updateColor", refValue);
			$element.find("#colorPalette_" + scope.$id).css("background-color", refValue);
			setPaletteIconColor(refValue);

		});

		scope.setColor = function(color){
			let tinColor = tinycolor(color);
			UtilService.setRefValue(scope.data, scope.definition.ref, tinColor.toRgbString());
			$element.find("#colorPalette_" + scope.$id).css("background-color", tinColor.toRgbString());
			$element.find("#colorPaletteIcon_" + scope.$id).css("color", tinycolor.mostReadable( tinColor , ['#595959', '#fff']).toHexString());
			scope.$emit("saveProperties");
		};

		$timeout(function() {
			$element.find("#hsvflat_" + scope.$id).ColorPickerSliders(
				{
					color: convertIfSense(UtilService.getRefValue(scope.args.layout, scope.definition.ref)),
					flat: true,
					sliders: false,
					swatches: false,
					hsvpanel: true,
					grouping: false,
					onchange: function(container, color){
						$timeout(function() {
							if(!scope.isData){
								UtilService.setRefValue(scope.data, scope.definition.ref, color.tiny.toRgbString());
							}
							scope.isData = false;

							$element.find("#colorPalette_" + scope.$id).css("background-color",color.tiny.toRgbString());
							setPaletteIconColor(color);

							scope.$emit("saveProperties");

						});
					}
				});
		});

		function convertIfSense(colorString){
			if(colorString && colorString.indexOf("ARGB") > -1){
				let opcaityLength = colorString.indexOf(',') - colorString.indexOf('(') - 1;
				let opacity = Number(colorString.substr(colorString.indexOf('(') + 1,opcaityLength)) / 255;

				return'rgba(' + colorString.substr(colorString.indexOf(',') + 1, colorString.length - colorString.indexOf(',') - 2) + ',' +opacity + ')';
			}else{
				return colorString
			}
		}

		function setPaletteIconColor(color){
			let colorObj = {};

			if(!color){
				return;
			}

			if(!color.tiny){
				colorObj.tiny = tinycolor(color);
			}else{
				colorObj = color;
			}

			if(colorObj.tiny.getAlpha() < 0.5){
				$element.find("#colorPaletteIcon_" + scope.$id).css("color", '#595959');
			}else{
				$element.find("#colorPaletteIcon_" + scope.$id).css("color", tinycolor.mostReadable( colorObj.tiny , ['#595959', '#fff']).toHexString());
			}
		}

	}]
};