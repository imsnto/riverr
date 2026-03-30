
/**
 * @fileOverview Retrieval Orchestrator - Calls Python AI Service
 *
 * This delegates vector search and retrieval logic to the Python service.
 */

export interface AgentKnowledgePolicy {
  agentId?: string;
  isCustomerFacing: boolean;
  accessLevel:
    | 'none'
    | 'articles_only'
    | 'topics_allowed'
    | 'insights_hidden_support'
    | 'internal_full_access';
  allowedLibraryIds: string[];
}

export type AnswerMode =
  | 'article_grounded'
  | 'topic_supported'
  | 'insight_supported_hidden'
  | 'internal_evidence_only'
  | 'clarify'
  | 'escalate';

export interface RetrievalDecision {
  answerMode: AnswerMode;
  chosenCandidates: Array<{
    sourceType: 'article' | 'topic' | 'insight' | 'chunk';
    id: string;
    text: string;
    title?: string;
    url?: string;
    score: number;
  }>;
  confidence: number;
  rationale: string;
}

const PYTHON_AI_SERVICE_URL = process.env.NEXT_PUBLIC_PYTHON_AI_SERVICE_URL || 'http://localhost:8000';

export async function orchestrateRetrieval(args: {
  message: string;
  hubId: string;
  spaceId: string;
  policy: AgentKnowledgePolicy;
}): Promise<RetrievalDecision> {
  const { message, spaceId, policy } = args;

  try {
    // Call Python service for knowledge retrieval
    const response = await fetch(`${PYTHON_AI_SERVICE_URL}/api/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: message,
        spaceId: spaceId,
        visibleSources: policy.allowedLibraryIds,
        limit: 5,
      }),
    });

    if (!response.ok) {
      console.error('Python AI service search failed:', response.statusText);
      return {
        answerMode: policy.isCustomerFacing ? 'clarify' : 'escalate',
        chosenCandidates: [],
        confidence: 0,
        rationale: 'Search service unavailable.',
      };
    }

    const data = await response.json();
    
    // Determine confidence and answer mode
    const results = data.results || [];
    const bestScore = results.length > 0 ? results[0].score : 0;
    
    let answerMode: AnswerMode = 'article_grounded';
    if (bestScore < 0.5) {
      answerMode = policy.isCustomerFacing ? 'clarify' : 'escalate';
    }

    return {
      answerMode,
      chosenCandidates: results.map((r: any) => ({
        sourceType: 'article' as const,
        id: r.id || '',
        text: r.text || '',
        title: r.title,
        url: r.url,
        score: r.score || 0,
      })),
      confidence: bestScore,
      rationale: results.length > 0 ? 'Knowledge base search completed.' : 'No results found.',
    };
  } catch (error) {
    console.error('Retrieval error:', error);
    return {
      answerMode: policy.isCustomerFacing ? 'clarify' : 'escalate',
      chosenCandidates: [],
      confidence: 0,
      rationale: 'Retrieval failed.',
    };
  }
}
