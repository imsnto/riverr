"""
Generate Cover Image Flow - Generates descriptions for cover images.
"""

from typing import Optional
from pydantic import BaseModel, Field
import json
from google.cloud import aiplatform
import os


class GenerateCoverImageInput(BaseModel):
    title: str = Field(..., description="Title or subject of the cover image")
    context: Optional[str] = Field(None, description="Additional context about the image")
    style: Optional[str] = Field(None, description="Style preference (e.g., 'modern', 'minimal', 'professional')")


class GenerateCoverImageOutput(BaseModel):
    imagePrompt: str = Field(..., description="Detailed prompt for image generation")
    colorPalette: list = Field(..., description="Suggested color palette")
    compositionalNotes: str = Field(..., description="Notes on composition and layout")


async def generate_cover_image(input_data: GenerateCoverImageInput) -> GenerateCoverImageOutput:
    """
    Generate a detailed prompt for creating a cover image.
    
    Args:
        input_data: Title, context, and style preferences
        
    Returns:
        GenerateCoverImageOutput with image generation details
    """
    try:
        # Initialize Vertex AI
        aiplatform.init(project=os.getenv("FIREBASE_PROJECT_ID", "riverr-ai"), location="us-central1")
        
        context_str = f"Context: {input_data.context}" if input_data.context else ""
        style_str = f"Style: {input_data.style}" if input_data.style else "Modern and professional"
        
        prompt = f"""You are an expert creative director. Your task is to create a detailed prompt for generating a cover image.

Title: {input_data.title}
{context_str}
{style_str}

**Your Task:**
1. Create a detailed, vivid prompt suitable for an AI image generator
2. Suggest a color palette that works well for the title/topic
3. Provide notes on composition and layout

Return ONLY valid JSON with these fields:
- imagePrompt: string (detailed prompt for image generation)
- colorPalette: array of hex colors or color names
- compositionalNotes: string (notes on layout and composition)

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
        
        return GenerateCoverImageOutput(
            imagePrompt=response_data.get("imagePrompt", ""),
            colorPalette=response_data.get("colorPalette", []),
            compositionalNotes=response_data.get("compositionalNotes", "")
        )
        
    except Exception as e:
        print(f"Generate cover image failed: {str(e)}")
        raise
