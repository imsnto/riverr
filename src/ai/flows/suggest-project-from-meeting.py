"""
Suggest Project From Meeting Flow - Suggests project structures from meeting notes.
"""

from typing import Optional, List
from pydantic import BaseModel, Field
import json
from google.cloud import aiplatform
import os


class ProjectSuggestion(BaseModel):
    name: str
    description: str
    suggestedTasks: List[str]
    timeline: Optional[str] = None
    priority: str


class SuggestProjectFromMeetingInput(BaseModel):
    meetingNotes: str = Field(..., description="Notes from the meeting")
    context: Optional[str] = Field(None, description="Additional context about the meeting")


class SuggestProjectFromMeetingOutput(BaseModel):
    suggestedProjects: List[ProjectSuggestion] = Field(..., description="Suggested projects based on meeting")
    keyOutcomes: List[str] = Field(..., description="Key outcomes or decisions from the meeting")
    nextSteps: List[str] = Field(..., description="Recommended next steps")


async def suggest_project_from_meeting(input_data: SuggestProjectFromMeetingInput) -> SuggestProjectFromMeetingOutput:
    """
    Suggest project structures based on meeting notes.
    
    Args:
        input_data: Meeting notes and context
        
    Returns:
        SuggestProjectFromMeetingOutput with project suggestions
    """
    try:
        # Initialize Vertex AI
        aiplatform.init(project=os.getenv("FIREBASE_PROJECT_ID", "riverr-ai"), location="us-central1")
        
        context_str = f"Context: {input_data.context}" if input_data.context else ""
        
        prompt = f"""You are an expert project manager. Your task is to analyze meeting notes and suggest project structures.

{context_str}

Meeting Notes:
---
{input_data.meetingNotes}
---

**Your Task:**
1. Identify projects that should be created based on the meeting
2. For each project, suggest a description and tasks
3. Identify key outcomes and decisions
4. Recommend next steps

Return ONLY valid JSON with these fields:
- suggestedProjects: array of objects with name, description, suggestedTasks, timeline, priority
- keyOutcomes: array of strings (key decisions/outcomes)
- nextSteps: array of strings (recommended actions)

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
        
        projects = [
            ProjectSuggestion(**project)
            for project in response_data.get("suggestedProjects", [])
        ]
        
        return SuggestProjectFromMeetingOutput(
            suggestedProjects=projects,
            keyOutcomes=response_data.get("keyOutcomes", []),
            nextSteps=response_data.get("nextSteps", [])
        )
        
    except Exception as e:
        print(f"Suggest project from meeting failed: {str(e)}")
        raise
