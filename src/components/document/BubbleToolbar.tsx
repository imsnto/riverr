'use client';

import React, { useState, useCallback, useEffect } from 'react';
import type { Editor } from '@tiptap/react';
import { Bold, Italic, Underline, Link as LinkIcon, Check, Trash2, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Separator } from '@/components/ui/separator';

const getActiveNodeLabel = (editor: Editor) => {
    if (editor.isActive('heading', { level: 1 })) return 'Heading 1';
    if (editor.isActive('heading', { level: 2 })) return 'Heading 2';
    if (editor.isActive('heading', { level: 3 })) return 'Heading 3';
    if (editor.isActive('bulletList')) return 'Bullet List';
    if (editor.isActive('orderedList')) return 'Numbered List';
    if (editor.isActive('blockquote')) return 'Blockquote';
    return 'Paragraph';
};


export function BubbleToolbar({ editor }: { editor: Editor | null }) {
  if (!editor) return null;

  const [isLinkPopoverOpen, setIsLinkPopoverOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [hasLink, setHasLink] = useState(false);

  // When popover opens, get the existing link URL
  useEffect(() => {
    if (isLinkPopoverOpen) {
      const existingUrl = editor.getAttributes('link').href || '';
      setLinkUrl(existingUrl);
      setHasLink(!!existingUrl);
    }
  }, [isLinkPopoverOpen, editor]);

  const setLink = useCallback(() => {
    // If user clears the input, remove the link
    if (linkUrl.trim() === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      setIsLinkPopoverOpen(false);
      return;
    }

    // Add protocol if missing
    let finalUrl = linkUrl.trim();
    if (finalUrl && !/^https?:\/\//i.test(finalUrl)) {
      finalUrl = `https://${finalUrl}`;
    }

    // Set or update the link
    editor.chain().focus().extendMarkRange('link').setLink({ href: finalUrl }).run();
    setIsLinkPopoverOpen(false);
  }, [editor, linkUrl]);

  const handleLinkSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLink();
  };
  
  const handleUnlink = () => {
    editor.chain().focus().extendMarkRange('link').unsetLink().run();
    setIsLinkPopoverOpen(false);
  }

  const activeNodeLabel = getActiveNodeLabel(editor);

  return (
    <div className="flex items-center gap-1 rounded-xl border bg-card/95 backdrop-blur px-2 py-1 shadow">
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-1 text-sm font-medium w-32 justify-start">
                    <span className="truncate">{activeNodeLabel}</span>
                    <ChevronDown className="h-4 w-4" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent onCloseAutoFocus={(e) => e.preventDefault()}>
                <DropdownMenuItem
                    onSelect={() => editor.chain().focus().setParagraph().run()}
                    disabled={!editor.can().setParagraph()}
                >
                    Paragraph
                </DropdownMenuItem>
                <DropdownMenuItem
                    onSelect={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                    disabled={!editor.can().toggleHeading({ level: 1 })}
                >
                    Heading 1
                </DropdownMenuItem>
                <DropdownMenuItem
                    onSelect={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                    disabled={!editor.can().toggleHeading({ level: 2 })}
                >
                    Heading 2
                </DropdownMenuItem>
                <DropdownMenuItem
                    onSelect={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                    disabled={!editor.can().toggleHeading({ level: 3 })}
                >
                    Heading 3
                </DropdownMenuItem>
            </DropdownMenuContent>
      </DropdownMenu>

      <Separator orientation="vertical" className="h-6 mx-1" />

      <Button
        type="button"
        variant={editor.isActive('bold') ? 'secondary' : 'ghost'}
        size="sm"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <Bold className="h-4 w-4" />
      </Button>

      <Button
        type="button"
        variant={editor.isActive('italic') ? 'secondary' : 'ghost'}
        size="sm"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <Italic className="h-4 w-4" />
      </Button>

      <Button
        type="button"
        variant={editor.isActive('underline') ? 'secondary' : 'ghost'}
        size="sm"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      >
        <Underline className="h-4 w-4" />
      </Button>
      
      <Popover open={isLinkPopoverOpen} onOpenChange={setIsLinkPopoverOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant={editor.isActive('link') ? 'secondary' : 'ghost'}
            size="sm"
            onMouseDown={(e) => e.preventDefault()}
          >
            <LinkIcon className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-2" sideOffset={10}>
          <form onSubmit={handleLinkSubmit} className="flex items-center gap-2">
            <Input
              type="text"
              placeholder="Paste link..."
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  setLink();
                }
              }}
              className="h-8"
            />
            <Button
              type="submit"
              variant="outline"
              size="icon"
              className="h-8 w-8 flex-shrink-0"
            >
              <Check className="h-4 w-4" />
            </Button>
            {hasLink && (
              <Button
                type="button"
                variant="destructive"
                size="icon"
                className="h-8 w-8 flex-shrink-0"
                onMouseDown={(e) => e.preventDefault()}
                onClick={handleUnlink}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </form>
        </PopoverContent>
      </Popover>
    </div>
  );
}
