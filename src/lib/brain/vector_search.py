"""
Vector Search Wrappers - Production retrieval wrappers over Vertex AI Vector Search.
"""

from typing import List, Optional, Literal
from .vertex_search_service import vertex_search, SearchParams, VectorSearchResult


class ArticleResult:
    """Search result for an article."""
    def __init__(self, id: str, text: str, title: Optional[str], score: float, 
                 libraryId: Optional[str], visibility: Literal['public', 'private'], 
                 url: Optional[str]):
        self.id = id
        self.text = text
        self.title = title
        self.sourceType = 'article'
        self.libraryId = libraryId
        self.visibility = visibility
        self.url = url
        self.score = score


class TopicResult:
    """Search result for a topic."""
    def __init__(self, id: str, text: str, title: Optional[str], score: float,
                 signalLevel: Optional[Literal['low', 'medium', 'high']], 
                 insightCount: Optional[int]):
        self.id = id
        self.title = title
        self.text = text
        self.sourceType = 'topic'
        self.signalLevel = signalLevel
        self.insightCount = insightCount
        self.score = score


class InsightResult:
    """Search result for an insight."""
    def __init__(self, id: str, text: str, title: Optional[str], score: float,
                 visibility: Literal['private', 'public'],
                 signalLevel: Optional[Literal['low', 'medium', 'high']],
                 origin: Optional[Literal['automatic', 'manual', 'imported']]):
        self.id = id
        self.title = title
        self.text = text
        self.sourceType = 'insight'
        self.visibility = visibility
        self.signalLevel = signalLevel
        self.origin = origin
        self.score = score


async def search_articles(
    query: str,
    hubId: str,
    spaceId: str,
    allowedHelpCenterIds: Optional[List[str]] = None,
    limit: int = 8
) -> List[ArticleResult]:
    """
    Tier 1: Curated Articles
    Highest-trust retrieval source.
    
    Args:
        query: Search query
        hubId: Hub ID
        spaceId: Space ID
        allowedHelpCenterIds: Allowed library IDs (None = restrict access)
        limit: Max results
        
    Returns:
        List of ArticleResult objects
    """
    # If article access is explicitly restricted to no libraries, return nothing
    if isinstance(allowedHelpCenterIds, list) and len(allowedHelpCenterIds) == 0:
        return []
    
    results: List[VectorSearchResult] = await vertex_search.search(
        SearchParams(
            query=query,
            sourceType='article',
            spaceId=spaceId,
            hubId=hubId,
            libraryIds=allowedHelpCenterIds,
            limit=limit
        )
    )
    
    return [
        ArticleResult(
            id=r.id,
            text=r.metadata.get('body') or r.metadata.get('summary') or r.metadata.get('title') or '',
            title=r.metadata.get('title'),
            score=r.score,
            libraryId=r.metadata.get('libraryId') or r.metadata.get('destinationLibraryId'),
            visibility=r.metadata.get('visibility', 'public'),
            url=r.metadata.get('url') or r.metadata.get('slug')
        )
        for r in results
    ]


async def search_topics(
    query: str,
    spaceId: str,
    hubId: Optional[str] = None,
    limit: int = 5
) -> List[TopicResult]:
    """
    Tier 2: Topics
    Recurring grouped patterns derived from Insights.
    
    Args:
        query: Search query
        spaceId: Space ID
        hubId: Optional Hub ID
        limit: Max results
        
    Returns:
        List of TopicResult objects
    """
    results: List[VectorSearchResult] = await vertex_search.search(
        SearchParams(
            query=query,
            sourceType='topic',
            spaceId=spaceId,
            hubId=hubId,
            limit=limit
        )
    )
    
    return [
        TopicResult(
            id=r.id,
            title=r.metadata.get('title'),
            text=r.metadata.get('summary') or r.metadata.get('title') or '',
            score=r.score,
            signalLevel=r.metadata.get('signalLevel'),
            insightCount=r.metadata.get('insightCount')
        )
        for r in results
    ]


async def search_insights(
    query: str,
    hubId: str,
    spaceId: str,
    limit: int = 5
) -> List[InsightResult]:
    """
    Tier 3: Insights
    Internal support learnings. Lower-trust than Articles and Topics.
    
    Args:
        query: Search query
        hubId: Hub ID
        spaceId: Space ID
        limit: Max results
        
    Returns:
        List of InsightResult objects
    """
    results: List[VectorSearchResult] = await vertex_search.search(
        SearchParams(
            query=query,
            sourceType='insight',
            spaceId=spaceId,
            hubId=hubId,
            visibility='private',
            limit=limit
        )
    )
    
    return [
        InsightResult(
            id=r.id,
            title=r.metadata.get('title'),
            text=r.metadata.get('content') or r.metadata.get('summary') or r.metadata.get('title') or '',
            score=r.score,
            visibility=r.metadata.get('visibility', 'private'),
            signalLevel=r.metadata.get('signalLevel'),
            origin=r.metadata.get('origin')
        )
        for r in results
    ]
