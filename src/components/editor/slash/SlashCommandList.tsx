
'use client'

import React, { useEffect, useImperativeHandle, useRef, useState } from 'react'
import type { Editor } from '@tiptap/react'
import { Image as ImageIcon, Youtube } from 'lucide-react'

type Range = { from: number; to: number }

type CommandItem = {
  title: string
  description?: string
  run: (opts: { editor: Editor; range: Range }) => void
}

type Props = {
  editor: Editor
  items: CommandItem[]
  command: (item: CommandItem) => void
  range: Range
  query: string
  uploadImage: (file: File) => Promise<string>
}

export const SlashCommandList = React.forwardRef(function SlashCommandList(
  { editor, items, command, range, uploadImage }: Props,
  ref: any,
) {
  const [selectedIndex, setSelectedIndex] = useState(0)

  const fileInputRef = useRef<HTMLInputElement | null>(null)

  // This is the ONLY position we care about: where the slash command text was
  const insertPosRef = useRef<number | null>(null)

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }: any) => {
      if (event.key === 'ArrowDown') {
        setSelectedIndex((i) => (i + 1) % items.length)
        return true
      }
      if (event.key === 'ArrowUp') {
        setSelectedIndex((i) => (i - 1 + items.length) % items.length)
        return true
      }
      if (event.key === 'Enter') {
        event.preventDefault()
        selectItem(selectedIndex)
        return true
      }
      return false
    },
  }))

  useEffect(() => setSelectedIndex(0), [items])

  const selectItem = async (index: number) => {
    const item = items[index]
    if (!item) return

    // IMAGE
    if (item.title === 'Image') {
      // save insertion point BEFORE picker steals focus
      insertPosRef.current = range.from

      // delete the "/image" text now while selection is valid
      editor.chain().focus().deleteRange(range).run()

      // open picker
      fileInputRef.current?.click()
      return
    }

    // YOUTUBE
    if (item.title === 'YouTube') {
      editor.chain().focus().deleteRange(range).run()

      const url = window.prompt('Paste YouTube URL')
      if (!url) return

      // insert video + paragraph so you can type underneath
      editor
        .chain()
        .focus()
        .setYoutubeVideo({ src: url, width: 640, height: 360 })
        .insertContent({ type: 'paragraph' })
        .run()

      return
    }

    // all other commands
    command(item)
  }

  const handleFilePicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    try {
      const url = await uploadImage(file)

      // restore selection to saved insert pos
      const pos = insertPosRef.current ?? editor.state.selection.from

      // Focus AFTER picker returns (Safari/Chrome)
      requestAnimationFrame(() => {
        editor.commands.focus()
        editor.commands.setTextSelection(pos)

        // Insert image + paragraph
        editor
          .chain()
          .focus()
          .insertContent([
            { type: 'image', attrs: { src: url, alt: file.name } },
            { type: 'paragraph' },
          ])
          .run()

        // Put cursor INSIDE the paragraph we just inserted.
        // After insertContent, selection is usually after the paragraph node.
        // Moving left once lands inside it.
        editor.commands.focus()
        editor.commands.command(({ tr, dispatch }) => {
          const nextPos = Math.max(0, tr.selection.from - 1)
          tr.setSelection((tr.selection as any).constructor.near(tr.doc.resolve(nextPos), 1))
          dispatch?.(tr)
          return true
        })
      })
    } catch (err) {
      console.error('Image upload failed:', err)
    } finally {
      insertPosRef.current = null
    }
  }

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
            onMouseDown={(e) => e.preventDefault()} // keeps editor selection stable
            onClick={() => selectItem(index)}
          >
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-md border bg-background">
              {item.title === 'Image' ? (
                <ImageIcon className="h-4 w-4" />
              ) : item.title === 'YouTube' ? (
                <Youtube className="h-4 w-4" />
              ) : (
                'T'
              )}
            </span>
            <span className="flex flex-col">
              <span className="text-sm font-medium">{item.title}</span>
              {item.description ? (
                <span className="text-xs text-muted-foreground">{item.description}</span>
              ) : null}
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
  )
})
