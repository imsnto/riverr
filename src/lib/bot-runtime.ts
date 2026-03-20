import { adminDB } from '@/lib/firebase-admin';
import type { Bot } from '@/lib/data';

export type ResolvedRuntimeBot = {
  widget: Bot | null;
  actor: Bot | null;
  effectiveBot: Bot;
  webAgentName: string;
  resolvedGreeting: string;
  resolvedIdentityCapture: Bot['identityCapture'] | undefined;
  allowedHelpCenterIds: string[];
  humanAgentIds: string[];
};

function normalizeIdentityCaptureFromAgent(agent?: Bot | null): Bot['identityCapture'] | undefined {
  if (!agent) return undefined;

  if (agent.identityCapture) {
    return agent.identityCapture;
  }

  const capture = agent.channelConfig?.web?.capture;
  if (!capture) return undefined;

  return {
    enabled: true,
    required: false,
    timing: capture.timing || 'after',
    fields: {
      name: !!capture.fields?.name,
      email: !!capture.fields?.email,
      phone: !!capture.fields?.phone,
    },
  };
}

function getAgentWebGreeting(agent?: Bot | null): string | undefined {
  if (!agent) return undefined;
  return (
    agent.channelConfig?.web?.greeting?.text ||
    agent.welcomeMessage ||
    undefined
  );
}

function getAgentName(agent?: Bot | null): string {
  return agent?.webAgentName || agent?.name || 'Assistant';
}

function mergeStageAndActor(widget: Bot, actor?: Bot | null): ResolvedRuntimeBot {
  const resolvedGreeting =
    getAgentWebGreeting(actor) ||
    widget.welcomeMessage ||
    'Hi! How can I help you today?';

  const resolvedIdentityCapture =
    normalizeIdentityCaptureFromAgent(actor) ||
    widget.identityCapture;

  const humanAgentIds =
    widget.agentIds?.length
      ? widget.agentIds
      : actor?.agentIds || [];

  const allowedHelpCenterIds =
    actor?.allowedHelpCenterIds || [];

  // THE ACTOR (AGENT) HUB AND KNOWLEDGE IS WHAT MATTERS FOR GROUNDING
  const effectiveBot: Bot = {
    ...widget,
    ...(actor || {}),
    hubId: actor?.hubId || widget.hubId, // CRITICAL: Use actor's hub for retrieval
    type: actor?.type || widget.type,
    assignedAgentId: widget.assignedAgentId || null,
    styleSettings: widget.styleSettings,
    agentIds: humanAgentIds,
    allowedHelpCenterIds,
    welcomeMessage: resolvedGreeting,
    identityCapture: resolvedIdentityCapture,
    webAgentName: getAgentName(actor || widget),
  };

  return {
    widget,
    actor: actor || null,
    effectiveBot,
    webAgentName: getAgentName(actor || widget),
    resolvedGreeting,
    resolvedIdentityCapture,
    allowedHelpCenterIds,
    humanAgentIds,
  };
}

export async function resolveRuntimeBot(botId: string): Promise<ResolvedRuntimeBot | null> {
  const botDoc = await adminDB.collection('bots').doc(botId).get();
  if (!botDoc.exists) return null;

  const bot = { id: botDoc.id, ...botDoc.data() } as Bot;

  if (bot.type === 'agent') {
    const identityCapture = normalizeIdentityCaptureFromAgent(bot);

    return {
      widget: null,
      actor: bot,
      effectiveBot: {
        ...bot,
        identityCapture: identityCapture || bot.identityCapture,
        allowedHelpCenterIds: bot.allowedHelpCenterIds || [],
        webAgentName: getAgentName(bot),
        welcomeMessage: getAgentWebGreeting(bot) || bot.welcomeMessage || 'Hi! How can I help you today?',
      },
      webAgentName: getAgentName(bot),
      resolvedGreeting: getAgentWebGreeting(bot) || bot.welcomeMessage || 'Hi! How can I help you today?',
      resolvedIdentityCapture: identityCapture || bot.identityCapture,
      allowedHelpCenterIds: bot.allowedHelpCenterIds || [],
      humanAgentIds: bot.agentIds || [],
    };
  }

  if (bot.type === 'widget' && bot.assignedAgentId) {
    const actorDoc = await adminDB.collection('bots').doc(bot.assignedAgentId).get();
    const actor = actorDoc.exists
      ? ({ id: actorDoc.id, ...actorDoc.data() } as Bot)
      : null;

    return mergeStageAndActor(bot, actor);
  }

  return mergeStageAndActor(bot, null);
}
