import { adminDB } from '../src/lib/firebase-admin';

async function migrateArticlesToVertex() {
  console.log('[Migration] Starting legacy articles migration to Vertex AI...');

  try {
    const articlesSnap = await adminDB.collection('articles').get();
    
    if (articlesSnap.empty) {
      console.log('[Migration] No articles found. Exiting.');
      return;
    }

    console.log(`[Migration] Found ${articlesSnap.size} articles.`);
    
    let count = 0;
    const batch = adminDB.batch();
    
    // Process in batches
    for (const doc of articlesSnap.docs) {
      const data = doc.data();
      
      // Skip if already ready for v2
      if (data.embeddingStatus === 'ready' && data.embeddingVersion === 'v2') {
        continue;
      }
      
      batch.update(doc.ref, {
        embeddingStatus: 'pending',
        embeddingVersion: 'v2', // Marker for the new system
        embeddingModel: 'text-embedding-004',
        updatedAt: new Date().toISOString()
      });
      
      count++;
      
      // Firestore batch limit is 500
      if (count % 400 === 0) {
        await batch.commit();
        console.log(`[Migration] Committed batch of 400 articles. (${count}/${articlesSnap.size})`);
      }
    }
    
    if (count % 400 !== 0) {
      await batch.commit();
      console.log(`[Migration] Committed final batch. (${count}/${articlesSnap.size})`);
    }

    console.log(`[Migration] Successfully marked ${count} articles for Vertex AI re-embedding.`);
    console.log('[Migration] The Cloud Functions (once deployed) will automatically process them.');

  } catch (err) {
    console.error('[Migration] Failed to migrate articles:', err);
  }
}

migrateArticlesToVertex()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
