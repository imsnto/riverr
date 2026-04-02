"""
agent.py - Hybrid Intelligence & Intent Routing Engine

Implements conversational AI reasoning + deterministic subflow execution.
"""

import re
from datetime import datetime
from typing import Optional, List, Dict, Any, Literal, Callable, Awaitable
from pydantic import BaseModel, Field
from enum import Enum


# ============= TYPE DEFINITIONS =============

class MessageRole(str, Enum):
    """Role of message sender."""
    USER = "user"
    ASSISTANT = "assistant"
    INTERNAL = "internal"


class ConfidenceLevel(str, Enum):
    """Confidence level classification."""
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class BotType(str, Enum):
    """Type of bot."""
    AGENT = "agent"
    WIDGET = "widget"


class AnswerMode(str, Enum):
    """Answer generation mode."""
    ARTICLE_GROUNDED = "article_grounded"
    TOPIC_SUPPORTED = "topic_supported"
    INSIGHT_SUPPORTED_HIDDEN = "insight_supported_hidden"
    INTERNAL_EVIDENCE_ONLY = "internal_evidence_only"
    CLARIFY = "clarify"
    ESCALATE = "escalate"


class ConfidenceStrategy(str, Enum):
    """Strategy for handling confidence levels."""
    ANSWER = "answer"
    ANSWER_SOFTLY = "answer_softly"
    CLARIFY = "clarify"
    ESCALATE = "escalate"


class HandoffStatus(str, Enum):
    """Handoff status."""
    NONE = "none"
    OFFERED = "offered"
    DECLINED = "declined"
    COMPLETED = "completed"


class ConversationStatus(str, Enum):
    """Conversation status."""
    OPEN = "open"
    WAITING_HUMAN = "waiting_human"
    RESOLVED = "resolved"


class ContextChunk(BaseModel):
    """Retrieved context chunk."""
    source_type: str  # 'article', 'topic', 'insight', 'chunk'
    id: str
    text: str
    title: Optional[str] = None
    url: Optional[str] = None
    score: float


class RetrievalDecision(BaseModel):
    """Decision from knowledge retrieval."""
    answer_mode: AnswerMode
    chosen_candidates: List[ContextChunk]
    confidence: float
    rationale: str


class IncomingMessage(BaseModel):
    """Incoming user message."""
    id: str
    role: MessageRole
    text: str
    created_at: str  # ISO format
    meta: Optional[Dict[str, Any]] = None


class Handoff(BaseModel):
    """Handoff state."""
    status: HandoffStatus
    reason: Optional[str] = None
    offered_at: Optional[str] = None


class ConversationMeta(BaseModel):
    """Conversation metadata."""
    attempt_count: Optional[int] = None
    intent_history: Optional[List[str]] = None
    active_playbook: Optional[Any] = None
    current_flow_step_id: Optional[str] = None
    extra: Optional[Dict[str, Any]] = Field(default_factory=dict)


class Conversation(BaseModel):
    """Conversation state."""
    id: str
    hub_id: str
    space_id: str
    status: ConversationStatus
    last_responder_type: Optional[str] = None
    ai_attempted: Optional[bool] = None
    ai_resolved: Optional[bool] = None
    customer_identified: Optional[bool] = None
    
    visitor_name: Optional[str] = None
    visitor_email: Optional[str] = None
    user_id: Optional[str] = None
    contact_id: Optional[str] = None
    
    handoff: Optional[Handoff] = None
    meta: Optional[ConversationMeta] = None


class BotConfig(BaseModel):
    """Bot configuration."""
    id: str
    type: BotType
    hub_id: str
    name: str
    web_agent_name: Optional[str] = None
    allowed_help_center_ids: List[str] = Field(default_factory=list)
    intelligence_access_level: Optional[str] = "topics_allowed"
    ai_enabled: Optional[bool] = True
    handoff_keywords: Optional[List[str]] = None
    quick_replies: Optional[List[str]] = None
    conversation_goal: Optional[str] = None
    
    # Intelligence posture
    behavior: Optional[Dict[str, Any]] = None
    confidence_handling: Optional[Dict[str, Any]] = None
    escalation: Optional[Dict[str, Any]] = None
    identity_capture: Optional[Dict[str, Any]] = None
    channel_config: Optional[Dict[str, Any]] = None
    tone: Optional[str] = None
    response_length: Optional[str] = None
    flow: Optional[Dict[str, Any]] = None


