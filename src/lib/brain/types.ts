export interface NormalizedThread {
  id: string;
  sourceUrl?: string;
  participants: {
    email: string;
    name?: string;
    role: 'customer' | 'agent' | 'rep' | 'internal';
  }[];
  messages: {
    id: string;
    from: { email: string; name?: string };
    at: Date;
    text: string;
    meta?: Record<string, any>;
  }[];
}

export interface RawItem {
  id: string;
}

export interface SourceAdapter<TParams, TRawItem extends RawItem, TNormalizedItem> {
  /**
   * Fetches a batch of raw data items from the source API.
   */
  fetchBatch(params: TParams): Promise<TRawItem[]>;

  /**
   * Normalizes a single raw item from the source into a common intermediate format.
   */
  normalize(rawItem: TRawItem): TNormalizedItem;
  
  /**
   * Converts the normalized item into a canonical node structure.
   */
  toRawNode(normalizedItem: TNormalizedItem): any;
}