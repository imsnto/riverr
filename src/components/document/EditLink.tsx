'use client';

import { Link as LinkIcon, Trash } from 'lucide-react';
import { type Editor } from '@tiptap/react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useState, useEffect } from 'react';
import { Toggle } from '../ui/toggle';

export function EditLink({ editor }: { editor: Editor }) {
  const [url, setUrl] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const existingUrl = editor.getAttributes('link').href || '';
      setUrl(existingUrl);
    }
  }, [isOpen, editor]);

  const handleSave = () => {
    // If the URL is empty, unset the link
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
    } else {
      // Otherwise, set or update the link
      editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
    }
    setIsOpen(false);
  };

  const handleRemove = () => {
    editor.chain().focus().extendMarkRange('link').unsetLink().run();
    setIsOpen(false);
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Toggle size="sm" pressed={editor.isActive('link')}>
          <LinkIcon className="h-4 w-4" />
        </Toggle>
      </PopoverTrigger>
      <PopoverContent className="w-80">
        <div className="grid gap-4">
          <div className="space-y-2">
            <h4 className="font-medium leading-none">Edit Link</h4>
            <p className="text-sm text-muted-foreground">
              Enter a URL. Leave blank to remove the link.
            </p>
          </div>
          <div className="flex gap-2">
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleSave();
                }
              }}
            />
            {editor.isActive('link') && (
              <Button variant="destructive" size="icon" onClick={handleRemove}>
                <Trash className="h-4 w-4" />
              </Button>
            )}
          </div>
          <Button onClick={handleSave}>Save Link</Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
