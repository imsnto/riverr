
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
        "grid h-full min-h-0 transition-all duration-200 ease-in-out",
        threadOpen ? 'grid-cols-[320px_1fr_400px]' : 'grid-cols-[320px_1fr]'
      )}
    >
      <div className="flex-col border-r bg-card hidden md:flex min-h-0">{left}</div>
      <div className="flex flex-col h-full min-h-0 min-w-0 overflow-hidden">{center}</div>
      {threadOpen && <div className="w-[400px] border-l bg-card h-full overflow-y-auto hidden md:block">{right}</div>}
    </div>
  );
}
