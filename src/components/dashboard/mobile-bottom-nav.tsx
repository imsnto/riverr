
// src/components/dashboard/mobile-bottom-nav.tsx
'use client';

import { AppView } from '@/lib/routes';
import { Hub, Space } from '@/lib/data';
import { Button } from '../ui/button';
import { cn, getInitials } from '@/lib/utils';
import {
  Home,
  MessageCircle,
  FolderKanban,
  Ticket,
  DollarSign,
  BookOpen,
  Users,
  Settings,
  MoreHorizontal,
  Building2,
  ChevronRight,
  Check,
  ArrowLeft,
} from 'lucide-react';
import React, { useState, useEffect, useMemo } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '../ui/sheet';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import * as db from '@/lib/db';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { ScrollArea } from '../ui/scroll-area';
import { Separator } from '../ui/separator';

// Ordered list of features as requested
const ALL_NAV_ITEMS = [
  { key: 'overview' as AppView, icon: <Home className="h-5 w-5" />, label: 'Overview', desc: 'Dashboard and recent activity' },
  { key: 'inbox' as AppView, icon: <MessageCircle className="h-5 w-5" />, label: 'Inbox', desc: 'Messaging and customer chat' },
  { key: 'tasks' as AppView, icon: <FolderKanban className="h-5 w-5" />, label: 'Task Board', desc: 'Project management and tasks' },
  { key: 'tickets' as AppView, icon: <Ticket className="h-5 w-5" />, label: 'Tickets', desc: 'Support issues and requests' },
  { key: 'deals' as AppView, icon: <DollarSign className="h-5 w-5" />, label: 'Deals', desc: 'Sales pipeline and CRM' },
  { key: 'help-center' as AppView, icon: <BookOpen className="h-5 w-5" />, label: 'Knowledge', desc: 'Documentation and guides' },
  { key: 'contacts' as AppView, icon: <Users className="h-5 w-5" />, label: 'Contacts', desc: 'Customer and lead directory' },
  { key: 'settings' as AppView, icon: <Settings className="h-5 w-5" />, label: 'Settings', desc: 'Account and app configuration' },
];

interface MobileBottomNavProps {
  currentView: AppView;
  onChangeView: (view: AppView) => void;
  activeHub: Hub | null;
  activeSpace: Space | null;
  allSpaces: Space[];
  onHubChange: (hubId: string, spaceId: string) => void;
  unreadMessagesCount?: number;
}

