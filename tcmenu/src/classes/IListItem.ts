export type TSingleSelect = 'Single Select';
export type TSenseSelect = 'Sense Select';
export type TVariableDropdown = 'Variable Dropdown';
export type TButtonContainer = 'Button Container';
export type TButton = 'Button';
export type TGroup = 'Group';

export type TSizeType = '%' | 'px';
export type TTextLayout = 'single' | 'multiple';
export interface ITextStyleDef {
	'font-family': string;
	'font-size': number;
	'font-weight': string;
	'font-style': string;
}
export type TAlignLabel = 'flex-start' | 'center' | 'flex-end';

export type TSelectTypes = TSingleSelect | TSenseSelect;
export type TListItemsTypes = TSelectTypes | TButtonContainer | TButton | TGroup;

export type TListItems = IListItem<TListItemsTypes>[];

export interface IListItem<T = TListItemsTypes> {
	cId: string;
	props: IListItemProps<T>;
	type: T;
	showCondition: string,
	variableItems: any[],
	selectItems: any[],
	stateItems: any[],
	dropdownItems: any[],
	groupItems: any[],
	subItems: ISubItem[],
	labelStyle: ITextStyleDef,
	selectionStyle: ITextStyleDef
}

export interface IListItemProps<T> {
	buttonName: string;
	variableName: string;
	dimId: string;
	showToolbar: boolean;
	alwaysSelectValue: boolean;
	selectValue: string;
	isCustomSize: boolean;
	sizeType: TSizeType;
	width: number;
	height: number;
	textLayout: TTextLayout;
	icon: string;
	itemLabel: string;
	horAlignLabel: TAlignLabel;
	verAlignLabel: TAlignLabel;
	isCustomSelection: boolean;
	selectionLabel: string;
	horAlignSelectionLabel: TAlignLabel;
	verAlignSelectionLabel: TAlignLabel;
	tooltip: string;
}

export interface ISelectItemProps<T> extends IListItemProps<T> {
}

export interface IContainerItemProps<T> extends IListItemProps<T> {
}

export interface ISingleSelectProps extends ISelectItemProps<TSingleSelect> {
	alwaysSelectValue: boolean;
	selectValue: string;
}

export interface ISenseSelectProps extends ISelectItemProps<TSenseSelect> {
}


export interface IVariableDropdownProps extends IListItemProps<TVariableDropdown> {
	variableName: string;
}

/** subItems are just buttons inside a button container */
export interface ISubItemProps {
	buttonName: string
}

export interface ISubItem {
	cId: string;
	labelStyle: ITextStyleDef;
	selectionStyle: ITextStyleDef;
	stateItems: IButtonState[];
	activeStates: IButtonState[];
}

export interface ISelectItem<T> extends IListItem<T> {
	showToolbar: boolean;
}

export interface IQStringExpression {
	qStringExpression: {
		qExpr: string;
	}
}

export interface IParameters {
	[key: number]: string | number | boolean;
}

export interface IExpressionParameters {
	[key: number]: IQStringExpression;
}

export interface IAction {
	name: string;
	params: IParameters;
	paramsExpr: IExpressionParameters;
}

export interface ITrigger {
	type: string;
	actions: IAction[];
}

export interface IButtonStyle {
	icon: {};
	font: {};
	background: {
		position: {};
		repeat: string;
	};
	border: {}
}

export interface IButtonLayout {
	width: string | number;
	height: string | number;
	icon: {}
}

export interface IButtonState {
	cId: string;
	buttonState: 'normal' | 'active' | 'disabled';
	buttonType: string;
	condition: string;
	hasActions: boolean;
	layout: IButtonLayout;
	style: IButtonStyle;
	text: string;
	triggers: ITrigger[];
	version: number;
}
