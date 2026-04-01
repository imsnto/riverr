from typing import Any, Optional, Protocol, TypeVar, Generic
from datetime import datetime
from pydantic import BaseModel, Field


class Participant(BaseModel):
    """Participant in a normalized thread."""
    email: str
    name: Optional[str] = None
    role: str  # 'customer' | 'agent' | 'rep' | 'internal'


class MessageInfo(BaseModel):
    """Sender information for a message."""
    email: str
    name: Optional[str] = None


class Message(BaseModel):
    """Message within a normalized thread."""
    id: str
    from_: MessageInfo = Field(alias='from')
    at: datetime
    text: str
    meta: Optional[dict[str, Any]] = None

    class Config:
        populate_by_name = True


class NormalizedThread(BaseModel):
    """Normalized conversation thread from any source."""
    id: str
    source_url: Optional[str] = None
    participants: list[Participant]
    messages: list[Message]


class RawItem(BaseModel):
    """Base class for raw data items from source APIs."""
    id: str


TParams = TypeVar('TParams')
TRawItem = TypeVar('TRawItem', bound=RawItem)
TNormalizedItem = TypeVar('TNormalizedItem')


class SourceAdapter(Protocol[TParams, TRawItem, TNormalizedItem]):
    """
    Generic protocol for adapters that fetch and normalize data from source APIs.
    
    Type parameters:
        TParams: The parameter type for fetch_batch
        TRawItem: The raw item type returned by the source API
        TNormalizedItem: The normalized item type
    """

    async def fetch_batch(self, params: TParams) -> list[TRawItem]:
        """
        Fetches a batch of raw data items from the source API.
        
        Args:
            params: Parameters for the fetch operation
            
        Returns:
            List of raw items from the source
        """
        ...

    def normalize(self, raw_item: TRawItem) -> TNormalizedItem:
        """
        Normalizes a single raw item from the source into a common intermediate format.
        
        Args:
            raw_item: The raw item to normalize
            
        Returns:
            The normalized item
        """
        ...

    def to_raw_node(self, normalized_item: TNormalizedItem) -> Any:
        """
        Converts the normalized item into a canonical node structure.
        
        Args:
            normalized_item: The normalized item to convert
            
        Returns:
            The canonical node representation
        """
        ...
