
'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { ReactRenderer } from '@tiptap/react'
import tippy, { type Instance } from 'tippy.js'
import 'tippy.js/dist/tippy.css'

type Props = {
  items: any[]
  command: (item: any) => void
}

function MenuList({ items, command }: Props) {
  const [selectedIndex, setSelectedIndex] = useState(0)

  useEffect(() => setSelectedIndex(0), [items])

  const selectItem = (index: number) => {
    const item = items[index]
    if (item) command(item)
  }

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((i) => (i + 1) % items.length)
      return true
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((i) => (i - 1 + items.length) % items.length)
      return true
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      selectItem(selectedIndex)
      return true
    }
    return false
  }

  // expose for suggestion render
  ;(MenuList as any).onKeyDown = onKeyDown

  return (
    <div className="min-w-[260px] rounded-xl border bg-card shadow-sm p-1">
      <div className="px-2 py-1 text-xs text-muted-foreground">Type “/”</div>
      {items.map((item, index) => (
        <button
          key={item.title}
          className={[
            'w-full text-left px-2 py-2 rounded-lg flex flex-col',
            index === selectedIndex ? 'bg-muted' : 'hover:bg-muted/60',
          ].join(' ')}
          onMouseDown={(e) => e.preventDefault()} // ✅ keep editor focus
          onClick={() => selectItem(index)}
        >
          <span className="text-sm font-medium">{item.title}</span>
          {item.description && (
            <span className="text-xs text-muted-foreground">{item.description}</span>
          )}
        </button>
      ))}
    </div>
  )
}

export function renderSlashMenu() {
  let component: ReactRenderer | null = null
  let popup: Instance[] | null = null

  return {
    onStart: (props: any) => {
      component = new ReactRenderer(MenuList, {
        props: {
          items: props.items,
          command: (item: any) => props.command(item),
        },
        editor: props.editor,
      })

      popup = tippy('body', {
        getReferenceClientRect: props.clientRect,
        appendTo: () => document.body,
        content: component.element,
        showOnCreate: true,
        interactive: true,
        trigger: 'manual',
        placement: 'bottom-start',
      })
    },

    onUpdate(props: any) {
      component?.updateProps({
        items: props.items,
        command: (item: any) => props.command(item),
      })
      popup?.[0].setProps({
        getReferenceClientRect: props.clientRect,
      })
    },

    onKeyDown(props: any) {
      const handler = (MenuList as any).onKeyDown as ((e: KeyboardEvent) => boolean) | undefined
      if (!handler) return false
      return handler(props.event)
    },

    onExit() {
      popup?.[0].destroy()
      component?.destroy()
      popup = null
      component = null
    },
  }
}
