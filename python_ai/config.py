"""Configuration and constants for Riverr AI Service"""
import os
from dotenv import load_dotenv

load_dotenv()

# Firebase Configuration
FIREBASE_PROJECT_ID = os.getenv("FIREBASE_PROJECT_ID", "riverr-prod")
FIRESTORE_CREDENTIALS_PATH = os.getenv("FIRESTORE_CREDENTIALS_PATH", "./serviceAccountKey.json")

# Vertex AI Configuration
VERTEX_PROJECT_ID = os.getenv("VERTEX_PROJECT_ID", FIREBASE_PROJECT_ID)
VERTEX_REGION = os.getenv("VERTEX_REGION", "us-central1")
VECTOR_SEARCH_INDEX_NAME = os.getenv("VECTOR_SEARCH_INDEX_NAME", "articles-index")
VECTOR_SEARCH_ENDPOINT = os.getenv("VECTOR_SEARCH_ENDPOINT", "")

# Gemini Configuration
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")

# Service Configuration
PORT = int(os.getenv("PORT", 8000))
DEBUG = os.getenv("DEBUG", "False").lower() == "true"
SERVICE_URL = os.getenv("SERVICE_URL", "http://localhost:8000")

# Timeouts (seconds)
VECTOR_SEARCH_TIMEOUT = int(os.getenv("VECTOR_SEARCH_TIMEOUT", 5))
LLM_GENERATION_TIMEOUT = int(os.getenv("LLM_GENERATION_TIMEOUT", 10))

# Performance Settings
VECTOR_SEARCH_POOL_SIZE = int(os.getenv("VECTOR_SEARCH_POOL_SIZE", 5))
BOT_CONFIG_CACHE_TTL = int(os.getenv("BOT_CONFIG_CACHE_TTL", 3600))

# Search Configuration
DEFAULT_SEARCH_LIMIT = 5
MAX_SEARCH_LIMIT = 20
