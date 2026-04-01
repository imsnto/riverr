from typing import Optional, Literal
from pydantic import BaseModel, Field


class HelpCenterChunk(BaseModel):
    """Chunk of a help center article with embedding and metadata."""
    
    id: str
    
    space_id: str = Field(alias='spaceId')
    hub_id: str = Field(alias='hubId')
    help_center_id: str = Field(alias='helpCenterId')
    
    article_id: str = Field(alias='articleId')
    article_title: str = Field(alias='articleTitle')
    article_subtitle: Optional[str] = Field(None, alias='articleSubtitle')
    article_type: Literal['article', 'snippet', 'pdf'] = Field(alias='articleType')
    
    # Position within the article
    chunk_index: int = Field(alias='chunkIndex')  # 0..N
    heading_path: list[str] = Field(alias='headingPath')  # ["Getting Started", "Create Products"]
    anchor: Optional[str] = None  # Optional stable anchor for citations
    
    # Searchable content
    text: str  # Plain text (no HTML)
    char_count: int = Field(alias='charCount')
    token_estimate: int = Field(alias='tokenEstimate')  # Cheap estimate for chunk sizing
    
    # Publication status
    status: Literal['draft', 'published']
    
    # Access control
    is_public: bool = Field(alias='isPublic')
    allowed_user_ids: Optional[list[str]] = Field(None, alias='allowedUserIds')
    
    # Freshness tracking
    article_updated_at: int = Field(alias='articleUpdatedAt')  # Epoch ms from article.updatedAt
    chunk_updated_at: int = Field(alias='chunkUpdatedAt')  # Epoch ms when chunk was written
    
    language: str
    
    # For citations
    url: str
    
    class Config:
        populate_by_name = True
