
'use client';

import React from 'react';

// This is a placeholder component.
// The user will provide the actual Tiptap implementation.
export const TiptapEditor = ({ content, onChange }: { content: string, onChange: (content: string) => void }) => {
  return (
    <textarea
      value={content}
      onChange={(e) => onChange(e.target.value)}
      className="w-full h-full p-4 border rounded-md"
      placeholder="Tiptap editor will be here..."
    />
  );
};
