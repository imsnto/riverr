"""Core AI orchestration logic"""
import asyncio
import time
from typing import Dict, List, Optional

from services import firebase, vertex_ai, gemini
from models import SourceResult, InvokeAgentResponse
from config import VECTOR_SEARCH_POOL_SIZE, DEFAULT_SEARCH_LIMIT


class InvokeAgentPipeline:
    """Main AI message processing pipeline"""

    def __init__(self):
        self.search_semaphore = asyncio.Semaphore(VECTOR_SEARCH_POOL_SIZE)
        self.bot_config_cache = {}

    async def invoke_agent(
        self,
        conversation_id: str,
        message: str,
        bot_id: str,
        space_id: str,
    ) -> Dict:
        """
        Main entrypoint for AI message processing.

        Args:
            conversation_id: Firestore conversation ID
            message: User message text
            bot_id: Bot ID
            space_id: Space/tenant ID

        Returns:
            InvokeAgentResponse as dict
        """
        start_time = time.time()

        try:
            # Step 1: Load bot configuration
            bot = await self._get_bot_config(bot_id, space_id)
            if not bot:
                return self._error_response("Bot not found", 404, start_time)

            if not bot.get("ai_enabled", True):
                return self._error_response("AI is not enabled for this bot", 400, start_time)

            # Step 2: Retrieve knowledge context from vector search
            search_results = await self._retrieve_knowledge(
                query=message,
                space_id=space_id,
                bot=bot,
            )

            # Step 3: Generate response using Gemini
            generate_result = await self._generate_response(
                query=message,
                context=search_results,
                bot_name=bot.get("name", "Assistant"),
                bot_instruction=bot.get("instruction"),
            )

            # Step 4: Build and return response
            execution_time = (time.time() - start_time) * 1000

            return {
                "answer": generate_result["answer"],
                "confidence": 0.85,
                "sources": [r.dict() if hasattr(r, 'dict') else r for r in search_results],
                "usedAgentName": bot.get("name", "ai"),
                "execution_time_ms": int(execution_time),
            }

        except Exception as e:
            return self._error_response(str(e), 500, start_time)

    async def _get_bot_config(self, bot_id: str, space_id: str) -> Optional[Dict]:
        """Fetch bot config with caching"""
        cache_key = f"{space_id}:{bot_id}"
        
        if cache_key in self.bot_config_cache:
            return self.bot_config_cache[cache_key]

        bot = await firebase.get_bot(bot_id, space_id)
        if bot:
            self.bot_config_cache[cache_key] = bot
        return bot

    async def _retrieve_knowledge(
        self,
        query: str,
        space_id: str,
        bot: Dict,
    ) -> List[SourceResult]:
        """Search knowledge base with visibility filtering"""
        allowed_sources = bot.get("allowedHelpCenterIds", [])
        
        # Use semaphore to limit concurrent vector searches
        async with self.search_semaphore:
            results = await vertex_ai.search(
                query=query,
                index_name="articles-index",
                space_id=space_id,
                limit=DEFAULT_SEARCH_LIMIT,
                visible_sources=allowed_sources,
            )

        # Filter and validate results
        filtered = []
        for r in results:
            try:
                source = SourceResult(
                    title=r.get("title", ""),
                    text=r.get("text", ""),
                    url=r.get("url"),
                    score=float(r.get("score", 0)),
                    source_type=r.get("source_type", "article"),
                )
                filtered.append(source)
            except Exception as e:
                print(f"Error processing search result: {e}")
                continue

        return filtered

    async def _generate_response(
        self,
        query: str,
        context: List[SourceResult],
        bot_name: str,
        bot_instruction: Optional[str] = None,
    ) -> Dict:
        """Call Gemini to generate response"""
        
        # Convert SourceResult objects to dicts for Gemini
        context_dicts = [
            c.dict() if hasattr(c, 'dict') else c 
            for c in context
        ]
        
        result = await gemini.generate(
            query=query,
            context=context_dicts,
            bot_name=bot_name,
            instruction=bot_instruction,
        )

        return result

    def _error_response(self, message: str, code: int, start_time: float) -> Dict:
        """Generate error response"""
        execution_time = (time.time() - start_time) * 1000
        return {
            "answer": f"Error: {message}",
            "confidence": 0.0,
            "sources": [],
            "usedAgentName": "error",
            "execution_time_ms": int(execution_time),
            "error": True,
            "error_code": code,
            "error_message": message,
        }

    def clear_cache(self):
        """Clear bot config cache"""
        self.bot_config_cache.clear()


# Singleton instance
pipeline = InvokeAgentPipeline()


async def invoke_agent(
    conversation_id: str,
    message: str,
    bot_id: str,
    space_id: str,
) -> Dict:
    """Public API for agent invocation"""
    return await pipeline.invoke_agent(conversation_id, message, bot_id, space_id)