class ContextItem(BaseModel):
    """Context item for answer generation."""
    title: str
    text: str
    url: Optional[str] = None


class Source(BaseModel):
    """Source reference for answer."""
    title: str
    url: str
    article_id: str
    score: float


class AgentAdapters:
    """Interface for external dependencies (Firestore, LLM, etc.)."""
    
    def __init__(
        self,
        retrieve_context: Callable,
        generate_answer: Callable,
        escalate_to_human: Callable,
        persist_assistant_message: Callable,
        update_conversation: Callable,
    ):
        self.retrieve_context = retrieve_context
        self.generate_answer = generate_answer
        self.escalate_to_human = escalate_to_human
        self.persist_assistant_message = persist_assistant_message
        self.update_conversation = update_conversation


# ============= MAIN AGENT FUNCTIONS =============

async def handle_incoming_message(
    bot: BotConfig,
    conversation: Conversation,
    message: IncomingMessage,
    adapters: AgentAdapters,
) -> None:
    """
    Main entry point for processing incoming messages.
    
    Implements: escalation guards, handoff triggers, hybrid flow, AI fallback.
    """
    text = (message.text or "").strip()
    
    # ---- 1. ESCALATION GUARD ----
    if conversation.status in [ConversationStatus.WAITING_HUMAN, ConversationStatus.RESOLVED]:
        return
    
    # ---- 2. GLOBAL HANDOFF TRIGGERS ----
    default_handoff_keywords = ['human', 'agent', 'person', 'representative', 'support']
    handoff_keywords = bot.handoff_keywords or default_handoff_keywords
    
    if contains_any(text, handoff_keywords):
        await escalate_now(adapters, conversation, "Requested by user via keyword.")
        return
    
    # Force triggers from operator cockpit
    force_triggers = (bot.escalation or {}).get('forceTriggers', [])
    if force_triggers:
        trigger_map = {
            'billing': ['billing', 'invoice', 'payment', 'charge', 'subscription'],
            'refunds': ['refund', 'money back'],
            'angry_customer': ['upset', 'angry', 'terrible', 'awful', 'frustrated'],
            'legal': ['legal', 'lawsuit', 'lawyer'],
            'custom_quote': ['quote', 'pricing', 'enterprise']
        }
        for trigger in force_triggers:
            keywords = trigger_map.get(trigger, [])
            if contains_any(text, keywords):
                await escalate_now(adapters, conversation, f"Sensitive topic detected: {trigger}")
                return
    
    # ---- 3. HYBRID FLOW EXECUTION ----
    if bot.flow and bot.flow.get('nodes'):
        await execute_hybrid_flow(bot, conversation, message, adapters)
        return
    
    # ---- 4. LEGACY AI FALLBACK ----
    if bot.ai_enabled is not False:
        await execute_ai_phase(bot, conversation, message, adapters)
        return
    
    # ---- 5. DEFAULT CLARIFICATION ----
    await adapters.persist_assistant_message(
        conversationId=conversation.id,
        hubId=conversation.hub_id,
        text="I'm not quite sure how to help. Would you like to speak with a human agent?",
        responderType="automation",
        meta={"buttons": [{"id": "handoff", "label": "Talk to Human"}]}
    )


# ============= HYBRID FLOW EXECUTION =============

