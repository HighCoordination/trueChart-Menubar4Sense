/**
 * HiCo Util Class
 */
export class Utils {

	/**
	 * Returns fontSize depending on given screenSize
	 *
	 * @param {number | string} fontSize
	 * @param {number} screenSize
	 *
	 * @returns {number}
	 */
	static getDynamicFontSize(fontSize: number | string, screenSize: number = window.innerWidth){
		if(typeof fontSize === 'string'){
			fontSize = parseFloat(fontSize);
		}

		if(screenSize > 1920){
			return fontSize + 1;
		}else if(screenSize > 992){
			return fontSize;
		}else if(screenSize > 768){
			return Math.max(fontSize - 1, 1);
		}else{
			return Math.max(fontSize - 2, 1);
		}
	}
}