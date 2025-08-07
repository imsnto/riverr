
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
import { useCallback } from 'react';
import { Toggle } from '../ui/toggle';

export function EditLink({ editor }: { editor: Editor }) {
  const setLink = useCallback(() => {
    const previousUrl = editor.getAttributes('link').href;
    const url = window.prompt('URL', previousUrl);

    // cancelled
    if (url === null) {
      return;
    }

    // empty
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }

    // update link
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  }, [editor]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Toggle
          size="sm"
          pressed={editor.isActive('link')}
          onPressedChange={() => {
            // if link is active, popover will be open, so we don't want to open prompt
            if (editor.isActive('link')) return;
            setLink();
          }}
        >
          <LinkIcon className="h-4 w-4" />
        </Toggle>
      </PopoverTrigger>
      {editor.isActive('link') && (
        <PopoverContent className="w-80">
          <div className="grid gap-4">
            <div className="space-y-2">
              <h4 className="font-medium leading-none">Edit Link</h4>
            </div>
            <div className="flex gap-2">
              <Input
                value={editor.getAttributes('link').href}
                onChange={(e) =>
                  editor.chain().focus().setLink({ href: e.target.value }).run()
                }
              />
              <Button
                variant="destructive"
                onClick={() =>
                  editor.chain().focus().unsetLink().run()
                }
              >
                <Trash className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </PopoverContent>
      )}
    </Popover>
  );
}
