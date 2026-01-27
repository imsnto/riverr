
import { NextRequest, NextResponse } from 'next/server';
import { adminDB } from '@/lib/firebase-admin';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const botId = searchParams.get('botId');

  if (!botId) {
    return NextResponse.json({ error: 'Bot ID is required' }, { status: 400 });
  }

  try {
    const botDoc = await adminDB.collection('bots').doc(botId).get();

    if (!botDoc.exists) {
      return NextResponse.json({ error: 'Bot not found' }, { status: 404 });
    }

    const botData = botDoc.data();
    // Only return public-safe settings
    const safeSettings = {
        name: botData?.name,
        styleSettings: botData?.styleSettings
    };

    return NextResponse.json(safeSettings);
  } catch (error) {
    console.error('Error fetching bot settings:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
