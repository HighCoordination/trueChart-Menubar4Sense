import * as tinycolor from 'tinycolor2/tinycolor';
import {$timeout} from '../../Services/AngularService';

import {UtilService} from '../../Services/UtilService';

import * as colorPickerInputTemplate from '../../../templates/colorPickerInputComponent.html';
import {QlikService, qvComponents} from '@highcoordination/common-sense';

export const ColorPickerComponent = !QlikService.inClient() ? 'string' : {
	template: colorPickerInputTemplate,
	controller: ['$scope', '$element', function(scope, $element){
		scope.showColorPicker = false;
		scope.qComponents = {
			string: qvComponents.getComponent('string')
		};
		scope.text = {type: 'string', ref: scope.definition.ref, expression: 'optional'};
		scope.obj = UtilService.getRefs(scope.data, scope.definition.ref);
		scope.activeState = 'swatches';
		scope.colors = ['#FFFFFF', '#D9D9D9', '#B3B3B3', '#808080', '#4D4D4D', '#333333', '#000000', '#a8d7f0', '#52a2cc', '#214152', '#c0dca9', '#61a729',
						'#274310', '#fcd6a5', '#f8981d', '#633d0c', '#db94ca', '#cc66b3', '#522948', '#ffb0b0', '#f05555', '#522121', '#ffdd68', '#ffce26',
						'#66520f'
		];

		scope.show = true;

		if(typeof scope.definition.show === 'function'){
			scope.show = scope.definition.show(scope.data);
		}

		scope.isData = true;

		scope.$on("datachanged", async function(){
			scope.isData = true;
			let refValue = UtilService.getRefValue(scope.data, scope.definition.ref);

			if(typeof scope.definition.show === 'function'){
				scope.show = scope.definition.show(scope.data);
			}

			refValue = await convertIfSense(refValue);

			$element.find(".hsvflat").trigger("colorpickersliders.updateColor", refValue);
			$element.find(".colorPalette").css("background-color", refValue);
			setPaletteIconColor(refValue);

		});

		scope.setColor = function(color){
			let tinColor = tinycolor(color);
			UtilService.setRefValue(scope.data, scope.definition.ref, tinColor.toRgbString());
			$element.find(".colorPalette").css("background-color", tinColor.toRgbString());
			$element.find(".colorPaletteIcon").css("color", tinycolor.mostReadable( tinColor , ['#595959', '#fff']).toHexString());
			scope.$emit("saveProperties");
		};

		$timeout(async function(){
			$element.find(".hsvflat").ColorPickerSliders(
				{
					color: await convertIfSense(UtilService.getRefValue(scope.data, scope.definition.ref)),
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

							$element.find(".colorPalette").css("background-color",color.tiny.toRgbString());
							setPaletteIconColor(color);

							scope.$emit("saveProperties");

						});
					}
				});
		});

		async function convertIfSense(color){
			let colorString = color;

			if(typeof color === 'object'){
				colorString = await QlikService.getInstance().evalExpression(color);
			}

			if(colorString.indexOf("ARGB") > -1){
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
				$element.find(".colorPaletteIcon").css("color", '#595959');
			}else{
				$element.find(".colorPaletteIcon").css("color", tinycolor.mostReadable( colorObj.tiny , ['#595959', '#fff']).toHexString());
			}
		}

	}]
};