async def execute_hybrid_flow(
    bot: BotConfig,
    conversation: Conversation,
    message: IncomingMessage,
    adapters: AgentAdapters,
) -> None:
    """Execute automated bot flow (nodes & edges)."""
    nodes = bot.flow.get('nodes', [])
    edges = bot.flow.get('edges', [])
    
    current_step_id = (conversation.meta or {}).get('current_flow_step_id') if conversation.meta else None
    
    if not current_step_id:
        # Find start node
        start_node = next((n for n in nodes if n.get('type') == 'start'), None)
        current_step_id = start_node.get('id') if start_node else None
    else:
        # Advance flow based on current node type
        current_node = next((n for n in nodes if n.get('id') == current_step_id), None)
        if not current_node:
            return
        
        node_type = current_node.get('type')
        
        if node_type in ['quick_reply', 'ai_classifier']:
            selected_button_id = (message.meta or {}).get('buttonId')
            target_edge = next(
                (e for e in edges if e.get('source') == current_step_id and e.get('sourceHandle') == f"intent:{selected_button_id}"),
                None
            )
            if target_edge:
                current_step_id = target_edge.get('target')
            else:
                next_edge = next((e for e in edges if e.get('source') == current_step_id), None)
                current_step_id = next_edge.get('target') if next_edge else None
        
        elif node_type == 'capture_input':
            input_type = current_node.get('data', {}).get('inputType', 'text')
            is_valid = validate_input(message.text, input_type)
            
            if is_valid:
                if current_node.get('data', {}).get('saveToProfile'):
                    var_name = (current_node.get('data', {}).get('variableName') or '').lower()
                    patch = {}
                    if var_name == 'email':
                        patch['visitorEmail'] = message.text.strip().lower()
                    if var_name == 'name':
                        patch['visitorName'] = message.text.strip()
                    
                    if patch:
                        await adapters.update_conversation(
                            conversationId=conversation.id,
                            hubId=conversation.hub_id,
                            patch=patch
                        )
                
                next_edge = next((e for e in edges if e.get('source') == current_step_id), None)
                current_step_id = next_edge.get('target') if next_edge else None
            else:
                error_msg = current_node.get('data', {}).get('validation', {}).get('errorMessage') or f"Please enter a valid {input_type}."
                await adapters.persist_assistant_message(
                    conversationId=conversation.id,
                    hubId=conversation.hub_id,
                    text=error_msg,
                    responderType='automation'
                )
                return
        
        elif node_type == 'identity_form':
            if conversation.visitor_email or conversation.contact_id:
                next_edge = next((e for e in edges if e.get('source') == current_step_id), None)
                current_step_id = next_edge.get('target') if next_edge else None
            else:
                return
        else:
            next_edge = next((e for e in edges if e.get('source') == current_step_id), None)
            current_step_id = next_edge.get('target') if next_edge else None
    
    # Execute flow steps (safety limit to prevent infinite loops)
    safety_limit = 15
    while current_step_id and safety_limit > 0:
        safety_limit -= 1
        node = next((n for n in nodes if n.get('id') == current_step_id), None)
        if not node:
            break
        
        # Update conversation with current step
        meta = conversation.meta.dict() if conversation.meta else {}
        meta['current_flow_step_id'] = current_step_id
        await adapters.update_conversation(
            conversationId=conversation.id,
            hubId=conversation.hub_id,
            patch={'meta': meta}
        )
        
        node_type = node.get('type')
        node_data = node.get('data', {})
        
        if node_type == 'start':
            next_edge = next((e for e in edges if e.get('source') == current_step_id), None)
            current_step_id = next_edge.get('target') if next_edge else None
            continue
        
        elif node_type == 'message':
            await adapters.persist_assistant_message(
                conversationId=conversation.id,
                hubId=conversation.hub_id,
                text=node_data.get('text', ''),
                responderType='automation'
            )
            next_edge = next((e for e in edges if e.get('source') == current_step_id), None)
            current_step_id = next_edge.get('target') if next_edge else None
            continue
        
        elif node_type in ['quick_reply', 'ai_classifier']:
            buttons = node_data.get('buttons' if node_type == 'quick_reply' else 'intents', [])
            prompt = node_data.get('text') or node_data.get('prompt') or "How can I help you?"
            await adapters.persist_assistant_message(
                conversationId=conversation.id,
                hubId=conversation.hub_id,
                text=prompt,
                responderType='automation',
                meta={'buttons': buttons}
            )
            return
        
        elif node_type == 'capture_input':
            prompt = node_data.get('prompt', 'Please enter details:')
            await adapters.persist_assistant_message(
                conversationId=conversation.id,
                hubId=conversation.hub_id,
                text=prompt,
                responderType='automation'
            )
            return
        
        elif node_type == 'identity_form':
            if conversation.visitor_email or conversation.contact_id:
                next_edge = next((e for e in edges if e.get('source') == current_step_id), None)
                current_step_id = next_edge.get('target') if next_edge else None
                continue
            else:
                prompt = node_data.get('prompt', 'Before we continue, could I get your name and email?')
                await adapters.persist_assistant_message(
                    conversationId=conversation.id,
                    hubId=conversation.hub_id,
                    text=prompt,
                    responderType='automation',
                    meta={'type': 'identity_form'}
                )
                return
        
        elif node_type == 'ai_step':
            resolved = await execute_ai_phase(bot, conversation, message, adapters)
            if resolved:
                next_edge = next((e for e in edges if e.get('source') == current_step_id and e.get('sourceHandle') == 'resolved'), None)
                current_step_id = next_edge.get('target') if next_edge else None
            else:
                next_edge = next((e for e in edges if e.get('source') == current_step_id and e.get('sourceHandle') == 'unresolved'), None)
                current_step_id = next_edge.get('target') if next_edge else None
            
            if not current_step_id:
                return
            continue
        
        elif node_type == 'handoff':
            custom_msg = node_data.get('text')
            await escalate_now(adapters, conversation, "Handoff step triggered.", custom_msg)
            return
        
        elif node_type == 'end':
            return
        
        break


