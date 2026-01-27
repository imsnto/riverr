'use client';

import React, { useEffect, useState } from 'react';
import { Editor, EditorContent, useEditor } from '@tiptap/react';
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

export default function TiptapEditor({
  content,
  onChange,
  onBlur,
  onEditorInstance,
  uploadImage,
}: {
  content: string;
  onChange: (html: string) => void;
  onBlur?: () => void;
  onEditorInstance?: (editor: Editor) => void;
  uploadImage: (file: File) => Promise<string>;
}) {
  const isMobile = useIsMobile();
  const [keyboardHeight, setKeyboardHeight] = useState(0);

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
      Image.configure({
        inline: false,
        allowBase64: false,
      }),
      Youtube.configure({ inline: false, width: 640, height: 360 }),
      TextStyle,
      FontFamily,
      FontSize,
    ],
    content,
    autofocus: 'end',
    editorProps: {
      attributes: {
        class:
          'prose dark:prose-invert max-w-none focus:outline-none min-h-[400px]',
      },
      handlePaste(view, event) {
        const items = Array.from(event.clipboardData?.items ?? []);
        const file = items.find((i) => i.type.startsWith('image/'))?.getAsFile();
        if (!file) return false;

        uploadImage(file).then((url) => {
          editor?.chain().focus().setImage({ src: url, alt: file.name }).run();
        });

        return true;
      },
      handleDrop(view, event, slice, moved) {
        if (moved) return false;
        const files = Array.from(event.dataTransfer?.files ?? []);
        const file = files.find((f) => f.type.startsWith('image/'));
        if (!file) return false;

        event.preventDefault();

        const coordinates = view.posAtCoords({
          left: event.clientX,
          top: event.clientY,
        });

        uploadImage(file).then((url) => {
          if (coordinates) {
            editor
              ?.chain()
              .focus()
              .insertContentAt(coordinates.pos, {
                type: 'image',
                attrs: { src: url, alt: file.name },
              })
              .run();
          } else {
            editor?.chain().focus().setImage({ src: url, alt: file.name }).run();
          }
        });

        return true;
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
    },
  });

  useEffect(() => {
    const visualViewport = window.visualViewport;
    if (!isMobile || !visualViewport) return;

    const handleResize = () => {
      const offset = window.innerHeight - visualViewport.height;
      setKeyboardHeight(offset > 0 ? offset : 0);
    };

    visualViewport.addEventListener('resize', handleResize);
    handleResize();

    return () => {
      visualViewport.removeEventListener('resize', handleResize);
    };
  }, [isMobile]);

  if (!editor) {
    return null;
  }

  if (isMobile === undefined) {
    return null; // Avoid rendering mismatch
  }

  return (
    <div className="flex flex-col gap-4">
      {!isMobile && (
        <div className="sticky top-0 z-10 border bg-card rounded-lg p-1">
          <Toolbar editor={editor} uploadImage={uploadImage} />
        </div>
      )}
      <EditorContent editor={editor} />
      {isMobile && (
        <div
          className="fixed left-0 right-0 z-20 bg-card border-t p-1 overflow-x-auto transition-all duration-150 ease-in-out"
          style={{ bottom: `${keyboardHeight}px` }}
        >
          <Toolbar editor={editor} uploadImage={uploadImage} />
        </div>
      )}
    </div>
  );
}