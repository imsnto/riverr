"""
Recommend Next Sales Action Flow - Recommends next steps in a sales process.
"""

from typing import Optional, List, Literal
from pydantic import BaseModel, Field
import json
from google.cloud import aiplatform
import os


class RecommendNextSalesActionInput(BaseModel):
    conversationSummary: str = Field(..., description="Summary of the sales conversation so far")
    leadPersona: Optional[str] = Field(None, description="Description of the lead's persona")
    lastInteractionDate: Optional[str] = Field(None, description="Date of last interaction")


class RecommendNextSalesActionOutput(BaseModel):
    recommendedAction: Literal['follow_up_email', 'call', 'meeting_request', 'send_proposal', 'demo', 'nurture', 'close'] = Field(..., description="Recommended next action")
    timing: str = Field(..., description="When to take the action (e.g., 'within 2 days', 'next week')")
    rationale: str = Field(..., description="Why this action is recommended")
    messageTemplate: Optional[str] = Field(None, description="Optional template for the next message")


async def recommend_next_sales_action(input_data: RecommendNextSalesActionInput) -> RecommendNextSalesActionOutput:
    """
    Recommend the next sales action based on conversation history.
    
    Args:
        input_data: Conversation summary and lead info
        
    Returns:
        RecommendNextSalesActionOutput with recommended next step
    """
    try:
        # Initialize Vertex AI
        aiplatform.init(project=os.getenv("FIREBASE_PROJECT_ID", "riverr-ai"), location="us-central1")
        
        persona_info = f"Lead Persona: {input_data.leadPersona}" if input_data.leadPersona else "No persona data"
        
        prompt = f"""You are an expert sales coach. Based on a conversation with a prospect, recommend the next step in the sales process.

{persona_info}

Conversation Summary:
{input_data.conversationSummary}

**Your Task:**
1. Assess the conversation and prospect readiness
2. Recommend the next action (follow_up_email, call, meeting_request, send_proposal, demo, nurture, or close)
3. Suggest timing for the next action
4. Explain why this action is recommended
5. Optionally provide a message template

Return ONLY valid JSON with these fields:
- recommendedAction: string (one of: follow_up_email, call, meeting_request, send_proposal, demo, nurture, close)
- timing: string (e.g., "within 2 days", "next week")
- rationale: string (explanation)
- messageTemplate: string or null (optional template)

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
        
        return RecommendNextSalesActionOutput(
            recommendedAction=response_data.get("recommendedAction", "follow_up_email"),
            timing=response_data.get("timing", "within 3 days"),
            rationale=response_data.get("rationale", ""),
            messageTemplate=response_data.get("messageTemplate")
        )
        
    except Exception as e:
        print(f"Recommend next sales action failed: {str(e)}")
        raise
