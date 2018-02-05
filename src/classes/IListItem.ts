export type TSingleSelect = 'Single Select';
export type TSenseSelect = 'Sense Select';
export type TVariableDropdown = 'Variable Dropdown';
export type TButtonContainer = 'Button Container';
export type TButton = 'Button';
export type TGroup = 'Group';

export type TSizeType = '%' | 'px';
export type TTextLayout = 'single' | 'multiple';
export type TTextStyleDef = {
	'font-family': string, 'font-size': number, 'font-weight': string, 'font-style': string
};
export type TAlignLabel = 'flex-start' | 'center' | 'flex-end';

export type TSelectTypes = TSingleSelect | TSenseSelect;
export type TListItemsTypes = TSelectTypes | TButtonContainer | TButton | TGroup;

export type TListItems = IListItem<TListItemsTypes>[];

export interface IListItem<T> {
	cId: string;
	props: IListItemProps<T>;
	type: T;
	showCondition: string,
	variableItems: any[],
	"selectItems": any[],
	"stateItems": any[],
	"dropdownItems": any[],
	"groupItems": any[],
	"subItems": any[],
	"labelStyle": TTextStyleDef,
	"selectionStyle": TTextStyleDef
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

export interface ISelectItem<T> extends IListItem<T> {
	showToolbar: boolean;
}
