/*global QUnit*/

jQuery.sap.require("sap.ui.qunit.qunit-css");
jQuery.sap.require("sap.ui.thirdparty.qunit");
jQuery.sap.require("sap.ui.qunit.qunit-junit");
QUnit.config.autostart = false;

sap.ui.require([
	"sap/ui/test/Opa5",
	"jbmeeting/MeetingManager/test/integration/pages/Common",
	"sap/ui/test/opaQunit",
	"jbmeeting/MeetingManager/test/integration/pages/Worklist",
	"jbmeeting/MeetingManager/test/integration/pages/Object",
	"jbmeeting/MeetingManager/test/integration/pages/NotFound",
	"jbmeeting/MeetingManager/test/integration/pages/Browser",
	"jbmeeting/MeetingManager/test/integration/pages/App"
], function (Opa5, Common) {
	"use strict";
	Opa5.extendConfig({
		arrangements: new Common(),
		viewNamespace: "jbmeeting.MeetingManager.view."
	});

	sap.ui.require([
		"jbmeeting/MeetingManager/test/integration/WorklistJourney",
		"jbmeeting/MeetingManager/test/integration/ObjectJourney",
		"jbmeeting/MeetingManager/test/integration/NavigationJourney",
		"jbmeeting/MeetingManager/test/integration/NotFoundJourney"
	], function () {
		QUnit.start();
	});
});