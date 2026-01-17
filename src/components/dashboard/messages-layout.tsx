

import React from 'react';
import { cn } from '@/lib/utils';

type MessagesLayoutProps = {
  left: React.ReactNode;
  center: React.ReactNode;
  right?: React.ReactNode;
  threadOpen: boolean;
};

export default function MessagesLayout({ left, center, right, threadOpen }: MessagesLayoutProps) {
  return (
    <div
      className={cn(
        "grid h-full min-h-0",
        threadOpen ? 'md:grid-cols-[320px_1fr_400px]' : 'md:grid-cols-[320px_1fr]'
      )}
    >
      <div className="flex-col border-r bg-card min-h-0">{left}</div>
      <div className="flex-col h-full min-h-0 min-w-0 overflow-hidden hidden md:flex">{center}</div>
      {threadOpen && <div className="w-[400px] border-l bg-card h-full overflow-y-auto hidden md:block">{right}</div>}
    </div>
  );
}
