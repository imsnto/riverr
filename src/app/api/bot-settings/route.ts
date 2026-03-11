
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
    
    // Resolve Greeting and Personality Logic
    let resolvedGreeting = botData?.welcomeMessage;
    let webAgentName = botData?.webAgentName || botData?.name || 'Assistant';
    let agentIds = botData?.agentIds || [];

    // If this is a widget, check for assigned AI Agent to inherit persona and human team
    if (botData?.type === 'widget' && botData?.assignedAgentId) {
      const aiAgentDoc = await adminDB.collection('bots').doc(botData.assignedAgentId).get();
      if (aiAgentDoc.exists) {
        const aiAgentData = aiAgentDoc.data();
        
        // Inherit human team members from the Agent if widget has none
        if (agentIds.length === 0) {
          agentIds = aiAgentData?.agentIds || [];
        }

        const webConfig = aiAgentData?.workflowConfig?.web;
        if (webConfig) {
          const aiName = webConfig.webAgentName || aiAgentData.name || 'Assistant';
          const aiBaseGreeting = webConfig.welcomeMessage || "How can I help you today?";
          webAgentName = aiName;
          resolvedGreeting = `Hi, I'm ${aiName}. ${aiBaseGreeting}`;
        }
      }
    }

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

    // Only return public-safe settings
    const safeSettings = {
        name: botData?.name,
        webAgentName: webAgentName,
        styleSettings: botData?.styleSettings,
        agents: agents,
        welcomeMessage: resolvedGreeting,
        identityCapture: botData?.identityCapture,
        assignedAgentId: botData?.assignedAgentId,
    };

    return NextResponse.json(safeSettings, { headers: corsHeaders});
  } catch (error) {
    console.error('Error fetching bot settings:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500, headers: corsHeaders });
  }
}
