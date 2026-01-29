import { Extension } from '@tiptap/core'
import Suggestion, { type SuggestionOptions } from '@tiptap/suggestion'
import { ReactRenderer } from '@tiptap/react'
import tippy, { type Instance as TippyInstance } from 'tippy.js'
import { SlashCommandList } from '../slash/SlashCommandList'

type Range = { from: number; to: number }

type CommandItem = {
  title: string
  description?: string
  run: (opts: { editor: any; range: Range }) => void
}

export interface SlashCommandOptions {
  uploadImage: (file: File) => Promise<string>
}

export const SlashCommand = Extension.create<SlashCommandOptions>({
  name: 'slashCommand',

  addOptions() {
    return {
      uploadImage: async () => '',
    }
  },

  addProseMirrorPlugins() {
    const getItems = ({ query }: { query: string }): CommandItem[] => {
      const q = (query ?? '').toLowerCase().trim()

      const all: CommandItem[] = [
        {
          title: 'Text',
          description: 'Continue writing',
          run: ({ editor, range }) => editor.chain().focus().deleteRange(range).run(),
        },
        {
          title: 'Heading 1',
          run: ({ editor, range }) =>
            editor.chain().focus().deleteRange(range).setNode('heading', { level: 1 }).run(),
        },
        {
          title: 'Heading 2',
          run: ({ editor, range }) =>
            editor.chain().focus().deleteRange(range).setNode('heading', { level: 2 }).run(),
        },
        {
          title: 'Heading 3',
          run: ({ editor, range }) =>
            editor.chain().focus().deleteRange(range).setNode('heading', { level: 3 }).run(),
        },
        {
          title: 'Bullet List',
          run: ({ editor, range }) =>
            editor.chain().focus().deleteRange(range).toggleBulletList().run(),
        },
        {
          title: 'Numbered List',
          run: ({ editor, range }) =>
            editor.chain().focus().deleteRange(range).toggleOrderedList().run(),
        },
        {
          title: 'Blockquote',
          run: ({ editor, range }) =>
            editor.chain().focus().deleteRange(range).toggleBlockquote().run(),
        },

        // IMPORTANT: Image + YouTube are handled inside the list component
        // so we don’t run anything here besides “no-op”
        { title: 'Image', description: 'Upload an image', run: () => {} },
        { title: 'YouTube', description: 'Embed a YouTube URL', run: () => {} },
      ]

      if (!q) return all
      return all.filter((i) => i.title.toLowerCase().includes(q))
    }

    const suggestion: Omit<SuggestionOptions, 'editor'> = {
      char: '/',
      startOfLine: false,
      allowSpaces: false,

      items: getItems,

      // For normal items we still call props.run, but image/youtube are handled in UI
      command: ({ editor, range, props }) => {
        props.run?.({ editor, range })
      },

      render: () => {
        let reactRenderer: ReactRenderer | null = null
        let popup: TippyInstance | null = null

        return {
          onStart: (props) => {
            reactRenderer = new ReactRenderer(SlashCommandList, {
              editor: props.editor,
              props: {
                ...props,
                uploadImage: this.options.uploadImage,
              },
            })

            popup = tippy('body', {
              getReferenceClientRect: props.clientRect as any,
              appendTo: () => document.body,
              content: reactRenderer.element,
              showOnCreate: true,
              interactive: true,
              trigger: 'manual',
              placement: 'bottom-start',
            })[0]
          },

          onUpdate(props) {
            reactRenderer?.updateProps({
              ...props,
              uploadImage: this.options.uploadImage,
            })

            popup?.setProps({
              getReferenceClientRect: props.clientRect as any,
            })
          },

          onKeyDown(props) {
            // @ts-expect-error
            const handled = reactRenderer?.ref?.onKeyDown?.(props)
            if (handled) return true

            if (props.event.key === 'Escape') {
              popup?.hide()
              return true
            }
            return false
          },

          onExit() {
            popup?.destroy()
            reactRenderer?.destroy()
            popup = null
            reactRenderer = null
          },
        }
      },
    }

    return [Suggestion({ editor: this.editor, ...suggestion })]
  },
})
