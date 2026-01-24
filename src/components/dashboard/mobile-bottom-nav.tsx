
'use client';

import { AppView } from '@/lib/routes';
import { Hub } from '@/lib/data';
import { Button } from '../ui/button';
import { ScrollArea, ScrollBar } from '../ui/scroll-area';
import { cn } from '@/lib/utils';
import {
  BarChart,
  FolderKanban,
  MessageCircle,
  Settings,
  BookOpen,
} from 'lucide-react';
import React from 'react';

const navItems: { key: AppView; icon: React.ReactNode; label: string }[] = [
  { key: 'overview', icon: <BarChart />, label: 'Dashboard' },
  { key: 'tasks', icon: <FolderKanban />, label: 'Projects' },
  { key: 'inbox', icon: <MessageCircle />, label: 'Inbox' },
  { key: 'help-center', icon: <BookOpen />, label: 'Help Center' },
  { key: 'settings', icon: <Settings />, label: 'Settings' },
];

interface MobileBottomNavProps {
  currentView: AppView;
  onChangeView: (view: AppView) => void;
  activeHub: Hub | null;
}

export default function MobileBottomNav({
  currentView,
  onChangeView,
  activeHub,
}: MobileBottomNavProps) {
  const hubComponents = activeHub?.settings?.components || [];

  // Always show dashboard and settings. Show others if enabled in hub.
  const availableNavItems = navItems.filter(
    (item) =>
      item.key === 'overview' ||
      item.key === 'settings' ||
      hubComponents.includes(item.key)
  );

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t p-1 z-10">
      <ScrollArea className="w-full whitespace-nowrap">
        <div className="flex w-max space-x-1">
          {availableNavItems.map((item) => (
            <Button
              key={item.key}
              variant={currentView === item.key ? 'secondary' : 'ghost'}
              className="flex-col h-auto px-2 py-1.5 items-center w-20"
              onClick={() => onChangeView(item.key)}
            >
              {React.cloneElement(item.icon as React.ReactElement, { className: 'h-5 w-5 mb-0.5' })}
              <span className="text-xs">{item.label}</span>
            </Button>
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
}
