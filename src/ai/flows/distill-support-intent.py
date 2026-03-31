"""
Distill Support Intent Flow - Extracts structured support intent from conversations.
"""

from typing import List, Optional
from pydantic import BaseModel, Field
import json
from google.cloud import aiplatform
import os


class ContextRequirement(BaseModel):
    key: str = Field(..., description="The variable name for a piece of information needed to answer")
    question: str = Field(..., description="The question the AI should ask the user to get this piece of information")


class SafetyCriteria(BaseModel):
    mustNot: List[str] = Field(default_factory=list, description="Things the AI must NOT do or say")
    requiresHumanIf: List[str] = Field(default_factory=list, description="Conditions requiring human escalation")


class DistillSupportIntentInput(BaseModel):
    conversationText: str = Field(..., description="Full text of support conversation with roles prefixed")
    lastAgentMessage: Optional[str] = Field(None, description="Final message from the support agent")


class DistillSupportIntentOutput(BaseModel):
    intentKey: str = Field(..., description="Concise machine-readable key for the problem (e.g., 'password_reset')")
    customerQuestion: str = Field(..., description="Clear one-sentence summary of the customer's primary question")
    resolution: str = Field(..., description="Summary of agent's resolution rewritten as standalone knowledge")
    requiredContext: List[ContextRequirement] = Field(default_factory=list, description="List of required context items")
    safetyCriteria: SafetyCriteria = Field(default_factory=SafetyCriteria, description="Safety and escalation policies")


async def distill_support_intent(input_data: DistillSupportIntentInput) -> DistillSupportIntentOutput:
    """
    Distill a support conversation into structured intent.
    
    Args:
        input_data: Support conversation text
        
    Returns:
        DistillSupportIntentOutput with extracted intent structure
    """
    try:
        # Initialize Vertex AI
        aiplatform.init(project=os.getenv("FIREBASE_PROJECT_ID", "riverr-ai"), location="us-central1")
        
        prompt = f"""You are an expert at analyzing customer support conversations and distilling them into structured, reusable knowledge.

Given the conversation below, return a JSON object with:
- intentKey: stable key in snake_case (e.g., 'password_reset')
- customerQuestion: one clear sentence
- resolution: standalone helpful answer
- requiredContext: list of info needed to answer (each with 'key' and 'question')
- safetyCriteria: object with 'mustNot' and 'requiresHumanIf' lists

Conversation:
---
{input_data.conversationText}
---

Return ONLY valid JSON, no other text."""

        # Call Gemini API
        model = aiplatform.generative_models.GenerativeModel("gemini-1.5-pro")
        response = model.generate_content(prompt)
        
        # Parse JSON response
        response_text = response.text.strip()
        # Remove markdown code blocks if present
        if response_text.startswith("```"):
            response_text = response_text.split("```")[1].strip()
            if response_text.startswith("json"):
                response_text = response_text[4:].strip()
        
        response_data = json.loads(response_text)
        
        # Parse required context
        required_context = [
            ContextRequirement(key=rc["key"], question=rc["question"])
            for rc in response_data.get("requiredContext", [])
        ]
        
        # Parse safety criteria
        safety_criteria = SafetyCriteria(
            mustNot=response_data.get("safetyCriteria", {}).get("mustNot", []),
            requiresHumanIf=response_data.get("safetyCriteria", {}).get("requiresHumanIf", [])
        )
        
        return DistillSupportIntentOutput(
            intentKey=response_data.get("intentKey", "unknown"),
            customerQuestion=response_data.get("customerQuestion", ""),
            resolution=response_data.get("resolution", ""),
            requiredContext=required_context,
            safetyCriteria=safety_criteria
        )
        
    except Exception as e:
        print(f"Distill support intent failed: {str(e)}")
        raise
