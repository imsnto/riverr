
export type HelpCenterChunk = {
  id: string;

  hubId: string;
  helpCenterIds: string[];

  articleId: string;
  articleTitle: string;
  articleSubtitle?: string | null;

  // where in the article this chunk came from
  order: number;                 // 0..N
  headingPath: string[];         // ["Getting Started", "Create Products"]
  anchor?: string | null;        // optional stable anchor for citations

  // the actual searchable payload
  text: string;                  // plain text (no HTML)
  charCount: number;
  tokenEstimate: number;         // cheap estimate for chunk sizing

  // access control
  isPublic: boolean;
  allowedUserIds?: string[];

  // freshness
  articleUpdatedAt: string;      // from article.updatedAt
  chunkUpdatedAt: string;        // when chunk was written

  // for later citations
  url: string;
};
