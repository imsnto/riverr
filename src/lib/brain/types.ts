
import { RawConversationNode, RawInteractionNode } from '@/lib/data';

/**
 * A generic representation of a raw item fetched from a source API (e.g., a Gmail message object).
 */
export type RawItem = any;

/**
 * A common, intermediate representation of a conversation thread before it's
 * converted into a RawConversationNode.
 */
export interface NormalizedThread {
  id: string; // Source-specific thread ID
  sourceUrl?: string;
  participants: {
    email: string;
    name?: string;
    role: 'customer' | 'agent' | 'rep' | 'internal';
  }[];
  messages: {
    id: string; // Source-specific message ID
    from: { email: string; name?: string };
    at: Date;
    text: string;
    meta?: Record<string, any>;
  }[];
}

/**
 * Defines the contract for a source adapter, responsible for fetching,
 * normalizing, and converting data from a specific source into canonical
 * Raw MemoryNodes for the Business Brain.
 */
export interface SourceAdapter<TParams, TRawItem extends RawItem, TNormalizedItem> {
  /**
   * Fetches a batch of raw data items from the source API.
   * @param params - Source-specific parameters for the fetch operation.
   * @returns A promise that resolves to an array of raw items.
   */
  fetchBatch(params: TParams): Promise<TRawItem[]>;

  /**
   * Normalizes a single raw item from the source into a common intermediate format.
   * This step is for cleaning, structuring, and preparing the data before it becomes a MemoryNode.
   * @param rawItem - The raw data item from the source.
   * @returns The normalized item.
   */
  normalize(rawItem: TRawItem): TNormalizedItem;
  
  /**
   * Converts the normalized item into a canonical RawConversationNode or RawInteractionNode.
   * This is the final step before the data is stored in the memory layer.
   * @param normalizedItem - The common, intermediate representation of the data.
   * @returns The final RawConversationNode or RawInteractionNode.
   */
  toRawNode(normalizedItem: TNormalizedItem): RawConversationNode | RawInteractionNode;
}
