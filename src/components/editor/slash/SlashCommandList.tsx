
'use client';

import React, { useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import type { Editor } from '@tiptap/react';
import { Image as ImageIcon, Youtube } from 'lucide-react';

type Range = { from: number; to: number };

type CommandItem = {
  title: string;
  description?: string;
  run: (opts: { editor: Editor; range: Range }) => void;
};

type Props = {
  editor: Editor;
  items: CommandItem[];
  command: (item: CommandItem) => void;
  range: Range;
  query: string;
  uploadImage: (file: File) => Promise<string>;
};

export const SlashCommandList = React.forwardRef(function SlashCommandList(
  { editor, items, command, range, uploadImage }: Props,
  ref: any
) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Hidden file input used by the Image command
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Selection snapshot that survives the file picker focus loss
  const selectionSnapshotRef = useRef<Range | null>(null);

  const selectItem = (index: number) => {
    const item = items[index];
    if (!item) return;

    // If it’s Image, we open picker and DO NOT rely on editor selection after that
    if (item.title === 'Image') {
      selectionSnapshotRef.current = { from: editor.state.selection.from, to: editor.state.selection.to };
      // Remove the slash command text first
      editor.chain().focus().deleteRange(range).run();

      // Open picker
      fileInputRef.current?.click();
      return;
    }

    command(item);
  };

  const onKeyDown = ({ event }: any) => {
    if (event.key === 'ArrowDown') {
      setSelectedIndex((i) => (i + 1) % items.length);
      return true;
    }
    if (event.key === 'ArrowUp') {
      setSelectedIndex((i) => (i - 1 + items.length) % items.length);
      return true;
    }
    if (event.key === 'Enter') {
      selectItem(selectedIndex);
      return true;
    }
    return false;
  };

  useImperativeHandle(ref, () => ({ onKeyDown }));

  useEffect(() => setSelectedIndex(0), [items]);

  const handleFilePicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const snap = selectionSnapshotRef.current;

    try {
      const url = await uploadImage(file);

      // Restore focus on next frame (helps Safari/Chrome after file picker)
      requestAnimationFrame(() => {
        editor.commands.focus();

        // Restore a sane selection before inserting
        if (snap) {
          editor.commands.setTextSelection({ from: snap.from, to: snap.to });
        }

        // Insert image + a paragraph after it so you can type underneath
        editor
          .chain()
          .focus()
          .insertContent([
            { type: 'image', attrs: { src: url, alt: file.name } },
            { type: 'paragraph' },
          ])
          .run();

        // Ensure cursor is in the paragraph after the image
        const pos = editor.state.selection.to;
        editor.commands.setTextSelection(pos);
      });
    } catch (err) {
      console.error('Image upload failed:', err);
    } finally {
      selectionSnapshotRef.current = null;
    }
  };

  return (
    <div className="w-80 overflow-hidden rounded-xl border bg-card shadow">
      <div className="max-h-72 overflow-y-auto p-1">
        {items.map((item, index) => (
          <button
            key={item.title}
            type="button"
            className={[
              'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left',
              index === selectedIndex ? 'bg-muted' : 'hover:bg-muted/60',
            ].join(' ')}
            onMouseDown={(e) => e.preventDefault()} // keep editor from losing selection on click
            onClick={() => selectItem(index)}
          >
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-md border bg-background">
              {item.title === 'Image' ? <ImageIcon className="h-4 w-4" /> : item.title === 'YouTube' ? <Youtube className="h-4 w-4" /> : 'T'}
            </span>
            <span className="flex flex-col">
              <span className="text-sm font-medium">{item.title}</span>
              {item.description ? <span className="text-xs text-muted-foreground">{item.description}</span> : null}
            </span>
          </button>
        ))}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={handleFilePicked}
      />
    </div>
  );
});
