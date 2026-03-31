"""
Agent Response Flow - Generates grounded AI responses using LLM.
"""

from typing import Optional, List
from pydantic import BaseModel
from google.cloud import aiplatform


class ContextChunk(BaseModel):
    title: str
    text: str
    url: Optional[str] = None


class AgentResponseInput(BaseModel):
    query: str
    botName: str
    context: List[ContextChunk]
    greetingScript: Optional[str] = None


class AgentResponseOutput(BaseModel):
    answer: str


async def agent_response(input_data: AgentResponseInput) -> AgentResponseOutput:
    """
    Generate a conversational response based on context and query.
    
    Args:
        input_data: Agent response input with query, context, and bot info
        
    Returns:
        AgentResponseOutput with generated answer
    """
    try:
        # Initialize Vertex AI
        aiplatform.init(project="riverr-ai", location="us-central1")
        
        # Build context string
        context_text = "\n\n".join([
            f"**{chunk.title}**\n{chunk.text}\n{f'(Source: {chunk.url})' if chunk.url else ''}"
            for chunk in input_data.context
        ])
        
        # Build system instruction
        system_instruction = input_data.greetingScript or f"You are {input_data.botName}, a helpful AI assistant. Be conversational and accurate."
        
        # Create prompt
        prompt = f"""System: {system_instruction}

Context:
{context_text}

User Question: {input_data.query}

Provide a helpful, concise answer based on the context above. If the context doesn't contain relevant information, say so."""
        
        # Call Gemini API
        model = aiplatform.generative_models.GenerativeModel("gemini-1.5-pro")
        response = model.generate_content(prompt)
        
        answer = response.text if response.text else ""
        
        return AgentResponseOutput(answer=answer)
        
    except Exception as e:
        print(f"Agent response generation failed: {str(e)}")
        raise
