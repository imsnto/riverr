
export type HelpCenterChunk = {
  id: string;

  spaceId: string;
  hubId: string;
  helpCenterIds: string[];

  articleId: string;
  articleTitle: string;
  articleSubtitle?: string | null;
  articleType: 'article' | 'snippet' | 'pdf';

  // where in the article this chunk came from
  chunkIndex: number;            // 0..N
  headingPath: string[];         // ["Getting Started", "Create Products"]
  anchor?: string | null;        // optional stable anchor for citations

  // the actual searchable payload
  text: string;                  // plain text (no HTML)
  charCount: number;
  tokenEstimate: number;         // cheap estimate for chunk sizing

  status: 'draft' | 'published';

  // access control
  isPublic: boolean;
  allowedUserIds?: string[];

  // freshness
  articleUpdatedAt: number;      // epoch ms from article.updatedAt
  chunkUpdatedAt: number;        // epoch ms when chunk was written
  
  language: string;

  // for later citations
  url: string;
};
