'use client';

import { type Editor } from '@tiptap/react';
import {
  Bold,
  Strikethrough,
  Italic,
  List,
  ListOrdered,
  Heading1,
  Heading2,
  Heading3,
  Underline,
  Quote,
  Undo,
  Redo,
  Code,
  Image as ImageIcon,
  Link as LinkIcon,
  Youtube,
  Pilcrow,
  CaseSensitive,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Toggle } from '@/components/ui/toggle';
import { EditLink } from './EditLink';
import { useCallback } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';

type Props = {
  editor: Editor;
};

const FONT_SIZES = ['12px', '14px', '16px', '18px', '24px', '30px', '36px'];

export function Toolbar({ editor }: Props) {
  const addImage = useCallback(() => {
    const url = window.prompt('URL');

    if (url) {
      editor.chain().focus().setImage({ src: url }).run();
    }
  }, [editor]);

  const addYoutubeVideo = () => {
    const url = prompt('Enter YouTube URL');

    if (url) {
      editor.commands.setYoutubeVideo({
        src: url,
        width: 640,
        height: 360,
      });
    }
  };

  const currentFontSize = () => {
    for (const size of FONT_SIZES) {
      if (editor.isActive('textStyle', { fontSize: size })) {
        return size;
      }
    }
    return '16px'; // Default paragraph size
  };

  return (
    <div className="flex flex-wrap items-center gap-1 p-2 border-b">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="w-24 justify-start">
            {editor.isActive('heading', { level: 1 }) && 'Heading 1'}
            {editor.isActive('heading', { level: 2 }) && 'Heading 2'}
            {editor.isActive('heading', { level: 3 }) && 'Heading 3'}
            {!editor.isActive('heading') && 'Paragraph'}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem
            onClick={() => editor.chain().focus().setParagraph().run()}
          >
            <Pilcrow className="mr-2" />
            Paragraph
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          >
            <Heading1 className="mr-2" />
            Heading 1
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          >
            <Heading2 className="mr-2" />
            Heading 2
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          >
            <Heading3 className="mr-2" />
            Heading 3
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="w-24 justify-start">
            <span style={{ fontFamily: editor.getAttributes('textStyle').fontFamily }}>
              {editor.getAttributes('textStyle').fontFamily || 'Inter'}
            </span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onClick={() => editor.chain().focus().setFontFamily('Inter').run()}>
            Inter
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => editor.chain().focus().setFontFamily('Arial').run()}>
            Arial
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => editor.chain().focus().setFontFamily('monospace').run()}>
            Monospace
          </DropdownMenuItem>
           <DropdownMenuItem onClick={() => editor.chain().focus().unsetFontFamily().run()}>
            Default
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

       <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="w-20 justify-start">
            <span>{currentFontSize()}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          {FONT_SIZES.map(size => (
             <DropdownMenuItem 
              key={size}
              onClick={() => editor.chain().focus().setMark('textStyle', { fontSize: size }).run()}
              className={editor.isActive('textStyle', { fontSize: size }) ? 'is-active' : ''}
             >
                {size}
             </DropdownMenuItem>
          ))}
          <DropdownMenuItem onClick={() => editor.chain().focus().unsetAllMarks().run()}>
            Default
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Toggle
        size="sm"
        pressed={editor.isActive('bold')}
        onPressedChange={() => editor.chain().focus().toggleBold().run()}
      >
        <Bold className="h-4 w-4" />
      </Toggle>
      <Toggle
        size="sm"
        pressed={editor.isActive('italic')}
        onPressedChange={() => editor.chain().focus().toggleItalic().run()}
      >
        <Italic className="h-4 w-4" />
      </Toggle>
      <Toggle
        size="sm"
        pressed={editor.isActive('underline')}
        onPressedChange={() => editor.chain().focus().toggleUnderline().run()}
      >
        <Underline className="h-4 w-4" />
      </Toggle>
      <Toggle
        size="sm"
        pressed={editor.isActive('strike')}
        onPressedChange={() => editor.chain().focus().toggleStrike().run()}
      >
        <Strikethrough className="h-4 w-4" />
      </Toggle>
      <Separator orientation="vertical" className="h-8" />
      
      <Toggle
        size="sm"
        pressed={editor.isActive('bulletList')}
        onPressedChange={() => editor.chain().focus().toggleBulletList().run()}
      >
        <List className="h-4 w-4" />
      </Toggle>
      <Toggle
        size="sm"
        pressed={editor.isActive('orderedList')}
        onPressedChange={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <ListOrdered className="h-4 w-4" />
      </Toggle>
      <Toggle
        size="sm"
        pressed={editor.isActive('blockquote')}
        onPressedChange={() => editor.chain().focus().toggleBlockquote().run()}
      >
        <Quote className="h-4 w-4" />
      </Toggle>
      <Separator orientation="vertical" className="h-8" />
      <Button onClick={addImage} size="sm" variant="ghost">
        <ImageIcon className="h-4 w-4" />
      </Button>
      <EditLink editor={editor} />
      <Button onClick={addYoutubeVideo} size="sm" variant="ghost">
        <Youtube className="h-4 w-4" />
      </Button>
      <Separator orientation="vertical" className="h-8" />
      <Button variant="ghost" size="sm" onClick={() => editor.chain().focus().undo().run()}>
        <Undo className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="sm" onClick={() => editor.chain().focus().redo().run()}>
        <Redo className="h-4 w-4" />
      </Button>
    </div>
  );
}
