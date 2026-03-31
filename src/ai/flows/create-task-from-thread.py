"""
Create Task From Thread Flow - Extracts task information from message threads.
"""

from typing import Optional, List, Literal
from pydantic import BaseModel, Field
import json
from google.cloud import aiplatform
import os


class SimplifiedUser(BaseModel):
    id: str
    name: str


class SimplifiedProject(BaseModel):
    id: str
    name: str


class CreateTaskFromThreadInput(BaseModel):
    threadContent: str = Field(..., description="Full content of the message thread")
    channelMembers: List[SimplifiedUser] = Field(default_factory=list)
    projects: List[SimplifiedProject] = Field(default_factory=list)


class CreateTaskFromThreadOutput(BaseModel):
    title: str = Field(..., description="Concise action-oriented task title")
    description: str = Field(..., description="Detailed summary of the conversation and action items")
    suggestedAssigneeId: Optional[str] = Field(None, description="ID of suggested assignee")
    suggestedProjectId: Optional[str] = Field(None, description="ID of suggested project")
    suggestedDueDate: Optional[str] = Field(None, description="Suggested due date in ISO format")
    suggestedPriority: Optional[Literal['Low', 'Medium', 'High', 'Urgent']] = Field(None, description="Suggested priority")


async def create_task_from_thread(input_data: CreateTaskFromThreadInput) -> CreateTaskFromThreadOutput:
    """
    Extract task information from a message thread.
    
    Args:
        input_data: Thread content and channel context
        
    Returns:
        CreateTaskFromThreadOutput with task details
    """
    try:
        # Initialize Vertex AI
        aiplatform.init(project=os.getenv("FIREBASE_PROJECT_ID", "riverr-ai"), location="us-central1")
        
        members_json = json.dumps([m.dict() for m in input_data.channelMembers])
        projects_json = json.dumps([p.dict() for p in input_data.projects])
        
        prompt = f"""You are an intelligent project management assistant. Your task is to analyze a conversation thread and convert it into a structured task.

**Thread Content:**
---
{input_data.threadContent}
---

**Available Channel Members:**
{members_json}

**Available Projects:**
{projects_json}

**Your Task:**
1. Extract the main action item(s) from the thread
2. Create a concise, action-oriented title
3. Summarize the context and action items in the description
4. Suggest an assignee based on who was mentioned or responded
5. Suggest a project if one is mentioned or implied
6. Extract any timeline or deadlines mentioned
7. Assess the urgency/priority

Return ONLY valid JSON with these fields:
- title: string (action-oriented, e.g., "Review homepage mockups")
- description: string (detailed summary)
- suggestedAssigneeId: string or null (ID from members list)
- suggestedProjectId: string or null (ID from projects list)
- suggestedDueDate: string or null (ISO format, e.g., "2024-08-20T23:59:59Z")
- suggestedPriority: string or null (one of: "Low", "Medium", "High", "Urgent")

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
        
        return CreateTaskFromThreadOutput(
            title=response_data.get("title", ""),
            description=response_data.get("description", ""),
            suggestedAssigneeId=response_data.get("suggestedAssigneeId"),
            suggestedProjectId=response_data.get("suggestedProjectId"),
            suggestedDueDate=response_data.get("suggestedDueDate"),
            suggestedPriority=response_data.get("suggestedPriority")
        )
        
    except Exception as e:
        print(f"Create task from thread failed: {str(e)}")
        raise
