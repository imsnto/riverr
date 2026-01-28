'use client';

import { Extension, Editor } from '@tiptap/core'
import Suggestion, { type SuggestionOptions } from '@tiptap/suggestion'
import { PluginKey } from 'prosemirror-state'
import { renderSlashMenu } from '../SlashMenu'
import { TextSelection } from 'prosemirror-state'

export type SlashItem = {
  title: string
  description?: string
  icon?: React.ReactNode
  command: (ctx: { editor: Editor; range: { from: number; to: number } }) => void
}

export type SlashCommandOptions = {
    uploadImage: (file: File) => Promise<string>;
    suggestion: Omit<SuggestionOptions<SlashItem>, 'editor'>
}

function openImagePickerAndInsert(editor: Editor, uploadImage: (file: File) => Promise<string>) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.style.display = 'none';

    const { from, to } = editor.state.selection;
    const selection = { from, to };

    input.onchange = async () => {
        const file = input.files?.[0];
        document.body.removeChild(input);
        if (!file) return;

        try {
            const url = await uploadImage(file);

            editor.commands.focus();
            editor.view.dispatch(
                editor.state.tr.setSelection(
                    TextSelection.create(editor.state.doc, selection.from, selection.to)
                )
            );

            editor.chain().focus().insertContent([
                { type: 'image', attrs: { src: url, alt: file.name } },
                { type: 'paragraph' }
            ]).run();
        } catch (e) {
            console.error('Image upload failed', e);
        }
    };

    document.body.appendChild(input);
    input.click();
}


function openYoutubePrompt(editor: Editor) {
  const url = window.prompt('Paste a YouTube URL');
  if (!url) return;
  editor.chain().focus().setYoutubeVideo({ src: url, width: 640, height: 360 }).run();
}


export const SlashCommand = Extension.create<SlashCommandOptions>({
  name: 'slashCommand',

  addOptions() {
    return {
      uploadImage: async (file: File) => { 
        console.error("uploadImage function not provided to SlashCommand extension");
        return "";
      },
      suggestion: {
        char: '/',
        pluginKey: new PluginKey('slashCommand'),
        allow: ({ editor, state, range }) => {
          if (!editor || !editor.isEditable) return false;
          const $from = state.doc.resolve(range.from);
          return $from.parent.type.name === 'paragraph';
        },
        command: ({ editor, range, props }) => {
          if (!editor) return;
          props.command({ editor, range });
        },
        render: renderSlashMenu(),
      },
    };
  },
  
  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
        items: ({ query }) => {
            const items: SlashItem[] = [
                {
                  title: 'Text',
                  description: 'Start writing with plain text',
                  command: ({ editor, range }) => {
                    editor.chain().focus().deleteRange(range).setParagraph().run()
                  },
                },
                {
                  title: 'Heading 1',
                  command: ({ editor, range }) => {
                    editor.chain().focus().deleteRange(range).toggleHeading({ level: 1 }).run()
                  },
                },
                {
                  title: 'Heading 2',
                  command: ({ editor, range }) => {
                    editor.chain().focus().deleteRange(range).toggleHeading({ level: 2 }).run()
                  },
                },
                 {
                  title: 'Heading 3',
                  command: ({ editor, range }) => {
                    editor.chain().focus().deleteRange(range).toggleHeading({ level: 3 }).run()
                  },
                },
                {
                  title: 'Bullet List',
                  command: ({ editor, range }) => {
                    editor.chain().focus().deleteRange(range).toggleBulletList().run()
                  },
                },
                {
                  title: 'Numbered List',
                  command: ({ editor, range }) => {
                    editor.chain().focus().deleteRange(range).toggleOrderedList().run()
                  },
                },
                {
                  title: 'Quote',
                  command: ({ editor, range }) => {
                    editor.chain().focus().deleteRange(range).toggleBlockquote().run()
                  },
                },
                {
                    title: 'Image',
                    description: 'Upload an image from your device',
                    command: ({ editor, range }) => {
                        editor.chain().focus().deleteRange(range).run();
                        openImagePickerAndInsert(editor, this.options.uploadImage);
                    }
                },
                {
                    title: 'YouTube Video',
                    description: 'Embed a YouTube video',
                    command: ({ editor, range }) => {
                        editor.chain().focus().deleteRange(range).run();
                        openYoutubePrompt(editor);
                    }
                }
            ];

            if (!query) return items;
            const q = query.toLowerCase();
            return items.filter(i => i.title.toLowerCase().includes(q));
        }
      }),
    ];
  },
});
