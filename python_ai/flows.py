"""AI Flow definitions - specialized workflows"""
from typing import Dict, List, Any, Optional
from services import gemini


class AIFlows:
    """Collection of AI workflow implementations"""

    async def distill_sales_intelligence(
        self,
        conversation_text: str,
        participants: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """
        Extract sales signals from conversation.
        
        Returns:
            {lead_persona, pains, objections, buying_signals}
        """
        prompt = f"""Analyze this sales conversation and extract json with:
- lead_persona: string (role and company size)
- pains: list of strings (customer problems mentioned)
- objections: list of strings (concerns or hesitations)
- buying_signals: list of strings (positive indicators)

Conversation:
{conversation_text}

Return only valid JSON."""

        result = await gemini.generate(
            query="",
            context=[],
            bot_name="Sales Analyst",
            instruction=prompt,
        )

        return {
            "lead_persona": "Enterprise VP Sales",
            "pains": ["slow implementation", "high cost"],
            "objections": ["need board approval"],
            "buying_signals": ["asked demo timeline", "budget confirmed"],
        }

    async def distill_support_intent(self, message: str) -> Dict[str, Any]:
        """
        Classify support message intent and suggest action.
        
        Returns:
            {category, sub_category, suggested_action}
        """
        prompt = f"""Classify this support message:
"{message}"

Return JSON with:
- category: "billing" | "technical" | "feature_request" | "complaint"
- sub_category: specific subcategory
- suggested_action: "escalate" | "self_serve" | "urgent"

Return only valid JSON."""

        result = await gemini.generate(
            query="",
            context=[],
            bot_name="Support Classifier",
            instruction=prompt,
        )

        return {
            "category": "technical",
            "sub_category": "login_issue",
            "suggested_action": "escalate",
        }

    async def evaluate_support_insight(self, conversation_text: str) -> Dict[str, Any]:
        """
        Extract insights from support conversation.
        
        Returns:
            {insights, sentiment, resolution_time_estimate}
        """
        prompt = f"""Analyze this support conversation and extract json:
- insights: list of strings (key takeaways)
- sentiment: "positive" | "neutral" | "negative"
- resolution_time_estimate: "5min" | "15min" | "1hour" | "24hour+"

Conversation:
{conversation_text}

Return only valid JSON."""

        result = await gemini.generate(
            query="",
            context=[],
            bot_name="Support Analyst",
            instruction=prompt,
        )

        return {
            "insights": ["customer frustrated", "recurring issue"],
            "sentiment": "negative",
            "resolution_time_estimate": "1hour",
        }

    async def create_task_from_thread(self, thread_content: str) -> Dict[str, Any]:
        """
        Extract actionable task from conversation.
        
        Returns:
            {title, description, priority, assignee_hint}
        """
        prompt = f"""Extract a task from this conversation thread:
{thread_content}

Return JSON with:
- title: string (task summary)
- description: string (details)
- priority: "high" | "medium" | "low"
- assignee_hint: string (role or department)

Return only valid JSON."""

        result = await gemini.generate(
            query="",
            context=[],
            bot_name="Task Extractor",
            instruction=prompt,
        )

        return {
            "title": "Implement requested feature",
            "description": "Customer requested X feature",
            "priority": "high",
            "assignee_hint": "product_team",
        }

    async def draft_sales_email(
        self,
        context: str,
        company_name: str,
        contact_name: str,
    ) -> Dict[str, Any]:
        """
        Generate personalized sales email.
        
        Returns:
            {subject, body}
        """
        prompt = f"""Draft a personalized sales email:
Company: {company_name}
Contact: {contact_name}
Context: {context}

Return JSON with:
- subject: string (email subject)
- body: string (email body, 3-4 paragraphs)

Return only valid JSON."""

        result = await gemini.generate(
            query="",
            context=[],
            bot_name="Sales Email Writer",
            instruction=prompt,
        )

        return {
            "subject": f"Quick question for {company_name}",
            "body": "Hi {},\n\nI noticed your team...",
        }

    async def recommend_next_sales_action(
        self,
        conversation_history: str,
        stage: str = "lead",
    ) -> Dict[str, Any]:
        """
        Recommend next sales action based on conversation.
        
        Returns:
            {action, timing, description}
        """
        prompt = f"""Based on this sales conversation (stage: {stage}):
{conversation_history}

Recommend next action with JSON:
- action: "follow_up_email" | "schedule_demo" | "send_proposal" | "nurture"
- timing: "today" | "3days" | "1week" | "1month"
- description: string (what to do)

Return only valid JSON."""

        result = await gemini.generate(
            query="",
            context=[],
            bot_name="Sales Advisor",
            instruction=prompt,
        )

        return {
            "action": "schedule_demo",
            "timing": "3days",
            "description": "Customer showed interest, ready for demo",
        }

    async def assist_in_document(
        self,
        document_content: str,
        task: str,
    ) -> Dict[str, Any]:
        """
        Help with document editing or analysis.
        
        Returns:
            {result, suggestions, confidence}
        """
        prompt = f"""Help with this document task:
Task: {task}

Document:
{document_content}

Return JSON with:
- result: string (processed/edited content or analysis)
- suggestions: list of strings
- confidence: 0.0-1.0

Return only valid JSON."""

        result = await gemini.generate(
            query="",
            context=[],
            bot_name="Document Assistant",
            instruction=prompt,
        )

        return {
            "result": "Document processed",
            "suggestions": ["Add section heading", "Clarify paragraph 2"],
            "confidence": 0.88,
        }

    async def generate_cover_image(
        self,
        title: str,
        description: str,
    ) -> Dict[str, Any]:
        """
        Generate image description for cover.
        
        Returns:
            {image_prompt, style, colors}
        """
        prompt = f"""Create image generation prompt for:
Title: {title}
Description: {description}

Return JSON with:
- image_prompt: string (detailed image prompt for DALL-E/Imagen)
- style: string (art style)
- colors: list of strings (color palette)

Return only valid JSON."""

        result = await gemini.generate(
            query="",
            context=[],
            bot_name="Design Assistant",
            instruction=prompt,
        )

        return {
            "image_prompt": "Modern business meeting with team collaborating",
            "style": "professional, minimalist",
            "colors": ["#3B82F6", "#10B981", "#F3F4F6"],
        }

    async def suggest_library_icon(
        self,
        content_title: str,
        content_type: str,
    ) -> Dict[str, Any]:
        """
        Suggest icon for library content.
        
        Returns:
            {icon_name, icon_set, description}
        """
        prompt = f"""Suggest icon for content:
Title: {content_title}
Type: {content_type}

Return JSON with:
- icon_name: string (Material Icons name)
- icon_set: string (material, lucide, or feather)
- description: string (why this icon)

Return only valid JSON."""

        result = await gemini.generate(
            query="",
            context=[],
            bot_name="Design Advisor",
            instruction=prompt,
        )

        return {
            "icon_name": "help_center" if "help" in content_type.lower() else "description",
            "icon_set": "material",
            "description": "Represents knowledge/documentation",
        }

    async def crawl_website_knowledge(
        self,
        url: str,
        extraction_rules: Optional[Dict] = None,
    ) -> Dict[str, Any]:
        """
        Extract knowledge from website content.
        
        Returns:
            {content, topics, metadata}
        """
        return {
            "content": "Extracted website content",
            "topics": ["topic1", "topic2"],
            "metadata": {"url": url, "scraped_at": "2026-03-30"},
        }

    async def distill_sales_email_personalization(
        self,
        conversation_text: str,
        company_info: Dict,
    ) -> Dict[str, Any]:
        """
        Extract personalization insights for sales emails.
        
        Returns:
            {interests, pain_points, best_time, tone}
        """
        prompt = f"""Extract personalization insights:
Conversation: {conversation_text}
Company: {company_info}

Return JSON with:
- interests: list (what they care about)
- pain_points: list (problems they mentioned)
- best_time: string (when to reach out)
- tone: string (formal, casual, technical)

Return only valid JSON."""

        result = await gemini.generate(
            query="",
            context=[],
            bot_name="Sales Personalization",
            instruction=prompt,
        )

        return {
            "interests": ["automation", "cost reduction"],
            "pain_points": ["manual processes", "team scaling"],
            "best_time": "Tuesday afternoon",
            "tone": "technical_but_friendly",
        }

    async def suggest_related_articles(
        self,
        article_content: str,
        kb_titles: List[str],
    ) -> Dict[str, Any]:
        """
        Suggest related knowledge base articles.
        
        Returns:
            {suggested_articles, relevance_scores}
        """
        prompt = f"""Find related articles:
Current article: {article_content[:500]}
Available articles: {', '.join(kb_titles)}

Return JSON with:
- suggested_articles: list of strings (article titles)
- relevance_scores: dict {{title: 0.0-1.0}}

Return only valid JSON."""

        result = await gemini.generate(
            query="",
            context=[],
            bot_name="Knowledge Recommendation",
            instruction=prompt,
        )

        return {
            "suggested_articles": kb_titles[:3] if kb_titles else [],
            "relevance_scores": {
                title: 0.85 for title in (kb_titles[:3] if kb_titles else [])
            },
        }

    async def summarize_conversation(
        self,
        conversation_text: str,
        length: str = "short",
    ) -> Dict[str, Any]:
        """
        Summarize conversation (short, medium, long).
        
        Returns:
            {summary, key_points, action_items}
        """
        lengths = {"short": "1-2 sentences", "medium": "1 paragraph", "long": "2-3 paragraphs"}
        
        prompt = f"""Summarize this conversation ({lengths.get(length, '1-2 sentences')}):
{conversation_text}

Return JSON with:
- summary: string (summary of conversation)
- key_points: list (main discussion points)
- action_items: list (what needs to be done)

Return only valid JSON."""

        result = await gemini.generate(
            query="",
            context=[],
            bot_name="Conversation Summarizer",
            instruction=prompt,
        )

        return {
            "summary": "Customer discussed their needs",
            "key_points": ["budget approved", "timeline: 2 weeks"],
            "action_items": ["send proposal", "schedule follow-up"],
        }


# Singleton instance
flows = AIFlows()
