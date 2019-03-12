type Component = {
	update: Function;
}

type Components = { [s: string]: Component; }

export class ContentManager {
	private static _components: Components = {};

	static registerComponent(id: string, component: Component){
		ContentManager._components[id] = component;
	}

	static unregisterComponent(id: string){
		delete ContentManager._components[id];
	}

	static updateComponents(){
		Object.keys(ContentManager._components).forEach((key) => {
			const component = ContentManager._components[key];

			if(component){
				component.update();
			}
		})
	}
}
