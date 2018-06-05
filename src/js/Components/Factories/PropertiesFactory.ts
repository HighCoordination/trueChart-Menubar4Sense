import {translation} from '../../../../resource/translations/translations';

import {ColorPickerComponent} from '../../Components/PropertyPanel/ColorPickerComponent';
import {SeparatorLabelComponent} from '../../Components/PropertyPanel/SeparatorLabelComponent';
import {SeparatorComponent} from '../../Components/PropertyPanel/SeparatorComponent';

export function createColorPickerComponent(label: string, ref: string, defaultValue: string){
	return {
		type: "items",
		component: ColorPickerComponent,
		label: label,
		ref: ref,
		expression: "optional",
		defaultValue: defaultValue,
	}
}

export function createDisplayExpression(ref: string, label: string, show: Function){
	return {
		ref: ref,
		label: label,
		type: "string",
		expression: "optional",
		defaultValue: "true",
		show: show || false
	};
}

export function createLabelSeparator(label: string){
	return {
		type: "string",
		component: SeparatorLabelComponent,
		label: label
	}
}

export function createSeparator(show?: Function){
	return {
		type: "string",
		component: SeparatorComponent,
		ref: "",
		show: show || true,
	}
}

export function createStringInput(label: string, ref: string, defaultValue: string, expression?: string, show?: Function){
	return {
		ref: ref,
		label: label,
		type: "string",
		expression: expression || "optional",
		defaultValue: defaultValue,
		show: show || true,
	}
}

export function createCheckbox(label: string, ref: string, defaultValue: boolean, show?: Function){
	return {
		type: "boolean",
		label: label,
		ref: ref,
		defaultValue: defaultValue,
		show: show || true,
	}
}
