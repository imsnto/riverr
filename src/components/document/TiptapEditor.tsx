
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
import { FontFamily } from '@tiptap/extension-font-family';
import { FontSize } from '@/lib/tiptap-fontsize';

import { BubbleToolbar } from './BubbleToolbar';
import { SlashCommand } from '../editor/extensions/SlashCommand';

type Props = {
  content: string;
  onChange: (html: string) => void;
  onBlur?: () => void;
  onEditorInstance?: (editor: Editor) => void;
  uploadImage: (file: File) => Promise<string>;
};

export default function TiptapEditor({
  content,
  onChange,
  onBlur,
  onEditorInstance,
  uploadImage,
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

      Image.configure({
        inline: false,
        allowBase64: false,
        HTMLAttributes: { class: 'tiptap-image' },
      }),

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
        class: 'prose dark:prose-invert max-w-none focus:outline-none min-h-[400px]',
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

  return (
    <div className="relative">
      {/* Bubble toolbar: only shows when there is a non-empty selection */}
      {editor && (
        <BubbleMenu
          editor={editor}
          tippyOptions={{ duration: 100, placement: 'top' }}
          shouldShow={({ editor }) => {
            if (!editor) {
              return false
            }
            const { from, to } = editor.state.selection;
            return from !== to && editor.isEditable;
          }}
        >
          <BubbleToolbar editor={editor} />
        </BubbleMenu>
      )}

      <EditorContent editor={editor} />
    </div>
  );
}
