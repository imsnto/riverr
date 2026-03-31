"""
Draft Sales Email Flow - Generates personalized sales emails.
"""

from typing import Optional, List
from pydantic import BaseModel, Field
import json
from google.cloud import aiplatform
import os


class Lead(BaseModel):
    name: Optional[str] = None
    company: Optional[str] = None


class Persona(BaseModel):
    summary: str
    winningAngles: List[str]


class MessagePattern(BaseModel):
    purpose: str
    bodyStructure: str
    ctaStyle: str
    openerStyle: str
    toneTagsSorted: List[str]


class DraftSalesEmailInput(BaseModel):
    lead: Lead
    persona: Optional[Persona] = None
    messagePattern: Optional[MessagePattern] = None


class DraftSalesEmailOutput(BaseModel):
    subject: str = Field(..., description="Compelling, concise email subject line")
    body: str = Field(..., description="Full personalized email body with markdown formatting")


async def draft_sales_email(input_data: DraftSalesEmailInput) -> DraftSalesEmailOutput:
    """
    Generate a personalized sales email based on lead and persona data.
    
    Args:
        input_data: Lead info, persona, and message pattern
        
    Returns:
        DraftSalesEmailOutput with subject and body
    """
    try:
        # Initialize Vertex AI
        aiplatform.init(project=os.getenv("FIREBASE_PROJECT_ID", "riverr-ai"), location="us-central1")
        
        lead_name = input_data.lead.name or "Prospect"
        lead_company = input_data.lead.company or "their company"
        
        persona_section = ""
        if input_data.persona:
            angles = "\n  ".join([f"- {angle}" for angle in input_data.persona.winningAngles])
            persona_section = f"""**Matched Persona Profile:**
- Summary: {input_data.persona.summary}
- Key angles that work for this persona:
  {angles}"""
        else:
            persona_section = "**No matching persona found.**"
        
        pattern_section = ""
        if input_data.messagePattern:
            tone = " ".join(input_data.messagePattern.toneTagsSorted)
            pattern_section = f"""**Recommended Message Pattern:**
- Purpose: {input_data.messagePattern.purpose}
- Opener Style: {input_data.messagePattern.openerStyle}
- Body Structure: {input_data.messagePattern.bodyStructure}
- CTA Style: {input_data.messagePattern.ctaStyle}
- Tone: {tone}"""
        else:
            pattern_section = "**No specific message pattern recommended. Use your best judgment.**"
        
        prompt = f"""You are an expert sales copywriter. Your task is to draft a personalized outreach email to a lead.

**Lead Information:**
- Name: {lead_name}
- Company: {lead_company}

{persona_section}

{pattern_section}

**Your Task:**
Based on all the provided information, write a highly personalized and effective sales email.

1. **Subject Line**: Create a subject that is intriguing and relevant to the lead.
2. **Email Body**:
   - Craft an opener that aligns with the recommended style
   - Structure the body according to the pattern (address pain, provide proof, call-to-action)
   - Use the recommended tone tags
   - Keep it concise but compelling (100-250 words)

Return ONLY valid JSON with these fields:
- subject: string
- body: string (with markdown formatting)

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
        
        return DraftSalesEmailOutput(
            subject=response_data.get("subject", ""),
            body=response_data.get("body", "")
        )
        
    except Exception as e:
        print(f"Draft sales email failed: {str(e)}")
        raise
