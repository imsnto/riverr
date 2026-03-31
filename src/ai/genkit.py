"""
AI configuration module - Initializes Vertex AI and Gemini models.
"""

import os
from google.cloud import aiplatform
from google.cloud import generative_models

# Initialize Vertex AI
PROJECT_ID = os.getenv("FIREBASE_PROJECT_ID", "riverr-ai")
LOCATION = os.getenv("VERTEX_REGION", "us-central1")
MODEL_NAME = "gemini-2.0-flash"

aiplatform.init(project=PROJECT_ID, location=LOCATION)

# Initialize Generative Model
ai = generative_models.GenerativeModel(MODEL_NAME)

__all__ = ['ai', 'aiplatform', 'MODEL_NAME', 'PROJECT_ID', 'LOCATION']
