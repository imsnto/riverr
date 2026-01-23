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
import { useState } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Input } from '../ui/input';

type Props = {
  editor: Editor;
};

const FONT_SIZES = ['12px', '14px', '16px', '18px', '24px', '30px', '36px'];

export function Toolbar({ editor }: Props) {
  const [imageUrl, setImageUrl] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  
  const [imagePopoverOpen, setImagePopoverOpen] = useState(false);
  const [youtubePopoverOpen, setYoutubePopoverOpen] = useState(false);

  const addImage = () => {
    if (imageUrl) {
      editor.chain().focus().setImage({ src: imageUrl }).run();
    }
    setImageUrl('');
    setImagePopoverOpen(false);
  };
  
  const addYoutubeVideo = () => {
    if (youtubeUrl) {
      editor.commands.setYoutubeVideo({
        src: youtubeUrl,
        width: 640,
        height: 360,
      });
    }
    setYoutubeUrl('');
    setYoutubePopoverOpen(false);
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
    <div className="flex flex-wrap items-center gap-1 p-2">
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
       {/* Image Popover */}
      <Popover open={imagePopoverOpen} onOpenChange={setImagePopoverOpen}>
        <PopoverTrigger asChild>
          <Button size="sm" variant="ghost">
            <ImageIcon className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80">
          <div className="grid gap-4">
            <div className="space-y-2">
              <h4 className="font-medium leading-none">Add Image</h4>
              <p className="text-sm text-muted-foreground">
                Paste an image URL.
              </p>
            </div>
            <Input
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://..."
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addImage();
                }
              }}
            />
            <Button onClick={addImage}>Add Image</Button>
          </div>
        </PopoverContent>
      </Popover>
      
      {/* Link Component */}
      <EditLink editor={editor} />
      
      {/* YouTube Popover */}
      <Popover open={youtubePopoverOpen} onOpenChange={setYoutubePopoverOpen}>
        <PopoverTrigger asChild>
          <Button size="sm" variant="ghost">
            <Youtube className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80">
          <div className="grid gap-4">
            <div className="space-y-2">
              <h4 className="font-medium leading-none">Embed YouTube Video</h4>
              <p className="text-sm text-muted-foreground">
                Paste a YouTube video URL.
              </p>
            </div>
            <Input
              value={youtubeUrl}
              onChange={(e) => setYoutubeUrl(e.target.value)}
              placeholder="https://youtube.com/watch?v=..."
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addYoutubeVideo();
                }
              }}
            />
            <Button onClick={addYoutubeVideo}>Embed Video</Button>
          </div>
        </PopoverContent>
      </Popover>
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
