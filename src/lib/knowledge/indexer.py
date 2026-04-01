import asyncio
import os
import re
from datetime import datetime
from typing import Optional, Any
import firebase_admin
from firebase_admin import firestore

from .chunking import chunk_article_html
from ..brain.embed import generate_document_embedding


def safe_slug(s: Optional[str]) -> str:
    """Convert a string to a safe URL slug."""
    if not s:
        return ""
    
    # Convert to lowercase
    s = s.lower()
    # Replace non-alphanumeric characters with hyphens
    s = re.sub(r'[^\p{L}\p{N}]+', '-', s, flags=re.UNICODE)
    # Remove leading/trailing hyphens
    s = re.sub(r'^-|-$', '', s)
    # Limit to 60 characters
    return s[:60]


async def index_help_center_article_to_chunks(
    admin_db: firestore.client,
    article: dict[str, Any],
    space_id: str,
    public_help_base_url: str,
) -> dict[str, int]:
    """
    Index a help center article into Firestore vector search.
    
    Args:
        admin_db: Firebase Firestore admin client
        article: Article document data
        space_id: Space/workspace ID
        public_help_base_url: Base URL for public help center
    
    Returns:
        Dictionary with chunk count
    """
    # Check if article is published
    status = article.get('status')
    if status != 'published':
        return {'chunk_count': 0}
    
    # Validate required fields
    hub_id = article.get('hubId')
    help_center_id = article.get('helpCenterId')
    if not hub_id or not help_center_id:
        return {'chunk_count': 0}
    
    article_id = article.get('id', '')
    article_title = article.get('title', 'Untitled')
    
    # Split article into chunks
    specs = chunk_article_html(
        html=article.get('content', ''),
        max_tokens=220,
        overlap_tokens=60
    )
    
    print(f"INDEXER: Processing article {article_id} into {len(specs)} specs")
    
    # Get embedding model from environment
    embedding_model = os.getenv('EMBEDDING_MODEL', 'gemini-embedding-2-preview')
    
    # Generate embeddings in parallel
    print(f"INDEXER: Generating {len(specs)} embeddings in parallel...")
    
    async def generate_embedding_for_chunk(chunk_spec: dict[str, Any]) -> tuple[dict[str, Any], Optional[list[float]]]:
        """Generate embedding for a single chunk."""
        try:
            embedding = await generate_document_embedding(chunk_spec['text'])
            return (chunk_spec, embedding)
        except Exception as err:
            print(f"INDEXER: Embedding failed for chunk {chunk_spec.get('chunk_index')} of article {article_id}: {err}")
            return (chunk_spec, None)
    
    # Parallelize embedding generation
    results = await asyncio.gather(
        *[generate_embedding_for_chunk(spec) for spec in specs]
    )
    
    chunk_count = 0
    
    for spec, embedding in results:
        if not embedding:
            continue
        
        # Generate anchor from heading path
        if spec.get('heading_path'):
            anchor = safe_slug('-'.join(spec['heading_path'])) + f"-{spec.get('chunk_index', 0)}"
        else:
            anchor = f"chunk-{spec.get('chunk_index', 0)}"
        
        # Construct URL
        public_url = article.get('publicUrl')
        if public_url:
            if public_url.startswith('http'):
                url = public_url
            else:
                url = f"{public_help_base_url}{public_url}"
        else:
            url = f"{public_help_base_url}/hc/{help_center_id}/articles/{article_id}"
        
        full_url = f"{url}#{anchor}" if anchor else url
        
        # Prepare chunk data for Firestore
        chunk_data = {
            'hubId': hub_id,
            'spaceId': space_id,
            'sourceType': 'help_center_article',
            'sourceId': article_id,
            'helpCenterId': help_center_id,
            'title': article_title,
            'text': spec['text'],
            'url': full_url,
            'visibility': article.get('visibility', 'public'),
            'allowedUserIds': article.get('allowedUserIds', []),
            'status': 'active',
            # Vector embedding
            'embedding': embedding,
            'embeddingModel': embedding_model,
            'embeddingDim': 2048,
            # Timestamps
            'createdAt': firestore.SERVER_TIMESTAMP,
            'updatedAt': firestore.SERVER_TIMESTAMP,
            'headingPath': spec.get('heading_path', []),
            'chunkIndex': spec.get('chunk_index', 0),
        }
        
        # Add chunk to Firestore
        await admin_db.collection('brain_chunks').add(chunk_data)
        chunk_count += 1
    
    # Update article metadata with chunk count
    await admin_db.collection('help_center_articles').document(article_id).set(
        {
            'chunkCount': chunk_count,
            'chunkedAt': datetime.now().isoformat(),
        },
        merge=True
    )
    
    print(f"INDEXER: Successfully indexed {chunk_count} chunks for {article_id}")
    return {'chunk_count': chunk_count}
