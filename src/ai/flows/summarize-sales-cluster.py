"""
Summarize Sales Cluster Flow - Summarizes patterns across multiple sales conversations.
"""

from typing import Optional, List
from pydantic import BaseModel, Field
import json
from google.cloud import aiplatform
import os


class SummarizeSalesClusterInput(BaseModel):
    conversations: List[str] = Field(..., description="List of sales conversations to analyze")
    focusArea: Optional[str] = Field(None, description="Specific area to focus on (e.g., 'pricing objections')")


class SummarizeSalesClusterOutput(BaseModel):
    commonPains: List[str] = Field(..., description="Common pain points across conversations")
    buyingPatterns: List[str] = Field(..., description="Observed buying patterns")
    effectiveArguments: List[str] = Field(..., description="Arguments that worked across multiple conversations")
    recommendedStrategy: str = Field(..., description="Recommended sales strategy for this cluster")


async def summarize_sales_cluster(input_data: SummarizeSalesClusterInput) -> SummarizeSalesClusterOutput:
    """
    Analyze and summarize patterns across multiple sales conversations.
    
    Args:
        input_data: List of conversations to cluster analysis
        
    Returns:
        SummarizeSalesClusterOutput with patterns and strategy
    """
    try:
        # Initialize Vertex AI
        aiplatform.init(project=os.getenv("FIREBASE_PROJECT_ID", "riverr-ai"), location="us-central1")
        
        conv_text = "\n\n---CONVERSATION---\n\n".join(input_data.conversations)
        focus = f"Focus Area: {input_data.focusArea}" if input_data.focusArea else "No specific focus"
        
        prompt = f"""You are an expert sales analyst. Your task is to identify patterns and strategies from multiple sales conversations.

{focus}

Conversations to analyze:
---
{conv_text}
---

**Your Task:**
1. Identify common pain points mentioned across conversations
2. Identify buying patterns (e.g., who buys, under what conditions)
3. Identify effective sales arguments that moved conversations forward
4. Recommend an overall strategy based on these patterns

Return ONLY valid JSON with these fields:
- commonPains: array of strings (common problems mentioned)
- buyingPatterns: array of strings (patterns that indicate readiness to buy)
- effectiveArguments: array of strings (arguments that worked)
- recommendedStrategy: string (overall sales strategy recommendation)

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
        
        return SummarizeSalesClusterOutput(
            commonPains=response_data.get("commonPains", []),
            buyingPatterns=response_data.get("buyingPatterns", []),
            effectiveArguments=response_data.get("effectiveArguments", []),
            recommendedStrategy=response_data.get("recommendedStrategy", "")
        )
        
    except Exception as e:
        print(f"Summarize sales cluster failed: {str(e)}")
        raise
