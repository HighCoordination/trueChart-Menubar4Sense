define(['qvangular', 'qlik', 'ng!$q', '../prefix', '../../../config'], function (qvangular, qlik, $q, prefix, config) {

	qvangular.service(prefix + 'ConfigService', [ConfigService]);

	function ConfigService() {

		var actionBlacklist = [];
		var ready = $q.defer();

		/* Public/privileged functions */
		this.getActionBlacklist = getActionBlacklist;
		this.getReady = getReady;

		init();

		/**
   * Initializes the config service
   */
		function init() {
			getBlacklistedActions(config).then(setActionBlacklist).then(function () {
				ready.resolve();
			});
		}

		/**
   * Returns a blacklisted actions for current user
   * @return {Promise} Array of blacklisted actionnames
   */
		function getActionBlacklist() {
			return getReady().then(function () {
				return actionBlacklist;
			});
		}

		/**
   * Sets a given actionBlacklist
   * @param blacklist Blacklist to be set
   */
		function setActionBlacklist(blacklist) {
			actionBlacklist = blacklist;
		}

		/**
   * Returns a promise which will be resolved when service is ready
   */
		function getReady() {
			return ready.promise;
		}
	}

	return ConfigService;

	/**
  * Parse the actionPermissions definition and returns blacklisted actions for given user in a promise
  * @param config {actionPermissions: [{match: {UserDirectory: string, UserId: string}, actionblacklist: [actionname]}]} definition
  * @return Promise Array of blacklisted actions
  */
	function getBlacklistedActions(config) {
		return qlik.getGlobal().getAuthenticatedUser().then(function (reply) {

			var user = {};

			// Get user directory and id from respnse
			reply.qReturn.split(';').forEach(function (part) {
				part = part.trim();
				if (part.indexOf('UserDirectory=') === 0) {
					user.directory = part.slice('UserDirectory='.length);
				} else if (part.indexOf('UserId=') === 0) {
					user.id = part.slice('UserId='.length);
				}
			});

			// Black lists sorted by priority index == 0 -> highest, index == 4 -> lowest
			var blacklists = [null, null, null, null];

			try {

				config.actionPermissions.every(function (actionPermission) {

					if (matchAllDirectories()) {
						if (matchAllUsers()) {
							// */*
							blacklists[3] === null && (blacklists[3] = actionPermission.blacklist);
						} else if (matchUser(user.id)) {
							// */user
							blacklists[1] === null && (blacklists[1] = actionPermission.blacklist);
						}
					} else if (matchDirectory(user.directory)) {
						if (matchAllUsers()) {
							// directory/*
							blacklists[2] === null && (blacklists[2] = actionPermission.blacklist);
						} else if (matchUser(user.id)) {
							// directory/user
							blacklists[0] === null && (blacklists[0] = actionPermission.blacklist);
						}
					}

					// Check every match conditon until we've found one with highest priority
					return blacklists[0] === null;

					/* Helper functions */
					function matchDirectory(directory) {
						return actionPermission.match.UserDirectory.indexOf(directory) > -1;
					}

					function matchAllDirectories() {
						return actionPermission.match.UserDirectory.indexOf('*') > -1;
					}

					function matchUser(id) {
						return actionPermission.match.UserId.indexOf(id) > -1;
					}

					function matchAllUsers() {
						return actionPermission.match.UserId.indexOf('*') > -1;
					}
				});
			} catch (e) {
				console.error('An Error occured during processing the configuration file (config.js). Please contact your Administrator', e);
			}

			// Return blacklist with priority as high as possible
			return blacklists.filter(function (list) {
				return list !== null;
			})[0] || [];
		});
	}
});