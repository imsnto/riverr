"""
Retrieval Orchestrator - Coordinates knowledge retrieval with fallback strategies.
"""

from typing import List, Literal, Optional
from .vector_search import search_articles, search_topics, search_insights


class AgentKnowledgePolicy:
    """Knowledge access policy for a bot."""
    def __init__(
        self,
        isCustomerFacing: bool,
        accessLevel: Literal['none', 'articles_only', 'topics_allowed', 'insights_hidden_support', 'internal_full_access'],
        allowedLibraryIds: Optional[List[str]] = None,
        agentId: Optional[str] = None
    ):
        self.agentId = agentId
        self.isCustomerFacing = isCustomerFacing
        self.accessLevel = accessLevel
        self.allowedLibraryIds = allowedLibraryIds or []


AnswerMode = Literal[
    'article_grounded',
    'topic_supported',
    'insight_supported_hidden',
    'internal_evidence_only',
    'clarify',
    'escalate'
]


class RetrievalDecision:
    """Decision result from retrieval orchestration."""
    def __init__(
        self,
        answerMode: AnswerMode,
        chosenCandidates: List[dict],
        confidence: float,
        rationale: str
    ):
        self.answerMode = answerMode
        self.chosenCandidates = chosenCandidates
        self.confidence = confidence
        self.rationale = rationale


CONFIDENCE_THRESHOLDS = {
    'ARTICLE': 0.78,
    'TOPIC': 0.75,
    'INSIGHT': 0.70,
}

BOOSTS = {
    'PUBLIC': {'article': 1.0, 'topic': 0.8, 'insight': 0.5},
    'INTERNAL': {'article': 1.0, 'topic': 0.9, 'insight': 0.85},
}


async def orchestrate_retrieval(
    message: str,
    hubId: str,
    spaceId: str,
    policy: AgentKnowledgePolicy
) -> RetrievalDecision:
    """
    Orchestrate knowledge retrieval with tiered fallback strategy.
    
    Args:
        message: User message/query
        hubId: Hub ID
        spaceId: Space ID
        policy: Knowledge access policy
        
    Returns:
        RetrievalDecision with chosen sources and answer mode
    """
    boost_map = BOOSTS['PUBLIC'] if policy.isCustomerFacing else BOOSTS['INTERNAL']
    
    # Parallel searches based on access level
    articles = await search_articles(
        query=message,
        hubId=hubId,
        spaceId=spaceId,
        allowedHelpCenterIds=policy.allowedLibraryIds if policy.accessLevel != 'none' else [],
        limit=8
    )
    
    topics = []
    if policy.accessLevel not in ['none', 'articles_only']:
        topics = await search_topics(
            query=message,
            spaceId=spaceId,
            hubId=hubId
        )
    
    insights = []
    if policy.accessLevel in ['insights_hidden_support', 'internal_full_access']:
        insights = await search_insights(
            query=message,
            hubId=hubId,
            spaceId=spaceId
        )
    
    # Apply weights
    scored_articles = [
        {**a.__dict__, 'weightedScore': a.score * boost_map['article']}
        for a in articles
    ]
    scored_topics = [
        {**t.__dict__, 'weightedScore': t.score * boost_map['topic']}
        for t in topics
    ]
    scored_insights = [
        {**i.__dict__, 'weightedScore': i.score * boost_map['insight']}
        for i in insights
    ]
    
    # Sort by weighted score
    scored_articles.sort(key=lambda x: x['weightedScore'], reverse=True)
    scored_topics.sort(key=lambda x: x['weightedScore'], reverse=True)
    scored_insights.sort(key=lambda x: x['weightedScore'], reverse=True)
    
    best_article = scored_articles[0] if scored_articles else None
    best_topic = scored_topics[0] if scored_topics else None
    best_insight = scored_insights[0] if scored_insights else None
    
    # TIER 1: ARTICLE (Highest Trust)
    if best_article and best_article['score'] >= CONFIDENCE_THRESHOLDS['ARTICLE']:
        return RetrievalDecision(
            answerMode='article_grounded',
            chosenCandidates=scored_articles[:3],
            confidence=best_article['score'],
            rationale='Strong article match found.'
        )
    
    # TIER 2: TOPIC (Pattern-based)
    if best_topic and best_topic['score'] >= CONFIDENCE_THRESHOLDS['TOPIC']:
        return RetrievalDecision(
            answerMode='topic_supported',
            chosenCandidates=[best_topic],
            confidence=best_topic['score'],
            rationale='Recurring issue pattern matched (topic).'
        )
    
    # TIER 3: INSIGHTS (Support memory)
    if best_insight and best_insight['score'] >= CONFIDENCE_THRESHOLDS['INSIGHT']:
        answer_mode = 'insight_supported_hidden' if policy.isCustomerFacing else 'internal_evidence_only'
        rationale = 'Internal support knowledge used (hidden from user).' if policy.isCustomerFacing else 'Internal-only insight used directly.'
        
        return RetrievalDecision(
            answerMode=answer_mode,
            chosenCandidates=[best_insight],
            confidence=best_insight['score'],
            rationale=rationale
        )
    
    # FALLBACK
    return RetrievalDecision(
        answerMode='clarify' if policy.isCustomerFacing else 'escalate',
        chosenCandidates=[],
        confidence=0,
        rationale='No high-confidence knowledge found.'
    )