# ============= AI PHASE EXECUTION =============

async def execute_ai_phase(
    bot: BotConfig,
    conversation: Conversation,
    message: IncomingMessage,
    adapters: AgentAdapters,
) -> bool:
    """
    Execute conversational AI reasoning with tiered intelligence.
    
    Returns: True if resolved, False if needs escalation/clarification.
    """
    text = message.text or ""
    bot_name = bot.web_agent_name or bot.name or "Support"
    
    # Update conversation state
    await adapters.update_conversation(
        conversationId=conversation.id,
        hubId=conversation.hub_id,
        patch={'aiAttempted': True, 'status': 'open'}
    )
    
    # 1. POLICY-AWARE RETRIEVAL DECISION
    is_customer_facing = bot.type == BotType.WIDGET
    
    decision = await adapters.retrieve_context(
        message=text,
        hubId=bot.hub_id,
        spaceId=conversation.space_id,
        policy={
            'isCustomerFacing': is_customer_facing,
            'accessLevel': bot.intelligence_access_level or 'topics_allowed',
            'allowedLibraryIds': bot.allowed_help_center_ids or []
        }
    )
    
    # 1.5 APPLY CONFIDENCE HANDLING STRATEGY
    score = decision.confidence
    if score >= 0.8:
        level = ConfidenceLevel.HIGH
    elif score >= 0.5:
        level = ConfidenceLevel.MEDIUM
    else:
        level = ConfidenceLevel.LOW
    
    confidence_handling = bot.confidence_handling or {}
    strategy = confidence_handling.get(level.value, 'answer' if level != ConfidenceLevel.LOW else 'clarify')
    
    if strategy == 'escalate':
        await escalate_now(adapters, conversation, "Auto-escalated: match confidence below threshold.")
        return True
    
    # 2. ADAPTIVE SYSTEM INSTRUCTION
    system_instruction = f"You are {bot_name}, a helpful AI assistant. Be conversational, warm, and accurate."
    
    if decision.answer_mode == AnswerMode.INSIGHT_SUPPORTED_HIDDEN:
        system_instruction += "\n\nCRITICAL POLICY: Your answer is based on internal support signals. DO NOT cite sources. Keep the tone helpful but cautious."
    elif decision.answer_mode == AnswerMode.TOPIC_SUPPORTED:
        system_instruction += "\n\nPOLICY: This information is based on recurring patterns. Avoid presenting it as absolute official policy."
    
    if strategy == 'answer_softly':
        system_instruction += "\n\nCRITICAL: Answer cautiously. Use phrases like 'Based on our documentation...' or 'It appears...'. If you aren't certain, offer to connect to a human."
    
    behavior = bot.behavior or {}
    if behavior.get('revealUncertainty') and level != ConfidenceLevel.HIGH:
        system_instruction += "\n\nPOLITE DISCLOSURE: Be open about your level of certainty if the documentation isn't perfectly clear."
    
    if behavior.get('mode') == 'sales':
        system_instruction += "\n\nSALES POSTURE: Be consultative and focused on value. Move the user towards a meeting or quote."
    elif behavior.get('mode') == 'support':
        system_instruction += "\n\nSUPPORT POSTURE: Be helpful, troubleshooting-focused, and thorough."
    
    if bot.conversation_goal:
        system_instruction += f"\n\nCONVERSATION GOAL:\n{bot.conversation_goal}"
    
    # 3. GENERATE ANSWER
    context = [
        ContextItem(title=c.title or 'Source', text=c.text, url=c.url)
        for c in decision.chosen_candidates
    ]
    
    answer = await adapters.generate_answer(
        query=text,
        botName=bot_name,
        context=context,
        greetingScript=system_instruction
    )
    
    if not answer or answer.strip() == "":
        if decision.answer_mode == AnswerMode.ESCALATE or strategy == 'escalate':
            await escalate_now(adapters, conversation, "No trusted knowledge sources found.")
            return True
        return False
    
    # 4. PERSIST RESULT WITH TIERED SOURCES
    sources = [
        Source(
            title=c.title or 'Untitled',
            url=c.url or '',
            article_id=c.id,
            score=c.score
        )
        for c in decision.chosen_candidates
        if c.source_type == 'article'
    ]
    
    await adapters.persist_assistant_message(
        conversationId=conversation.id,
        hubId=conversation.hub_id,
        text=answer,
        responderType='ai',
        sources=[s.dict() for s in sources]
    )
    
    await adapters.update_conversation(
        conversationId=conversation.id,
        hubId=conversation.hub_id,
        patch={'aiResolved': True}
    )
    
    return True


