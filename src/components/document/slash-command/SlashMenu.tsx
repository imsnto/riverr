'use client';

import React from 'react';

export type SlashItem = {
  title: string;
  keywords: string[];
  action: (editor: any) => void;
};

export function SlashMenu({
  items,
  selectedIndex,
  onSelect,
}: {
  items: SlashItem[];
  selectedIndex: number;
  onSelect: (item: SlashItem) => void;
}) {
  return (
    <div className="w-72 overflow-hidden rounded-xl border bg-card shadow-lg">
      <div className="px-3 py-2 text-xs text-muted-foreground">Insert</div>
      <div className="max-h-72 overflow-auto">
        {items.map((item, idx) => (
          <button
            key={item.title}
            className={
              'w-full text-left px-3 py-2 text-sm hover:bg-muted ' +
              (idx === selectedIndex ? 'bg-muted' : '')
            }
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onSelect(item)}
          >
            {item.title}
          </button>
        ))}
      </div>
    </div>
  );
}
