
'use client';

import React from 'react';
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
import { FontSize } from '@/lib/tiptap-fontsize';

import { Toolbar } from './TiptapToolbar';
import { useIsMobile } from '@/hooks/use-mobile';
export { useEditor };

export default function TiptapEditor({ content, onChange, onBlur, onEditorInstance }: { content: string; onChange: (html: string) => void, onBlur?: () => void, onEditorInstance?: (editor: Editor) => void }) {
  const isMobile = useIsMobile();
  
  const editor = useEditor({
    extensions: [
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
      Image,
      Youtube.configure({ inline: false, width: 640, height: 360 }),
      TextStyle,
      FontFamily,
      FontSize,
    ],
    content,
    editorProps: {
      attributes: {
        class: 'prose dark:prose-invert max-w-full focus:outline-none min-h-[400px]',
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    onBlur: () => {
      if (onBlur) {
        onBlur();
      }
    },
    onCreate: ({ editor }) => {
        if (onEditorInstance) {
            onEditorInstance(editor);
        }
    }
  });

  if (isMobile === undefined) {
    return null; // Avoid rendering mismatch between server and client
  }

  return (
    <>
      {editor && !isMobile && (
        <BubbleMenu 
            editor={editor} 
            tippyOptions={{ duration: 100 }}
            className="bg-card border border-border rounded-lg shadow-xl"
        >
            <Toolbar editor={editor} />
        </BubbleMenu>
      )}
      <EditorContent editor={editor} />
      {editor && isMobile && (
        <div className="fixed bottom-0 left-0 right-0 z-10 bg-card border-t p-1 overflow-x-auto">
            <Toolbar editor={editor} />
        </div>
      )}
    </>
  );
}
