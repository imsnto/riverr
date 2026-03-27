"use strict";
'use server';
Object.defineProperty(exports, "__esModule", { value: true });
exports.previewAgentResponseAction = previewAgentResponseAction;
exports.invokeAgent = invokeAgent;
exports.addChatMessage = addChatMessage;
exports.updateConversation = updateConversation;
exports.createConversationAndLinkCrm = createConversationAndLinkCrm;
exports.ensureConversationCrmLinkedAction = ensureConversationCrmLinkedAction;
exports.reindexArticleAction = reindexArticleAction;
const firebase_admin_1 = require("@/lib/firebase-admin");
const agent_1 = require("@/lib/agent");
const bot_runtime_1 = require("@/lib/bot-runtime");
const agent_response_1 = require("@/ai/flows/agent-response");
const retrieve_context_1 = require("@/lib/brain/retrieve-context");
const providerFactory_1 = require("@/lib/comms/providerFactory");
const indexer_1 = require("@/lib/knowledge/indexer");
/**
 * Non-mutating version of the agent logic used for settings previews.
 */
async function previewAgentResponseAction(args) {
    const message = String(args.message || '').trim();
    const effectiveBot = args.botData;
    if (!effectiveBot)
        throw new Error('botData is required');
    if (!message)
        return { answer: '', usedAgentName: 'Assistant', sources: [] };
    const webAgentName = effectiveBot.webAgentName || effectiveBot.name || 'Assistant';
    const policy = {
        agentId: effectiveBot.id,
        isCustomerFacing: effectiveBot.type === 'widget',
        accessLevel: effectiveBot.intelligenceAccessLevel || 'topics_only',
        allowedLibraryIds: effectiveBot.allowedHelpCenterIds || []
    };
    const decision = await (0, retrieve_context_1.orchestrateRetrieval)({
        message,
        hubId: effectiveBot.hubId,
        spaceId: effectiveBot.spaceId,
        policy
    });
    let systemInstruction = `You are ${webAgentName}, a helpful AI assistant. Be conversational, warm, and accurate.`;
    const score = decision.confidence;
    const level = score >= 0.8 ? 'high' : score >= 0.5 ? 'medium' : 'low';
    const strategy = effectiveBot.confidenceHandling?.[level] || (level === 'low' ? 'clarify' : 'answer');
    if (strategy === 'answer_softly') {
        systemInstruction += "\n\nCRITICAL: Answer cautiously. Use phrases like 'Based on our documentation...' or 'It appears...'. If you aren't certain, offer to connect to a human.";
    }
    if (effectiveBot.behavior?.revealUncertainty && level !== 'high') {
        systemInstruction += "\n\nPOLITE DISCLOSURE: Be open about your level of certainty if the documentation isn't perfectly clear.";
    }
    if (effectiveBot.behavior?.mode === 'sales') {
        systemInstruction += "\n\nSALES POSTURE: Be consultative and focused on value. Move the user towards a meeting or quote.";
    }
    if (effectiveBot.conversationGoal) {
        systemInstruction += `\n\nCONVERSATION GOAL:\n${effectiveBot.conversationGoal}`;
    }
    const result = await (0, agent_response_1.agentResponse)({
        query: message,
        botName: webAgentName,
        context: decision.chosenCandidates.map(c => ({ title: c.title || 'Source', text: c.text, url: c.url })),
        greetingScript: systemInstruction,
    });
    return {
        answer: (result?.answer || '').trim() || (decision.answerMode === 'escalate' ? `I'm not sure, let me connect you to a human.` : ''),
        usedAgentName: webAgentName,
        sources: decision.chosenCandidates
            .filter(c => c.sourceType === 'article')
            .slice(0, 3)
            .map((c) => ({
            articleId: c.id,
            title: c.title || 'Untitled',
            url: c.url || '',
            score: c.score,
        })),
    };
}
async function invokeAgent(args) {
    let { bot, conversation } = args;
    const resolved = bot?.id ? await (0, bot_runtime_1.resolveRuntimeBot)(bot.id) : null;
    const effectiveBot = resolved?.effectiveBot || bot;
    const adapters = {
        retrieveContext: async (params) => {
            return (0, retrieve_context_1.orchestrateRetrieval)({
                ...params,
                policy: {
                    ...params.policy,
                    isCustomerFacing: effectiveBot.type === 'widget'
                }
            });
        },
        generateAnswer: async (params) => {
            const result = await (0, agent_response_1.agentResponse)(params);
            return result.answer;
        },
        escalateToHuman: async ({ conversationId, reason }) => {
            await firebase_admin_1.adminDB.collection('conversations').doc(conversationId).update({
                status: 'waiting_human',
                escalated: true,
                escalationReason: reason,
                state: 'human_assigned',
            });
        },
        persistAssistantMessage: async ({ conversationId, text, responderType, meta, sources }) => {
            const convo = await firebase_admin_1.adminDB.collection('conversations').doc(conversationId).get();
            const convoData = convo.data();
            const messageData = {
                conversationId,
                authorId: 'ai_agent',
                type: 'message',
                senderType: 'agent',
                responderType,
                content: text,
                timestamp: new Date().toISOString(),
                attachments: [],
                sources: sources || null,
                ...(meta || {})
            };
            if (convoData?.channel === 'sms') {
                const msgRef = await firebase_admin_1.adminDB.collection('chat_messages').add({
                    ...messageData,
                    channel: 'sms',
                    provider: 'twilio',
                    deliveryStatus: 'created',
                });
                const provider = (0, providerFactory_1.getMessagingProvider)('twilio');
                try {
                    const { providerMessageId } = await provider.sendSms({
                        from: convoData.channelAddress,
                        to: convoData.externalAddress,
                        body: text,
                    });
                    await msgRef.update({
                        providerMessageId,
                        deliveryStatus: 'queued',
                    });
                    await firebase_admin_1.adminDB.doc(`provider_message_lookups/twilio_${providerMessageId}`).set({
                        messageId: msgRef.id,
                        conversationId,
                    });
                }
                catch (e) {
                    console.error('AI SMS delivery failed', e);
                    await msgRef.update({ deliveryStatus: 'failed' });
                }
            }
            else {
                await firebase_admin_1.adminDB.collection('chat_messages').add(messageData);
            }
        },
        updateConversation: async ({ conversationId, patch }) => {
            await firebase_admin_1.adminDB.collection('conversations').doc(conversationId).update(patch);
        },
    };
    const botConfig = {
        id: effectiveBot.id,
        type: effectiveBot.type || 'widget',
        hubId: effectiveBot.hubId,
        name: effectiveBot.name,
        webAgentName: effectiveBot.webAgentName || effectiveBot.name,
        allowedHelpCenterIds: effectiveBot.allowedHelpCenterIds || [],
        intelligenceAccessLevel: effectiveBot.intelligenceAccessLevel || 'topics_only',
        aiEnabled: effectiveBot.aiEnabled !== false,
        handoffKeywords: effectiveBot.channelConfig?.web?.handoffKeywords ||
            effectiveBot.automations?.handoffKeywords ||
            ['human', 'agent', 'person', 'representative', 'support'],
        flow: effectiveBot.flow,
        conversationGoal: effectiveBot.conversationGoal ||
            effectiveBot.primaryGoal ||
            'Provide information and let customer decide',
        behavior: effectiveBot.behavior,
        confidenceHandling: effectiveBot.confidenceHandling,
        escalation: effectiveBot.escalation,
        identityCapture: effectiveBot.identityCapture,
        channelConfig: effectiveBot.channelConfig,
        tone: effectiveBot.tone,
        responseLength: effectiveBot.responseLength,
    };
    await (0, agent_1.handleIncomingMessage)({
        ...args,
        conversation,
        bot: botConfig,
        adapters,
    });
}
async function addChatMessage(message) {
    const docRef = await firebase_admin_1.adminDB.collection('chat_messages').add(message);
    return { id: docRef.id, ...message };
}
async function updateConversation(id, patch) {
    await firebase_admin_1.adminDB.collection('conversations').doc(id).update(patch);
}
async function createConversationAndLinkCrm(data) {
    const now = new Date().toISOString();
    const hubSnap = await firebase_admin_1.adminDB.collection('hubs').doc(data.hubId).get();
    const spaceId = hubSnap.data()?.spaceId;
    const convoRef = await firebase_admin_1.adminDB.collection('conversations').add({
        hubId: data.hubId,
        spaceId,
        visitorId: data.visitorId,
        assigneeId: data.assigneeId,
        assignedAgentIds: data.assigneeId ? [data.assigneeId] : [],
        status: 'ai_active',
        state: 'ai_active',
        channel: 'webchat',
        lastMessage: data.lastMessage,
        lastMessageAt: now,
        lastMessageAuthor: data.lastMessageAuthor,
        createdAt: now,
        updatedAt: now,
        ownerType: 'hub',
        ownerAgentId: null,
        sharedWithTeam: true,
        aiAttempted: false,
        aiResolved: false,
    });
    return { id: convoRef.id, hubId: data.hubId, spaceId };
}
async function ensureConversationCrmLinkedAction(conversationId) {
    const convoRef = firebase_admin_1.adminDB.collection('conversations').doc(conversationId);
    const convoSnap = await convoRef.get();
    const convo = convoSnap.data();
    if (!convo || convo.contactId)
        return;
    const visitorSnap = await firebase_admin_1.adminDB.collection('visitors').doc(convo.visitorId).get();
    const visitor = visitorSnap.data();
    if (!visitor?.email)
        return;
    const contactQuery = await firebase_admin_1.adminDB.collection('contacts')
        .where('spaceId', '==', convo.spaceId)
        .where('primaryEmail', '==', visitor.email.toLowerCase())
        .limit(1)
        .get();
    if (!contactQuery.empty) {
        await convoRef.update({ contactId: contactQuery.docs[0].id });
    }
}
/**
 * Triggered whenever an article is updated or created to ensure the
 * search index is accurate (Vertex-backed `articles` embeddings).
 */
async function reindexArticleAction(articleId) {
    const articleSnap = await firebase_admin_1.adminDB.collection("help_center_articles").doc(articleId).get();
    if (!articleSnap.exists)
        return;
    const article = { id: articleSnap.id, ...articleSnap.data() };
    const hubDoc = await firebase_admin_1.adminDB.collection("hubs").doc(article.hubId).get();
    const spaceId = hubDoc.data()?.spaceId;
    if (!spaceId)
        return;
    await (0, indexer_1.indexHelpCenterArticleToChunks)({
        adminDB: firebase_admin_1.adminDB,
        article,
        spaceId,
        publicHelpBaseUrl: process.env.PUBLIC_HELP_BASE_URL || "",
    });
}
