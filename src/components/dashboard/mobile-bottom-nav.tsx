
'use client';

import { AppView } from '@/lib/routes';
import { Hub, Space } from '@/lib/data';
import { Button } from '../ui/button';
import { ScrollArea, ScrollBar } from '../ui/scroll-area';
import { cn, getInitials } from '@/lib/utils';
import {
  BarChart,
  FolderKanban,
  MessageCircle,
  Settings,
  BookOpen,
  Ticket,
  DollarSign,
  Users,
  Building2,
  ChevronRight,
  Check,
} from 'lucide-react';
import React, { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '../ui/sheet';
import { Separator } from '../ui/separator';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import * as db from '@/lib/db';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';

const navItems: { key: AppView; icon: React.ReactNode; label: string }[] = [
  { key: 'overview', icon: <BarChart />, label: 'Dashboard' },
  { key: 'tasks', icon: <FolderKanban />, label: 'Projects' },
  { key: 'tickets', icon: <Ticket />, label: 'Tickets' },
  { key: 'deals', icon: <DollarSign />, label: 'Deals' },
  { key: 'inbox', icon: <MessageCircle />, label: 'Inbox' },
  { key: 'contacts', icon: <Users />, label: 'Contacts' },
  { key: 'help-center', icon: <BookOpen />, label: 'Knowledge' },
  { key: 'settings', icon: <Settings />, label: 'Settings' },
];

interface MobileBottomNavProps {
  currentView: AppView;
  onChangeView: (view: AppView) => void;
  activeHub: Hub | null;
  activeSpace: Space | null;
  allSpaces: Space[];
  onHubChange: (hubId: string, spaceId: string) => void;
}

export default function MobileBottomNav({
  currentView,
  onChangeView,
  activeHub,
  activeSpace,
  allSpaces,
  onHubChange,
}: MobileBottomNavProps) {
  const [isSwitcherOpen, setIsSwitcherOpen] = useState(false);
  const [browsingSpaceId, setBrowsingSpaceId] = useState<string | undefined>(activeSpace?.id);
  const [browsingHubs, setBrowsingHubs] = useState<Hub[]>([]);

  useEffect(() => {
    if (isSwitcherOpen) {
      setBrowsingSpaceId(activeSpace?.id);
    }
  }, [isSwitcherOpen, activeSpace]);

  useEffect(() => {
    if (browsingSpaceId) {
      db.getHubsForSpace(browsingSpaceId).then(setBrowsingHubs);
    } else {
      setBrowsingHubs([]);
    }
  }, [browsingSpaceId]);

  const hubComponents = activeHub?.settings?.components || [];

  // Always show dashboard and settings. Show others if enabled in hub.
  const availableNavItems = navItems.filter(
    (item) =>
      item.key === 'overview' ||
      item.key === 'settings' ||
      hubComponents.includes(item.key)
  );

  const handleHubSelect = (hubId: string) => {
    if (browsingSpaceId) {
      onHubChange(hubId, browsingSpaceId);
      setIsSwitcherOpen(false);
    }
  };

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t p-1 z-10 flex items-center">
      <ScrollArea className="flex-1 whitespace-nowrap">
        <div className="flex w-max space-x-1">
          {availableNavItems.map((item) => (
            <Button
              key={item.key}
              variant={currentView === item.key ? 'secondary' : 'ghost'}
              className="flex-col h-auto px-2 py-1.5 items-center w-20"
              onClick={() => onChangeView(item.key)}
            >
              {React.cloneElement(item.icon as React.ReactElement, { className: 'h-5 w-5 mb-0.5' })}
              <span className="text-[10px]">{item.label}</span>
            </Button>
          ))}
        </div>
        <ScrollBar orientation="horizontal" className="hidden" />
      </ScrollArea>

      <Separator orientation="vertical" className="h-8 mx-1" />

      <Sheet open={isSwitcherOpen} onOpenChange={setIsSwitcherOpen}>
        <SheetTrigger asChild>
          <Button
            variant="ghost"
            className="flex-col h-auto px-2 py-1.5 items-center w-20 shrink-0"
          >
            <Building2 className="h-5 w-5 mb-0.5" />
            <span className="text-[10px]">Workspace</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="bottom" className="rounded-t-2xl px-6 pb-10">
          <SheetHeader className="text-left mb-6">
            <SheetTitle>Switch Workspace</SheetTitle>
          </SheetHeader>
          
          <div className="space-y-6">
            <div className="space-y-3">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Select Space</Label>
              <Select value={browsingSpaceId} onValueChange={setBrowsingSpaceId}>
                <SelectTrigger className="w-full h-12">
                  <SelectValue placeholder="Select a space" />
                </SelectTrigger>
                <SelectContent>
                  {allSpaces.filter(s => !s.isSystem).map((space) => (
                    <SelectItem key={space.id} value={space.id}>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-6 w-6 rounded-sm">
                          <AvatarImage src={space.logoUrl} />
                          <AvatarFallback className="text-[10px]">{getInitials(space.name)}</AvatarFallback>
                        </Avatar>
                        {space.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Select Hub</Label>
              <div className="grid gap-2">
                {browsingHubs.length > 0 ? browsingHubs.map((hub) => (
                  <Button
                    key={hub.id}
                    variant={activeHub?.id === hub.id && browsingSpaceId === activeSpace?.id ? "secondary" : "outline"}
                    className="w-full justify-between h-12 px-4"
                    onClick={() => handleHubSelect(hub.id)}
                  >
                    <span className="font-medium">{hub.name}</span>
                    {activeHub?.id === hub.id && browsingSpaceId === activeSpace?.id ? (
                      <Check className="h-4 w-4 text-primary" />
                    ) : (
                      <ChevronRight className="h-4 w-4 opacity-50" />
                    )}
                  </Button>
                )) : (
                  <p className="text-sm text-muted-foreground italic py-2 text-center">No hubs found in this space.</p>
                )}
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
