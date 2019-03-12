define([], function(){

	/**
	 * Possible actions are:
	 *
	 * custom: 					Custom action (button+)
	 * nextSheet: 				Navigate to next sheet or page in mashup
	 * prevSheet: 				Navigate to previous sheet or page in mashup
	 * gotoApp: 				Navigate to a specific app
	 * gotoSheet: 				Navigate to a specific sheet
	 * gotoStory: 				Navigate to a specific story
	 * gotoURL: 				Navigate to a specific website
	 * setVariable: 			Set a variable to a specific value
	 * selectValues: 			Selects specific values in a field
	 * selectMatch:				Selects matching field values
	 * selectAlternative: 		Selects alternative values in a field
	 * selectExcluded: 			Selects excluded values in a field
	 * selectPossible: 			Selects possible values in a field
	 * selectAll: 				Selects all values in a field
	 * clearField: 				Clears a field selection
	 * clearOther: 				Clears all fields except the selected one
	 * clearAll: 				Clears all selections in all fields of the current qlik sense app
	 * lockField: 				Locks a field selection
	 * lockAll: 				Locks all selections
	 * unlockAll: 				Unlocks all selections that has previously been locked
	 * applyBookmark: 			Applies a bookmark
	 * reloadData: 				Reloads the data in a qlik sense app
	 *
	 * Toggle_Show_Edit_Mode:	Toggle between show and edit mode of inline comments
	 * Save_Changed:			Save changed inlie comments
	 * Save_All:				Save the whole extension
	 * Refresh:					Refresh of the browser page
	 * Export_As_PDF:			Exports the chart as PDF
	 * Export_As_PNG:			Exports the chart as PNG
	 * Export_As_EMF:			Exports the chart as EMF
	 * Export_As_XLS:			Exports the chart as XLS
	 * Reload_Common_Tables:	Reloads common table and their inline comments
	 *
	 * customClickBehaviour:	Custom clickbehaviour (trueChart)
	 */
	return {
		actionPermissions: {

			blacklist: [
				{
					// alle User können die Actions "custom", "reloadData" und "customClickBehavior" +nicht+ auswählen
					match: {
						UserDirectory: ["*"],
						UserId: ["*"]
					},
					actions: [
						//"custom",
						//"reloadData",
						//"customClickBehaviour"
					],
				},
				{
					// Benutzer der DOMAIN-Domäne können zusätzlich die Action "customClickBehavior" auswählen
					match: {
						UserDirectory: ["DOMAIN"],
						UserId: ["*"]
					},
					actions: [
						"custom",
						"reloadData",
						// "customClickBehaviour"
					],
				},
				{
					// Die Benutzer "abc", "def", "xyz" können alle Actions auswählen
					match: {
						UserDirectory: ["*"],
						UserId: ["abc", "def", "xyz"]
					},
					actions: [
						// "*" // -> alle Actions wären nicht auswählbar
					],
				},
				{
					// Die Benutzer "DOMAIN\abc", "DOMAIN\def", "DOMAIN\xyz" können alle Actions auswählen
					match: {
						UserDirectory: ["DOMAIN"],
						UserId: ['*']
					},
					actions: [
						// "*" // -> alle Actions wären nicht auswählbar
					],
				},
			],
			whitelist: [
				{
					// alle User können die Actions "custom", "reloadData" und "customClickBehavior" auswählen
					match: {
						UserDirectory: ["*"],
						UserId: ["*"]
					},
					actions: [
						//"custom",
						//"reloadData",
						//"customClickBehaviour"
					],
				},
				{
					// Benutzer der DOMAIN-Domäne können zusätzlich die Action "customClickBehavior" auswählen
					match: {
						UserDirectory: ["DOMAIN"],
						UserId: ["*"]
					},
					actions: [
						"custom",
						"reloadData",
						// "customClickBehaviour"
					],
				},
				{
					// Die Benutzer "abc", "def", "xyz" können alle Actions auswählen
					match: {
						UserDirectory: ["*"],
						UserId: ["abc", "def", "xyz"]
					},
					actions: [
						// "*" // -> alle Actions wären auswählbar
					],
				},
				{
					// Die Benutzer "DOMAIN\abc", "DOMAIN\def", "DOMAIN\xyz" können alle Actions auswählen
					match: {
						UserDirectory: ["DOMAIN"],
						UserId: ['*']
					},
					actions: [
						// "*" // -> alle Actions wären auswählbar
					],
				},
			],
		},
	};
});
