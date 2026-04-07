"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.onArticleDeleted = exports.onArticleUpdated = exports.onHelpCenterArticleDeleted = exports.onHelpCenterArticleUpdated = exports.scheduledAiFollowUp = exports.onConversationResolvedForInsight = exports.buyPhoneNumber = exports.searchNumbers = exports.provisionTwilioSubaccount = exports.twilioVoiceDialResult = exports.twilioVoiceRecording = exports.twilioVoiceStatus = exports.twilioVoiceInbound = exports.sendCommsMessage = exports.twilioSmsStatus = exports.twilioSmsInbound = exports.onSmsMessageCreated = exports.scheduledAcknowledgementEmail = exports.sendVisitorReplyEmail = exports.sendAgentChatAlertEmail = exports.onChatMessageCreated = exports.processBrainJob = exports.onVisitorMessageCreated = exports.resendInvite = exports.acceptInvite = exports.sendInviteEmail = exports.renewEmailWatches = void 0;
const scheduler_1 = require("firebase-functions/v2/scheduler");
const admin = __importStar(require("firebase-admin"));
if (!admin.apps.length)
    admin.initializeApp();
// Daily Email Watch Renewal
exports.renewEmailWatches = (0, scheduler_1.onSchedule)({ schedule: "every 24 hours", memory: "512MiB" }, async (event) => {
    const db = admin.firestore();
    const now = new Date();
    const cutoff = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000); // 2 days buffer
    // 1. Renew Hub Watches
    const hubQuerySnap = await db.collectionGroup("emailConfigs")
        .where("connected", "==", true)
        .where("watchConfig.expiresAt", "<=", cutoff.toISOString())
        .get();
    for (const doc of hubQuerySnap.docs) {
        console.log(`Renewing hub watch for ${doc.data().emailAddress}`);
    }
    // 2. Renew Agent Watches
    const agentIndexSnap = await db.collection("emailIndex")
        .where("type", "==", "agent")
        .get();
    for (const indexDoc of agentIndexSnap.docs) {
        const { userId, emailConfigId } = indexDoc.data();
        const configRef = db.doc(`users/${userId}/emailConfigs/${emailConfigId}`);
        const configSnap = await configRef.get();
        if (configSnap.exists) {
            const config = configSnap.data();
            if (config.connected && config.watchConfig?.expiresAt && new Date(config.watchConfig.expiresAt) <= cutoff) {
                console.log(`Renewing agent watch for ${config.emailAddress}`);
            }
        }
    }
});
// Exports
var sendInviteEmail_1 = require("./sendInviteEmail");
Object.defineProperty(exports, "sendInviteEmail", { enumerable: true, get: function () { return sendInviteEmail_1.sendInviteEmail; } });
var acceptInvite_1 = require("./acceptInvite");
Object.defineProperty(exports, "acceptInvite", { enumerable: true, get: function () { return acceptInvite_1.acceptInvite; } });
var resendInvite_1 = require("./resendInvite");
Object.defineProperty(exports, "resendInvite", { enumerable: true, get: function () { return resendInvite_1.resendInvite; } });
var onVisitorMessageCreated_1 = require("./onVisitorMessageCreated");
Object.defineProperty(exports, "onVisitorMessageCreated", { enumerable: true, get: function () { return onVisitorMessageCreated_1.onVisitorMessageCreated; } });
var processBrainJob_1 = require("./processBrainJob");
Object.defineProperty(exports, "processBrainJob", { enumerable: true, get: function () { return processBrainJob_1.processBrainJob; } });
var metadataTriggers_1 = require("./chatNotifications/metadataTriggers");
Object.defineProperty(exports, "onChatMessageCreated", { enumerable: true, get: function () { return metadataTriggers_1.onChatMessageCreated; } });
var emailNotifications_1 = require("./chatNotifications/emailNotifications");
Object.defineProperty(exports, "sendAgentChatAlertEmail", { enumerable: true, get: function () { return emailNotifications_1.sendAgentChatAlertEmail; } });
Object.defineProperty(exports, "sendVisitorReplyEmail", { enumerable: true, get: function () { return emailNotifications_1.sendVisitorReplyEmail; } });
Object.defineProperty(exports, "scheduledAcknowledgementEmail", { enumerable: true, get: function () { return emailNotifications_1.scheduledAcknowledgementEmail; } });
var botTrigger_1 = require("./chat/botTrigger");
Object.defineProperty(exports, "onSmsMessageCreated", { enumerable: true, get: function () { return botTrigger_1.onSmsMessageCreated; } });
var twilioSmsInbound_1 = require("./http/twilioSmsInbound");
Object.defineProperty(exports, "twilioSmsInbound", { enumerable: true, get: function () { return twilioSmsInbound_1.twilioSmsInbound; } });
var twilioSmsStatus_1 = require("./http/twilioSmsStatus");
Object.defineProperty(exports, "twilioSmsStatus", { enumerable: true, get: function () { return twilioSmsStatus_1.twilioSmsStatus; } });
var sendCommsMessage_1 = require("./http/sendCommsMessage");
Object.defineProperty(exports, "sendCommsMessage", { enumerable: true, get: function () { return sendCommsMessage_1.sendCommsMessage; } });
var twilioVoiceInbound_1 = require("./http/twilioVoiceInbound");
Object.defineProperty(exports, "twilioVoiceInbound", { enumerable: true, get: function () { return twilioVoiceInbound_1.twilioVoiceInbound; } });
var twilioVoiceStatus_1 = require("./http/twilioVoiceStatus");
Object.defineProperty(exports, "twilioVoiceStatus", { enumerable: true, get: function () { return twilioVoiceStatus_1.twilioVoiceStatus; } });
var twilioVoiceRecording_1 = require("./http/twilioVoiceRecording");
Object.defineProperty(exports, "twilioVoiceRecording", { enumerable: true, get: function () { return twilioVoiceRecording_1.twilioVoiceRecording; } });
var twilioVoiceDialResult_1 = require("./http/twilioVoiceDialResult");
Object.defineProperty(exports, "twilioVoiceDialResult", { enumerable: true, get: function () { return twilioVoiceDialResult_1.twilioVoiceDialResult; } });
var provisioning_1 = require("./twilio/provisioning");
Object.defineProperty(exports, "provisionTwilioSubaccount", { enumerable: true, get: function () { return provisioning_1.provisionTwilioSubaccount; } });
Object.defineProperty(exports, "searchNumbers", { enumerable: true, get: function () { return provisioning_1.searchNumbers; } });
Object.defineProperty(exports, "buyPhoneNumber", { enumerable: true, get: function () { return provisioning_1.buyPhoneNumber; } });
var insightTrigger_1 = require("./chat/insightTrigger");
Object.defineProperty(exports, "onConversationResolvedForInsight", { enumerable: true, get: function () { return insightTrigger_1.onConversationResolvedForInsight; } });
var aiFollowUpScheduler_1 = require("./chatNotifications/aiFollowUpScheduler");
Object.defineProperty(exports, "scheduledAiFollowUp", { enumerable: true, get: function () { return aiFollowUpScheduler_1.scheduledAiFollowUp; } });
var onHelpCenterArticleUpdated_1 = require("./onHelpCenterArticleUpdated");
Object.defineProperty(exports, "onHelpCenterArticleUpdated", { enumerable: true, get: function () { return onHelpCenterArticleUpdated_1.onHelpCenterArticleUpdated; } });
Object.defineProperty(exports, "onHelpCenterArticleDeleted", { enumerable: true, get: function () { return onHelpCenterArticleUpdated_1.onHelpCenterArticleDeleted; } });
var onArticleUpdated_1 = require("./onArticleUpdated");
Object.defineProperty(exports, "onArticleUpdated", { enumerable: true, get: function () { return onArticleUpdated_1.onArticleUpdated; } });
Object.defineProperty(exports, "onArticleDeleted", { enumerable: true, get: function () { return onArticleUpdated_1.onArticleDeleted; } });
