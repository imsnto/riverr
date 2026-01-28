
'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import { Editor, EditorContent, useEditor, BubbleMenu } from '@tiptap/react';
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
import { TextSelection } from 'prosemirror-state';

import { FontSize } from '@/lib/tiptap-fontsize';
import { BubbleToolbar } from './BubbleToolbar';
import { SlashCommand } from '@/components/editor/extensions/SlashCommand';

type Props = {
  content: string;
  onChange: (html: string) => void;
  onBlur?: () => void;
  onEditorInstance?: (editor: Editor) => void;
  uploadImage: (file: File) => Promise<string>;
  /**
   * Fix #1: when entering an existing doc, do NOT jump to bottom.
   * We'll set selection to start and avoid autofocus-to-end behaviors.
   */
  startAtTop?: boolean;
};

export default function TiptapEditor({
  content,
  onChange,
  onBlur,
  onEditorInstance,
  uploadImage,
  startAtTop = true,
}: Props) {
  const extensions = useMemo(
    () => [
      StarterKit.configure({
        textStyle: false,
      }),
      Bold,
      Italic,
      Underline,
      Heading.configure({ levels: [1, 2, 3] }),
      BulletList,
      OrderedList,
      ListItem,
      Blockquote,
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
      SlashCommand.configure({
        uploadImage,
      })
    ],
    [uploadImage]
  );

  const editor = useEditor({
    extensions,
    content,
    autofocus: false, 
    editorProps: {
      attributes: {
        class: 'prose dark:prose-invert max-w-none focus:outline-none min-h-[400px]',
      },
    },
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    onBlur: () => onBlur?.(),
    onCreate: ({ editor }) => {
      onEditorInstance?.(editor);

      if (startAtTop) {
        requestAnimationFrame(() => {
          try {
            editor.commands.setTextSelection(1);
          } catch {}
        });
      }
    },
  });


  return (
    <div className="relative">
      {editor && (
        <BubbleMenu
          editor={editor}
          tippyOptions={{
            duration: 150,
            placement: 'top',
            maxWidth: 'none',
          }}
          shouldShow={({ editor, from, to }) => {
             if (!editor?.isFocused) {
                return false;
             }
            return from !== to;
          }}
        >
          <BubbleToolbar editor={editor} />
        </BubbleMenu>
      )}

      <EditorContent editor={editor} />
    </div>
  );
}
