import { searchBrainChunks, searchSupportMemory } from './vector-search';

export interface RetrievalResult {
  chunks: Array<{
    id: string;
    text: string;
    title?: string;
    url?: string;
    score: number;
    sourceId?: string;
  }>;
  intents: Array<{
    id: string;
    title: string;
    description: string;
    score: number;
  }>;
  contextText: string;
}

/**
 * Orchestrates multi-source retrieval for Finn's brain.
 * Searches both support memory and documentation library.
 */
export async function retrieveBrainContext(args: {
  message: string;
  hubId: string;
  allowedHelpCenterIds?: string[];
  userId?: string | null;
}): Promise<RetrievalResult | null> {
  const { message, hubId, allowedHelpCenterIds, userId } = args;

  // 1. Parallel search for speed
  const [supportResults, docResults] = await Promise.all([
    searchSupportMemory({ query: message, hubId, limit: 3 }),
    searchBrainChunks({ query: message, hubId, limit: 8 })
  ]);

  // 2. Filter documentation chunks by security/ID constraints
  const filteredChunks = docResults.filter(c => {
    const hcOk = !allowedHelpCenterIds?.length || 
                 !c.helpCenterId || 
                 allowedHelpCenterIds.includes(c.helpCenterId);

    const visibilityOk = c.visibility === 'public' || 
                         c.visibility === 'internal' || 
                         (c.visibility === 'private' && userId && c.allowedUserIds?.includes(userId));

    return hcOk && visibilityOk;
  }).slice(0, 6);

  if (!supportResults.length && !filteredChunks.length) return null;

  // 3. Construct clean context block
  let contextLines: string[] = [];

  if (supportResults.length > 0) {
    contextLines.push("### KNOWN SUPPORT RESOLUTIONS");
    supportResults.forEach((res, i) => {
      contextLines.push(`[Memory ${i + 1}] Q: ${res.title}\nA: ${res.description}`);
    });
  }

  if (filteredChunks.length > 0) {
    contextLines.push("### DOCUMENTATION EXCERPTS");
    filteredChunks.forEach((c, i) => {
      contextLines.push(`[Source ${i + 1}] Title: ${c.title || 'Untitled'}\nContent: ${c.text}\nURL: ${c.url || 'No URL'}`);
    });
  }

  return {
    chunks: filteredChunks,
    intents: supportResults,
    contextText: contextLines.join('\n\n')
  };
}
