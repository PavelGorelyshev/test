/*global location*/
sap.ui.define([
	"jbmeeting/MeetingManager/controller/BaseController",
	"sap/ui/model/json/JSONModel",
	"sap/ui/core/routing/History",
	"jbmeeting/MeetingManager/model/formatter",
	"sap/m/MessageToast",
	"sap/ui/core/Fragment",
	"sap/m/Dialog",
	"sap/ui/model/Filter",
	"sap/ui/model/FilterOperator"

], function(
	BaseController,
	JSONModel,
	History,
	formatter,
	MessageToast,
	Fragment,
	Dialog,
	Filter,
	FilterOperator
) {
	"use strict";

	return BaseController.extend("jbmeeting.MeetingManager.controller.Object", {

		formatter: formatter,

		/* =========================================================== */
		/* lifecycle methods                                           */
		/* =========================================================== */

		/**
		 * Called when the worklist controller is instantiated.
		 * @public
		 */
		onInit: function() {
			// Model used to manipulate control states. The chosen values make sure,
			// detail page is busy indication immediately so there is no break in
			// between the busy indication for loading the view"s meta data
			var iOriginalBusyDelay,
				oViewModel = new JSONModel({
					busy: true,
					delay: 0,
					changeVisible: false,
					participantsTableTitle: this.getResourceBundle().getText("participantsTableTitle"),
					agendasTableTitle: this.getResourceBundle().getText("agendasTableTitle"),
					Duration: "0 h",
					creation: false
				});

			this.getRouter().getRoute("object").attachPatternMatched(this._onObjectMatched, this);
			this.setModel(oViewModel, "objectView");

			// Store original busy indicator delay, so it can be restored later on
			iOriginalBusyDelay = this.getView().getBusyIndicatorDelay();

			this.getOwnerComponent().getModel().metadataLoaded().then(function() {
				// Restore original busy indicator delay for the object view
				oViewModel.setProperty("/delay", iOriginalBusyDelay);
			});

		},

		/////////////////////////////// MeetingHeaders buttons \\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\
		onPressEdit: function() {
			this.getModel("objectView").setProperty("/changeVisible", true);
		},

		//////////////////////////////////////////////////////////////////////////////////////////////////

		onPressSubmitChanges: function() {
			//view mode
			this.activeViewMode();
			//elemental model
			var oJSONModelData = this.getModel("json").getData();
			this.oElementalJSONModelData.meeting = Object.assign({}, oJSONModelData.meeting);
			this.oElementalJSONModelData.participants = JSON.parse(JSON.stringify(oJSONModelData.participants));
			this.oElementalJSONModelData.agendas = [];
			for (var i = 0; i < oJSONModelData.agendas.length; i++) {
				this.oElementalJSONModelData.agendas.push(Object.assign({}, oJSONModelData.agendas[i]));
			}
			//buttons disabled
			this.byId("btnMeetingEdit").setEnabled(false);
			this.byId("btnMeetingRefresh").setEnabled(false);
			//batches
			this.numberCompletedBatches = 0;
			this.getModel().setDeferredGroups(this.getModel().getDeferredGroups().concat(["participants", "agendas"]));
			this.meetingSaveBack();
			this.participantsSaveBack();
			this.agendasSaveBack();
		},

		meetingSaveBack: function() {
			var oODataModel = this.getModel();
			var oJSONModel = this.getModel("json");
			var oJSONModelData = oJSONModel.getData().meeting;
			// var oPage = this.byId("page");
			var MeetingHeaderID = this.sObjectId;
			var sPath = "/jbmeeting_base_MeetingHeaders('" + MeetingHeaderID + "')";
			// oPage.setBusy(true);

			//Update
			var MeetingHeaderTextJSON = oJSONModelData.MeetingHeaderText;
			var DateFromJSON = oJSONModelData.DateFrom;
			var DateToJSON = oJSONModelData.DateTo;
			var MeetingTypeIdJSON = oJSONModelData.MeetingTypeID;
			var LocationJSON = oJSONModelData.Location;
			var MeetingHeaderDescriptionJSON = oJSONModelData.MeetingHeaderDescription;
			var ProjectIdJSON = oJSONModelData.ProjectID;
			oODataModel.setProperty(sPath + "/MeetingHeaderText", MeetingHeaderTextJSON);
			oODataModel.setProperty(sPath + "/DateFrom", DateFromJSON);
			oODataModel.setProperty(sPath + "/DateTo", DateToJSON);
			oODataModel.setProperty(sPath + "/MeetingTypeID", MeetingTypeIdJSON);
			oODataModel.setProperty(sPath + "/Location", LocationJSON);
			oODataModel.setProperty(sPath + "/MeetingHeaderDescription", MeetingHeaderDescriptionJSON);
			oODataModel.setProperty(sPath + "/ProjectID", ProjectIdJSON);

			this.getModel().submitChanges({
				success: function() {
					this.setBusyIndicatorForButtons();
				}.bind(this)
			});
		},

		participantsSaveBack: function() {
			var oODataModel = this.getModel();
			var oJSONModel = this.getModel("json");
			var oJSONModelData = oJSONModel.getData().participants;
			var oTable = this.byId("participantsTable");
			var MeetingHeaderID = this.sObjectId;
			// oTable.setBusy(true);

			//Read Participants Entity in OData
			oODataModel.read("/jbmeeting_base_MeetingHeaders('" + this.sObjectId +
				"')/jbmeeting_base_MeetingHeaders__jbmeeting_base_Participants", {
					success: function(oData) {
						//Get ParticipantIDs from JSON 
						var jsonIDs = [];
						for (var i = 0; i < oTable.getItems().length; i++) {
							var jsonID = oJSONModel.getProperty("/participants/" + i + "/ParticipantID");
							jsonIDs.push(jsonID);
						}
						//Get ParticipantIDs from OData 
						var odataIDs = [];
						for (var i = 0; i < oData.results.length; i++) {
							var odataID = oData.results[i].ParticipantID;
							odataIDs.push(odataID);
						}

						//Delete & Update functions
						for (var i = 0; i < odataIDs.length; i++) {
							var sOdataPathParticipant = "/jbmeeting_base_Participants(ParticipantID='" + odataIDs[i] +
								"',MeetingHeaderID='" + MeetingHeaderID + "')";
							if (jsonIDs.includes(odataIDs[i]) === false) { //If ParticipantID there isn't in OData 
								//Delete
								oODataModel.remove(sOdataPathParticipant, {
									groupId: "participants"
								});
							} else { //If ParticipantID there is in OData Model
								//Update fields
								var MandatoryOData = oODataModel.getProperty(sOdataPathParticipant).Mandatory;
								var MeetingRoleIdOData = oODataModel.getProperty(sOdataPathParticipant).MeetingRoleID;
								var MandatoryJSON = oJSONModelData.filter(function(item) {
									return item.ParticipantID === odataIDs[i];
								})[0].Mandatory;
								var MeetingRoleIdJSON = oJSONModelData.filter(function(item) {
									return item.ParticipantID === odataIDs[i];
								})[0].MeetingRoleID;
								oODataModel.setProperty(sOdataPathParticipant + "/Mandatory", MandatoryJSON);
								oODataModel.setProperty(sOdataPathParticipant + "/MeetingRoleID", MeetingRoleIdJSON);
								var ParticipantOData = oODataModel.getProperty(sOdataPathParticipant);
								if (MandatoryOData !== MandatoryJSON || MeetingRoleIdOData !== MeetingRoleIdJSON) {
									oODataModel.update(sOdataPathParticipant, ParticipantOData, {
										groupId: "participants"
									});
								}
							}
						}

						//Сreate
						for (var i = 0; i < jsonIDs.length; i++) {
							if (odataIDs.includes(jsonIDs[i]) === false) { //If ParticipantID there isn't in JSON 
								//Create item
								var oCreatedItem = {
									ParticipantID: oJSONModelData[i].ParticipantID,
									MeetingHeaderID: MeetingHeaderID,
									EmployeeID: oJSONModelData[i].EmployeeID,
									MeetingRoleID: oJSONModelData[i].MeetingRoleID,
									Mandatory: oJSONModelData[i].Mandatory
								};
								this.getModel().createEntry("/jbmeeting_base_Participants", {
									groupId: "participants",
									properties: oCreatedItem
								});
							}
						}
						this.getModel().submitChanges({
							groupId: "participants",
							success: function() {
								this.setBusyIndicatorForButtons();
								this.routingToCreatedMeeting();
							}.bind(this)
						});
					}.bind(this)
				});
		},

		agendasSaveBack: function() {
			var oODataModel = this.getModel();
			var oJSONModel = this.getModel("json");
			var oJSONModelData = oJSONModel.getData().agendas;
			var oTable = this.byId("agendasTable");
			var MeetingHeaderID = this.sObjectId;
			// oTable.setBusy(true);

			//Read Agendas Entity in OData
			oODataModel.read("/jbmeeting_base_MeetingHeaders('" + this.sObjectId +
				"')/jbmeeting_base_MeetingHeaders__jbmeeting_base_Agendas", {
					success: function(oData) {
						//Get AgendaIDs from JSON 
						var jsonIDs = [];
						for (var i = 0; i < oTable.getItems().length; i++) {
							var jsonID = oJSONModel.getProperty("/agendas/" + i + "/AgendaID");
							jsonIDs.push(jsonID);
						}
						//Get AgendaIDs from OData 
						var odataIDs = [];
						for (var i = 0; i < oData.results.length; i++) {
							var odataID = oData.results[i].AgendaID;
							odataIDs.push(odataID);
						}

						//Delete & Update functions
						for (var i = 0; i < odataIDs.length; i++) {
							var sOdataPathAgenda = "/jbmeeting_base_Agendas(AgendaID='" + odataIDs[i] +
								"',MeetingHeaderID='" + MeetingHeaderID + "')";
							if (jsonIDs.includes(odataIDs[i]) === false) { //If AgendaID there isn't in OData 
								//Delete
								oODataModel.remove(sOdataPathAgenda, {
									groupId: "agendas"
								});
							} else { //If AgendaID there is in OData Model
								//Update fields
								var AgendaItemOData = oODataModel.getProperty(sOdataPathAgenda).AgendaItem;
								var PriorityIdOData = oODataModel.getProperty(sOdataPathAgenda).PriorityID;
								var StatusIdOData = oODataModel.getProperty(sOdataPathAgenda).StatusID;
								var QuestionOData = oODataModel.getProperty(sOdataPathAgenda).Question;
								var ResolutionOData = oODataModel.getProperty(sOdataPathAgenda).Resolution;
								var AgendaItemJSON = oJSONModelData.filter(function(item) {
									return item.AgendaID === odataIDs[i];
								})[0].AgendaItem;
								var PriorityIdJSON = oJSONModelData.filter(function(item) {
									return item.AgendaID === odataIDs[i];
								})[0].PriorityID;
								var StatusIdJSON = oJSONModelData.filter(function(item) {
									return item.AgendaID === odataIDs[i];
								})[0].StatusID;
								var QuestionJSON = oJSONModelData.filter(function(item) {
									return item.AgendaID === odataIDs[i];
								})[0].Question;
								var ResolutionJSON = oJSONModelData.filter(function(item) {
									return item.AgendaID === odataIDs[i];
								})[0].Resolution;
								oODataModel.setProperty(sOdataPathAgenda + "/AgendaItem", AgendaItemJSON);
								oODataModel.setProperty(sOdataPathAgenda + "/PriorityID", PriorityIdJSON);
								oODataModel.setProperty(sOdataPathAgenda + "/StatusID", StatusIdJSON);
								oODataModel.setProperty(sOdataPathAgenda + "/Question", QuestionJSON);
								oODataModel.setProperty(sOdataPathAgenda + "/Resolution", ResolutionJSON);
								var AgendaOData = oODataModel.getProperty(sOdataPathAgenda);
								if (AgendaItemOData !== AgendaItemJSON || PriorityIdOData !== PriorityIdJSON || StatusIdOData !== StatusIdJSON ||
									QuestionOData !== QuestionJSON || ResolutionOData !== ResolutionJSON) {
									oODataModel.update(sOdataPathAgenda, AgendaOData, {
										groupId: "agendas"
									});
								}
							}
						}

						//Сreate
						for (var i = 0; i < jsonIDs.length; i++) {
							if (odataIDs.includes(jsonIDs[i]) === false) { //If AgendaID there isn't in JSON 
								//Create item
								var oCreatedItem = {
									AgendaID: oJSONModelData[i].AgendaID,
									MeetingHeaderID: MeetingHeaderID,
									AgendaItem: oJSONModelData[i].AgendaItem,
									PriorityID: oJSONModelData[i].PriorityID,
									StatusID: oJSONModelData[i].StatusID,
									Question: oJSONModelData[i].Question,
									Resolution: oJSONModelData[i].Resolution
								};
								this.getModel().createEntry("/jbmeeting_base_Agendas", {
									groupId: "agendas",
									properties: oCreatedItem
								});
							}
						}
						oODataModel.submitChanges({
							groupId: "agendas",
							success: function() {
								this.setBusyIndicatorForButtons();
								this.routingToCreatedMeeting();
							}.bind(this)
						});
					}.bind(this)
				});
		},

		setBusyIndicatorForButtons: function() {
			if (this.numberCompletedBatches === 0) {
				this.numberCompletedBatches = 1;
			} else if (this.numberCompletedBatches === 1) {
				this.numberCompletedBatches = 2;
			} else if (this.numberCompletedBatches === 2) {
				this.byId("btnMeetingEdit").setEnabled(true);
				this.byId("btnMeetingRefresh").setEnabled(true);
			}
		},

		routingToCreatedMeeting: function() {
			if (this.completedBatch && this.completedBatch === true) {
				this.getRouter().navTo().getHashChanger().replaceHash("Meeting/" + this.sObjectId);
				this.completedBatch = false;
			} else {
				this.completedBatch = true;
			}
		},

		//////////////////////////////////////////////////////////////////////////////////////////////////

		onPressResetChanges: function(oEvent) {
			var oCurrentJSONModelData = JSON.parse(JSON.stringify(this.getModel("json").getData()));
			//делаю вью мод для агенд у текущей модели, чтобы он всегда был равен и не влиял на результат сравнения
			for (var i = 0; i < oCurrentJSONModelData.agendas.length; i++) {
				oCurrentJSONModelData.agendas[i].Mode = "view";
			}
			if (JSON.stringify(oCurrentJSONModelData) === JSON.stringify(this.oElementalJSONModelData)) {
				this.activeViewMode();
			} else {
				this.oApproveDialogMeetingReset = new Dialog({
					icon: "sap-icon://reset",
					state: "None",
					title: "Reset",
					type: "Message",
					content: new sap.m.Text({
						text: "Reset all changes? This action cannot be undone."
					}),
					beginButton: new sap.m.Button({
						type: "Emphasized",
						text: "Reset",
						press: function() {
							this.oApproveDialogMeetingReset.close();
							this.resetChanges();
						}.bind(this)
					}),
					endButton: new sap.m.Button({
						text: "Cancel",
						press: function() {
							this.oApproveDialogMeetingReset.close();
						}.bind(this)
					})
				});
				this.oApproveDialogMeetingReset.open();
			}
		},

		resetChanges: function() {
			var oModel = this.getModel("json");
			this.getModel("objectView").setProperty("/changeVisible", false);
			oModel.setProperty("/meeting", Object.assign({}, this.oElementalJSONModelData.meeting));
			oModel.setProperty("/participants", JSON.parse(JSON.stringify(this.oElementalJSONModelData.participants)));
			var oModelDataAgendas = [];
			for (var i = 0; i < this.oElementalJSONModelData.agendas.length; i++) {
				oModelDataAgendas.push(Object.assign({}, this.oElementalJSONModelData.agendas[i]));
			}
			oModel.setProperty("/agendas", oModelDataAgendas);
			// this.getModel("json").setProperty("/agendas", this.oElementalJSONModelData.agendas.slice());
			MessageToast.show("Changes Reset");
		},

		onPressDelete: function() {
			this.oApproveDialogMeetingDelete = new Dialog({
				icon: "sap-icon://message-warning",
				state: "Warning",
				title: "Delete",
				type: "Message",
				content: new sap.m.Text({
					text: "Delete the meeting? This action cannot be undone."
				}),
				beginButton: new sap.m.Button({
					type: "Emphasized",
					text: "Delete",
					press: function() {
						this.oApproveDialogMeetingDelete.close();
						this.getRouter().navTo("worklist", {}, true);
						var sPath = this.getView().getBindingContext().getPath();
						this.getModel().remove(sPath, {
							success: function() {
								MessageToast.show("Meeting Deleted");
							},
							error: function() {
								MessageToast.show("Error!");
							}
						});
					}.bind(this)
				}),
				endButton: new sap.m.Button({
					text: "Cancel",
					press: function() {
						this.oApproveDialogMeetingDelete.close();
					}.bind(this)
				})
			});
			this.oApproveDialogMeetingDelete.open();
		},

		onPressRefresh: function() {
			this.getModel().refresh(true, true);
			this.getModel().updateBindings(true);
			this.getView().updateBindingContext();
			this.convertODataToJSON();
			MessageToast.show("Refreshed");
		},

		activeViewMode: function() {
			this.getModel("objectView").setProperty("/changeVisible", false);
			var oModel = this.getModel("json");
			var oModelData = oModel.getData();
			var oModelDataAgendas = oModelData.agendas;
			for (var i = 0; i < oModelDataAgendas.length; i++) {
				oModel.setProperty("/agendas/" + i + "/Mode", "view");
			}
		},

		onMeetingUpdateMeetingType: function(oEvent) {
			var oModel = this.getModel("json");
			var MeetingTypeText = oEvent.getParameters().selectedItem.getProperty("text");
			var MeetingTypeIcon = oEvent.getParameters().selectedItem.getProperty("icon");
			oModel.setProperty("/meeting/MeetingTypeText", MeetingTypeText);
			oModel.setProperty("/meeting/MeetingTypeIcon", MeetingTypeIcon);
		},

		///////////////////////////////////// Participants table \\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\
		onParticipantCreate: function() {
			var oJSONModel = this.getModel("json");
			var oODataModel = this.getModel();
			var oJSONModelData = oJSONModel.getProperty("/participants");
			var EmployeeID = this.byId("comboboxAddParticipant").getSelectedItem().getProperty("key");
			var oTable = this.byId("participantsTable");

			//If Participant with the same EmployeeID already exists, then a new Participant cannot be created
			var possibleCreate = true;
			oJSONModelData.forEach(function(item) {
				if (item.EmployeeID === EmployeeID) {
					possibleCreate = false;
				}
			});
			if (possibleCreate === true) {
				//Read selected Employee from OData to get the fields for the correct display of the JSON Model on the page
				oTable.setBusy(true);
				oODataModel.read("/jbmeeting_base_Employees", {
					filters: [new Filter("EmployeeID", FilterOperator.EQ, EmployeeID)],
					success: function(oDataEmployees) {
						var EmployeeText = oDataEmployees.results[0].EmployeeText;
						var AvatarURL_16x16 = oDataEmployees.results[0].AvatarURL_16x16;
						var newItem = {
							MeetingHeaderID: this.sObjectId,
							EmployeeID: EmployeeID,
							EmployeeText: EmployeeText,
							MeetingRoleID: "02",
							MeetingRoleText: "Participant",
							Mandatory: "",
							AvatarURL_16x16: AvatarURL_16x16
						};
						//Set default ParticipantID from the entity  ParticipantID entity in OData
						oODataModel.read("/ParticipantID", {
							success: function(oDataParticipantID) {
								var newParticipantID = oDataParticipantID.results[0].ID;
								newItem.ParticipantID = newParticipantID;

							}
						});
						//Read Participant with filter by selected EmployeeID from OData to set the correct ParticipantID
						oODataModel.read("/jbmeeting_base_MeetingHeaders('" + this.sObjectId +
							"')/jbmeeting_base_MeetingHeaders__jbmeeting_base_Participants", {
								filters: [new Filter("EmployeeID", FilterOperator.EQ, EmployeeID)],
								success: function(oDataParticipants) {
									var oDataParticipantsLength = oDataParticipants.results.length;
									if (oDataParticipantsLength !== 0) { //If Participant with selected EmployeeID already there is in OData
										//Set old ParticipantID
										var oldParticipantID = oDataParticipants.results[0].ParticipantID;
										newItem.ParticipantID = oldParticipantID;
									}
									//Create new Participant with correct ParticipantID
									oJSONModelData.push(newItem);
									oJSONModel.setProperty("/participants", oJSONModelData);
									//busy
									oTable.setBusy(false);
								}.bind(this)
							});
					}.bind(this)
				});
			} else {
				MessageToast.show("This participant has already been added");
			}
		},

		onParticipantDelete: function(oEvent) {
			var oModel = this.getModel("json");
			var oModelDataParticpants = oModel.getData().participants;
			var oDeletedParticipant = oEvent.getSource().getBindingContext("json").getObject();
			var index = oModelDataParticpants.indexOf(oDeletedParticipant);
			oModelDataParticpants.splice(index, 1);
			oModel.setProperty("/participants", oModelDataParticpants);
		},

		onParticipantUpdateMandatory: function(oEvent) {
			var oModel = this.getModel("json");
			var sPath = oEvent.getSource().getBindingContext("json");
			if (oModel.getProperty(sPath + "/Mandatory") === "X") {
				oModel.setProperty(sPath + "/Mandatory", null);
			} else {
				oModel.setProperty(sPath + "/Mandatory", "X");
			}
		},

		onParticipantUpdateMeetingRole: function(oEvent) {
			var oModel = this.getModel("json");
			var MeetingRoleText = oEvent.getParameters().selectedItem.getProperty("text");
			var sPath = oEvent.getSource().getBindingContext("json");
			oModel.setProperty(sPath + "/MeetingRoleText", MeetingRoleText);
		},

		//////////////////////////////////////// Agendas table \\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\
		onAgendaApproveDelete: function(oEvent) {
			var oModel = this.getModel("json");
			var oModelDataAgendas = oModel.getData().agendas;
			var oDeletedAgenda = oEvent.getSource().getBindingContext("json").getObject();
			var index = oModelDataAgendas.indexOf(oDeletedAgenda);

			this.oApproveDialogAgendaDelete = new Dialog({
				icon: "sap-icon://message-warning",
				state: "Warning",
				title: "Delete",
				type: "Message",
				content: new sap.m.Text({
					text: "Delete the agenda?"
				}),
				beginButton: new sap.m.Button({
					type: "Emphasized",
					text: "Delete",
					press: function() {
						this.oApproveDialogAgendaDelete.close();
						oModelDataAgendas.splice(index, 1);
						oModel.setProperty("/agendas", oModelDataAgendas);
					}.bind(this)
				}),
				endButton: new sap.m.Button({
					text: "Cancel",
					press: function() {
						this.oApproveDialogAgendaDelete.close();
					}.bind(this)
				})
			});

			this.oApproveDialogAgendaDelete.open();
		},

		agendaDelete: function(oEvent) {
			var oModel = this.getModel("json");
			var oModelDataAgendas = oModel.getData().agendas;
			var oDeletedAgenda = oEvent.getSource().getBindingContext("json").getObject();
			var index = oModelDataAgendas.indexOf(oDeletedAgenda);
			oModelDataAgendas.splice(index, 1);
			oModel.setProperty("/agendas", oModelDataAgendas);
		},

		onAgendaUpdatePriority: function(oEvent) {
			var oModel = this.getModel("json");
			var PriorityText = oEvent.getParameters().selectedItem.getProperty("text");
			var PriorityIcon = oEvent.getParameters().selectedItem.getProperty("icon");
			var sPath = oEvent.getSource().getBindingContext("json");
			oModel.setProperty(sPath + "/PriorityText", PriorityText);
			oModel.setProperty(sPath + "/PriorityIcon", PriorityIcon);
		},

		onAgendaUpdateStatus: function(oEvent) {
			var oModel = this.getModel("json");
			var StatusText = oEvent.getParameters().selectedItem.getProperty("text");
			var StatusIcon = oEvent.getParameters().selectedItem.getProperty("icon");
			var sPath = oEvent.getSource().getBindingContext("json");
			oModel.setProperty(sPath + "/StatusText", StatusText);
			oModel.setProperty(sPath + "/StatusIcon", StatusIcon);
		},

		onAgendaDone: function(oEvent) {
			var oModel = this.getModel("json");
			var sPath = oEvent.getSource().getBindingContext("json");
			oModel.setProperty(sPath + "/Mode", "view");
			var AgendaID = oModel.getProperty(sPath + "/AgendaID");
			var index = -1;
			this.oElementalJSONModelData.agendas.forEach(function(item) {
				if (item.AgendaID === AgendaID) {
					index = AgendaID;
				}
			});
			if (index !== -1 && JSON.stringify(this.oAgenda) !== JSON.stringify(this.oElementalJSONModelData.agendas[index])) {
				oModel.setProperty(sPath + "/Modified", new Date());
				oModel.setProperty(sPath + "/ModifiedBy", "P000023");
			}
		},

		onAgendaCancel: function(oEvent) {
			var oModel = this.getModel("json");
			var oModelDataAgendas = oModel.getData().agendas;
			var i = oModelDataAgendas.indexOf(this.oAgenda);
			oModelDataAgendas[i] = this.oElementalAgenda;
			oModel.setProperty("/agendas", oModelDataAgendas);
		},

		onAgendaCreate: function() {
			this.action = "create"; //записываем действие крейт в переменную
			this.checkPossibleAgendaCreateEdit(); //проверка на возможность создания

			if (this.possibleCreateEdit === true) { //если создание возможно
				this.getModel("json").setProperty(this.sAgendaPath + "/Mode", "view"); //вью мод для старой агенды
				this.agendaCreate(); //создаем агенду
			} else {
				this.sOldAgendaPath = this.sAgendaPath.slice(); //копируем в переменную старого пути текущий путь к агенде 
				this.onApproveAgendaDialogOpen(); //открываем диалоговое окно
			}

		},

		agendaCreate: function() {
			var oJSONModel = this.getModel("json");
			var oODataModel = this.getModel();
			var oJSONModelDataAgendas = oJSONModel.getProperty("/agendas");
			var MeetingHeaderID = this.sObjectId;
			var oTable = this.byId("agendasTable");

			oODataModel.read("/AgendaID", {
				success: function(oDataAgendaID) {
					var AgendaID = oDataAgendaID.results[0].ID;
					var newItem = {
						AgendaID: AgendaID,
						MeetingHeaderID: MeetingHeaderID,
						AgendaItem: "",
						PriorityID: "03",
						PriorityText: "Medium",
						PriorityIcon: "sap-icon://expand-group",
						StatusID: "01",
						StatusText: "Active",
						StatusIcon: "sap-icon://media-play",
						Mode: "create",
						Modified: new Date(),
						Created: new Date(),
						CreatedByFullName: "P000023 P000023"
					};
					oJSONModelDataAgendas.push(newItem);
					oJSONModel.setProperty("/agendas", oJSONModelDataAgendas);
					//set sPath for current Agenda
					this.sAgendaPath = "/agendas/" + oJSONModelDataAgendas.indexOf(newItem);

					//Scroll to new Agenda
					oTable.getItems()[0].focus();
				}.bind(this)
			});
		},

		onAgendaEdit: function(oEvent) {
			this.action = "edit"; //записываем действие эдит в переменную
			this.checkPossibleAgendaCreateEdit(); //проверка на возможность редактирования
			if (this.possibleCreateEdit === true) {
				this.activeAgendaEditMode(oEvent); //включаем эдит мод
			} else {
				this.sOldAgendaPath = this.sAgendaPath.slice(); //копируем в переменную старого пути текущий путь к агенде 
				this.sAgendaPath = oEvent.getSource().getBindingContext("json").getPath(); //получаем новый текущий путь
				this.onApproveAgendaDialogOpen(); //открываем диалоговое окно
			}
		},

		activeAgendaEditMode: function(oEvent) {
			var oModel = this.getModel("json");
			var oModelDataAgendas = oModel.getData().agendas;
			for (var i = 0; i < oModelDataAgendas.length; i++) {
				oModelDataAgendas[i].Mode = "view"; //задаем каждой записи вью мод, на случай, если у нас была запись в эдит моде
			}
			this.sAgendaPath = oEvent.getSource().getBindingContext("json").getPath(); //записываем путь текущей редактируемой агенды
			this.oAgenda = oModel.getProperty(this.sAgendaPath); //получаем текущую редактируемую агенду
			this.oElementalAgenda = Object.assign({}, this.oAgenda); //делаем дубликат, чтобы откатиться к нему, если будет ресет
			oModel.setProperty(this.sAgendaPath + "/Mode", "edit"); //переводим агенду в эдит мод
		},

		checkPossibleAgendaCreateEdit: function() {
			this.possibleCreateEdit = true; //задаем тру по дефолту
			var oModelDataAgendas = this.getModel("json").getData().agendas;
			for (var i = 0; i < oModelDataAgendas.length; i++) {
				if (oModelDataAgendas[i].Mode !== "view") {
					var AgendaMode = oModelDataAgendas[i].Mode;
					this.possibleCreateEdit = false; //меняем на фолс если есть агенды не во вью моде
					break;
				}
			}

			if (AgendaMode === "edit" && this.oElementalAgenda && this.oAgenda && this.oElementalAgenda.AgendaItem === this.oAgenda.AgendaItem &&
				this.oElementalAgenda.StatusID === this.oAgenda.StatusID && this.oElementalAgenda.PriorityID === this.oAgenda.PriorityID &&
				this.oElementalAgenda.Question === this.oAgenda.Question && this.oElementalAgenda.Resolution === this.oAgenda.Resolution) {
				this.possibleCreateEdit = true; //меняем на тру если агенда в эдит моде и не одно ее поле не изменено
			}
		},

		onApproveAgendaDialogOpen: function() {
			if (!this.oApproveAgendaDialog) {
				this.oApproveAgendaDialog = new Dialog({
					type: sap.m.DialogType.Message,
					customHeader: new sap.m.Bar({
						contentLeft: [
							new sap.ui.core.Icon({
								src: "sap-icon://message-warning"
							}),
							new sap.m.Title({
								text: "Unsaved Changes"
							})
						],
						contentRight: [
							new sap.m.Button({
								icon: "sap-icon://decline",
								tooltip: "Close",
								press: function() {
									this.sAgendaPath = this.sOldAgendaPath.slice(); //возращаем текущий путь из старого пути к агенде
									this.oApproveAgendaDialog.close();
								}.bind(this)
							})
						]
					}),
					content: new sap.m.Text({
						text: "Save changes to the edited Agenda?"
					}),
					beginButton: new sap.m.Button({
						type: sap.m.ButtonType.Emphasized,
						text: "Yes",
						press: function() {
							this.onSaveApproveAgendaDialog();
							this.oApproveAgendaDialog.close();
						}.bind(this)
					}),
					endButton: new sap.m.Button({
						text: "No",
						press: function() {
							this.onResetApproveAgendaDialog();
							this.oApproveAgendaDialog.close();
						}.bind(this)
					})
				});
			}

			this.oApproveAgendaDialog.open();
		},

		onSaveApproveAgendaDialog: function() {
			var oModel = this.getModel("json");
			if (this.action === "edit") { //если было редактирование
				oModel.setProperty(this.sAgendaPath + "/Mode", "edit"); //вью мод для новой агенды
				oModel.setProperty(this.sOldAgendaPath + "/Mode", "view"); //эдит мод для старой агенды
				this.oAgenda = oModel.getProperty(this.sAgendaPath);
				this.oElementalAgenda = JSON.parse(JSON.stringify(this.oAgenda)); //делаем дубликат, чтобы откатиться к нему, если будет ресет
				this.oElementalAgenda.Mode = "view"; //задаем дубликату вью мод, чтобы при ресете агенда вернулась во вью мод
			} else { //если было создание
				oModel.setProperty(this.sOldAgendaPath + "/Mode", "view"); //эдит мод для старой агенды
				this.agendaCreate();
			}
		},

		onResetApproveAgendaDialog: function() {
			var oModel = this.getModel("json");
			var OldAgendaMode = oModel.getProperty(this.sOldAgendaPath + "/Mode");
			var oModelDataAgendas = oModel.getData().agendas;
			var oDeletedAgenda = oModel.getProperty(this.sOldAgendaPath);
			var index = oModelDataAgendas.indexOf(oDeletedAgenda);
			if (this.action && this.action === "edit") {
				if (OldAgendaMode === "edit") {
					this.onAgendaCancel();
					this.onSaveApproveAgendaDialog();
				} else {
					oModelDataAgendas.splice(index, 1);
					oModel.setProperty("/agendas", oModelDataAgendas);
					this.onSaveApproveAgendaDialog();
				}
			} else {
				if (OldAgendaMode === "edit") {
					this.onAgendaCancel();
					this.onSaveApproveAgendaDialog();
				} else {
					oModelDataAgendas.splice(index, 1);
					oModel.setProperty("/agendas", oModelDataAgendas);
					this.agendaCreate();
				}

			}

		},

		////////////////////////////////////// Creation Meeting \\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\
		activeCreationMode: function() {
			//Busy
			var oPage = this.byId("page");
			oPage.setBusy(false);
			//Active view mode
			this.onPressEdit();
			this.getModel("objectView").setProperty("/creation", true);
			//Empty Items
			var min15 = 1000 * 60 * 15;
			var date = new Date();
			var DateFrom = new Date(Math.round(date.getTime() / min15) * min15 + min15);
			var DateTo = new Date(DateFrom.getTime() + min15 * 4);
			var oJSONModel = new sap.ui.model.json.JSONModel({
				meeting: {
					DateFrom: DateFrom,
					DateTo: DateTo,
					MeetingTypeID: "02"
				},
				participants: [],
				agendas: []
			});
			this.setModel(oJSONModel, "json");
			this.oElementalJSONModelData = JSON.parse(JSON.stringify(oJSONModel.getData()));
		},

		onMeetingCreate: function() {
			var oODataModel = this.getModel();
			var oJSONModel = this.getModel("json");
			var oPage = this.byId("page");
			oPage.setBusy(true);
			oODataModel.read("/MeetingHeaderID", {
				success: function(oData) {
					var MeetingHeaderID = oData.results[0].ID;
					var oNewMeeting = oJSONModel.getData().meeting;
					this.activeViewMode();
					this.getModel("objectView").setProperty("/creation", false);
					oNewMeeting.MeetingHeaderID = MeetingHeaderID;
					oODataModel.createEntry("/jbmeeting_base_MeetingHeaders", {
						properties: oNewMeeting
					});
					oODataModel.submitChanges({
						success: function() {
							oPage.setBusy(false);
							this.completed = false;
							this.sObjectId = MeetingHeaderID;
							this.getModel().setDeferredGroups(this.getModel().getDeferredGroups().concat(["participants", "agendas"]));
							this.participantsSaveBack();
							this.agendasSaveBack();
						}.bind(this)
					});
				}.bind(this)
			});
		},

		onApproveMeetingClosing: function() {
			if (JSON.stringify(JSON.parse(JSON.stringify(this.getModel("json").getData()))) === JSON.stringify(this.oElementalJSONModelData)) {
				this.onNavBack();
			} else {
				this.oApproveDialogMeetingClose = new Dialog({
					icon: "sap-icon://decline",
					state: "None",
					title: "Close",
					type: "Message",
					content: new sap.m.Text({
						text: "Are you sure you want to close the creation window?"
					}),
					beginButton: new sap.m.Button({
						type: "Emphasized",
						text: "Close",
						press: function() {
							this.onNavBack();
						}.bind(this)
					}),
					endButton: new sap.m.Button({
						text: "Cancel",
						press: function() {
							this.oApproveDialogMeetingClose.close();
						}.bind(this)
					})
				});
				this.oApproveDialogMeetingClose.open();
			}
		},

		/////////////////////////////// Automatically working functions \\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\
		convertODataToJSON: function(oEvent) {
			var oODataModel = this.getModel();
			var oJSONModel = new sap.ui.model.json.JSONModel({
				meeting: {},
				participants: [],
				agendas: []
			});
			this.setModel(oJSONModel, "json");
			oJSONModel = this.getModel("json");
			var oJSONModelData = oJSONModel.getData();
			this.oElementalJSONModelData = JSON.parse(JSON.stringify(oJSONModelData));
			//Meeting
			this.byId("page").setBusy(true);
			oODataModel.read("/jbmeeting_base_MeetingHeaders('" + this.sObjectId + "')", {
				success: function(oData, oResponse) {
					var oJSONModelDataMeeting = oJSONModelData.meeting;
					oJSONModelDataMeeting = oData;
					this.oElementalJSONModelData.meeting = Object.assign({}, oJSONModelDataMeeting);
					oJSONModel.setProperty("/meeting", oJSONModelDataMeeting);
					this.byId("page").setBusy(false);
				}.bind(this)
			});
			//Participants
			this.byId("participantsTable").setBusy(true);
			oODataModel.read("/jbmeeting_base_MeetingHeaders('" + this.sObjectId +
				"')/jbmeeting_base_MeetingHeaders__jbmeeting_base_Participants", {
					success: function(oData, oResponse) {
						var oJSONModelDataParticipants = oJSONModelData.participants;
						for (var i = 0; i < oData.results.length; i++) {
							oJSONModelDataParticipants.push(oData.results[i]);
						}
						this.oElementalJSONModelData.participants = JSON.parse(JSON.stringify(oJSONModelDataParticipants));
						oJSONModel.setProperty("/participants", oJSONModelDataParticipants);
						this.byId("participantsTable").setBusy(false);
					}.bind(this)
				});
			//Agendas
			this.byId("agendasTable").setBusy(true);
			oODataModel.read("/jbmeeting_base_MeetingHeaders('" + this.sObjectId + "')/jbmeeting_base_MeetingHeaders__jbmeeting_base_Agendas", {
				success: function(oData, oResponse) {
					var oJSONModelDataAgendas = oJSONModelData.agendas;
					for (var i = 0; i < oData.results.length; i++) {
						oJSONModelDataAgendas.push(oData.results[i]);
						oJSONModelDataAgendas[i].Mode = "view";

						this.oElementalJSONModelData.agendas.push(Object.assign({}, oData.results[i]));
						this.oElementalJSONModelData.agendas[i].Mode = "view";
					}
					// this.oElementalJSONModelData.agendas = JSON.parse(JSON.stringify(oJSONModelDataAgendas));
					oJSONModel.setProperty("/agendas", oJSONModelDataAgendas);
					this.byId("agendasTable").setBusy(false);
				}.bind(this)
			});
		},

		onUpdateFinishedParticipants: function(oEvent) {
			var sTitle,
				oViewModel = this.getModel("objectView"),
				oTable = this.byId("participantsTable"),
				iTotalItems = oTable.getItems().length;
			if (oTable.getBinding("items").isLengthFinal() & iTotalItems !== 0) {
				sTitle = this.getResourceBundle().getText("participantsTableTitleCount", [iTotalItems]);
			} else {
				sTitle = this.getResourceBundle().getText("participantsTableTitle");
			}
			oViewModel.setProperty("/participantsTableTitle", sTitle);

			//Duration
			// var startDate = this.getView().byId("DateFrom").getDateValue();
			// var endDate = this.getView().byId("DateTo").getDateValue();
			// var duration = (endDate.getTime() - startDate.getTime()) / (3600000);
			// this.getModel("objectView").setProperty("/Duration", duration + " h");
		},

		onUpdateFinishedAgendas: function() {
			var sTitle,
				oViewModel = this.getModel("objectView"),
				oTable = this.byId("agendasTable"),
				count = 0,
				iTotalItems = oTable.getItems().length;
			for (var i = 0; i < oTable.getItems().length; i++) {
				var visible = oTable.getItems()[i].getVisible();
				if (visible === true) {
					count++;
				}
			}
			if (oTable.getBinding("items").isLengthFinal() & iTotalItems !== 0) {
				sTitle = this.getResourceBundle().getText("agendasTableTitleCount", [count]);
			} else {
				sTitle = this.getResourceBundle().getText("agendasTableTitle");
			}
			oViewModel.setProperty("/agendasTableTitle", sTitle);
		},

		removeSpaces: function(oEvent) {
			var sValue = oEvent.getParameter("value");
			if (sValue[0] === " ") {
				oEvent.getSource().setValue(sValue.trimStart());
			}
		},

		// Filter agendas with SegmentedButton
		onSelectionChange: function(oEvent) {
			var sKey = oEvent.getParameter("item").getKey();
			if (sKey !== "all") {
				var oGlobalFilter = new Filter([
					new Filter("StatusID", FilterOperator.EQ, sKey)
				], false);
			}
			this._filter(oGlobalFilter);
		},

		_filter: function(oGlobalFilter) {
			var oFilter = null;
			if (oGlobalFilter) {
				oFilter = oGlobalFilter;
			}
			this.byId("agendasTable").getBinding("items").filter(oFilter);
		},

		// For view badge icon in avatar
		onPressAvatar: function() {},

		/////////////////////////////////////////////////////////////////
		/////////////////////////////////////////////////////////////////
		/////////////////////////////////////////////////////////////////
		///////////////////////////// Functions not used \\\\\\\\\\\\\\\\\\\\\\\\\

		//Popover
		// onPopoverOpen: function(oEvent) {
		// 	var oButton = oEvent.getSource(),
		// 		oView = this.getView();
		// 	if (!this._pPopover) {
		// 		this._pPopover = Fragment.load({
		// 			id: oView.getId(),
		// 			name: "jbmeeting.MeetingManager.view.Object.Popover",
		// 			controller: this
		// 		}).then(function(oPopover) {
		// 			oView.addDependent(oPopover);
		// 			return oPopover;
		// 		});
		// 	}
		// 	this._pPopover.then(function(oPopover) {
		// 		oPopover.openBy(oButton);
		// 	});
		// },

		// onPopoverClose: function() {
		// 	this.byId("Popover").close();
		// },

		// onAgendaCreateDialog: function(oEvent) {
		// 	var that = this;
		// 	var oDialog = new Dialog({
		// 		title: "Create new agenda",
		// 		contentWidth: "240px",
		// 		type: "Message",
		// 		content: [
		// 			new sap.m.Label({
		// 				text: "Title",
		// 				labelFor: "AgendaItem"
		// 			}),
		// 			new sap.m.Input("AgendaItem", {}),

		// 			new sap.m.Label({
		// 				text: "Priority",
		// 				labelFor: "PriorityID"
		// 			}),
		// 			new sap.m.Input("PriorityID"),

		// 			new sap.m.Label({
		// 				text: "Responsible",
		// 				labelFor: "ResponsibleID"
		// 			}),
		// 			new sap.m.Input("ResponsibleID"),

		// 			new sap.m.Label({
		// 				text: "Question",
		// 				labelFor: "Question"
		// 			}),
		// 			new sap.m.Input("Question"),

		// 			new sap.m.Label({
		// 				text: "Resolution",
		// 				labelFor: "Resolution"
		// 			}),
		// 			new sap.m.Input("Resolution")
		// 		],
		// 		beginButton: new sap.m.Button({
		// 			type: "Emphasized",
		// 			text: "Create",

		// 			press: function() {
		// 				var newAgenda = {
		// 					AgendaID: "",
		// 					AgendaItem: oDialog.getContent()[1].getValue(),
		// 					MeetingHeaderID: this.sObjectId,
		// 					StatusID: "01",
		// 					PriorityID: oDialog.getContent()[3].getValue(),
		// 					ResponsibleID: oDialog.getContent()[5].getValue(),
		// 					Question: oDialog.getContent()[7].getValue(),
		// 					Resolution: oDialog.getContent()[9].getValue()
		// 				};
		// 				that.getModel().create("/jbmeeting_base_Agendas", newAgenda, {
		// 					error: function() {
		// 						MessageToast.show("Error!");
		// 					}
		// 				});
		// 				oDialog.close();
		// 			}
		// 		}),
		// 		endButton: new sap.m.Button({
		// 			text: "Cancel",
		// 			press: function() {
		// 				oDialog.close();
		// 			}
		// 		}),
		// 		afterClose: function() {
		// 			oDialog.destroy();
		// 		}
		// 	});
		// 	oDialog.open();

		// },

		// _getDialog: function() {
		// 	if (!this._oDialog) {
		// 		this._oDialog = sap.ui.xmlfragment("jbmeeting.MeetingManager.fragment.MessageBoxAgendaApprove");
		// 		this.getView().addDependent(this._oDialog);
		// 	}
		// 	return this._oDialog;
		// },
		// onOpenDialog: function() {
		// 	this._getDialog().open();
		// },

		/////////////////////////////////////////////////////////////////

		/* =========================================================== */
		/* event handlers                                              */
		/* =========================================================== */

		/**
		 * Event handler  for navigating back.
		 * It there is a history entry we go one step back in the browser history
		 * If not, it will replace the current entry of the browser history with the worklist route.
		 * @public
		 */
		onNavBack: function() {
			var sPreviousHash = History.getInstance().getPreviousHash();

			if (sPreviousHash !== undefined) {
				history.go(-1);
			} else {
				this.getRouter().navTo("worklist", {}, true);
			}
		},

		/* =========================================================== */
		/* internal methods                                            */
		/* =========================================================== */

		/**
		 * Binds the view to the object path.
		 * @function
		 * @param {sap.ui.base.Event} oEvent pattern match event in route "object"
		 * @private
		 */
		_onObjectMatched: function(oEvent) {
			if (this.sObjectId) {
				this.sOldObjectId = JSON.parse(JSON.stringify(this.sObjectId));
			}
			this.sObjectId = oEvent.getParameter("arguments").objectId;
			if (!this.sOldObjectId || this.sOldObjectId !== this.sObjectId) {
				if (this.sObjectId !== "Creation") {
					this.getModel().metadataLoaded().then(function() {
						var sObjectPath = this.getModel().createKey("jbmeeting_base_MeetingHeaders", {
							MeetingHeaderID: this.sObjectId
						});
						this._bindView("/" + sObjectPath);
						this.convertODataToJSON();
						this.activeViewMode();
						this.getModel("objectView").setProperty("/creation", false);
					}.bind(this));
				} else {
					this.activeCreationMode();
				}
			}
		},

		/**
		 * Binds the view to the object path.
		 * @function
		 * @param {string} sObjectPath path to the object to be bound
		 * @private
		 */
		_bindView: function(sObjectPath) {
			var oViewModel = this.getModel("objectView"),
				oDataModel = this.getModel();

			this.getView().bindElement({
				path: sObjectPath,
				events: {
					change: this._onBindingChange.bind(this),
					dataRequested: function() {
						oDataModel.metadataLoaded().then(function() {
							// Busy indicator on view should only be set if metadata is loaded,
							// otherwise there may be two busy indications next to each other on the
							// screen. This happens because route matched handler already calls "_bindView"
							// while metadata is loaded.
							oViewModel.setProperty("/busy", true);
						});
					},
					dataReceived: function() {
						oViewModel.setProperty("/busy", false);
					}
				}
			});
		},

		_onBindingChange: function() {
			var oView = this.getView(),
				oViewModel = this.getModel("objectView"),
				oElementBinding = oView.getElementBinding();

			// No data for the binding
			if (!oElementBinding.getBoundContext()) {
				this.getRouter().getTargets().display("objectNotFound");
				return;
			}

			var oResourceBundle = this.getResourceBundle(),
				oObject = oView.getBindingContext().getObject(),
				sObjectId = oObject.MeetingHeaderID,
				sObjectName = oObject.MeetingHeaderText;

			oViewModel.setProperty("/busy", false);

			oViewModel.setProperty("/shareSendEmailSubject",
				oResourceBundle.getText("shareSendEmailObjectSubject", [sObjectId]));
			oViewModel.setProperty("/shareSendEmailMessage",
				oResourceBundle.getText("shareSendEmailObjectMessage", [sObjectName, sObjectId, location.href]));
		}

	});

});