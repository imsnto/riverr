import { NextRequest, NextResponse } from 'next/server';
import { adminDB } from '@/lib/firebase-admin';
import { resolveRuntimeBot } from '@/lib/bot-runtime';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-requested-with',
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  });
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const botId = searchParams.get('botId');

  if (!botId) {
    return NextResponse.json(
      { error: 'Bot ID is required' },
      { status: 400, headers: corsHeaders }
    );
  }

  try {
    const resolved = await resolveRuntimeBot(botId);

    if (!resolved) {
      return NextResponse.json(
        { error: 'Bot not found' },
        { status: 404, headers: corsHeaders }
      );
    }

    const {
      widget,
      effectiveBot,
      webAgentName,
      resolvedGreeting,
      resolvedIdentityCapture,
      humanAgentIds,
    } = resolved;

    let agents: { id: string; name: string; avatarUrl: string }[] = [];
    if (humanAgentIds.length > 0) {
      const userPromises = humanAgentIds.map((id: string) =>
        adminDB.collection('users').doc(id).get()
      );
      const userDocs = await Promise.all(userPromises);

      agents = userDocs
        .filter((doc) => doc.exists)
        .map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            name: data?.name || 'Agent',
            avatarUrl: data?.avatarUrl || '',
          };
        });
    }

    const safeSettings = {
      id: widget?.id || effectiveBot.id,
      type: widget?.type || effectiveBot.type,
      name: widget?.name || effectiveBot.name,
      webAgentName,
      styleSettings: widget?.styleSettings || effectiveBot.styleSettings,
      agents,
      welcomeMessage: resolvedGreeting,
      identityCapture: resolvedIdentityCapture,
      assignedAgentId: widget?.assignedAgentId || null,
      // CRITICAL: AI configuration fields needed for response generation
      aiEnabled: effectiveBot.aiEnabled,
      flow: effectiveBot.flow,
      behavior: effectiveBot.behavior,
      confidenceHandling: effectiveBot.confidenceHandling,
      escalation: effectiveBot.escalation,
      channelConfig: effectiveBot.channelConfig,
      tone: effectiveBot.tone,
      responseLength: effectiveBot.responseLength,
      intelligenceAccessLevel: effectiveBot.intelligenceAccessLevel,
      allowedHelpCenterIds: effectiveBot.allowedHelpCenterIds,
      agentIds: effectiveBot.agentIds,
      hubId: effectiveBot.hubId,
    };

    return NextResponse.json(safeSettings, { headers: corsHeaders });
  } catch (error) {
    console.error('Error fetching bot settings:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500, headers: corsHeaders }
    );
  }
}
