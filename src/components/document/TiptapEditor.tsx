
'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import { EditorContent, BubbleMenu, useEditor, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Bold from '@tiptap/extension-bold';
import Italic from '@tiptap/extension-italic';
import Underline from '@tiptap/extension-underline';
import Heading from '@tiptap/extension-heading';
import BulletList from '@tiptap/extension-bullet-list';
import OrderedList from '@tiptap/extension-ordered-list';
import ListItem from '@tiptap/extension-list-item';
import Blockquote from '@tiptap/extension-blockquote';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import Youtube from '@tiptap/extension-youtube';
import TextStyle from '@tiptap/extension-text-style';
import Table from '@tiptap/extension-table'
import TableCell from '@tiptap/extension-table-cell'
import TableHeader from '@tiptap/extension-table-header'
import TableRow from '@tiptap/extension-table-row'
import { FontFamily } from '@tiptap/extension-font-family';
import { FontSize } from '@/lib/tiptap-fontsize';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { ResizableImageNode } from './ResizableImageNode';
import { Button } from '@/components/ui/button';
import { AlignCenter, PanelLeft, PanelRight } from 'lucide-react';

import { BubbleToolbar } from './BubbleToolbar';
import { SlashCommand } from '../editor/extensions/SlashCommand';
import { Document } from '@/lib/data';

const CustomImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: { default: null },
      height: { default: null },
      'data-float': { default: 'none' },
      'data-align': { default: 'center' },
    };
  },
  addNodeView() {
    return ReactNodeViewRenderer(ResizableImageNode);
  },
}).configure({
  inline: false,
  allowBase64: false,
});

type Props = {
  content: string;
  onChange: (html: string) => void;
  onBlur?: () => void;
  onEditorInstance?: (editor: Editor) => void;
  uploadImage: (file: File) => Promise<string>;
  docId: string;
  allDocuments?: Document[];
  linkPrefix?: string;
};

export default function TiptapEditor({
  content,
  onChange,
  onBlur,
  onEditorInstance,
  uploadImage,
  docId,
  allDocuments,
  linkPrefix,
}: Props) {
  // Keep latest uploadImage to avoid stale closure in extensions
  const uploadImageRef = useRef(uploadImage);
  useEffect(() => {
    uploadImageRef.current = uploadImage;
  }, [uploadImage]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // keep paragraph default; do not auto-title
        heading: false, // we’ll re-add Heading with config below
        blockquote: false,
        bulletList: false,
        orderedList: false,
        listItem: false,
        textStyle: false,
        image: false, // Disable default image
        table: false, // Disable default table
      }),
      Heading.configure({ levels: [1, 2, 3] }),
      Blockquote,
      BulletList,
      OrderedList,
      ListItem,

      Bold,
      Italic,
      Underline,

      Link.configure({ openOnClick: false }),

      CustomImage,
      
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableHeader,
      TableCell,

      Youtube.configure({ inline: false, width: 640, height: 360 }),

      TextStyle,
      FontFamily,
      FontSize,

      // Slash command menu on "/"
      SlashCommand.configure({
        uploadImage: (file: File) => uploadImageRef.current(file),
      }),
    ],
    content,
    // IMPORTANT: do not jump to bottom
    autofocus: false,
    editorProps: {
      attributes: {
        class: 'prose dark:prose-invert max-w-none focus:outline-none min-h-[400px] pb-96',
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    onBlur: () => {
      onBlur?.();
    },
    onCreate: ({ editor }) => {
      onEditorInstance?.(editor);

      // Put selection at the very start WITHOUT focusing (prevents scroll-to-bottom)
      // This makes opening an existing doc start at top.
      editor.commands.setTextSelection(0);
    },
  });

  if (!editor) return null;

  return (
    <div className="relative">
      {/* Bubble toolbar for text selection */}
      <BubbleMenu
        editor={editor}
        tippyOptions={{ duration: 100, placement: 'top', maxWidth: 'none' }}
        shouldShow={({ editor }) => {
          const { from, to } = editor.state.selection;
          return from !== to && editor.isEditable;
        }}
      >
        <BubbleToolbar editor={editor} articles={allDocuments} documentId={docId} linkPrefix={linkPrefix} />
      </BubbleMenu>

      {/* Bubble toolbar for image resizing/alignment */}
      <BubbleMenu
        editor={editor}
        tippyOptions={{ duration: 100, placement: 'top', maxWidth: 'none' }}
        shouldShow={({ editor }) => editor.isActive('image')}
      >
        <div className="flex w-max whitespace-nowrap items-center rounded-xl border bg-card/95 backdrop-blur px-1 py-1 shadow">
            <Button
              type="button"
              variant={editor.getAttributes('image')['data-float'] === 'left' ? 'secondary' : 'ghost'}
              size="sm"
              title="Float left"
              onClick={() => editor.chain().focus().updateAttributes('image', { 'data-float': 'left' }).run()}
            >
              <PanelLeft className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant={editor.getAttributes('image')['data-float'] === 'none' ? 'secondary' : 'ghost'}
              size="sm"
              title="Align center"
              onClick={() => editor.chain().focus().updateAttributes('image', { 'data-float': 'none', 'data-align': 'center' }).run()}
            >
              <AlignCenter className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant={editor.getAttributes('image')['data-float'] === 'right' ? 'secondary' : 'ghost'}
              size="sm"
              title="Float right"
              onClick={() => editor.chain().focus().updateAttributes('image', { 'data-float': 'right' }).run()}
            >
              <PanelRight className="h-4 w-4" />
            </Button>
        </div>
      </BubbleMenu>

      <EditorContent editor={editor} />
    </div>
  );
}
