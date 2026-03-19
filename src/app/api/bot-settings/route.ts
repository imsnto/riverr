import { NextRequest, NextResponse } from 'next/server';
import { adminDB } from '@/lib/firebase-admin';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-requested-with',
};

export async function OPTIONS() {
  return new NextResponse(null, { 
    status: 204, // No content is standard for OPTIONS
    headers: corsHeaders 
  });
}

/**
 * Runtime Settings Resolver
 * Used by the live Chat Widget to decide branding and behavior.
 * Implements "Theater Architecture": Resolves the Stage (Widget) + Actor (Agent).
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const botId = searchParams.get('botId');

  if (!botId) {
    return NextResponse.json({ error: 'Bot ID is required' }, { status: 400, headers: corsHeaders });
  }

  try {
    const botDoc = await adminDB.collection('bots').doc(botId).get();

    if (!botDoc.exists) {
      return NextResponse.json({ error: 'Bot not found' }, { status: 404, headers: corsHeaders });
    }

    const botData = botDoc.data();
    
    // Default fallback values from the Widget itself
    let resolvedGreeting = botData?.welcomeMessage;
    let webAgentName = botData?.webAgentName || botData?.name || 'Assistant';
    let agentIds = botData?.agentIds || [];
    let identityCapture = botData?.identityCapture;

    // ---- INTELLIGENT AGENT INHERITANCE (The Actor) ----
    // If this is a widget stage and has an assigned AI Actor brain
    if (botData?.type === 'widget' && botData?.assignedAgentId) {
      const aiAgentDoc = await adminDB.collection('bots').doc(botData.assignedAgentId).get();
      if (aiAgentDoc.exists) {
        const aiAgentData = aiAgentDoc.data();
        
        // 1. Inherit Human Team members if the widget has none explicitly set
        if (agentIds.length === 0) {
          agentIds = aiAgentData?.agentIds || [];
        }

        // 2. Resolve Agent Personality & Greeting for Web Channel
        // We look specifically for the agent's web channel instructions
        const webConfig = aiAgentData?.channelConfig?.web;
        if (webConfig?.enabled) {
          const aiName = aiAgentData.webAgentName || aiAgentData.name || 'Assistant';
          const aiBaseGreeting = webConfig.greeting?.text || "How can I help you today?";
          webAgentName = aiName;
          resolvedGreeting = aiBaseGreeting;
          
          // 3. Inherit Lead Capture timing/fields from the Agent actor
          if (aiAgentData.identityCapture) {
            identityCapture = aiAgentData.identityCapture;
          }
        }
      }
    }

    // Resolve public-safe user info for avatars
    let agents: { id: string; name: string; avatarUrl: string }[] = [];
    if (agentIds.length > 0) {
        const userPromises = agentIds.map((id: string) => adminDB.collection('users').doc(id).get());
        const userDocs = await Promise.all(userPromises);
        agents = userDocs
            .filter(doc => doc.exists)
            .map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    name: data?.name || 'Agent',
                    avatarUrl: data?.avatarUrl || '',
                };
            });
    }

    // Explicitly select fields safe for the public web widget
    const safeSettings = {
        id: botId,
        type: botData?.type,
        name: botData?.name,
        webAgentName: webAgentName,
        styleSettings: botData?.styleSettings,
        agents: agents,
        welcomeMessage: resolvedGreeting,
        identityCapture: identityCapture,
        assignedAgentId: botData?.assignedAgentId,
    };

    return NextResponse.json(safeSettings, { headers: corsHeaders});
  } catch (error) {
    console.error('Error fetching bot settings:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500, headers: corsHeaders });
  }
}
