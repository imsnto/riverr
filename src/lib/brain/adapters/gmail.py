"""
Gmail Adapter - Converts Gmail data to normalized thread format.
"""

from typing import List, Optional, Dict, Any
from datetime import datetime


class RawGmailMessage:
    """Raw Gmail message structure."""
    def __init__(
        self,
        id: str,
        threadId: str,
        subject: Optional[str] = None,
        from_: Optional[str] = None,
        to: Optional[str] = None,
        date: Optional[str] = None,
        body: Optional[str] = None
    ):
        self.id = id
        self.threadId = threadId
        self.subject = subject
        self.from_ = from_
        self.to = to
        self.date = date
        self.body = body


class Message:
    """Normalized message structure."""
    def __init__(self, id: str, from_email: str, at: datetime, text: str):
        self.id = id
        self.from_email = from_email
        self.at = at
        self.text = text


class NormalizedThread:
    """Normalized thread structure."""
    def __init__(self, id: str, participants: List[str], messages: List[Message]):
        self.id = id
        self.participants = participants
        self.messages = messages


class RawConversationNode:
    """Raw conversation node for knowledge indexing."""
    def __init__(
        self,
        type: str = 'raw_conversation',
        sourceType: str = 'gmail',
        channel: str = 'support',
        participants: Optional[List[str]] = None,
        messages: Optional[List[Dict]] = None
    ):
        self.type = type
        self.sourceType = sourceType
        self.channel = channel
        self.participants = participants or []
        self.messages = messages or []


class GmailAdapter:
    """Gmail data adapter for knowledge ingestion."""
    
    async def fetch_batch(self, userId: str, maxResults: int = 10) -> List[RawGmailMessage]:
        """
        Fetch batch of Gmail messages for a user.
        
        Args:
            userId: Gmail user ID
            maxResults: Max messages to fetch
            
        Returns:
            List of RawGmailMessage objects
        """
        # Skeleton implementation
        # In production, would integrate with Gmail API
        return []
    
    def normalize(self, raw_item: RawGmailMessage) -> NormalizedThread:
        """
        Normalize raw Gmail message to thread format.
        
        Args:
            raw_item: Raw Gmail message
            
        Returns:
            NormalizedThread object
        """
        message_date = datetime.fromisoformat(raw_item.date) if raw_item.date else datetime.now()
        
        return NormalizedThread(
            id=raw_item.threadId,
            participants=[],
            messages=[
                Message(
                    id=raw_item.id,
                    from_email=raw_item.from_ or "unknown@example.com",
                    at=message_date,
                    text=raw_item.body or ""
                )
            ]
        )
    
    def to_raw_node(self, normalized_thread: NormalizedThread) -> RawConversationNode:
        """
        Convert normalized thread to raw conversation node.
        
        Args:
            normalized_thread: Normalized thread
            
        Returns:
            RawConversationNode for indexing
        """
        messages = []
        for msg in normalized_thread.messages:
            messages.append({
                "at": msg.at.isoformat(),
                "fromRole": "customer",
                "text": msg.text
            })
        
        return RawConversationNode(
            type='raw_conversation',
            sourceType='gmail',
            channel='support',
            participants=normalized_thread.participants,
            messages=messages
        )


# Singleton instance
gmail_adapter = GmailAdapter()
