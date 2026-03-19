import * as admin from 'firebase-admin';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { VertexAI } from '@google-cloud/vertexai';
import { distillSupportIntent } from '../../src/ai/flows/distill-support-intent';
import Typesense from 'typesense';

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

const vertexAI = new VertexAI({
  project: process.env.GCLOUD_PROJECT,
  location: 'us-central1',
});

const embeddingModel = vertexAI.getGenerativeModel({
  model: 'embedding-2',
});

const tsClient = new Typesense.Client({
  nodes: [
    {
      host: process.env.TYPESENSE_HOST!,
      port: Number(process.env.TYPESENSE_PORT || 443),
      protocol: process.env.TYPESENSE_PROTOCOL || 'https',
    },
  ],
  apiKey: process.env.TYPESENSE_ADMIN_API_KEY!,
  connectionTimeoutSeconds: 10,
});

const MAX_CHUNK_CHARS = 3500;
const CHUNK_OVERLAP_CHARS = 400;

function chunkConversationTurns(turnLines: string[]): string[] {
  const fullText = turnLines.map((t) => t.trim()).filter(Boolean).join('\n');
  if (!fullText) return [];
  if (fullText.length <= MAX_CHUNK_CHARS) return [fullText];

  const chunks: string[] = [];
  let start = 0;

  while (start < fullText.length) {
    const end = Math.min(start + MAX_CHUNK_CHARS, fullText.length);
    chunks.push(fullText.slice(start, end));
    if (end >= fullText.length) break;
    start = Math.max(0, end - CHUNK_OVERLAP_CHARS);
  }

  return chunks;
}

async function generateQaEmbedding(text: string): Promise<number[] | null> {
  try {
    const result = await embeddingModel.embedContent({
      content: {
        role: 'user',
        parts: [{ text }],
      },
    });

    return result.embedding?.values || null;
  } catch (err) {
    console.error('Vertex embedding error:', err);
    return null;
  }
}

export const processBrainJob = onDocumentCreated('brain_jobs/{jobId}', async (event) => {
  const snap = event.data;
  if (!snap) return;

  const job = snap.data() as any;
  const jobId = event.params.jobId;

  await snap.ref.update({
    status: 'running',
    startedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  try {
    switch (job.type) {
      case 'ingest_conversations': {
        const { spaceId, hubId } = job.params as { spaceId: string; hubId: string };
        if (!spaceId || !hubId) throw new Error('ingest_conversations requires spaceId and hubId');

        const conversationsSnap = await db
          .collection('conversations')
          .where('hubId', '==', hubId)
          .limit(50)
          .get();

        let processed = 0;

        for (const convDoc of conversationsSnap.docs) {
          const conv = convDoc.data() as any;

          const messagesSnap = await db
            .collection('chat_messages')
            .where('conversationId', '==', convDoc.id)
            .get();

          const messages = messagesSnap.docs
            .map((d) => d.data() as any)
            .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

          const lines = messages
            .map((m) => {
              const role =
                m.senderType === 'agent' || m.authorId === 'ai_agent'
                  ? 'Agent'
                  : 'User';
              return `${role}: ${m.content || ''}`.trim();
            })
            .filter(Boolean);

          if (!lines.length) continue;

          const normalizedText = lines.join('\n');
          const lastAgentMessage =
            [...messages].reverse().find((m) => m.senderType === 'agent' || m.authorId === 'ai_agent')?.content || '';

          const rawRef = db.collection('brain_raw_conversations').doc();
          await rawRef.set({
            spaceId,
            hubId,
            conversationId: convDoc.id,
            normalizedText,
            lastAgentMessage,
            messageCount: lines.length,
            processedForChunking: true,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          });

          const chunks = chunkConversationTurns(lines);

          for (let i = 0; i < chunks.length; i++) {
            await db.collection('brain_chunks').add({
              spaceId,
              hubId,
              rawConversationId: rawRef.id,
              conversationId: convDoc.id,
              chunkIndex: i,
              chunkText: chunks[i],
              processedForDistillation: null,
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });
          }

          await convDoc.ref.set(
            {
              brainIngestion: {
                ingestedAt: admin.firestore.FieldValue.serverTimestamp(),
                rawConversationId: rawRef.id,
                chunkCount: chunks.length,
              },
            },
            { merge: true }
          );

          processed += 1;

          await snap.ref.set(
            {
              progress: {
                current: processed,
                total: conversationsSnap.size,
                message: `Ingested ${processed} of ${conversationsSnap.size} conversations`,
              },
            },
            { merge: true }
          );
        }

        break;
      }

      case 'distill_support_intents': {
        const { spaceId } = job.params as { spaceId: string };
        if (!spaceId) throw new Error('distill_support_intents requires spaceId');

        const chunksSnap = await db
          .collection('brain_chunks')
          .where('spaceId', '==', spaceId)
          .where('processedForDistillation', '==', null)
          .limit(20)
          .get();

        let processed = 0;

        for (const chunkDoc of chunksSnap.docs) {
          const chunk = chunkDoc.data() as any;

          const result = await distillSupportIntent({
            conversationText: chunk.chunkText,
            lastAgentMessage: '',
          });

          const qa = result;
          if (!qa?.customerQuestion || !qa?.resolution) {
            await chunkDoc.ref.update({ processedForDistillation: true });
            continue;
          }

          const embeddingText = `Question: ${qa.customerQuestion}\nAnswer: ${qa.resolution}`;
          const embedding = await generateQaEmbedding(embeddingText);

          const qaRef = db.collection('brain_distilled_qas').doc();
          await qaRef.set({
            spaceId,
            hubId: chunk.hubId,
            chunkId: chunkDoc.id,
            rawConversationId: chunk.rawConversationId,
            intentKey: qa.intentKey,
            question: qa.customerQuestion,
            answer: qa.resolution,
            confidence: 0.8,
            requiredContext: qa.requiredContext || [],
            requiresHumanIf: qa.safetyCriteria?.requiresHumanIf || [],
            mustNot: qa.safetyCriteria?.mustNot || [],
            embedding,
            status: 'approved',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          });

          await chunkDoc.ref.update({ processedForDistillation: true });

          processed += 1;

          await snap.ref.set(
            {
              progress: {
                current: processed,
                total: chunksSnap.size,
                message: `Distilled ${processed} of ${chunksSnap.size} chunks`,
              },
            },
            { merge: true }
          );
        }

        break;
      }

      default:
        throw new Error(`Unsupported brain job type: ${job.type}`);
    }

    await snap.ref.update({
      status: 'completed',
      completedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (error: any) {
    console.error('processBrainJob failed:', error);
    await snap.ref.update({
      status: 'failed',
      error: error?.message || 'Unknown error',
      completedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }
});