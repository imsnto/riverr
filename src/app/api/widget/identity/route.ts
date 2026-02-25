
import { NextRequest, NextResponse } from 'next/server';
import { adminDB } from '@/lib/firebase-admin';
import admin from 'firebase-admin';
import crypto from 'crypto';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      botId,
      hubId,
      providerId,
      anonymousVisitorId,
      conversationId,
      user_id,
      email,
      name,
      user_hash,
      custom_attributes
    } = body;

    if (!botId || !hubId || !providerId) {
      return NextResponse.json({ error: 'Missing core routing fields' }, { status: 400, headers: corsHeaders });
    }

    // 1. Load Provider Config
    const providerSnap = await adminDB.collection('providers').doc(providerId).get();
    if (!providerSnap.exists) {
      console.warn(`[Identity] Unknown provider: ${providerId}`);
      return NextResponse.json({ error: 'Unknown provider' }, { status: 404, headers: corsHeaders });
    }
    const provider = providerSnap.data() as any;

    // 2. Validate Hub/Bot alignment (Strict)
    const isHubAllowed = !provider.allowedHubIds || provider.allowedHubIds.includes(hubId);
    const isBotAllowed = !provider.allowedBotIds || provider.allowedBotIds.includes(botId);
    
    if (!isHubAllowed || !isBotAllowed) {
      console.error(`[Identity] Unauthorized hub/bot access for provider ${providerId}`);
      return NextResponse.json({ error: 'Unauthorized access' }, { status: 403, headers: corsHeaders });
    }

    // 3. Secure Mode Verification
    let isVerified = false;
    if (provider.secureModeEnabled && user_id) {
      if (!user_hash) {
        console.warn(`[Identity] user_hash missing for user_id ${user_id} (Secure Mode ON)`);
        return NextResponse.json({ status: 'anonymous' }, { status: 200, headers: corsHeaders });
      }

      const expectedHash = crypto
        .createHmac('sha256', provider.secureModeSecret)
        .update(user_id)
        .digest('hex');

      try {
        isVerified = crypto.timingSafeEqual(
          Buffer.from(expectedHash, 'hex'),
          Buffer.from(user_hash, 'hex')
        );
      } catch (e) {
        isVerified = false;
      }

      if (!isVerified) {
        console.error(`[Identity] Invalid HMAC signature for user_id ${user_id}`);
        return NextResponse.json({ status: 'anonymous' }, { status: 200, headers: corsHeaders });
      }
    } else if (!provider.secureModeEnabled) {
      isVerified = true;
    }

    // 4. Resolve Workspace context
    const hubSnap = await adminDB.collection('hubs').doc(hubId).get();
    if (!hubSnap.exists) return NextResponse.json({ error: 'Hub not found' }, { status: 404, headers: corsHeaders });
    const spaceId = hubSnap.data()?.spaceId;

    // 5. Upsert Contact
    let contactId = null;
    const emailLower = email?.toLowerCase();

    // Strategy A: Identify by external user_id (Strongest)
    if (user_id && isVerified) {
      const contactQuery = await adminDB.collection('contacts')
        .where('providerId', '==', providerId)
        .where('externalUserId', '==', user_id)
        .limit(1)
        .get();

      const baseData = {
        spaceId,
        providerId,
        externalUserId: user_id,
        primaryEmail: emailLower || null,
        name: name || null,
        customAttributes: custom_attributes || {},
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        lastSeenAt: admin.firestore.FieldValue.serverTimestamp(),
        source: 'chat' as const,
      };

      if (!contactQuery.empty) {
        const doc = contactQuery.docs[0];
        const updatePayload: any = { ...baseData };
        if (emailLower) {
            updatePayload.emails = admin.firestore.FieldValue.arrayUnion(emailLower);
        }
        await doc.ref.update(updatePayload);
        contactId = doc.id;
      } else {
        const newRef = await adminDB.collection('contacts').add({
          ...baseData,
          emails: emailLower ? [emailLower] : [],
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          isMerged: false,
          mergeParentId: null,
          tags: [],
          externalIds: {},
          phones: [],
        });
        contactId = newRef.id;
      }
    } 
    // Strategy B: Identify by email (Only if Secure Mode is OFF)
    else if (emailLower && provider.allowEmailOnlyIdentify && !provider.secureModeEnabled) {
      const contactQuery = await adminDB.collection('contacts')
        .where('spaceId', '==', spaceId)
        .where('primaryEmail', '==', emailLower)
        .limit(1)
        .get();

      const baseData = {
        spaceId,
        providerId,
        primaryEmail: emailLower,
        name: name || null,
        customAttributes: custom_attributes || {},
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        lastSeenAt: admin.firestore.FieldValue.serverTimestamp(),
        source: 'chat' as const,
      };

      if (!contactQuery.empty) {
        const doc = contactQuery.docs[0];
        const updatePayload: any = { ...baseData };
        updatePayload.emails = admin.firestore.FieldValue.arrayUnion(emailLower);
        await doc.ref.update(updatePayload);
        contactId = doc.id;
      } else {
        const newRef = await adminDB.collection('contacts').add({
          ...baseData,
          emails: [emailLower],
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          isMerged: false,
          mergeParentId: null,
          tags: [],
          externalIds: {},
          phones: [],
        });
        contactId = newRef.id;
      }
    }

    // 6. Link to Conversation
    if (contactId) {
      const updateData = {
        contactId,
        visitorName: name || emailLower || undefined,
        visitorEmail: emailLower || undefined,
        updatedAt: new Date().toISOString()
      };

      if (conversationId) {
        await adminDB.collection('conversations').doc(conversationId).update(updateData);
      } else if (anonymousVisitorId) {
        // Link identity to the most recent active session for this visitor
        const activeConvo = await adminDB.collection('conversations')
          .where('visitorId', '==', anonymousVisitorId)
          .where('hubId', '==', hubId)
          .where('status', 'in', ['open','bot','human','unassigned'])
          .orderBy('lastMessageAt', 'desc') 
          .limit(1)
          .get();

        if (!activeConvo.empty) {
          await activeConvo.docs[0].ref.update(updateData);
        }
      }
    }

    return NextResponse.json({ contactId, status: contactId ? 'identified' : 'anonymous' }, { status: 200, headers: corsHeaders });
  } catch (error: any) {
    console.error(`[Identity] API Error:`, error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders });
  }
}
