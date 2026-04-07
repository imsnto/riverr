/**
 * Test script: writes a dummy insight + brain_job to Firestore.
 * Run from functions/ directory: node test-insight-write.js
 *
 * Uses Application Default Credentials (gcloud auth application-default login)
 * or GOOGLE_APPLICATION_CREDENTIALS env var.
 */
const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp({ projectId: 'timeflow-6i3eo' });
}
const db = admin.firestore();

async function main() {
  const now = new Date().toISOString();

  const insightRef = db.collection('insights').doc();
  const insightData = {
    spaceId: 'TEST_SPACE',
    hubId: 'TEST_HUB',
    topicId: null,
    title: '[TEST] Firestore write test',
    summary: 'This is a test insight to verify Firestore writes work.',
    content: 'Issue: Test\nResolution: Verified write works',
    kind: 'support_resolution',
    source: {
      type: 'conversation_message',
      conversationId: 'TEST_CONVO',
      messageId: 'TEST_MSG',
      channel: 'webchat',
      provider: null,
      label: null,
    },
    author: { userId: null, name: 'Test' },
    issueLabel: 'test-issue',
    resolutionLabel: 'test-resolution',
    signalScore: 0.9,
    signalLevel: 'high',
    processingStatus: 'pending',
    groupingStatus: 'ungrouped',
    visibility: 'private',
    origin: 'automatic',
    embeddingStatus: 'pending',
    embeddingModel: null,
    embeddingVersion: null,
    vectorDocId: null,
    embeddingUpdatedAt: null,
    createdAt: now,
    updatedAt: now,
    ingestedAt: now,
  };

  await insightRef.set(insightData);
  console.log('✅ Insight created:', insightRef.id);

  const jobRef = await db.collection('brain_jobs').add({
    type: 'process_vector_indexing',
    status: 'pending',
    params: {
      sourceType: 'insight',
      sourceId: insightRef.id,
      spaceId: 'TEST_SPACE',
      text: insightData.content,
    },
    createdAt: now,
  });
  console.log('✅ Brain job created:', jobRef.id);

  console.log('\nDone! Check Firestore console for:');
  console.log('  - insights/' + insightRef.id);
  console.log('  - brain_jobs/' + jobRef.id);
  process.exit(0);
}

main().catch(err => {
  console.error('❌ Error:', err.message || err);
  process.exit(1);
});
