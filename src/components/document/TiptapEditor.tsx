'use client';

import React, { useEffect, useState, useRef } from 'react';
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
import { cn } from '@/lib/utils';
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
  const [isFocused, setIsFocused] = useState(false);

  // Use a ref to hold the latest uploadImage function to avoid stale closures
  const uploadImageRef = React.useRef(uploadImage);
  useEffect(() => {
    uploadImageRef.current = uploadImage;
  }, [uploadImage]);

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
        HTMLAttributes: {
          class: 'tiptap-image',
        },
      }),
      Youtube.configure({ inline: false, width: 640, height: 360 }),
      TextStyle,
      FontFamily,
      FontSize,
    ],
    content,
    autofocus: !isMobile ? 'end' : false,
    editorProps: {
      attributes: {
        class:
          'prose dark:prose-invert max-w-none focus:outline-none min-h-[400px]',
      },
      handlePaste(view, event) {
        const items = Array.from(event.clipboardData?.items ?? []);
        const file = items.find((i) => i.type.startsWith('image/'))?.getAsFile();
        if (!file) return false;

        uploadImageRef.current(file).then((url) => {
          const { schema } = view.state;
          const imageNode = schema.nodes.image.create({ src: url, alt: file.name });
          const paragraph = schema.nodes.paragraph.create();

          const tr = view.state.tr
            .replaceSelectionWith(imageNode)
            .insert(view.state.selection.from + imageNode.nodeSize, paragraph);

          view.dispatch(tr.scrollIntoView());
        });

        return true;
      },
      handleDrop(view, event, slice, moved) {
        if (moved) return false;
        const files = Array.from(event.dataTransfer?.files ?? []);
        const file = files.find((f) => f.type.startsWith('image/'));
        if (!file) return false;

        event.preventDefault();

        uploadImageRef.current(file).then((url) => {
          const { schema } = view.state;
          const imageNode = schema.nodes.image.create({ src: url, alt: file.name });
          const paragraph = schema.nodes.paragraph.create();
          
          const coords = view.posAtCoords({ left: event.clientX, top: event.clientY });
          const pos = coords?.pos ?? view.state.selection.from;

          const tr = view.state.tr
            .insert(pos, imageNode)
            .insert(pos + imageNode.nodeSize, paragraph);

          view.dispatch(tr.scrollIntoView());
        });

        return true;
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    onFocus: () => setIsFocused(true),
    onBlur: () => {
        setIsFocused(false);
        if (onBlur) onBlur();
    },
    onCreate: ({ editor }) => {
      if (onEditorInstance) {
        onEditorInstance(editor);
      }
    },
  });

  useEffect(() => {
    const vv = window.visualViewport;
    if (!isMobile || !vv) return;

    const update = () => {
      const keyboard = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      setKeyboardHeight(keyboard);
    };

    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    update();

    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
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
          className="fixed left-0 right-0 z-20 border-t bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/70 transition-all duration-150 ease-in-out"
          style={{
            bottom: `${keyboardHeight}px`,
            transform: isFocused ? "translateY(0px)" : "translateY(12px)",
            opacity: isFocused ? 1 : 0,
            pointerEvents: isFocused ? "auto" : "none",
          }}
        >
          {/* This wrapper creates the horizontal scrolling strip */}
          <div className="overflow-x-auto [-webkit-overflow-scrolling:touch]">
            <Toolbar editor={editor} uploadImage={uploadImage} variant="mobile" />
          </div>
        </div>
      )}
    </div>
  );
}
