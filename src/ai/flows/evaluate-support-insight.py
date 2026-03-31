"""
Evaluate Support Insight Flow - Determines if support response contains reusable insight.
"""

from typing import Optional
from pydantic import BaseModel, Field
import json
from google.cloud import aiplatform
import os


class StructuredContent(BaseModel):
    issue: str = Field(..., description="Normalized description of the customer problem")
    resolution: str = Field(..., description="Specific steps or explanation that solved it")
    context: Optional[str] = Field(None, description="System requirements, constraints, or channel-specific details")


class EvaluateInsightInput(BaseModel):
    messageText: str = Field(..., description="The content of the agent message to evaluate")
    conversationContext: Optional[str] = Field(None, description="Recent message history for context")


class EvaluateInsightOutput(BaseModel):
    shouldCreateInsight: bool = Field(..., description="Whether this response contains a valuable reusable resolution")
    confidence: float = Field(..., ge=0, le=1, description="Confidence score for the decision")
    reason: str = Field(..., description="Why this was or was not selected")
    title: Optional[str] = Field(None, description="Concise internal-facing title for this insight")
    issueLabel: Optional[str] = Field(None, description="Machine-readable label for the issue type")
    resolutionLabel: Optional[str] = Field(None, description="Machine-readable label for the resolution type")
    structuredContent: Optional[StructuredContent] = Field(None, description="Extracted issue and resolution")


async def evaluate_support_insight(input_data: EvaluateInsightInput) -> EvaluateInsightOutput:
    """
    Evaluate if a support response contains a reusable insight.
    
    Args:
        input_data: Agent message and conversation context
        
    Returns:
        EvaluateInsightOutput with decision and extracted content
    """
    try:
        # Initialize Vertex AI
        aiplatform.init(project=os.getenv("FIREBASE_PROJECT_ID", "riverr-ai"), location="us-central1")
        
        context_str = input_data.conversationContext or "No additional context provided."
        
        prompt = f"""You are an expert Knowledge Management AI. Your job is to analyze human support responses and identify "Insights" — reusable pieces of internal knowledge.

CREATION RULES:
Only create an Insight if the message contains:
- Root cause of a problem
- Troubleshooting findings or workarounds
- Explanation of complex system behavior
- Repeatable resolution steps
- Onboarding clarification

DO NOT CREATE IF:
- Greeting or filler (thanks, hello, checking now)
- Short status updates (sent to team, escalating)
- General conversation with no reusable resolution

MESSAGE TO EVALUATE:
---
{input_data.messageText}
---

CONTEXT:
---
{context_str}
---

TASK:
Decide if this message contains a high-signal support resolution. If yes, extract the issue, resolution, and a professional internal title. Focus on identifying the core problem solved.

Return ONLY valid JSON with these fields:
- shouldCreateInsight: boolean
- confidence: number between 0 and 1
- reason: string explaining the decision
- title: string or null
- issueLabel: string or null
- resolutionLabel: string or null
- structuredContent: object with issue, resolution, context (or null)

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
        
        # Parse structured content if present
        structured_content = None
        if response_data.get("structuredContent"):
            structured_content = StructuredContent(**response_data["structuredContent"])
        
        return EvaluateInsightOutput(
            shouldCreateInsight=response_data.get("shouldCreateInsight", False),
            confidence=float(response_data.get("confidence", 0)),
            reason=response_data.get("reason", ""),
            title=response_data.get("title"),
            issueLabel=response_data.get("issueLabel"),
            resolutionLabel=response_data.get("resolutionLabel"),
            structuredContent=structured_content
        )
        
    except Exception as e:
        print(f"Evaluate support insight failed: {str(e)}")
        raise
