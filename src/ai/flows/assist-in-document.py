"""
Assist in Document Flow - Provides AI assistance for document editing and improvement.
"""

from typing import Optional
from pydantic import BaseModel, Field
import json
from google.cloud import aiplatform
import os


class AssistInDocumentInput(BaseModel):
    documentContent: str = Field(..., description="Content of the document")
    assistanceType: str = Field(..., description="Type of assistance (e.g., 'grammar', 'clarity', 'tone', 'expansion')")
    specificRequest: Optional[str] = Field(None, description="Specific improvements requested")


class AssistInDocumentOutput(BaseModel):
    suggestions: str = Field(..., description="Detailed suggestions and improvements")
    improvedContent: str = Field(..., description="Improved version of the document")
    keyChanges: list = Field(..., description="List of key changes made")


async def assist_in_document(input_data: AssistInDocumentInput) -> AssistInDocumentOutput:
    """
    Provide AI assistance for improving document content.
    
    Args:
        input_data: Document content and assistance request
        
    Returns:
        AssistInDocumentOutput with suggestions and improved content
    """
    try:
        # Initialize Vertex AI
        aiplatform.init(project=os.getenv("FIREBASE_PROJECT_ID", "riverr-ai"), location="us-central1")
        
        specific = f"Specific Request: {input_data.specificRequest}" if input_data.specificRequest else ""
        
        prompt = f"""You are an expert document editor. Your task is to improve document content.

Assistance Type: {input_data.assistanceType}
{specific}

Document:
---
{input_data.documentContent}
---

**Your Task:**
1. Analyze the document for the requested assistance type
2. Provide specific, actionable suggestions
3. Create an improved version of the document
4. List the key changes made

Return ONLY valid JSON with these fields:
- suggestions: string (detailed suggestions)
- improvedContent: string (improved version)
- keyChanges: array of strings (key improvements made)

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
        
        return AssistInDocumentOutput(
            suggestions=response_data.get("suggestions", ""),
            improvedContent=response_data.get("improvedContent", ""),
            keyChanges=response_data.get("keyChanges", [])
        )
        
    except Exception as e:
        print(f"Assist in document failed: {str(e)}")
        raise
