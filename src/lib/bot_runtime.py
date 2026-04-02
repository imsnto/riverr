"""
bot_runtime.py - Bot Runtime Resolution

Resolves bot configuration at runtime by merging widget + agent settings.
Handles identity capture, greeting, and preference resolution.
"""

from typing import Optional, List, Dict, Any
from pydantic import BaseModel
from firebase_admin import firestore


class BotSettingsIdentityCapture(BaseModel):
    """Identity capture settings."""
    enabled: bool = False
    fields: Optional[List[str]] = None
    message: Optional[str] = None


class BotSettingsStyleSettings(BaseModel):
    """Style and appearance settings."""
    theme: Optional[str] = None
    colors: Optional[Dict[str, str]] = None


class BotConfig(BaseModel):
    """Bot configuration."""
    id: str
    name: str
    type: str  # 'agent', 'widget'
    hub_id: str
    welcome_message: Optional[str] = None
    web_agent_name: Optional[str] = None
    allowed_help_center_ids: List[str] = []
    agent_ids: Optional[List[str]] = None
    assigned_agent_id: Optional[str] = None
    intelligence_access_level: Optional[str] = "topics_allowed"
    identity_capture: Optional[BotSettingsIdentityCapture] = None
    style_settings: Optional[BotSettingsStyleSettings] = None
    channel_config: Optional[Dict[str, Any]] = None
    behavior: Optional[Dict[str, Any]] = None
    confidence_handling: Optional[Dict[str, Any]] = None
    escalation: Optional[Dict[str, Any]] = None


class ResolvedRuntimeBot(BaseModel):
    """Resolved bot configuration at runtime."""
    widget: Optional[BotConfig] = None
    actor: Optional[BotConfig] = None
    effective_bot: BotConfig
    web_agent_name: str
    resolved_greeting: str
    resolved_identity_capture: Optional[BotSettingsIdentityCapture] = None
    allowed_help_center_ids: List[str]
    human_agent_ids: List[str]


# ============= BOT RUNTIME RESOLUTION =============

def normalize_identity_capture_from_agent(agent: Optional[BotConfig]) -> Optional[BotSettingsIdentityCapture]:
    """Extract identity capture settings from agent bot."""
    if not agent:
        return None
    return agent.identity_capture


def get_agent_web_greeting(agent: Optional[BotConfig]) -> Optional[str]:
    """Get web greeting from agent bot."""
    if not agent:
        return None
    
    # Check channel-specific greeting
    channel_config = agent.channel_config or {}
    web_config = channel_config.get('web', {})
    greeting_config = web_config.get('greeting', {})
    if greeting_config.get('text'):
        return greeting_config['text']
    
    # Fall back to welcome message
    return agent.welcome_message


def get_agent_name(agent: Optional[BotConfig]) -> str:
    """Get display name from agent bot."""
    if not agent:
        return 'Assistant'
    return agent.web_agent_name or agent.name or 'Assistant'


