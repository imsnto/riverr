import * as admin from 'firebase-admin';
import { MatchServiceClient } from '@google-cloud/aiplatform';

// Required env vars mapping to standard Vertex AI spec
const PROJECT = process.env.GOOGLE_CLOUD_PROJECT || 'timeflow-6i3eo';
const LOCATION = process.env.VERTEX_API_LOCATION || 'us-central1';
const INDEX_ID = process.env.VERTEX_AI_INDEX_ID || '';
const ENDPOINT_ID = process.env.VERTEX_AI_INDEX_ENDPOINT_ID || '';
const DEPLOYED_INDEX_ID = process.env.VERTEX_AI_DEPLOYED_INDEX_ID || 'manowar_v2_deployed';
const PUBLIC_ENDPOINT_DOMAIN = process.env.VERTEX_AI_PUBLIC_ENDPOINT_DOMAIN || 'us-central1-aiplatform.googleapis.com';

const INDEX_ENDPOINT_RESOURCE_NAME = ENDPOINT_ID
  ? `projects/${PROJECT}/locations/${LOCATION}/indexEndpoints/${ENDPOINT_ID}`
  : '';

const db = admin.firestore();

// Only cluster Insights into Topics if they share similarity above 0.82 (Client spec requirement)
const TOPIC_SIMILARITY_THRESHOLD = 0.82;
// Minimum Insights required to form a new pattern Topic
const MIN_INSIGHTS_FOR_TOPIC = 2; 

const matchClient = new MatchServiceClient({
  apiEndpoint: PUBLIC_ENDPOINT_DOMAIN,
});

/**
 * Finds unguored insights, queries Vertex AI for similar insights,
 * and if 3+ share > 0.82 similarity, groups them into a new Topic.
 */
export async function groupInsightsIntoTopics(spaceId: string) {
  console.log(`[TopicGrouper] Scanning for un-grouped insights in space ${spaceId}...`);

  try {
    // 1. Fetch eligible ungrouped Insights
    const ungroupedSnap = await db.collection('insights')
      .where('spaceId', '==', spaceId)
      // Only check established, verified insights
      .where('status', '==', 'verified')
      .where('groupingStatus', '==', 'ungrouped')
      .where('embeddingStatus', '==', 'ready')
      .limit(50) // Process in chunks
      .get();

    if (ungroupedSnap.empty) {
      console.log('[TopicGrouper] No eligible ungrouped insights found.');
      return;
    }

    console.log(`[TopicGrouper] Found ${ungroupedSnap.size} insights to check for clustering.`);

    if (!INDEX_ENDPOINT_RESOURCE_NAME) {
      console.warn('[TopicGrouper] Missing Vertex Endpoint. Cannot cluster today.');
      return;
    }

    for (const doc of ungroupedSnap.docs) {
      const insight = doc.data();
      const vectorDocId = insight.vectorDocId; // e.g. "insight:123"

      if (!vectorDocId) continue;

      // 2. Query Vertex AI for neighbors to this specific Insight
      const [response] = await matchClient.findNeighbors({
        indexEndpoint: INDEX_ENDPOINT_RESOURCE_NAME,
        deployedIndexId: DEPLOYED_INDEX_ID,
        queries: [
          {
            datapoint: { datapointId: vectorDocId },
            neighborCount: 15,
            // @ts-ignore
            restricts: [
              { name: 'spaceId', allowTokens: [spaceId] },
              { name: 'sourceType', allowTokens: ['insight'] }
            ]
          }
        ]
      }) as unknown as [any, any, any];

      const nearest = response.nearestNeighbors?.[0]?.neighbors ?? [];
      
      // Filter neighbors by the strict 0.82 threshold
      const similarNeighbors = nearest.filter((n: any) => {
         const distance = n.distance as number;
         // In Vertex COSINE_DISTANCE, distance 0 is identical, higher is further
         // Convert to similarity score (1 - distance) assuming normalized vectors
         const similarity = 1 - distance; 
         return similarity >= TOPIC_SIMILARITY_THRESHOLD;
      });

      // Include self in the cluster count 
      // (Vertex sometimes returns the query datapoint, sometimes doesn't if query by ID depending on indexing lag)
      const isSelfIncluded = similarNeighbors.some((n: any) => n.datapoint.datapointId === vectorDocId);
      const clusterSize = similarNeighbors.length + (isSelfIncluded ? 0 : 1);

      if (clusterSize >= MIN_INSIGHTS_FOR_TOPIC) {
        // 3. We have a pattern! Create a Topic.
        console.log(`[TopicGrouper] Pattern detected! Core Insight ${doc.id} mapped to ${clusterSize} similar items.`);
        
        // Extract firestore IDs from vectorDocIds (e.g. "insight:abc" -> "abc")
        const clusterInsightIds = similarNeighbors.map((n: any) => n.datapoint.datapointId.split(':')[1]);
        if (!isSelfIncluded) clusterInsightIds.push(doc.id);

        await createTopicFromCluster(
          spaceId,
          insight.hubId ?? null,
          clusterInsightIds,
          insight.title,
          clusterSize
        );
      } else {
        // No strong cluster found yet. We leave it 'ungrouped' to check again later 
        // as more data arrives, or eventually mark it 'ignored' if it ages out.
      }
    }

  } catch (err) {
    console.error(`[TopicGrouper] Error grouping insights:`, err);
  }
}

async function createTopicFromCluster(
  spaceId: string,
  hubId: string | null,
  insightIds: string[],
  baseTitle: string,
  count: number
) {
  const batch = db.batch();
  
  const topicRef = db.collection('topics').doc();
  const now = new Date().toISOString();
  
  // Topic metadata
  batch.set(topicRef, {
    id: topicRef.id,
    spaceId,
    hubId,
    title: `Common Issue: ${baseTitle}`, // Auto-titling pattern
    insightCount: count,
    signalLevel: count >= 10 ? 'high' : count >= 5 ? 'medium' : 'low',
    embeddingStatus: 'pending', // Triggers Vertex queue function to embed it
    createdAt: now,
    updatedAt: now
  });

  // Stamp all member insights as grouped
  for (const id of insightIds) {
    batch.update(db.collection('insights').doc(id), {
      topicId: topicRef.id,
      groupingStatus: 'grouped',
      updatedAt: now
    });
  }

  await batch.commit();
  console.log(`[TopicGrouper] Created Topic ${topicRef.id} grouping ${count} insights.`);
}