export default function MobileBottomNav({
  currentView,
  onChangeView,
  activeHub,
  activeSpace,
  allSpaces,
  onHubChange,
  unreadMessagesCount = 0,
}: MobileBottomNavProps) {
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [isSwitchingWorkspace, setIsSwitchingWorkspace] = useState(false);
  const [browsingSpaceId, setBrowsingSpaceId] = useState<string | undefined>(activeSpace?.id);
  const [browsingHubs, setBrowsingHubs] = useState<Hub[]>([]);

  useEffect(() => {
    if (isMoreOpen) {
      setBrowsingSpaceId(activeSpace?.id);
      setIsSwitchingWorkspace(false);
    }
  }, [isMoreOpen, activeSpace]);

  useEffect(() => {
    if (browsingSpaceId) {
      db.getHubsForSpace(browsingSpaceId).then(setBrowsingHubs);
    } else {
      setBrowsingHubs([]);
    }
  }, [browsingSpaceId]);

  const hubComponents = activeHub?.settings?.components || [];

  // Filter items based on what's active in the hub
  const availableItems = useMemo(() => {
    return ALL_NAV_ITEMS.filter(item => 
      item.key === 'overview' || 
      item.key === 'settings' || 
      hubComponents.includes(item.key)
    );
  }, [hubComponents]);

  // Show top 4 items instead of 3
  const visibleItems = useMemo(() => availableItems.slice(0, 4), [availableItems]);

  const isInboxUnread = unreadMessagesCount > 0;
  const isInboxInMore = !visibleItems.some(i => i.key === 'inbox') && availableItems.some(i => i.key === 'inbox');
  const showDotOnMore = isInboxUnread && isInboxInMore;

  const handleHubSelect = (hubId: string) => {
    if (browsingSpaceId) {
      onHubChange(hubId, browsingSpaceId);
      setIsMoreOpen(false);
    }
  };

  const handleNavigate = (view: AppView) => {
    onChangeView(view);
    setIsMoreOpen(false);
  };

  return (
    <div className="md:hidden fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-auto">
      {/* Floating Pill Toolbar */}
      <div className="flex items-center gap-4 bg-background/80 backdrop-blur-md border shadow-2xl rounded-full p-1.5 px-6">
        {visibleItems.map((item) => {
          const hasUnread = item.key === 'inbox' && isInboxUnread;
          return (
            <Button
              key={item.key}
              variant={currentView === item.key ? 'secondary' : 'ghost'}
              className={cn(
                "h-12 w-12 rounded-full flex items-center justify-center p-0 relative",
                currentView === item.key ? "bg-primary text-primary-foreground hover:bg-primary/90" : "text-muted-foreground"
              )}
              onClick={() => handleNavigate(item.key)}
            >
              {item.icon}
              {hasUnread && (
                <span className="absolute top-2 right-2 h-2.5 w-2.5 rounded-full bg-red-500 border-2 border-background" />
              )}
              <span className="sr-only">{item.label}</span>
            </Button>
          );
        })}

        <Sheet open={isMoreOpen} onOpenChange={setIsMoreOpen}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              className="h-12 w-12 rounded-full flex items-center justify-center p-0 text-muted-foreground relative"
            >
              <MoreHorizontal className="h-6 w-6" />
              {showDotOnMore && (
                <span className="absolute top-2 right-2 h-2.5 w-2.5 rounded-full bg-red-500 border-2 border-background" />
              )}
              <span className="sr-only">More</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="rounded-t-3xl px-0 pb-10 h-[85vh] flex flex-col">
            <SheetHeader className="px-6 text-left shrink-0">
              <div className="flex items-center gap-2">
                {isSwitchingWorkspace && (
                  <Button variant="ghost" size="icon" className="-ml-2" onClick={() => setIsSwitchingWorkspace(false)}>
                    <ArrowLeft className="h-5 w-5" />
                  </Button>
                )}
                <SheetTitle className="text-2xl font-bold">
                  {isSwitchingWorkspace ? 'Switch Workspace' : 'More'}
                </SheetTitle>
              </div>
            </SheetHeader>
            
            <ScrollArea className="flex-1 mt-4">
              {!isSwitchingWorkspace ? (
                <div className="px-2 space-y-1">
                  {availableItems.map((item) => {
                    const hasUnread = item.key === 'inbox' && isInboxUnread;
                    return (
                      <button
                        key={item.key}
                        onClick={() => handleNavigate(item.key)}
                        className={cn(
                          "w-full flex items-center gap-4 p-4 rounded-2xl transition-colors text-left relative",
                          currentView === item.key ? "bg-primary/10" : "hover:bg-muted"
                        )}
                      >
                        <div className={cn(
                          "h-10 w-10 rounded-xl flex items-center justify-center shrink-0 relative",
                          currentView === item.key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                        )}>
                          {item.icon}
                          {hasUnread && (
                            <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-red-500 border-2 border-background" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={cn("font-semibold", currentView === item.key ? "text-primary" : "text-foreground")}>
                            {item.label}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">{item.desc}</p>
                        </div>
                        {currentView === item.key && <Check className="h-5 w-5 text-primary" />}
                      </button>
                    )
                  })}

                  <Separator className="my-4 mx-4" />

                  {/* Switch Workspace Trigger Item */}
                  <button
                    onClick={() => setIsSwitchingWorkspace(true)}
                    className="w-full flex items-center gap-4 p-4 rounded-2xl hover:bg-muted transition-colors text-left"
                  >
                    <div className="h-10 w-10 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center shrink-0">
                      <Building2 className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold">Switch Workspace</p>
                      <p className="text-xs text-muted-foreground truncate">
                        Currently: {activeSpace?.name} / {activeHub?.name}
                      </p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </button>
                </div>
              ) : (
                <div className="px-6 space-y-8 py-2">
                  <div className="space-y-3">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Select Space</Label>
                    <Select value={browsingSpaceId} onValueChange={setBrowsingSpaceId}>
                      <SelectTrigger className="w-full h-14 rounded-2xl text-lg">
                        <SelectValue placeholder="Select a space" />
                      </SelectTrigger>
                      <SelectContent className="rounded-2xl">
                        {allSpaces.filter(s => !s.isSystem).map((space) => (
                          <SelectItem key={space.id} value={space.id}>
                            <div className="flex items-center gap-3">
                              <Avatar className="h-8 w-8 rounded-lg">
                                <AvatarImage src={space.logoUrl} />
                                <AvatarFallback className="bg-primary text-primary-foreground font-bold">
                                  {getInitials(space.name)}
                                </AvatarFallback>
                              </Avatar>
                              <span className="font-medium">{space.name}</span>
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
                          className="w-full justify-between h-14 px-4 rounded-2xl text-lg"
                          onClick={() => handleHubSelect(hub.id)}
                        >
                          <span className="font-medium">{hub.name}</span>
                          {activeHub?.id === hub.id && browsingSpaceId === activeSpace?.id ? (
                            <Check className="h-5 w-5 text-primary" />
                          ) : (
                            <ChevronRight className="h-5 w-5 opacity-50" />
                          )}
                        </Button>
                      )) : (
                        <div className="text-center py-10 border-2 border-dashed rounded-3xl">
                          <p className="text-sm text-muted-foreground italic">No hubs found in this space.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </ScrollArea>
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}