def merge_stage_and_actor(
    widget: BotConfig,
    actor: Optional[BotConfig] = None
) -> ResolvedRuntimeBot:
    """
    Merge widget (stage) and actor (agent) bot configurations.
    Actor settings take precedence.
    """
    resolved_greeting = (
        get_agent_web_greeting(actor) or
        widget.welcome_message or
        'Hi! How can I help you today?'
    )
    
    resolved_identity_capture = (
        normalize_identity_capture_from_agent(actor) or
        widget.identity_capture
    )
    
    human_agent_ids = (
        widget.agent_ids if widget.agent_ids else
        (actor.agent_ids if actor else [])
    ) or []
    
    allowed_help_center_ids = (
        actor.allowed_help_center_ids if actor else
        widget.allowed_help_center_ids or []
    )
    
    intelligence_access_level = (
        actor.intelligence_access_level if actor else
        widget.intelligence_access_level
    ) or 'topics_allowed'
    
    # Build effective bot by merging
    effective_bot_dict = widget.dict()
    if actor:
        actor_dict = actor.dict()
        # Actor settings override widget settings
        effective_bot_dict.update({
            k: v for k, v in actor_dict.items()
            if v is not None
        })
    
    # Ensure these are set from merged config
    effective_bot_dict.update({
        'id': actor.id if actor else widget.id,
        'hub_id': actor.hub_id if actor else widget.hub_id,
        'type': widget.type or 'widget',
        'assigned_agent_id': widget.assigned_agent_id or None,
        'style_settings': widget.style_settings,
        'agent_ids': human_agent_ids,
        'allowed_help_center_ids': allowed_help_center_ids,
        'intelligence_access_level': intelligence_access_level,
        'welcome_message': resolved_greeting,
        'identity_capture': resolved_identity_capture,
        'web_agent_name': get_agent_name(actor or widget),
        'behavior': (actor.behavior if actor else None) or widget.behavior,
        'confidence_handling': (actor.confidence_handling if actor else None) or widget.confidence_handling,
        'escalation': (actor.escalation if actor else None) or widget.escalation,
        'channel_config': (actor.channel_config if actor else None) or widget.channel_config,
    })
    
    effective_bot = BotConfig(**effective_bot_dict)
    
    return ResolvedRuntimeBot(
        widget=widget,
        actor=actor,
        effective_bot=effective_bot,
        web_agent_name=get_agent_name(actor or widget),
        resolved_greeting=resolved_greeting,
        resolved_identity_capture=resolved_identity_capture,
        allowed_help_center_ids=allowed_help_center_ids,
        human_agent_ids=human_agent_ids
    )


async def resolve_runtime_bot(
    bot_id: str,
    admin_db: firestore.client
) -> Optional[ResolvedRuntimeBot]:
    """
    Resolve bot configuration at runtime.
    
    Fetches bot from Firestore and merges widget/agent settings.
    
    Args:
        bot_id: ID of the bot to resolve
        admin_db: Firestore admin client
    
    Returns:
        ResolvedRuntimeBot with merged configuration, or None if not found
    """
    bot_doc = await admin_db.collection('bots').document(bot_id).get()
    if not bot_doc.exists:
        return None
    
    bot_data = bot_doc.to_dict() or {}
    bot_data['id'] = bot_doc.id
    bot = BotConfig(**bot_data)
    
    # If this is an agent bot, use it directly
    if bot.type == 'agent':
        identity_capture = normalize_identity_capture_from_agent(bot)
        resolved_greeting = get_agent_web_greeting(bot) or bot.welcome_message or 'Hi! How can I help you today?'
        
        # Build effective bot
        effective_bot_dict = bot.dict()
        effective_bot_dict.update({
            'identity_capture': identity_capture,
            'allowed_help_center_ids': bot.allowed_help_center_ids or [],
            'web_agent_name': get_agent_name(bot),
            'welcome_message': resolved_greeting,
        })
        
        effective_bot = BotConfig(**effective_bot_dict)
        
        return ResolvedRuntimeBot(
            widget=None,
            actor=bot,
            effective_bot=effective_bot,
            web_agent_name=get_agent_name(bot),
            resolved_greeting=resolved_greeting,
            resolved_identity_capture=identity_capture,
            allowed_help_center_ids=bot.allowed_help_center_ids or [],
            human_agent_ids=bot.agent_ids or []
        )
    
    # If widget bot with assigned agent, fetch and merge
    if bot.type == 'widget' and bot.assigned_agent_id:
        actor_doc = await admin_db.collection('bots').document(bot.assigned_agent_id).get()
        if actor_doc.exists:
            actor_data = actor_doc.to_dict() or {}
            actor_data['id'] = actor_doc.id
            actor = BotConfig(**actor_data)
        else:
            actor = None
        
        return merge_stage_and_actor(bot, actor)
    
    # Widget bot without actor
    return merge_stage_and_actor(bot, None)
