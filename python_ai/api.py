"""FastAPI HTTP routes for Riverr AI Service"""
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from typing import Dict, Any
from datetime import datetime
import time

from models import (
    SearchRequest,
    SearchResponse,
    GenerateRequest,
    GenerateResponse,
    InvokeAgentRequest,
    InvokeAgentResponse,
    ErrorResponse,
    SourceResult,
)
from core import invoke_agent
from flows import flows
from services import vertex_ai, gemini
from config import DEBUG

# Create FastAPI app
app = FastAPI(
    title="Riverr AI Service",
    version="1.0.0",
    description="Python AI backend for Riverr messaging platform",
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ==================== HEALTH CHECK ====================

@app.get("/health")
async def health_check() -> Dict[str, str]:
    """Health check endpoint"""
    return {"status": "healthy", "service": "riverr-ai"}


# ==================== MAIN AI ENDPOINTS ====================

@app.post("/api/invoke-agent")
async def invoke_agent_endpoint(request: InvokeAgentRequest) -> Dict[str, Any]:
    """
    Main AI message processing endpoint.
    
    Called from: src/app/actions/chat.ts
    
    Returns: {answer, confidence, sources[], usedAgentName, execution_time_ms}
    """
    result = await invoke_agent(
        conversation_id=request.conversation_id,
        message=request.message,
        bot_id=request.bot_id,
        space_id=request.space_id,
    )
    
    if result.get("error"):
        raise HTTPException(
            status_code=result.get("error_code", 500),
            detail=result.get("error_message", "Unknown error"),
        )
    
    return result


@app.post("/api/search", response_model=SearchResponse)
async def search_endpoint(request: SearchRequest) -> SearchResponse:
    """
    Knowledge base search endpoint.
    
    Called from: src/lib/brain/retrieve-context.ts
    
    Returns: {results: [{title, text, url, score}], query, execution_time_ms}
    """
    start_time = time.time()
    
    results = await vertex_ai.search(
        query=request.query,
        index_name="articles-index",
        space_id=request.space_id,
        limit=min(request.limit, 20),
        visible_sources=request.visible_sources,
    )
    
    execution_time = (time.time() - start_time) * 1000
    
    source_results = [
        SourceResult(
            title=r.get("title", ""),
            text=r.get("text", ""),
            url=r.get("url"),
            score=float(r.get("score", 0)),
            source_type=r.get("source_type", "article"),
        )
        for r in results
    ]
    
    return SearchResponse(
        results=source_results,
        query=request.query,
        execution_time_ms=execution_time,
    )


@app.post("/api/generate", response_model=GenerateResponse)
async def generate_endpoint(request: GenerateRequest) -> GenerateResponse:
    """
    LLM response generation endpoint.
    
    Called from: src/ai/flows/agent-response.ts
    
    Returns: {answer, confidence, sources[], model, execution_time_ms}
    """
    start_time = time.time()
    
    result = await gemini.generate(
        query=request.query,
        context=request.context,
        bot_name=request.bot_name,
        instruction=request.instruction,
    )
    
    execution_time = (time.time() - start_time) * 1000
    
    source_results = [
        SourceResult(**c) if isinstance(c, dict) else c
        for c in request.context
    ]
    
    return GenerateResponse(
        answer=result["answer"],
        confidence=0.85,
        sources=source_results,
        model=result["model"],
        execution_time_ms=execution_time,
    )


# ==================== AI FLOWS ====================

@app.post("/api/flows/sales-intelligence")
async def sales_intelligence_endpoint(conversation_text: str) -> Dict[str, Any]:
    """Distill sales intelligence from conversation"""
    return await flows.distill_sales_intelligence(conversation_text)


@app.post("/api/flows/sales-personalization")
async def sales_personalization_endpoint(
    conversation_text: str,
    company_info: Dict[str, Any] = None,
) -> Dict[str, Any]:
    """Extract personalization insights for sales"""
    company_info = company_info or {}
    return await flows.distill_sales_email_personalization(conversation_text, company_info)


@app.post("/api/flows/support-intent")
async def support_intent_endpoint(message: str) -> Dict[str, Any]:
    """Classify support message intent"""
    return await flows.distill_support_intent(message)


@app.post("/api/flows/support-insight")
async def support_insight_endpoint(conversation_text: str) -> Dict[str, Any]:
    """Evaluate support conversation for insights"""
    return await flows.evaluate_support_insight(conversation_text)


@app.post("/api/flows/draft-email")
async def draft_email_endpoint(
    context: str,
    company_name: str,
    contact_name: str,
) -> Dict[str, Any]:
    """Generate personalized sales email"""
    return await flows.draft_sales_email(context, company_name, contact_name)


@app.post("/api/flows/next-action")
async def next_action_endpoint(
    conversation_history: str,
    stage: str = "lead",
) -> Dict[str, Any]:
    """Recommend next sales action"""
    return await flows.recommend_next_sales_action(conversation_history, stage)


@app.post("/api/flows/create-task")
async def create_task_endpoint(thread_content: str) -> Dict[str, Any]:
    """Extract task from conversation thread"""
    return await flows.create_task_from_thread(thread_content)


@app.post("/api/flows/cover-image")
async def cover_image_endpoint(title: str, description: str) -> Dict[str, Any]:
    """Generate cover image description"""
    return await flows.generate_cover_image(title, description)


@app.post("/api/flows/icon-suggestion")
async def icon_suggestion_endpoint(content_title: str, content_type: str) -> Dict[str, Any]:
    """Suggest icon for content"""
    return await flows.suggest_library_icon(content_title, content_type)


@app.post("/api/flows/summarize")
async def summarize_endpoint(conversation_text: str, length: str = "short") -> Dict[str, Any]:
    """Summarize conversation"""
    return await flows.summarize_conversation(conversation_text, length)


@app.post("/api/flows/related-articles")
async def related_articles_endpoint(
    article_content: str,
    kb_titles: list = None,
) -> Dict[str, Any]:
    """Suggest related knowledge base articles"""
    kb_titles = kb_titles or []
    return await flows.suggest_related_articles(article_content, kb_titles)


# ==================== ERROR HANDLING ====================

@app.exception_handler(Exception)
async def exception_handler(request, exc):
    """Global exception handler"""
    error_response = ErrorResponse(
        error="internal_error",
        message=str(exc),
        details={"path": str(request.url)} if DEBUG else None,
    )
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content=error_response.dict(),
    )


@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc):
    """HTTP exception handler"""
    error_response = ErrorResponse(
        error="http_error",
        message=exc.detail,
    )
    return JSONResponse(
        status_code=exc.status_code,
        content=error_response.dict(),
    )


# ==================== ROOT ROUTES ====================

@app.get("/")
async def root() -> Dict[str, str]:
    """Root endpoint"""
    return {
        "service": "riverr-ai",
        "version": "1.0.0",
        "status": "running",
    }


@app.get("/api")
async def api_info() -> Dict[str, Any]:
    """API info endpoint"""
    return {
        "service": "Riverr AI Service",
        "version": "1.0.0",
        "endpoints": {
            "health": "/health",
            "main": ["/api/invoke-agent", "/api/search", "/api/generate"],
            "flows": "/api/flows/*",
        },
    }
