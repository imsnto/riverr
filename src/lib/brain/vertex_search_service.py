"""
Vertex AI Vector Search Service - Queries vector index and hydrates from Firestore.
"""

import os
from typing import Dict, List, Optional, Literal
from google.cloud import aiplatform
from google.cloud.aiplatform_v1 import MatchServiceClient
import firebase_admin
from firebase_admin import firestore

from .embed import generate_query_embedding

INDEX_ENDPOINT_RESOURCE_NAME = os.getenv("VERTEX_VECTOR_INDEX_ENDPOINT_RESOURCE_NAME", "")
DEPLOYED_INDEX_ID = os.getenv("VERTEX_VECTOR_DEPLOYED_INDEX_ID", "")
PUBLIC_ENDPOINT_DOMAIN = os.getenv("VERTEX_VECTOR_PUBLIC_ENDPOINT_DOMAIN", "")

VectorSourceType = Literal['article', 'topic', 'insight', 'chunk']


class VectorSearchResult:
    """Result from vector search."""
    def __init__(self, id: str, score: float, metadata: Dict):
        self.id = id
        self.score = score
        self.metadata = metadata


class SearchParams:
    """Search parameters."""
    def __init__(
        self,
        query: str,
        sourceType: VectorSourceType,
        spaceId: str,
        hubId: Optional[str] = None,
        libraryIds: Optional[List[str]] = None,
        visibility: Optional[Literal['public', 'private']] = None,
        limit: int = 10
    ):
        self.query = query
        self.sourceType = sourceType
        self.spaceId = spaceId
        self.hubId = hubId
        self.libraryIds = libraryIds or []
        self.visibility = visibility
        self.limit = limit


def get_collection_name(sourceType: VectorSourceType) -> str:
    """Get Firestore collection name from source type."""
    mapping = {
        'article': 'articles',
        'topic': 'topics',
        'insight': 'insights',
        'chunk': 'source_chunks',
    }
    if sourceType not in mapping:
        raise ValueError(f"Unsupported source type: {sourceType}")
    return mapping[sourceType]


def build_query_restricts(params: SearchParams) -> List[Dict]:
    """Build Vertex AI query restrictions."""
    restricts = [
        {"namespace": "sourceType", "allowList": [params.sourceType]},
        {"namespace": "spaceId", "allowList": [params.spaceId]},
    ]
    
    if params.hubId:
        restricts.append({"namespace": "hubId", "allowList": [params.hubId]})
    if params.visibility:
        restricts.append({"namespace": "visibility", "allowList": [params.visibility]})
    if params.libraryIds:
        restricts.append({"namespace": "libraryId", "allowList": params.libraryIds[:10]})
    
    return restricts


class VertexVectorSearchService:
    """Vertex AI Vector Search Service with Firestore hydration."""
    
    def __init__(self):
        """Initialize the service."""
        self.match_client = MatchServiceClient(
            client_options={"api_endpoint": PUBLIC_ENDPOINT_DOMAIN or "us-central1-aiplatform.googleapis.com"}
        )
        try:
            self.db = firestore.client()
        except:
            # Firebase not initialized, will be initialized elsewhere
            self.db = None
    
    async def search(self, params: SearchParams) -> List[VectorSearchResult]:
        """
        Real Vertex AI Vector Search:
        1. Query deployed index endpoint
        2. Get candidate datapoints
        3. Hydrate canonical Firestore docs by ID
        
        Args:
            params: Search parameters
            
        Returns:
            List of VectorSearchResult objects
        """
        if not INDEX_ENDPOINT_RESOURCE_NAME or not DEPLOYED_INDEX_ID or not PUBLIC_ENDPOINT_DOMAIN:
            print("[VertexSearch] Infrastructure not fully configured. Returning empty results.")
            return []
        
        # Generate query embedding
        query_vector = await generate_query_embedding(params.query)
        if not query_vector or len(query_vector) == 0:
            return []
        
        restricts = build_query_restricts(params)
        
        try:
            # Query Vertex Vector Search
            response = self.match_client.find_neighbors(
                index_endpoint=INDEX_ENDPOINT_RESOURCE_NAME,
                deployed_index_id=DEPLOYED_INDEX_ID,
                queries=[{
                    "data_point": {
                        "datapoint_id": "query",
                        "feature_vector": query_vector,
                    },
                    "neighbor_count": params.limit,
                    "restricts": restricts,
                }],
            )
            
            nearest = response[0].nearest_neighbors[0].neighbors if response else []
            if not nearest:
                return []
            
            # Extract doc IDs from datapoint IDs
            ids = []
            for neighbor in nearest:
                dp_id = neighbor.data_point.datapoint_id if neighbor.data_point else None
                if dp_id:
                    parts = dp_id.split(":")
                    doc_id = ":".join(parts[1:]) if len(parts) >= 2 else None
                    if doc_id:
                        ids.append(doc_id)
            
            if not ids:
                return []
            
            # Hydrate from Firestore
            collection_name = get_collection_name(params.sourceType)
            hydrated = {}
            
            if self.db:
                # Batch get documents (max 10 per query)
                for i in range(0, len(ids), 10):
                    batch = ids[i:i+10]
                    docs = self.db.collection(collection_name).where('__name__', 'in', batch).get()
                    for doc in docs:
                        hydrated[doc.id] = doc.to_dict()
            
            # Build results
            results = []
            for neighbor in nearest:
                dp_id = neighbor.data_point.datapoint_id if neighbor.data_point else None
                if not dp_id:
                    continue
                
                doc_id = ":".join(dp_id.split(":")[1:])
                data = hydrated.get(doc_id)
                
                if data and data.get('spaceId') == params.spaceId:
                    distance = neighbor.distance if hasattr(neighbor, 'distance') else 0.2
                    score = 1 - distance if distance is not None else 0.8
                    
                    results.append(VectorSearchResult(
                        id=doc_id,
                        score=score,
                        metadata=data
                    ))
            
            return results
            
        except Exception as err:
            print(f"[VertexSearch] Search failed: {str(err)}")
            return []


# Singleton instance
vertex_search = VertexVectorSearchService()
