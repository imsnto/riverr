import type { SourceAdapter, NormalizedThread, RawItem } from '@/lib/brain/types';

export interface GmailFetchParams {
  userId: string;
  maxResults?: number;
}

export interface RawGmailMessage extends RawItem {
  threadId: string;
  subject?: string;
  from?: string;
  to?: string;
  date?: string;
  body?: string;
}

export class GmailAdapter implements SourceAdapter<GmailFetchParams, RawGmailMessage, NormalizedThread> {
  async fetchBatch(params: GmailFetchParams): Promise<RawGmailMessage[]> {
    // Skeleton implementation
    return [];
  }

  normalize(rawItem: RawGmailMessage): NormalizedThread {
    return {
      id: rawItem.threadId,
      participants: [],
      messages: [
        {
          id: rawItem.id,
          from: { email: rawItem.from || 'unknown@example.com' },
          at: rawItem.date ? new Date(rawItem.date) : new Date(),
          text: rawItem.body || '',
        },
      ],
    };
  }

  toRawNode(normalizedThread: NormalizedThread) {
    return {
      type: 'raw_conversation',
      sourceType: 'gmail',
      channel: 'support',
      participants: normalizedThread.participants,
      messages: normalizedThread.messages.map((m) => ({
        at: m.at.toISOString(),
        fromRole: 'customer',
        text: m.text,
      })),
    };
  }
}