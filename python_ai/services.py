"""External service clients (Firebase, Vertex AI, Gemini)"""
import asyncio
from typing import Optional, List, Dict, Any
from firebase_admin import initialize_app, credentials, firestore
from google.cloud import aiplatform
import google.generativeai as genai

from config import (
    FIREBASE_PROJECT_ID,
    FIRESTORE_CREDENTIALS_PATH,
    VERTEX_PROJECT_ID,
    VERTEX_REGION,
    VECTOR_SEARCH_ENDPOINT,
    GEMINI_MODEL,
    GEMINI_API_KEY,
)


class FirebaseService:
    """Firestore client wrapper (singleton)"""
    _instance: Optional["FirebaseService"] = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(FirebaseService, cls).__new__(cls)
        return cls._instance

    def __init__(self):
        if not hasattr(self, "initialized"):
            try:
                cred = credentials.Certificate(FIRESTORE_CREDENTIALS_PATH)
                initialize_app(cred, {"projectId": FIREBASE_PROJECT_ID})
                self.client = firestore.client()
                self.initialized = True
            except Exception as e:
                print(f"Firebase initialization error: {e}")
                raise

    async def get_bot(self, bot_id: str, space_id: str) -> Optional[Dict]:
        """Fetch bot configuration"""
        try:
            doc = (
                self.client.collection("Spaces")
                .document(space_id)
                .collection("bots")
                .document(bot_id)
                .get()
            )
            return doc.to_dict() if doc.exists else None
        except Exception as e:
            print(f"Error fetching bot: {e}")
            return None

    async def get_conversation(self, conversation_id: str) -> Optional[Dict]:
        """Fetch conversation metadata"""
        try:
            doc = self.client.collection("conversations").document(conversation_id).get()
            return doc.to_dict() if doc.exists else None
        except Exception as e:
            print(f"Error fetching conversation: {e}")
            return None

    async def save_message(self, message_id: str, data: Dict) -> bool:
        """Save message to chat_messages collection"""
        try:
            self.client.collection("chat_messages").document(message_id).set(data, merge=True)
            return True
        except Exception as e:
            print(f"Error saving message: {e}")
            return False


class VertexAIService:
    """Vertex AI Vector Search wrapper (singleton)"""
    _instance: Optional["VertexAIService"] = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(VertexAIService, cls).__new__(cls)
        return cls._instance

    def __init__(self):
        if not hasattr(self, "initialized"):
            try:
                aiplatform.init(project=VERTEX_PROJECT_ID, location=VERTEX_REGION)
                self.initialized = True
            except Exception as e:
                print(f"Vertex AI initialization error: {e}")
                raise

    async def search(
        self,
        query: str,
        index_name: str,
        space_id: str,
        limit: int = 5,
        visible_sources: Optional[List[str]] = None,
    ) -> List[Dict]:
        """Search vector index for similar articles"""
        try:
            # Mock implementation - replace with actual Vertex AI Vector Search API
            # In production, call the Vertex AI Vector Search API endpoint
            
            # Placeholder: simulate vector search response
            results = [
                {
                    "title": f"Support Article - {i}",
                    "text": f"Content for query: {query}",
                    "url": f"https://help.example.com/article-{i}",
                    "score": 0.92 - (i * 0.05),
                    "source_type": "article",
                    "article_id": f"article_{i}",
                }
                for i in range(min(limit, 3))
            ]
            return results
        except Exception as e:
            print(f"Error searching vectors: {e}")
            return []

    async def generate_embeddings(self, text: str, model: str = "text-embedding-004") -> Optional[List[float]]:
        """Generate vector embedding for text"""
        try:
            # Mock implementation - return zero vector
            return [0.0] * 2048  # text-embedding-004 outputs 2048 dimensions
        except Exception as e:
            print(f"Error generating embeddings: {e}")
            return None


class GeminiService:
    """Google Gemini LLM wrapper (singleton)"""
    _instance: Optional["GeminiService"] = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(GeminiService, cls).__new__(cls)
        return cls._instance

    def __init__(self):
        if not hasattr(self, "initialized"):
            try:
                if GEMINI_API_KEY:
                    genai.configure(api_key=GEMINI_API_KEY)
                self.model = genai.GenerativeModel(GEMINI_MODEL)
                self.initialized = True
            except Exception as e:
                print(f"Gemini initialization error: {e}")
                raise

    async def generate(
        self,
        query: str,
        context: List[Dict],
        bot_name: str,
        instruction: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Generate AI response using Gemini"""
        try:
            # Build context string
            context_text = "\n".join(
                [f"Source: {c.get('title', 'Unknown')}\n{c.get('text', '')}" for c in context]
            )

            # Build prompt
            system_instruction = instruction or "Provide a helpful, accurate response based on the context above."
            prompt = f"""You are {bot_name}, a helpful AI assistant.

Context Information:
{context_text if context_text else "No context available."}

User Question: {query}

{system_instruction}

Answer:"""

            # Call Gemini API using asyncio
            response = await asyncio.to_thread(
                self.model.generate_content,
                prompt,
            )

            return {
                "answer": response.text if response else "Unable to generate response",
                "model": GEMINI_MODEL,
                "tokens": getattr(response.usage_metadata, "total_token_count", 0) if response else 0,
            }
        except Exception as e:
            print(f"Error generating response: {e}")
            return {
                "answer": f"Error: {str(e)}",
                "model": GEMINI_MODEL,
                "tokens": 0,
            }


# Singleton instances
firebase = FirebaseService()
vertex_ai = VertexAIService()
gemini = GeminiService()
