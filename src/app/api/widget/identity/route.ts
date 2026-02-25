
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

    // 2. Validate Hub/Bot alignment
    const isHubAllowed = !provider.allowedHubIds || provider.allowedHubIds.includes(hubId);
    const isBotAllowed = !provider.allowedBotIds || provider.allowedBotIds.includes(botId);
    
    if (!isHubAllowed || !isBotAllowed) {
      console.error(`[Identity] Unauthorized hub/bot for provider ${providerId}`);
      return NextResponse.json({ error: 'Unauthorized access' }, { status: 403, headers: corsHeaders });
    }

    // 3. SECURE MODE VERIFICATION
    let isVerified = false;
    if (provider.secureModeEnabled && user_id) {
      if (!user_hash) {
        console.warn(`[Identity] Signature missing for user_id ${user_id} (Secure Mode ON)`);
        return NextResponse.json({ status: 'anonymous', message: 'Secure mode required' }, { status: 200, headers: corsHeaders });
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
        console.error(`[Identity] Invalid signature for user_id ${user_id}`);
        return NextResponse.json({ status: 'anonymous', message: 'Invalid signature' }, { status: 200, headers: corsHeaders });
      }
    } else if (!provider.secureModeEnabled) {
      // If secure mode is disabled, we "trust" what's provided if identify by email is allowed
      isVerified = true;
    }

    // 4. Resolve SpaceId from Hub
    const hubSnap = await adminDB.collection('hubs').doc(hubId).get();
    if (!hubSnap.exists) return NextResponse.json({ error: 'Hub not found' }, { status: 404, headers: corsHeaders });
    const spaceId = hubSnap.data()?.spaceId;

    // 5. Upsert Contact
    let contactId = null;
    if (user_id && isVerified) {
      const contactQuery = await adminDB.collection('contacts')
        .where('providerId', '==', providerId)
        .where('externalUserId', '==', user_id)
        .limit(1)
        .get();

      const contactData = {
        spaceId,
        providerId,
        externalUserId: user_id,
        emails: email ? admin.firestore.FieldValue.arrayUnion(email.toLowerCase()) : [],
        primaryEmail: email ? email.toLowerCase() : null,
        name: name || null,
        customAttributes: custom_attributes || {},
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        lastSeenAt: admin.firestore.FieldValue.serverTimestamp(),
        identifiedAt: new Date().toISOString(),
        source: 'chat' as const,
      };

      if (!contactQuery.empty) {
        const doc = contactQuery.docs[0];
        await doc.ref.update(contactData);
        contactId = doc.id;
      } else {
        const newRef = await adminDB.collection('contacts').add({
          ...contactData,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          isMerged: false,
          mergeParentId: null,
          tags: [],
          externalIds: {},
          phones: [],
        });
        contactId = newRef.id;
      }
    } else if (email && provider.allowEmailOnlyIdentify && isVerified) {
      // Fallback: Identify by email if allowed and verified (or non-secure mode)
      const emailLower = email.toLowerCase();
      const contactQuery = await adminDB.collection('contacts')
        .where('spaceId', '==', spaceId)
        .where('primaryEmail', '==', emailLower)
        .limit(1)
        .get();

      const contactData = {
        spaceId,
        providerId,
        emails: admin.firestore.FieldValue.arrayUnion(emailLower),
        primaryEmail: emailLower,
        name: name || null,
        customAttributes: custom_attributes || {},
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        lastSeenAt: admin.firestore.FieldValue.serverTimestamp(),
        source: 'chat' as const,
      };

      if (!contactQuery.empty) {
        const doc = contactQuery.docs[0];
        await doc.ref.update(contactData);
        contactId = doc.id;
      } else {
        const newRef = await adminDB.collection('contacts').add({
          ...contactData,
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
      if (conversationId) {
        await adminDB.collection('conversations').doc(conversationId).update({
          contactId,
          visitorName: name || email || undefined,
          visitorEmail: email || undefined,
          updatedAt: new Date().toISOString()
        });
      } else if (anonymousVisitorId) {
        // Find most recent active conversation for this anonymous visitor
        // status 'in' + orderBy requires a composite index
        const activeConvo = await adminDB.collection('conversations')
          .where('visitorId', '==', anonymousVisitorId)
          .where('hubId', '==', hubId)
          .where('status', 'in', ['open','bot','human','unassigned'])
          .orderBy('lastMessageAt', 'desc') 
          .limit(1)
          .get();

        if (!activeConvo.empty) {
          await activeConvo.docs[0].ref.update({
            contactId,
            visitorName: name || email || undefined,
            visitorEmail: email || undefined,
            updatedAt: new Date().toISOString()
          });
        }
      }
    }

    return NextResponse.json({ contactId, status: contactId ? 'identified' : 'anonymous' }, { status: 200, headers: corsHeaders });
  } catch (error: any) {
    console.error(`[Identity] API Error:`, error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders });
  }
}
