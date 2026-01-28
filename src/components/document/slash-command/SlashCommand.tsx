'use client';

import { Extension, Editor } from '@tiptap/core';
import Suggestion from '@tiptap/suggestion';
import tippy, { Instance as TippyInstance } from 'tippy.js';
import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import { SlashMenu, SlashItem } from './SlashMenu';
import { TextSelection } from 'prosemirror-state';

type RememberSel = { from: number; to: number };

type Options = {
  uploadImage: (file: File) => Promise<string>;
  onRememberSelection: (sel: RememberSel) => void;
  onRestoreSelection: (editor: Editor) => void;
};

function insertImageAtSelection(editor: Editor, url: string, alt?: string) {
  const { view } = editor;
  const { state } = view;
  const { schema } = state;

  if (!schema.nodes.image) return;

  const imageNode = schema.nodes.image.create({ src: url, alt: alt || '' });
  const paragraph = schema.nodes.paragraph.create();

  let tr = state.tr.replaceSelectionWith(imageNode);

  // After replaceSelectionWith, selection is moved; insert paragraph after image.
  const insertPos = tr.selection.to;
  tr = tr.insert(insertPos, paragraph);

  // Put cursor into the new paragraph.
  const cursorPos = Math.min(insertPos + 1, tr.doc.content.size);
  tr = tr.setSelection(TextSelection.near(tr.doc.resolve(cursorPos), 1));

  view.dispatch(tr.scrollIntoView());
  view.focus();
}

function openImagePickerAndInsert(editor: Editor, opts: Options) {
  // Remember selection BEFORE the picker steals focus
  const sel = editor.state.selection;
  opts.onRememberSelection({ from: sel.from, to: sel.to });

  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.style.display = 'none';
  document.body.appendChild(input);

  input.onchange = async () => {
    const file = input.files?.[0];
    document.body.removeChild(input);
    if (!file) return;

    try {
      const url = await opts.uploadImage(file);

      // Restore selection + focus AFTER async upload completes
      // (file picker + upload both can disrupt focus)
      requestAnimationFrame(() => {
        opts.onRestoreSelection(editor);
        editor.commands.focus();
        insertImageAtSelection(editor, url, file.name);
      });
    } catch (e) {
      console.error('Image upload failed', e);
    }
  };

  input.click();
}

function openYoutubePrompt(editor: Editor) {
  const url = window.prompt('Paste a YouTube URL');
  if (!url) return;
  editor.chain().focus().setYoutubeVideo({ src: url, width: 640, height: 360 }).run();
}

export const SlashCommand = (opts: Options) => {
  return Extension.create({
    name: 'slashCommand',

    addProseMirrorPlugins() {
      let popup: TippyInstance | null = null;
      let reactRoot: Root | null = null;
      let container: HTMLDivElement | null = null;

      const items: SlashItem[] = [
        {
          title: 'Text',
          keywords: ['paragraph', 'text'],
          action: (editor) => editor.chain().focus().setParagraph().run(),
        },
        {
          title: 'Heading 1',
          keywords: ['h1', 'heading'],
          action: (editor) => editor.chain().focus().toggleHeading({ level: 1 }).run(),
        },
        {
          title: 'Heading 2',
          keywords: ['h2', 'heading'],
          action: (editor) => editor.chain().focus().toggleHeading({ level: 2 }).run(),
        },
        {
          title: 'Heading 3',
          keywords: ['h3', 'heading'],
          action: (editor) => editor.chain().focus().toggleHeading({ level: 3 }).run(),
        },
        {
          title: 'Bullet List',
          keywords: ['ul', 'bullet', 'list'],
          action: (editor) => editor.chain().focus().toggleBulletList().run(),
        },
        {
          title: 'Numbered List',
          keywords: ['ol', 'number', 'list'],
          action: (editor) => editor.chain().focus().toggleOrderedList().run(),
        },
        {
          title: 'Quote',
          keywords: ['blockquote', 'quote'],
          action: (editor) => editor.chain().focus().toggleBlockquote().run(),
        },
        {
          title: 'Image',
          keywords: ['img', 'image', 'upload'],
          action: (editor) => openImagePickerAndInsert(editor, opts),
        },
        {
          title: 'YouTube Video',
          keywords: ['youtube', 'video'],
          action: (editor) => openYoutubePrompt(editor),
        },
      ];

      return [
        Suggestion({
          char: '/',
          startOfLine: true,
          command: ({ editor, range, props }: any) => {
            // remove the slash text first
            editor.chain().focus().deleteRange(range).run();
            props.action(editor);
          },
          items: ({ query }: any) => {
            const q = (query || '').toLowerCase();
            return items
              .filter((it) => {
                if (!q) return true;
                return (
                  it.title.toLowerCase().includes(q) ||
                  it.keywords.some((k) => k.includes(q))
                );
              })
              .slice(0, 8);
          },
          render: () => {
            return {
              onStart: (props: any) => {
                container = document.createElement('div');
                reactRoot = createRoot(container);

                popup = tippy('body', {
                  getReferenceClientRect: props.clientRect,
                  appendTo: () => document.body,
                  content: container,
                  showOnCreate: true,
                  interactive: true,
                  trigger: 'manual',
                  placement: 'bottom-start',
                });

                reactRoot.render(
                  <SlashMenu
                    items={props.items}
                    selectedIndex={props.selectedIndex}
                    onSelect={(item) => props.command(item)}
                  />
                );
              },

              onUpdate(props: any) {
                popup?.setProps({
                  getReferenceClientRect: props.clientRect,
                });

                reactRoot?.render(
                  <SlashMenu
                    items={props.items}
                    selectedIndex={props.selectedIndex}
                    onSelect={(item) => props.command(item)}
                  />
                );
              },

              onKeyDown(props: any) {
                if (props.event.key === 'Escape') {
                  popup?.hide();
                  return true;
                }
                return false;
              },

              onExit() {
                popup?.destroy();
                popup = null;

                reactRoot?.unmount();
                reactRoot = null;

                if (container?.parentNode) container.parentNode.removeChild(container);
                container = null;
              },
            };
          },
        }),
      ];
    },
  });
};
