
'use client'

import React, { useEffect, useImperativeHandle, useRef, useState } from 'react'
import type { Editor } from '@tiptap/react'
import { Image as ImageIcon, Youtube, Table as TableIcon } from 'lucide-react'
import { TextSelection } from 'prosemirror-state'

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

  // The exact position to insert at (captured AFTER deleting the slash text)
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

  const deleteSlashTextAndCaptureInsertPos = () => {
    // 1) delete the typed "/something"
    editor.chain().focus().deleteRange(range).run()

    // 2) NOW capture where insertion should occur (post-delete)
    insertPosRef.current = editor.state.selection.from
  }

  const insertBlockAndPlaceCursorAfter = (node: any) => {
    const view = editor.view
    if (!view || editor.isDestroyed) return

    const { state } = view
    const { schema } = state
    const pos = insertPosRef.current ?? state.selection.from

    // Create a paragraph after block so typing works
    const paragraph = schema.nodes.paragraph?.create()

    let tr = state.tr.insert(pos, node)

    if (paragraph) {
      const afterBlock = pos + node.nodeSize
      tr = tr.insert(afterBlock, paragraph)

      // Place cursor inside the new paragraph
      const insideParagraph = Math.min(afterBlock + 1, tr.doc.content.size)
      tr = tr.setSelection(TextSelection.near(tr.doc.resolve(insideParagraph), 1))
    }

    view.dispatch(tr.scrollIntoView())
    view.focus()
  }

  const selectItem = async (index: number) => {
    const item = items[index]
    if (!item) return

    if (item.title === 'Image') {
      fileInputRef.current?.click()
      return
    }

    if (item.title === 'YouTube') {
      deleteSlashTextAndCaptureInsertPos()

      const url = window.prompt('Paste YouTube URL')
      if (!url) return

      // Use schema directly (more reliable than chained command)
      const { schema } = editor.state
      const yt = schema.nodes.youtube
      if (!yt) {
        console.error('YouTube node not in schema. Is Youtube extension enabled?')
        return
      }

      const node = yt.create({ src: url, width: 640, height: 360 })
      insertBlockAndPlaceCursorAfter(node)
      return
    }

    command(item)
  }

  const handleFilePicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    deleteSlashTextAndCaptureInsertPos()
    if (!file) return

    try {
      const url = await uploadImage(file)
      if (!url) {
        console.error('uploadImage returned empty url')
        return
      }

      if (editor.isDestroyed) return

      const { schema } = editor.state
      const img = schema.nodes.image
      if (!img) {
        console.error('Image node not in schema. Is Image extension enabled?')
        return
      }

      // Build the node and insert via transaction
      const node = img.create({ src: url, alt: file.name })
      requestAnimationFrame(() => {
        if (editor.isDestroyed) return
        insertBlockAndPlaceCursorAfter(node)
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
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => selectItem(index)}
          >
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-md border bg-background">
              {item.title === 'Image' ? (
                <ImageIcon className="h-4 w-4" />
              ) : item.title === 'YouTube' ? (
                <Youtube className="h-4 w-4" />
              ) : item.title === 'Table' ? (
                <TableIcon className="h-4 w-4" />
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
