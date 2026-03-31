"""
Text Embedding Generation - Generates embeddings using Vertex AI Gemini.
"""

import os
from typing import Optional, List
from google.cloud import aiplatform

PROJECT = os.getenv("FIREBASE_PROJECT_ID", "timeflow-6i3eo")
LOCATION = os.getenv("VERTEX_REGION", "us-central1")

# v2 MODEL STANDARD: Gemini Gecko text-embedding-004
EMBEDDING_MODEL = "text-embedding-004"

# FIRESTORE/VERTEX VECTOR CAP: 2048 dimensions
EMBEDDING_DIM = 2048

# Initialize Vertex AI
aiplatform.init(project=PROJECT, location=LOCATION)

_vertex_ai_instance = None


def get_vertex_ai():
    """Get or create Vertex AI instance (singleton)."""
    global _vertex_ai_instance
    if _vertex_ai_instance is None:
        _vertex_ai_instance = aiplatform.init(project=PROJECT, location=LOCATION)
    return _vertex_ai_instance


async def generate_document_embedding(text: str) -> Optional[List[float]]:
    """
    Generates an embedding for documentation content (articles, topics, etc).
    Uses taskType: RETRIEVAL_DOCUMENT for optimal indexing.
    
    Args:
        text: Content to embed
        
    Returns:
        List of embedding values or None on error
    """
    if not text or not text.strip():
        return None

    try:
        print(f"[Embedding] Generating document embedding for: {text[:50]}...")
        
        model = aiplatform.generative_models.GenerativeModel(EMBEDDING_MODEL)
        
        result = model.embed_content(
            model=EMBEDDING_MODEL,
            content=text.strip(),
            task_type="RETRIEVAL_DOCUMENT",
            output_dimensionality=EMBEDDING_DIM
        )
        
        if result and hasattr(result, 'embedding'):
            values = result.embedding
            return values if values and len(values) > 0 else None
        
        return None
        
    except Exception as error:
        print(f"generateDocumentEmbedding failed: {str(error)}")
        return None


async def generate_query_embedding(text: str) -> Optional[List[float]]:
    """
    Generates an embedding for a user search query.
    Uses taskType: RETRIEVAL_QUERY for optimal retrieval performance.
    
    Args:
        text: Query text to embed
        
    Returns:
        List of embedding values or None on error
    """
    if not text or not text.strip():
        return None

    try:
        print(f"[Embedding] Generating query embedding for: {text[:50]}...")
        
        model = aiplatform.generative_models.GenerativeModel(EMBEDDING_MODEL)
        
        result = model.embed_content(
            model=EMBEDDING_MODEL,
            content=text.strip(),
            task_type="RETRIEVAL_QUERY",
            output_dimensionality=EMBEDDING_DIM
        )
        
        if result and hasattr(result, 'embedding'):
            values = result.embedding
            return values if values and len(values) > 0 else None
        
        return None
        
    except Exception as error:
        print(f"generateQueryEmbedding failed: {str(error)}")
        return None
