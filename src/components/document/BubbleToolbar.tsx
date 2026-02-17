'use client';

import React, { useState, useCallback, useEffect } from 'react';
import type { Editor } from '@tiptap/react';
import { Bold, Italic, Underline, Link as LinkIcon, Check, Trash2, ChevronDown, Strikethrough, Code, Quote } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
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

const FONT_SIZES = ['12px', '14px', '16px', '18px', '24px', '30px', '36px', '48px'];
const FONT_FAMILIES = ['Inter', 'Arial', 'Georgia', 'Times New Roman', 'Verdana', 'serif', 'monospace', 'cursive'];


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
  const activeFontSize = editor.getAttributes('textStyle').fontSize || '16px';
  const activeFontFamily = editor.getAttributes('textStyle').fontFamily || 'Inter';
  
  const NodeSelector = () => (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1 text-sm font-medium w-32 justify-start">
          <span className="truncate">{activeNodeLabel}</span>
          <ChevronDown className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-1" sideOffset={10} onCloseAutoFocus={(e) => e.preventDefault()}>
        <div className="flex flex-col">
          {[
            { label: 'Paragraph', action: () => editor.chain().focus().setParagraph().run(), can: () => editor.can().setParagraph() },
            { label: 'Heading 1', action: () => editor.chain().focus().toggleHeading({ level: 1 }).run(), can: () => editor.can().toggleHeading({ level: 1 }) },
            { label: 'Heading 2', action: () => editor.chain().focus().toggleHeading({ level: 2 }).run(), can: () => editor.can().toggleHeading({ level: 2 }) },
            { label: 'Heading 3', action: () => editor.chain().focus().toggleHeading({ level: 3 }).run(), can: () => editor.can().toggleHeading({ level: 3 }) },
            { label: 'Blockquote', action: () => editor.chain().focus().toggleBlockquote().run(), can: () => editor.can().toggleBlockquote() },
          ].map(item => (
            <Button
              key={item.label}
              variant="ghost"
              className="justify-start"
              onMouseDown={(e) => e.preventDefault()}
              onClick={item.action}
              disabled={!item.can()}
            >
              {item.label}
            </Button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );

  const FontfamilySelector = () => (
    <Popover>
        <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="text-sm font-medium w-28 justify-start">
                <span className="truncate" style={{fontFamily: activeFontFamily}}>{activeFontFamily}</span>
                <ChevronDown className="h-4 w-4 ml-auto" />
            </Button>
        </PopoverTrigger>
        <PopoverContent className="w-48 p-1" sideOffset={10} onCloseAutoFocus={(e) => e.preventDefault()}>
            <div className="flex flex-col">
            {FONT_FAMILIES.map(font => (
                <Button
                    key={font}
                    variant={font === activeFontFamily ? 'secondary' : 'ghost'}
                    className="justify-start"
                    style={{fontFamily: font}}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => editor.chain().focus().setFontFamily(font).run()}
                >
                {font}
                </Button>
            ))}
            </div>
        </PopoverContent>
    </Popover>
  );

   const FontSizeSelector = () => (
    <Popover>
        <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="text-sm font-medium w-20 justify-start">
                <span className="truncate">{activeFontSize}</span>
                <ChevronDown className="h-4 w-4 ml-auto" />
            </Button>
        </PopoverTrigger>
        <PopoverContent className="w-32 p-1" sideOffset={10} onCloseAutoFocus={(e) => e.preventDefault()}>
            <div className="flex flex-col">
            {FONT_SIZES.map(size => (
                <Button
                    key={size}
                    variant={size === activeFontSize ? 'secondary' : 'ghost'}
                    className="justify-start"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => editor.chain().focus().setFontSize(size).run()}
                >
                {size}
                </Button>
            ))}
            </div>
        </PopoverContent>
    </Popover>
  );


  return (
    <div className="flex w-max whitespace-nowrap items-center rounded-xl border bg-card/95 backdrop-blur px-1 py-1 shadow">
        <div className="flex items-center">
            <NodeSelector />
            <FontfamilySelector />
            <FontSizeSelector />
        </div>

        <Separator orientation="vertical" className="h-6 mx-1" />

        <div className="flex items-center">
            <Button
                type="button"
                variant={editor.isActive('bold') ? 'secondary' : 'ghost'}
                size="icon"
                className="h-8 w-8"
                title="Bold"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => editor.chain().focus().toggleBold().run()}
            >
                <Bold className="h-4 w-4" />
            </Button>

            <Button
                type="button"
                variant={editor.isActive('italic') ? 'secondary' : 'ghost'}
                size="icon"
                className="h-8 w-8"
                title="Italic"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => editor.chain().focus().toggleItalic().run()}
            >
                <Italic className="h-4 w-4" />
            </Button>

            <Button
                type="button"
                variant={editor.isActive('underline') ? 'secondary' : 'ghost'}
                size="icon"
                className="h-8 w-8"
                title="Underline"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => editor.chain().focus().toggleUnderline().run()}
            >
                <Underline className="h-4 w-4" />
            </Button>

            <Button
                type="button"
                variant={editor.isActive('strike') ? 'secondary' : 'ghost'}
                size="icon"
                className="h-8 w-8"
                title="Strikethrough"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => editor.chain().focus().toggleStrike().run()}
            >
                <Strikethrough className="h-4 w-4" />
            </Button>

            <Button
                type="button"
                variant={editor.isActive('code') ? 'secondary' : 'ghost'}
                size="icon"
                className="h-8 w-8"
                title="Code"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => editor.chain().focus().toggleCode().run()}
            >
                <Code className="h-4 w-4" />
            </Button>
            
            <Button
                type="button"
                variant={editor.isActive('blockquote') ? 'secondary' : 'ghost'}
                size="icon"
                className="h-8 w-8"
                title="Blockquote"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => editor.chain().focus().toggleBlockquote().run()}
            >
                <Quote className="h-4 w-4" />
            </Button>
        </div>
      
        <Separator orientation="vertical" className="h-6 mx-1" />

        <div className="flex items-center">
            <Popover open={isLinkPopoverOpen} onOpenChange={setIsLinkPopoverOpen}>
                <PopoverTrigger asChild>
                <Button
                    type="button"
                    variant={editor.isActive('link') ? 'secondary' : 'ghost'}
                    size="icon"
                    className="h-8 w-8"
                    title="Link"
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
    </div>
  );
}
