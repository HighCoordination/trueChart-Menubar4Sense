import {ColorPickerComponent} from '../PropertyPanel/ColorPickerComponent';
import {MediaLibraryComponent} from '../PropertyPanel/MediaLibraryComponent';
import {SeparatorLabelComponent} from '../PropertyPanel/SeparatorLabelComponent';
import {SeparatorComponent} from '../PropertyPanel/SeparatorComponent';

type TOption = {
	value: string,
	label: string,
	tooltip?: string
}

export function createColorPickerComponent(label: string, ref: string, defaultValue: string, show: Function | boolean = true){
	return {
		type: "items",
		component: ColorPickerComponent,
		label: label,
		ref: ref,
		expression: "optional",
		defaultValue: defaultValue,
		show,
	}
}

export function createMediaLibraryComponent(label: string, ref: string, defaultValue: string, show?: Function){
	return {
		type: "items",
		component: MediaLibraryComponent,
		label: label,
		ref: ref,
		expression: "optional",
		defaultValue: defaultValue,
		show: show || true,
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

export function createCheckbox(label: string, ref: string, defaultValue: boolean, show?: Function|boolean,  onChange?: Function){
	return {
		type: "boolean",
		label: label,
		ref: ref,
		defaultValue: defaultValue,
		show: show || true,
		change: onChange,
	}
}

export function createToggle(label: string, ref: string, defaultValue: boolean, optionOne: string, optioneTwo: string, show?: Function){
	return {
		type: "boolean",
		component: "switch",
		label: label,
		ref: ref,
		options: [
			{
				value: true,
				label: optionOne
			}, {
				value: false,
				label: optioneTwo
			}
		],
		defaultValue: defaultValue,
		show: show || true,
	}
}

export function createDropdown(label: string, ref: string, defaultValue: string, options: TOption[], show?: Function){
	return {
		type: "string",
		component: "dropdown",
		label: label,
		ref: ref,
		options: options,
		defaultValue: defaultValue,
		show: show || true,
	}
}

export function createButtonGroup(label: string, ref: string, defaultValue: string, options: TOption[], show?: Function){
	return {
		type: "string",
		component: "buttongroup",
		label: label,
		ref: ref,
		options: options,
		defaultValue: defaultValue,
		show: show || true,
	}
}

export function createSlider(label: string, ref: string, defaultValue: number, min: number, max: number, step: number, show?: Function){
	return {
		type: "number",
		component: "slider",
		label: label,
		ref: ref,
		show: show || true,
		min: min,
		max: max,
		step: step,
		defaultValue: defaultValue
	}
}
