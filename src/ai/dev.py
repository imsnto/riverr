"""
Development entry point for AI flows.
Imports all available flow modules.
"""

import os
from dotenv import load_dotenv

load_dotenv()

# Import all AI flow functions
from flows.suggest_project_from_meeting import suggest_project_from_meeting
from flows.create_task_from_thread import create_task_from_thread
from flows.assist_in_document import assist_in_document
from flows.generate_cover_image import generate_cover_image
from flows.distill_support_intent import distill_support_intent
from flows.distill_sales_intelligence import extract_sales_conversation
from flows.summarize_sales_cluster import summarize_sales_cluster
from flows.recommend_next_sales_action import recommend_next_sales_action
from flows.draft_sales_email import draft_sales_email
from flows.suggest_library_icon import suggest_library_icon
from flows.crawl_website_knowledge import crawl_website_knowledge
from flows.agent_response import agent_response
from flows.evaluate_support_insight import evaluate_support_insight

__all__ = [
    'suggest_project_from_meeting',
    'create_task_from_thread',
    'assist_in_document',
    'generate_cover_image',
    'distill_support_intent',
    'extract_sales_conversation',
    'summarize_sales_cluster',
    'recommend_next_sales_action',
    'draft_sales_email',
    'suggest_library_icon',
    'crawl_website_knowledge',
    'agent_response',
    'evaluate_support_insight',
]

if __name__ == '__main__':
    print("AI Flow modules loaded successfully")
