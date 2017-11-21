define(['qlik', 'qvangular', '../lib/hico/prefix', '../lib/hico/services/qlik-service'], function (qlik, qvangular, prefix) {
	return qvangular.service("updateService", [prefix + 'QlikService', UpdateService]);

	/*
  For every new update follow this steps:
  1. Create new update function or use an existing one if it wasn't already released, which gets properties as parameter and returns properties in a Promise
  2. Add new if check in runUpdates and push (add) your update to the updates array
 */
	function UpdateService(qlikService) {
		var _qlikService = qlikService,

		//_app = qlik.currApp(), // not needed for now
		_currentVersion = '1.0.8_152',
		    // will be replaced with current version in a format: x.x.x_(buildNumber|dev)
		_updatedObjectIds = []; // Collection of object ids, which were already updated so tey shouldn't be updated again

		/**
   * Updates the extension model, if required
   * @param model {object} Extension model with layout available (normally initially there)
   * @return Promise
   */
		this.checkUpdates = function (model) {
			var updates = getUpdates(model.layout.version);

			// Run updtes only if required
			if (updates.length > 0) {
				// In case of master item we need to update properties of the master object!
				return _qlikService.getMasterObjectProperties(model).then(function (srcObject) {
					// Check if the object was already updated, so no need to update his properties again
					// In case of multiple extensions from same master item on the same sheet, update of the same sourceobject would be triggered multiple times
					if (_updatedObjectIds.indexOf(srcObject.id) !== -1) {
						console.info('tcmenu was already updated');
						return Promise.resolve();
					} else {
						_updatedObjectIds.push(srcObject.id);
					}

					console.info('tcmenu update is running');
					return _qlikService.getProperties(srcObject, true).then(function (properties) {
						return runUpdates(properties, updates);
					}).then(function (properties) {

						// Update version to the currentVersion
						properties.version = _currentVersion;

						// Finally set properties and make changes persistent (in case the app is not published)
						return _qlikService.setProperties(srcObject, properties);
					});
				}).catch(function (err) {
					console.error('HICO: Error occurred during tcmenu update', err, model);
					return Promise.reject();
				});
			}

			// otherwise no updates required
			return Promise.resolve();
		};

		/**
   * Returns updates in array, depending on current version
   * @param version
   * @return {Array}
   */
		function getUpdates(version) {
			var verMajor = 1,
			    verMinor = 0,
			    verPatch = 0,
			    updates = [];

			version = (typeof version === 'string' ? version : version.toString()).split('.');

			if (version) {
				verMajor = parseInt(version[0]) || 1;
				verMinor = parseInt(version[1]) || 0;
				verPatch = parseInt(version[2]) || 0;
			}

			needsUpdate(1, 0, 2) && updates.push(update102);
			needsUpdate(1, 0, 4) && updates.push(update104);

			return updates;

			function needsUpdate(major, minor, patch) {
				return verMajor < major || verMajor === major && verMinor < minor || verMajor === major && verMinor === minor && verPatch < patch;
			}
		}

		/**
   * Execute required updates to update extension properties
   * @param {Object} properties Extension properties object
   * @return Promise {object} Updated extension properties in a Promise
   */
		function runUpdates(properties, updates) {
			var oldVersion = 'string' === typeof properties.version ? properties.version.split('_')[0] : '1.0.0';

			properties = JSON.parse(JSON.stringify(properties)); // keep our own copy of properties so that it will not be destroyed/overwritten by qs updates

			console.info('Update tcmenu from "' + oldVersion + '" to version "' + _currentVersion + '"');

			// Run updates sequentially
			return updates.reduce(function (resolveProperties, update) {
				return resolveProperties.then(update);
			}, Promise.resolve(properties));
		}

		/**
   * Updates for all extensions created before release 1.0.2
   */
		function update102(properties) {
			// Create qHyperCubeDef which is required for qCalcCond in properties panel
			if (!properties.qHyperCubeDef) {
				properties.qHyperCubeDef = {
					qCalcCond: {},
					qDimensions: [],
					qMeasures: [],
					qInitialDataFetch: [{ qWidth: 0, qHeight: 0 }]
				};
			}

			// Add default calcCondVariable propertie if not already defined
			if (!properties.calCondVariable) {
				properties.calCondVariable = '';
			}

			// Return updated properties as a Promise
			return Promise.resolve(properties);
		}

		/**
   * Updates for all extensions created before release 1.0.4
   */
		function update104(properties) {
			// TODO: update properties, where listItems of type 'Sense Select' || 'Single Select' use "dimTitle" instead of "dim" value for options

			// remove unused properties
			delete properties.qFieldListDef;
			delete properties.qListObjectDef;

			return Promise.resolve(properties);
		}
	}
});