"""
Suggest Library Icon Flow - Recommends icons for library articles.
"""

from typing import Optional, List
from pydantic import BaseModel, Field
import json
from google.cloud import aiplatform
import os


class SuggestLibraryIconInput(BaseModel):
    articleTitle: str = Field(..., description="Title of the library article")
    articleContent: Optional[str] = Field(None, description="Content preview of the article")
    existingIcons: Optional[List[str]] = Field(None, description="List of already-used icon names")


class SuggestLibraryIconOutput(BaseModel):
    suggestedIcon: str = Field(..., description="Suggested icon name (e.g., 'book', 'question-circle')")
    alternatives: List[str] = Field(default_factory=list, description="Alternative icon suggestions")
    rationale: str = Field(..., description="Explanation for the suggestion")


async def suggest_library_icon(input_data: SuggestLibraryIconInput) -> SuggestLibraryIconOutput:
    """
    Suggest an icon for a library article.
    
    Args:
        input_data: Article title, content, and existing icons
        
    Returns:
        SuggestLibraryIconOutput with icon suggestion
    """
    try:
        # Initialize Vertex AI
        aiplatform.init(project=os.getenv("FIREBASE_PROJECT_ID", "riverr-ai"), location="us-central1")
        
        content_preview = input_data.articleContent or "No content provided"
        existing = ", ".join(input_data.existingIcons) if input_data.existingIcons else "None"
        
        prompt = f"""You are an expert at selecting appropriate icons for library articles.

**Article Title:** {input_data.articleTitle}

**Article Preview:**
{content_preview}

**Already Used Icons:** {existing}

**Your Task:**
Suggest an appropriate icon for this article from common icon libraries (Font Awesome, Material Icons, etc.).

Return ONLY valid JSON with these fields:
- suggestedIcon: string (icon name, e.g., "book", "question-circle", "settings")
- alternatives: array of 2-3 alternative icon names
- rationale: string (brief explanation)

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
        
        return SuggestLibraryIconOutput(
            suggestedIcon=response_data.get("suggestedIcon", "help-circle"),
            alternatives=response_data.get("alternatives", []),
            rationale=response_data.get("rationale", "")
        )
        
    except Exception as e:
        print(f"Suggest library icon failed: {str(e)}")
        raise
