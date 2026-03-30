"""Pydantic models for request/response validation"""
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime


# ==================== REQUEST MODELS ====================

class SearchRequest(BaseModel):
    """Knowledge base search request"""
    query: str
    space_id: str = Field(..., alias="spaceId")
    visible_sources: List[str] = Field(default_factory=list, alias="visibleSources")
    limit: int = 5

    class Config:
        populate_by_name = True


class GenerateRequest(BaseModel):
    """LLM response generation request"""
    query: str
    context: List[Dict] = Field(default_factory=list)
    bot_name: str = Field(..., alias="botName")
    instruction: Optional[str] = None
    greeting_script: Optional[str] = None

    class Config:
        populate_by_name = True


class FlowRequest(BaseModel):
    """Generic AI flow trigger request"""
    conversation_id: str = Field(..., alias="conversationId")
    flow_name: str = Field(..., alias="flowName")
    params: Dict[str, Any] = Field(default_factory=dict)

    class Config:
        populate_by_name = True


class InvokeAgentRequest(BaseModel):
    """Main agent invocation request"""
    conversation_id: str = Field(..., alias="conversationId")
    message: str
    bot_id: str = Field(..., alias="botId")
    space_id: str = Field(..., alias="spaceId")

    class Config:
        populate_by_name = True


# ==================== RESPONSE MODELS ====================

class SourceResult(BaseModel):
    """Knowledge base search result"""
    title: str
    text: str
    url: Optional[str] = None
    score: float
    source_type: str = Field(..., alias="sourceType")

    class Config:
        populate_by_name = True


class SearchResponse(BaseModel):
    """Knowledge base search response"""
    results: List[SourceResult]
    query: str
    execution_time_ms: float


class GenerateResponse(BaseModel):
    """LLM generation response"""
    answer: str
    confidence: float
    sources: List[SourceResult] = Field(default_factory=list)
    model: str
    execution_time_ms: Optional[float] = None


class InvokeAgentResponse(BaseModel):
    """Main agent response"""
    answer: str
    confidence: float
    sources: List[SourceResult] = Field(default_factory=list)
    used_agent_name: str = Field(default="ai", alias="usedAgentName")
    execution_time_ms: float

    class Config:
        populate_by_name = True


class ErrorResponse(BaseModel):
    """Error response"""
    error: str
    message: str
    details: Optional[Dict] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)


# ==================== INTERNAL MODELS ====================

class BotConfig(BaseModel):
    """Bot configuration from Firestore"""
    id: str
    name: str
    space_id: str = Field(..., alias="spaceId")
    ai_enabled: bool = Field(default=True, alias="aiEnabled")
    allowed_help_center_ids: List[str] = Field(default_factory=list, alias="allowedHelpCenterIds")
    intelligence_access_level: str = Field(default="articles_only", alias="intelligenceAccessLevel")
    instruction: Optional[str] = None
    greeting_script: Optional[str] = None

    class Config:
        populate_by_name = True


class Conversation(BaseModel):
    """Conversation metadata from Firestore"""
    id: str
    space_id: str = Field(..., alias="spaceId")
    bot_id: str = Field(..., alias="botId")
    channel: str
    visitor_id: Optional[str] = Field(None, alias="visitorId")

    class Config:
        populate_by_name = True
