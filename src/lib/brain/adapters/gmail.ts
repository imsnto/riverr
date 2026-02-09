
import { SourceAdapter, RawItem, NormalizedThread } from '@/lib/brain/types';
import { RawConversationNode } from '@/lib/data';

// --- Helper Functions for Normalization ---

// Basic email address parser
function parseEmailAddress(raw: string): { email: string; name: string } {
    const match = raw.match(/(?:^|")([^"]+)(?:$|"|)\s*<(.+?)>/);
    if (match) {
        return { name: match[1].trim(), email: match[2].trim().toLowerCase() };
    }
    const emailOnlyMatch = raw.match(/<(.+?)>/);
    if (emailOnlyMatch) {
        return { name: emailOnlyMatch[1].split('@')[0], email: emailOnlyMatch[1].trim().toLowerCase() };
    }
    return { name: raw.split('@')[0], email: raw.trim().toLowerCase() };
}

// Strips common email reply quotes and signatures
function cleanEmailBody(text: string): string {
    const lines = text.split('\n');
    const resultLines: string[] = [];
    const stopPatterns = [
        /^On.*wrote:$/, // "On Wed, Oct 1, 2023, at 10:00 AM, Customer wrote:"
        /^>/,           // > quoted text
        /^--\s*$/,       // Signature separator
        /^\s*Best regards/i,
        /^\s*Sincerely/i,
        /^\s*Thanks/i,
    ];

    for (const line of lines) {
        if (stopPatterns.some(pattern => pattern.test(line))) {
            break;
        }
        resultLines.push(line);
    }
    return resultLines.join('\n').trim();
}


// --- Adapter Implementation ---

interface GmailFetchParams {
  query: string;
  maxResults?: number;
  pageToken?: string;
}

type RawGmailMessage = RawItem;

const mockGmailThread: RawGmailMessage[] = [
    {
        id: 'msg-1',
        threadId: 'thread-abc',
        payload: {
            headers: [
                { name: 'From', value: 'Customer <customer@example.com>' },
                { name: 'To', value: 'support@yourcompany.com' },
                { name: 'Date', value: new Date('2023-10-01T10:00:00Z').toUTCString() },
            ],
            body: { data: Buffer.from("Hi, I'm having trouble with feature X. It's not working as expected.").toString('base64') },
        },
    },
    {
        id: 'msg-2',
        threadId: 'thread-abc',
        payload: {
            headers: [
                { name: 'From', value: 'Agent Alice <alice@yourcompany.com>' },
                { name: 'To', value: 'customer@example.com' },
                { name: 'Date', value: new Date('2023-10-01T10:05:00Z').toUTCString() },
            ],
            body: { data: Buffer.from("Hi Customer,\n\nI'm sorry to hear that. Can you tell me more about what's happening?\n\n> On Oct 1, 2023, at 10:00 AM, Customer wrote:\n> Hi, I'm having trouble with feature X.").toString('base64') },
        },
    },
     {
        id: 'msg-3',
        threadId: 'thread-abc',
        payload: {
            headers: [
                { name: 'From', value: 'Customer <customer@example.com>' },
                { name: 'To', value: 'alice@yourcompany.com' },
                { name: 'Date', value: new Date('2023-10-01T10:10:00Z').toUTCString() },
            ],
            body: { data: Buffer.from("It just shows an error page. That's all.").toString('base64') },
        },
    }
];

class GmailAdapter implements SourceAdapter<GmailFetchParams, RawGmailMessage[], NormalizedThread> {
  
  async fetchBatch(params: GmailFetchParams): Promise<RawGmailMessage[][]> {
    console.log('Fetching batch from Gmail with params:', params);
    return [mockGmailThread];
  }

  normalize(rawThread: RawGmailMessage[]): NormalizedThread {
    if (!rawThread || rawThread.length === 0) {
        throw new Error("Cannot normalize empty or invalid raw thread.");
    }
    
    const internalDomains = ['yourcompany.com']; // In a real app, this would be configurable

    const allParticipants = new Map<string, { email: string; name: string; role: 'customer' | 'agent' | 'internal' }>();
    
    const messages = rawThread.map(rawMsg => {
        const headers = new Map(rawMsg.payload.headers.map((h: any) => [h.name.toLowerCase(), h.value]));
        const from = parseEmailAddress(headers.get('from') || '');
        const date = new Date(headers.get('date') || Date.now());
        
        const bodyBase64 = rawMsg.payload.body.data || '';
        const bodyText = Buffer.from(bodyBase64, 'base64').toString('utf-8');
        const cleanedText = cleanEmailBody(bodyText);

        // Update participants map
        if (!allParticipants.has(from.email)) {
            const isInternal = internalDomains.some(domain => from.email.endsWith(domain));
            allParticipants.set(from.email, {
                ...from,
                role: isInternal ? 'agent' : 'customer'
            });
        }
        
        return {
            id: rawMsg.id,
            from: from,
            at: date,
            text: cleanedText,
            meta: { originalHeaders: headers }
        };
    }).sort((a, b) => a.at.getTime() - b.at.getTime());


    return {
      id: rawThread[0].threadId,
      sourceUrl: `https://mail.google.com/mail/u/0/#inbox/${rawThread[0].threadId}`,
      participants: Array.from(allParticipants.values()),
      messages: messages,
    };
  }

  toRawNode(normalizedThread: NormalizedThread): RawConversationNode {
    console.log('Converting normalized thread to RawConversationNode:', normalizedThread);

    const now = new Date().toISOString();
    const cleanedText = normalizedThread.messages.map(m => `${m.from.name}: ${m.text}`).join('\n\n');
    const agentMessages = normalizedThread.messages.filter(m => {
        const participant = normalizedThread.participants.find(p => p.email === m.from.email);
        return participant?.role === 'agent';
    });
    const lastAgentOrRepMessage = agentMessages.length > 0 ? agentMessages[agentMessages.length - 1].text : undefined;
    
    return {
      id: '',
      spaceId: '',
      hubId: '',
      type: 'raw_conversation',
      sourceType: 'gmail',
      channel: 'support',
      participants: normalizedThread.participants.map(p => ({
          email: p.email,
          name: p.name,
          role: p.role,
      })),
      startedAt: normalizedThread.messages[0]?.at.toISOString() || now,
      lastAt: normalizedThread.messages[normalizedThread.messages.length - 1]?.at.toISOString() || now,
      messages: normalizedThread.messages.map(m => {
          const fromParticipant = normalizedThread.participants.find(p => p.email === m.from.email);
          return {
              at: m.at.toISOString(),
              fromRole: fromParticipant?.role || 'customer',
              text: m.text,
          }
      }),
      outcome: {},
      visibility: 'internal_only',
      sources: [{ sourceType: 'gmail', sourceId: normalizedThread.id, sourceUrl: normalizedThread.sourceUrl }],
      normalized: { 
          cleanedText,
          lastAgentOrRepMessage
       },
      textForEmbedding: cleanedText,
    };
  }
}

export const gmailAdapter = new GmailAdapter();
