import re
from typing import TypedDict, Optional


def normalize_spaces(s: Optional[str]) -> str:
    """Normalize whitespace by replacing horizontal whitespace with single space and trimming."""
    if not s:
        return ""
    return re.sub(r'[^\S\r\n]+', ' ', s).strip()


def strip_html(html: Optional[str]) -> str:
    """
    Remove HTML tags while preserving newlines.
    Collapses horizontal whitespace but keeps line breaks.
    """
    if not html:
        return ""
    
    clean = html
    # Remove script and style tags
    clean = re.sub(r'<script[\s\S]*?>[\s\S]*?</script>', ' ', clean, flags=re.IGNORECASE)
    clean = re.sub(r'<style[\s\S]*?>[\s\S]*?</style>', ' ', clean, flags=re.IGNORECASE)
    # Replace br tags with newlines
    clean = re.sub(r'<br\s*/?>', '\n', clean, flags=re.IGNORECASE)
    # Replace block-level closing tags with newlines
    clean = re.sub(
        r'</(p|div|h1|h2|h3|h4|li|ul|ol|blockquote|tr|section|article)>',
        '\n',
        clean,
        flags=re.IGNORECASE
    )
    # Remove all other tags
    clean = re.sub(r'<[^>]+>', ' ', clean)
    
    # Split by lines, trim each, and filter empty
    lines = [line.strip() for line in clean.split('\n')]
    lines = [line for line in lines if line]
    
    return '\n'.join(lines)


def estimate_tokens(text: Optional[str]) -> int:
    """
    Rough token estimation (good enough for chunk sizing).
    Rule of thumb: ~4 chars per token in English.
    """
    if not text:
        return 0
    return (len(text) + 3) // 4  # Ceiling division


class Block(TypedDict):
    """Represents a block of content (heading or text)."""
    kind: str  # "heading" or "text"
    level: Optional[int]
    text: str


def extract_blocks_from_html(html: Optional[str]) -> list[Block]:
    """Extract structured blocks (headings and text) from HTML content."""
    if not html:
        return []
    
    raw = html
    
    # Replace headings with sentinel markers
    with_sentinels = raw
    with_sentinels = re.sub(r'<h1[^>]*>([\s\S]*?)</h1>', r'\n[[H1]] \1 \n', with_sentinels, flags=re.IGNORECASE)
    with_sentinels = re.sub(r'<h2[^>]*>([\s\S]*?)</h2>', r'\n[[H2]] \1 \n', with_sentinels, flags=re.IGNORECASE)
    with_sentinels = re.sub(r'<h3[^>]*>([\s\S]*?)</h3>', r'\n[[H3]] \1 \n', with_sentinels, flags=re.IGNORECASE)
    with_sentinels = re.sub(r'<h4[^>]*>([\s\S]*?)</h4>', r'\n[[H4]] \1 \n', with_sentinels, flags=re.IGNORECASE)
    
    plain = strip_html(with_sentinels)
    lines = [line.strip() for line in plain.split('\n')]
    lines = [line for line in lines if line]
    
    # Parse blocks from lines
    blocks: list[Block] = []
    for line in lines:
        match = re.match(r'^\[\[H([1-4])\]\]\s*(.*)$', line)
        if match:
            level = int(match.group(1))
            text = normalize_spaces(match.group(2))
            if text:
                blocks.append({
                    'kind': 'heading',
                    'level': level,
                    'text': text
                })
        else:
            text = normalize_spaces(line)
            if text:
                blocks.append({
                    'kind': 'text',
                    'level': None,
                    'text': text
                })
    
    # Merge small consecutive text blocks
    merged: list[Block] = []
    for b in blocks:
        last = merged[-1] if merged else None
        if (b['kind'] == 'text' and last and last['kind'] == 'text' and
            (len(last['text']) < 140 or len(b['text']) < 140)):
            last['text'] = normalize_spaces(f"{last['text']}\n{b['text']}")
        else:
            merged.append(b.copy())
    
    return merged


class ChunkSpec(TypedDict):
    """Specification for a chunk of content."""
    heading_path: list[str]
    text: str
    chunk_index: int


def chunk_article_html(
    html: str,
    max_tokens: int = 220,
    overlap_tokens: int = 60
) -> list[ChunkSpec]:
    """
    Chunk HTML article content with specified token limits and overlap.
    
    Args:
        html: HTML content to chunk
        max_tokens: Maximum tokens per chunk (default 220)
        overlap_tokens: Tokens to overlap between chunks (default 60)
    
    Returns:
        List of chunk specifications with heading paths and text
    """
    blocks = extract_blocks_from_html(html)
    
    chunks: list[ChunkSpec] = []
    heading_path: list[str] = []
    buffer: list[str] = []
    buffer_tokens = 0
    order = 0
    
    def flush() -> None:
        nonlocal order
        text = normalize_spaces('\n'.join(buffer))
        if text:
            chunks.append({
                'heading_path': heading_path.copy(),
                'text': text,
                'chunk_index': order
            })
            order += 1
    
    def reset_buffer_with_overlap() -> None:
        nonlocal buffer, buffer_tokens
        if overlap_tokens > 0 and buffer:
            joined = '\n'.join(buffer)
            words = [w for w in joined.split() if w]
            keep_words = max(30, round(overlap_tokens * 1.3))
            overlap_text = ' '.join(words[-keep_words:]).strip()
            
            if overlap_text:
                buffer = [overlap_text]
                buffer_tokens = estimate_tokens(overlap_text)
                return
        
        buffer = []
        buffer_tokens = 0
    
    def push_text(text: str) -> None:
        nonlocal buffer, buffer_tokens
        
        t = normalize_spaces(text)
        if not t:
            return
        
        if len(t) > 20000:
            print(f"CHUNK_ENGINE: Large block detected, forcing split - length: {len(t)}")
        
        tok = estimate_tokens(t)
        
        # If a single block is huge, split it
        if tok > max_tokens:
            # Try splitting by sentences first
            parts = [p for p in re.split(r'(?<=[.?!])\s+', t) if p]
            
            # If splitting by sentences didn't work, use word-based slicing
            if len(parts) == 1:
                words = [w for w in t.split() if w]
                chunk_size_in_words = 100
                
                for i in range(0, len(words), chunk_size_in_words):
                    slice_words = words[i:i + chunk_size_in_words]
                    if not slice_words:
                        continue
                    
                    slice_text = ' '.join(slice_words)
                    slice_tok = estimate_tokens(slice_text)
                    
                    # Boundary check for the current slice
                    if buffer_tokens + slice_tok > max_tokens and buffer:
                        flush()
                        reset_buffer_with_overlap()
                    
                    buffer.append(slice_text)
                    buffer_tokens += slice_tok
                return
            
            for part in parts:
                if part != t:  # Recursion safety
                    push_text(part)
            return
        
        # Standard chunk-boundary logic
        if buffer_tokens + tok > max_tokens and buffer:
            flush()
            reset_buffer_with_overlap()
        
        buffer.append(t)
        buffer_tokens += tok
    
    # Process blocks
    for b in blocks:
        if b['kind'] == 'heading':
            if buffer:
                flush()
                buffer = []
                buffer_tokens = 0
            
            lvl = b['level'] or 2
            idx = max(0, lvl - 1)
            heading_path = heading_path[:idx]
            if idx < len(heading_path):
                heading_path[idx] = b['text']
            else:
                heading_path.append(b['text'])
            continue
        
        push_text(b['text'])
    
    if buffer:
        flush()
    
    # Filter out very small chunks
    return [c for c in chunks if len(c['text']) >= 80]
