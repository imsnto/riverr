"""
Distill Sales Intelligence Flow - Extracts structured sales signals from conversations.
"""

from typing import List, Optional, Literal
from pydantic import BaseModel, Field
import json
from google.cloud import aiplatform
import os


class LeadPersonaHints(BaseModel):
    industry: Optional[str] = Field(None, description="The lead's industry")
    role: Optional[str] = Field(None, description="The lead's job role")
    orgSize: Optional[Literal['solo', 'small', 'mid', 'enterprise']] = Field(None, description="Organization size")
    nicheTags: Optional[List[str]] = Field(None, description="Tags about the lead's niche")
    geo: Optional[str] = Field(None, description="Geographic location")


class OutboundMessage(BaseModel):
    messageId: Optional[str] = None
    purpose: Literal['initial', 'followup_1', 'followup_2', 'breakup', 'reply']
    subject: Optional[str] = None
    opener: str = Field(..., description="First sentence or two")
    cta: str = Field(..., description="Call-to-action")
    bodyStructure: Literal['pain->proof->cta', 'proof->pain->cta', 'value_drop->cta', 'question_only', 'other']
    toneTags: List[str] = Field(default_factory=list)
    lengthBucket: Literal['short', 'medium', 'long']


class SalesConversationExtraction(BaseModel):
    leadPersonaHints: LeadPersonaHints
    pains: List[str]
    objections: List[str]
    buyingSignals: List[str]
    outboundMessages: List[OutboundMessage]
    outcome: Literal['replied_positive', 'replied_negative', 'no_reply', 'meeting_booked', 'closed_won', 'closed_lost', 'unknown']
    recommendedPersonaClusterText: str
    notes: Optional[str] = None


class Participant(BaseModel):
    email: Optional[str] = None
    name: Optional[str] = None
    role: Literal['customer', 'agent', 'rep', 'internal']


class DistillSalesIntelligenceInput(BaseModel):
    conversationText: str
    participants: List[Participant]


async def extract_sales_conversation(input_data: DistillSalesIntelligenceInput) -> SalesConversationExtraction:
    """
    Extract structured sales intelligence from a conversation.
    
    Args:
        input_data: Sales conversation text and participants
        
    Returns:
        SalesConversationExtraction with structured sales signals
    """
    try:
        # Initialize Vertex AI
        aiplatform.init(project=os.getenv("FIREBASE_PROJECT_ID", "riverr-ai"), location="us-central1")
        
        participants_str = "\n".join([
            f"- {p.name or 'Unknown'} ({p.role})" + (f": {p.email}" if p.email else "")
            for p in input_data.participants
        ])
        
        prompt = f"""You are an expert sales operations analyst. Your job is to dissect a sales conversation and extract structured data.

Participants:
{participants_str}

Conversation:
---
{input_data.conversationText}
---

Return a JSON object with:
- leadPersonaHints: object with industry, role, orgSize, nicheTags, geo
- pains: array of problems the lead is experiencing
- objections: array of reasons for not wanting to buy
- buyingSignals: array of positive interest signals
- outboundMessages: array of sales messages with purpose, opening, cta, tone
- outcome: one of ['replied_positive', 'replied_negative', 'no_reply', 'meeting_booked', 'closed_won', 'closed_lost', 'unknown']
- recommendedPersonaClusterText: compact summary for clustering
- notes: any other observations

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
        
        # Parse lead persona hints
        persona_hints_data = response_data.get("leadPersonaHints", {})
        lead_persona_hints = LeadPersonaHints(
            industry=persona_hints_data.get("industry"),
            role=persona_hints_data.get("role"),
            orgSize=persona_hints_data.get("orgSize"),
            nicheTags=persona_hints_data.get("nicheTags"),
            geo=persona_hints_data.get("geo")
        )
        
        # Parse outbound messages
        outbound_messages = []
        for msg_data in response_data.get("outboundMessages", []):
            try:
                outbound_messages.append(OutboundMessage(**msg_data))
            except Exception as e:
                print(f"Error parsing message: {e}")
                continue
        
        return SalesConversationExtraction(
            leadPersonaHints=lead_persona_hints,
            pains=response_data.get("pains", []),
            objections=response_data.get("objections", []),
            buyingSignals=response_data.get("buyingSignals", []),
            outboundMessages=outbound_messages,
            outcome=response_data.get("outcome", "unknown"),
            recommendedPersonaClusterText=response_data.get("recommendedPersonaClusterText", ""),
            notes=response_data.get("notes")
        )
        
    except Exception as e:
        print(f"Extract sales conversation failed: {str(e)}")
        raise
