"""
Crawl Website Knowledge Flow - Extracts knowledge from website content.
"""

from typing import Optional, List
from pydantic import BaseModel, Field
import json
from google.cloud import aiplatform
import os


class CrawlWebsiteKnowledgeInput(BaseModel):
    websiteUrl: str = Field(..., description="URL of the website to crawl")
    focusTopics: Optional[List[str]] = Field(None, description="Specific topics to focus on")
    content: Optional[str] = Field(None, description="Raw website content if already crawled")


class KnowledgeExtract(BaseModel):
    title: str
    summary: str
    keyPoints: List[str]
    sourceUrl: str


class CrawlWebsiteKnowledgeOutput(BaseModel):
    extracts: List[KnowledgeExtract] = Field(..., description="Extracted knowledge items")
    topicsFound: List[str] = Field(..., description="Topics found on the website")
    suggestedCategories: List[str] = Field(..., description="Suggested categories for organization")


async def crawl_website_knowledge(input_data: CrawlWebsiteKnowledgeInput) -> CrawlWebsiteKnowledgeOutput:
    """
    Extract structured knowledge from website content.
    
    Args:
        input_data: Website URL and content to analyze
        
    Returns:
        CrawlWebsiteKnowledgeOutput with extracted knowledge
    """
    try:
        # Initialize Vertex AI
        aiplatform.init(project=os.getenv("FIREBASE_PROJECT_ID", "riverr-ai"), location="us-central1")
        
        focus_str = f"Focus Topics: {', '.join(input_data.focusTopics)}" if input_data.focusTopics else "No specific focus"
        content = input_data.content or f"Website: {input_data.websiteUrl}"
        
        prompt = f"""You are an expert knowledge management specialist. Extract structured knowledge from website content.

{focus_str}

Website Content:
---
{content}
---

**Your Task:**
1. Extract key knowledge items from the content
2. Identify all topics covered
3. Suggest categories for organization

Return ONLY valid JSON with these fields:
- extracts: array of objects with title, summary, keyPoints (array), sourceUrl
- topicsFound: array of topic strings
- suggestedCategories: array of suggested category names

Return ONLY valid JSON, no other text."""

        # Call Gemini API
        model = aiplatform.generative_models.GenerativeModel("gemini-1.5-pro")
        response = model.generate_content(prompt)
        
        # Parse JSON response
        response_text = response.text.strip()
        if response_text.startswith("```"):
            response_text = response_text.split("```")[1].strip()
            if response_text.startswith("json"):
                response_text = response_text[4:].strip()
        
        response_data = json.loads(response_text)
        
        extracts = [
            KnowledgeExtract(**extract)
            for extract in response_data.get("extracts", [])
        ]
        
        return CrawlWebsiteKnowledgeOutput(
            extracts=extracts,
            topicsFound=response_data.get("topicsFound", []),
            suggestedCategories=response_data.get("suggestedCategories", [])
        )
        
    except Exception as e:
        print(f"Crawl website knowledge failed: {str(e)}")
        raise
