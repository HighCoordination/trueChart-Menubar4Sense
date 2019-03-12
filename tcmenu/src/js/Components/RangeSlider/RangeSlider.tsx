import * as React from "react";
import * as ReactDOM from "react-dom";

import Slider, {
	SliderProps,
	Range,
	Handle
} from 'rc-slider';
import Tooltip from 'rc-tooltip';

import {UtilService} from "../../Services/UtilService";

import 'rc-slider/assets/index.css';
import 'rc-tooltip/assets/bootstrap.css';

interface IStrings {
	value: string;
	label: string;
}

export interface IRangeSliderProps extends SliderProps {
	type: string;
	orientation: string;
	showMinMAx: boolean;
	showValues: boolean;
	defaultValue: number;
	defaultValues: number[];
	strings: IStrings[];
	minColor?: string;
	maxColor?: string;
	valueType: string;
	dateFormat?: string;
	allowCross?: boolean;
}

export namespace RangeSlider {
	export interface IOptions extends IRangeSliderProps {
		container: HTMLElement;
	}
}

export class RangeSlider extends React.Component<IRangeSliderProps> {

	static show(props: RangeSlider.IOptions){
		const {container, ...rest} = props;

		ReactDOM.render(<RangeSlider {...rest}/>, container);
	}

	static remove(props: RangeSlider.IOptions){
		const {container} = props;

		ReactDOM.unmountComponentAtNode(container);
	}

	onAfterChange = (e: any) => {
		const props = this.props;

		if(props.onAfterChange){
			props.onAfterChange(e);
		}
	};

	renderSlider = () => {
		const props = this.props,
			valueType = props.valueType;

		let marks: any = {};

		if(props.showMinMAx){
			const minColor = props.minColor || '',
				maxColor = props.maxColor || '';

			if(valueType === 'date'){
				let minDate = new Date(props.min),
					maxDate = new Date(props.max),
					formatedMinDate = UtilService.createFormatedDate(props.dateFormat, minDate.getDate(), minDate.getMonth(), minDate.getFullYear()),
					formatedMaxDate = UtilService.createFormatedDate(props.dateFormat, maxDate.getDate(), maxDate.getMonth(), maxDate.getFullYear());

				marks = {
					[props.min]: {style: {color: minColor,}, label: <strong>{formatedMinDate}</strong>},
					[props.max]: {style: {color: maxColor,}, label: <strong>{formatedMaxDate}</strong>},
				};
			}else if(valueType === 'string'){
				const strings = props.strings;
				marks = {
					[0]: {style: {color: minColor,}, label: strings[0].label},
					[strings.length - 1]: {style: {color: maxColor,}, label: strings[strings.length - 1].label},
				};
			}else{
				marks = {
					[props.min]: {style: {color: minColor,}, label: <strong>{props.min}</strong>},
					[props.max]: {style: {color: maxColor,}, label: <strong>{props.max}</strong>},
				};
			}
		}

		if(props.showValues){
			let step = props.step,
				min = props.min,
				max = props.max;

			for(let i = min + step; i < max; i += step){
				if(valueType === 'string'){
					marks[i] = props.strings[i].label;
				}else if(valueType === 'date'){
					let date = new Date(i);
					marks[i] = UtilService.createFormatedDate(props.dateFormat, date.getDate(), date.getMonth(), date.getFullYear())
				}else{ //numbers
					marks[i] = i;
				}
			}
		}

		const handle = (data: any) => {
			const {value, dragging, index, ...restProps} = data,
				props = this.props,
				valueType = props.valueType;

			let displayValue = value;

			if(valueType === 'date'){
				const date = new Date(value);
				displayValue = UtilService.createFormatedDate(props.dateFormat, date.getDate(), date.getMonth(), date.getFullYear());
			}

			if(valueType === 'string'){
				displayValue = props.strings[value].label;
			}

			return (
				<Tooltip
					prefixCls="rc-slider-tooltip"
					overlay={displayValue}
					visible={dragging}
					placement="top"
					key={index}
				>
					<Handle value={value} {...restProps} />
				</Tooltip>
			);
		};


		const {vertical, min, max, step, railStyle, trackStyle, handleStyle, dotStyle, activeDotStyle, allowCross} = props;
		if(props.type === 'single'){
			return (<Slider {...{vertical, min, max, marks, step, railStyle, trackStyle, handleStyle, dotStyle, activeDotStyle, handle}}
							defaultValue={props.defaultValue} onAfterChange={this.onAfterChange}/>);
		}else if(props.type === 'range' || props.type === 'multi'){
			return (<Range {...{vertical, min, max, marks, step, railStyle, trackStyle, handleStyle, dotStyle, activeDotStyle, handle}}
						   defaultValue={props.defaultValues} allowCross={allowCross || false} onAfterChange={this.onAfterChange}/>);
		}
	};

	render(){
		const paddingClass = this.props.orientation === 'horizontal' ? 'hico-variable-slider-container' : 'hico-variable-slider-container-horizontal';

		return (
			<div className={'hico-container-horizontal hico-fontstyle-inherit ' + paddingClass}>
				{this.renderSlider()}
			</div>
		);
	}
}