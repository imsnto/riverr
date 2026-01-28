'use client';

import React from 'react';
import type { Editor } from '@tiptap/react';
import { Bold, Italic, Underline, Link as LinkIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function BubbleToolbar({ editor }: { editor?: Editor | null }) {
  if (!editor) return null;

  return (
    <div className="flex items-center gap-1 rounded-xl border bg-card/95 backdrop-blur px-2 py-1 shadow-sm">
      <Button
        variant={editor.isActive('bold') ? 'secondary' : 'ghost'}
        size="sm"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <Bold className="h-4 w-4" />
      </Button>

      <Button
        variant={editor.isActive('italic') ? 'secondary' : 'ghost'}
        size="sm"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <Italic className="h-4 w-4" />
      </Button>

      <Button
        variant={editor.isActive('underline') ? 'secondary' : 'ghost'}
        size="sm"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      >
        <Underline className="h-4 w-4" />
      </Button>

      <Button
        variant={editor.isActive('link') ? 'secondary' : 'ghost'}
        size="sm"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => {
          const previousUrl = editor.getAttributes('link').href as string | undefined;
          const url = window.prompt('Enter URL', previousUrl || '');
          if (url === null) return;
          if (url.trim() === '') {
            editor.chain().focus().unsetLink().run();
            return;
          }
          editor.chain().focus().setLink({ href: url }).run();
        }}
      >
        <LinkIcon className="h-4 w-4" />
      </Button>
    </div>
  );
}
