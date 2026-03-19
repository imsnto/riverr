import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import Typesense from 'typesense';

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

export const syncDistilledQaToTypesense = onDocumentWritten(
  'brain_distilled_qas/{qaId}',
  async (event) => {
    const qaId = event.params.qaId as string;
    const before = event.data?.before;
    const after = event.data?.after;

    try {
      if (!after?.exists) {
        await tsClient.collections('memory_nodes').documents(qaId).delete();
        return;
      }

      const qa = after.data() as any;

      if (qa.status !== 'approved') {
        const prev = before?.exists ? (before.data() as any) : null;
        if (prev?.status === 'approved') {
          await tsClient.collections('memory_nodes').documents(qaId).delete();
        }
        return;
      }

      await tsClient.collections('memory_nodes').documents().upsert({
        id: qaId,
        type: 'support_intent',
        sourceId: qaId,
        spaceId: qa.spaceId,
        hubId: qa.hubId,
        title: qa.question,
        text: qa.answer,
        textForEmbedding: `Question: ${qa.question}\nAnswer: ${qa.answer}`,
        status: 'approved',
      });
    } catch (err) {
      console.error('syncDistilledQaToTypesense error:', err);
      throw err;
    }
  }
);