# ============= HELPERS =============

def validate_input(text: str, input_type: str) -> bool:
    """Validate user input based on type."""
    if not text:
        return False
    
    text = text.strip()
    
    if input_type == 'email':
        pattern = r'^[^\s@]+@[^\s@]+\.[^\s@]+$'
        return bool(re.match(pattern, text))
    
    elif input_type == 'phone':
        pattern = r'^\+?[\d\s\-()]{7,}$'
        return bool(re.match(pattern, text))
    
    else:
        return len(text) > 0


def contains_any(haystack: str, needles: List[str]) -> bool:
    """Check if haystack contains any needle (case-insensitive)."""
    h = (haystack or "").lower()
    return any(n.lower() in h for n in needles)


async def escalate_now(
    adapters: AgentAdapters,
    conversation: Conversation,
    reason: str,
    custom_message: Optional[str] = None,
) -> None:
    """Escalate conversation to human agent."""
    now = datetime.utcnow().isoformat() + 'Z'
    
    await adapters.update_conversation(
        conversationId=conversation.id,
        hubId=conversation.hub_id,
        patch={
            'status': 'waiting_human',
            'lastResponderType': 'system',
            'handoff': {
                'status': 'completed',
                'reason': reason,
                'offeredAt': now
            }
        }
    )
    
    await adapters.escalate_to_human(
        conversationId=conversation.id,
        hubId=conversation.hub_id,
        reason=reason
    )
    
    message = custom_message or "Connecting you to our team. They will reply here shortly."
    await adapters.persist_assistant_message(
        conversationId=conversation.id,
        hubId=conversation.hub_id,
        text=message,
        responderType='automation'
    )
