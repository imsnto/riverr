
// src/components/dashboard/AppSidebar.tsx
"use client";

import React, { useState, useEffect } from "react";
import { Sidebar, useSidebar } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import {
  BarChart,
  Users,
  FolderKanban,
  MessageCircle,
  BookOpen,
  Settings,
  Clock,
  LogOut,
  User as UserIcon,
  ChevronsUpDown,
  Check,
  Ticket,
  DollarSign,
  Grid2X2,
  Plus,
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { Space, Hub, User } from "@/lib/data";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from '../ui/command';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "../ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { Label } from "../ui/label";
import { AppView } from "@/lib/routes";
import { getInitials } from "@/lib/utils";
import * as db from '@/lib/db';
import { messaging } from "@/lib/firebase";
import { getToken } from "firebase/messaging";
import { arrayRemove, doc, updateDoc } from "firebase/firestore";
import { db as firestore } from "@/lib/firebase";

interface SpaceSwitcherProps {
  spaces: Space[];
  selectedSpaceId: string | undefined;
  onSpaceChange: (spaceId: string) => void;
  onNewSpace?: () => void;
}

function SpaceSwitcher({ spaces, selectedSpaceId, onSpaceChange, onNewSpace }: SpaceSwitcherProps) {
  const [open, setOpen] = React.useState(false);
  const selectedSpace = spaces.find(s => s.id === selectedSpaceId);

  return (
     <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          <span className="truncate">{selectedSpace ? selectedSpace.name : "Select a space"}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search space..." />
          <CommandList>
            <CommandEmpty>No space found.</CommandEmpty>
            <CommandGroup heading="Spaces">
              {spaces.filter(s => !s.isSystem).map((space) => (
                <CommandItem
                  key={space.id}
                  value={space.name}
                  onSelect={() => {
                    onSpaceChange(space.id)
                    setOpen(false)
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      selectedSpaceId === space.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {space.name}
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup>
              <CommandItem onSelect={() => { onNewSpace?.(); setOpen(false); }}>
                <Plus className="mr-2 h-4 w-4" />
                <span>Create New Space</span>
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

interface HubSwitcherProps {
  hubs: Hub[];
  activeHubId: string | undefined;
  onHubChange: (hubId: string) => void;
  disabled: boolean;
}

function HubSwitcher({ hubs, activeHubId, onHubChange, disabled }: HubSwitcherProps) {
  const [open, setOpen] = React.useState(false);
  const selectedHub = hubs.find(h => h.id === activeHubId);

  return (
     <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
          disabled={disabled}
        >
          <span className="truncate">{selectedHub ? selectedHub.name : "Select a hub"}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search hub..." />
          <CommandList>
            <CommandEmpty>No hub found.</CommandEmpty>
            <CommandGroup>
              {hubs.map((hub) => (
                <CommandItem
                  key={hub.id}
                  value={hub.name}
                  onSelect={() => {
                    onHubChange(hub.id)
                    setOpen(false)
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      activeHubId === hub.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {hub.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

interface AppSidebarProps {
  view: AppView;
  onChangeView: (view: AppView) => void;
  activeSpace: Space | null;
  allSpaces: Space[];
  activeHub: Hub | null;
  onHubChange: (hubId: string, spaceId: string) => void;
  unreadMessagesCount?: number;
  onNewSpace?: () => void;
}

const allTopItems: { key: AppView; icon: React.ElementType; label: string; fixed?: boolean }[] = [
  { key: "overview", icon: BarChart, label: 'Overview', fixed: true },
];

const allMiddleItems: {
  key: AppView;
  icon: React.ElementType;
  label: string;
  fixed?: boolean;
}[] = [
  { key: "tasks", icon: FolderKanban, label: 'Projects' },
  { key: "tickets", icon: Ticket, label: 'Tickets' },
  { key: "deals", icon: DollarSign, label: 'Deals' },
  { key: "inbox", icon: MessageCircle, label: 'Inbox' },
  { key: "contacts", icon: Users, label: 'Contacts' },
  { key: 'help-center', icon: BookOpen, label: 'Knowledge' },
];

const allBottomItems: {
  key: AppView;
  icon: React.ElementType;
  label: string;
  fixed?: boolean;
}[] = [
  { key: "team-timesheets", icon: Clock, label: 'Timesheets', fixed: true },
  { key: "settings", icon: Settings, label: 'Settings', fixed: true },
];

export const AppSidebar: React.FC<AppSidebarProps> = ({
  view,
  onChangeView,
  activeSpace,
  allSpaces,
  activeHub,
  onHubChange,
  unreadMessagesCount = 0,
  onNewSpace,
}) => {
  const { appUser, signOut } = useAuth();
  const { isMobile, state, openMobile, setOpenMobile } = useSidebar();
  const router = useRouter();

  // Local browsing state for the popover
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [browsingSpaceId, setBrowsingSpaceId] = useState<string | undefined>(activeSpace?.id);
  const [browsingHubs, setBrowsingHubs] = useState<Hub[]>([]);

  useEffect(() => {
    if (isPopoverOpen) {
      setBrowsingSpaceId(activeSpace?.id);
    }
  }, [isPopoverOpen, activeSpace]);

  useEffect(() => {
    if (browsingSpaceId) {
      db.getHubsForSpace(browsingSpaceId).then(setBrowsingHubs);
    } else {
      setBrowsingHubs([]);
    }
  }, [browsingSpaceId]);

  const handleLogout = async () => {
    try {
      // 1. Safely check for notification permissions before calling getToken
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted' && messaging) {
        try {
          const token = await getToken(messaging);
          const userId = appUser?.id;

          if (token && userId) {
            const userTokensRef = doc(firestore, "fcmTokens", userId);
            // Remove ONLY this token from the array
            await updateDoc(userTokensRef, {
              tokens: arrayRemove(token)
            });
          }
        } catch (tokenErr) {
          // Skip token cleanup if messaging fails, allowing the logout to continue
          console.warn("FCM token retrieval or update skipped during logout:", tokenErr);
        }
      }
    } catch (error) {
      console.error("General error during logout cleanup:", error);
    } finally {
      // 2. Perform standard sign out and redirect regardless of messaging status
      await signOut();
      window.location.replace('/login');
    }
  };

  const hubComponents = activeHub?.settings?.components || [];

  const topItems = allTopItems.filter(
    (item) => item.fixed || hubComponents.includes(item.key)
  );
  const middleItems = allMiddleItems.filter(
    (item) => item.fixed || hubComponents.includes(item.key)
  );
  const bottomItems = allBottomItems.filter(
    (item) => item.fixed || hubComponents.includes(item.key)
  );
  
  const showLabels = isMobile || state === 'expanded';

  const handleNavigation = (newView: AppView) => {
    onChangeView(newView);
    if (openMobile) {
      setOpenMobile(false);
    }
  };

  const renderButton = (item: {
    key: AppView;
    icon: React.ElementType;
    label: string;
    fixed?: boolean;
  }) => {
    const isActive = view === item.key;
    const variant = isActive ? "secondary" : "ghost";
    const Icon = item.icon;
    const hasUnread = item.key === 'inbox' && unreadMessagesCount > 0;
    
    return (
      <Button
        key={item.key}
        onClick={() => handleNavigation(item.key)}
        variant={variant}
        className={cn("h-10 w-full justify-start rounded-md px-3 relative", !showLabels && "px-0 justify-center w-10 mx-auto")}
      >
        <Icon className="w-4 h-4 shrink-0" />
        {showLabels && <span className="ml-2.5 truncate">{item.label}</span>}
        {hasUnread && (
          <span className={cn(
            "absolute flex h-2 w-2 rounded-full bg-red-500",
            showLabels ? "right-3 top-1/2 -translate-y-1/2" : "right-1 top-1"
          )} />
        )}
      </Button>
    );
  };
  
  return (
    <Sidebar collapsible="icon">
      <div className={cn("flex flex-col h-full", showLabels ? "p-2" : "p-1")}>
         <div className="p-1.5">
          <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
            <PopoverTrigger asChild>
              <Button 
                variant="outline" 
                className={cn(
                  "w-full justify-start gap-2 h-12 px-2 rounded-lg border-muted-foreground/20 hover:bg-accent transition-all",
                  !showLabels && "w-10 h-10 p-0 justify-center"
                )}
              >
                  <Avatar className="h-8 w-8 rounded-lg shrink-0 shadow-sm">
                    <AvatarImage src={activeSpace?.logoUrl} className="object-cover" />
                    <AvatarFallback className="rounded-lg text-xs font-bold bg-primary text-primary-foreground">
                      {activeSpace ? getInitials(activeSpace.name) : "W"}
                    </AvatarFallback>
                  </Avatar>
                  {showLabels && (
                    <div className="flex flex-col items-start min-w-0 flex-1 overflow-hidden">
                      <span className="text-xs font-bold truncate w-full text-left leading-none mb-1">{activeSpace?.name}</span>
                      <span className="text-[10px] text-muted-foreground truncate w-full text-left leading-none">{activeHub?.name || 'Select Hub'}</span>
                    </div>
                  )}
                  {showLabels && <ChevronsUpDown className="h-3 w-3 shrink-0 opacity-50" />}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 ml-2" side={isMobile ? "bottom" : "right"} align="start">
              <div className="grid gap-4">
                <div className="space-y-1">
                  <h4 className="font-medium leading-none">Switch Workspace</h4>
                  <p className="text-xs text-muted-foreground">
                    Select a space and hub to change your context.
                  </p>
                </div>
                <Separator />
                <div className="space-y-4">
                  <div className="grid grid-cols-[auto_1fr] items-center gap-x-4">
                      <Label className="w-12 text-xs">Space</Label>
                      <SpaceSwitcher 
                        spaces={allSpaces} 
                        selectedSpaceId={browsingSpaceId} 
                        onSpaceChange={setBrowsingSpaceId}
                        onNewSpace={() => {
                          onNewSpace?.();
                          setIsPopoverOpen(false);
                        }}
                      />
                  </div>
                   <div className="grid grid-cols-[auto_1fr] items-center gap-x-4">
                      <Label className="w-12 text-xs">Hub</Label>
                      <HubSwitcher 
                        hubs={browsingHubs} 
                        activeHubId={browsingSpaceId === activeSpace?.id ? activeHub?.id : undefined} 
                        onHubChange={(hubId) => {
                          if (browsingSpaceId) {
                            onHubChange(hubId, browsingSpaceId);
                            setIsPopoverOpen(false);
                          }
                        }} 
                        disabled={!browsingSpaceId}
                      />
                  </div>
                </div>
              </div>
            </PopoverContent>
          </Popover>
         </div>
         <Separator className={cn("my-2", !showLabels && "mx-auto w-10")} />
        <div className="flex flex-col flex-1 space-y-1 overflow-y-auto">
          {topItems.map(renderButton)}
          <div className={cn("px-2 py-2", !showLabels && "px-0")}>
            <Separator />
          </div>
          {middleItems.map(renderButton)}
          
          {showLabels && (
            <Button
              variant="ghost"
              size="sm"
              className="mt-2 justify-start px-3 text-muted-foreground hover:text-foreground text-xs"
              onClick={() => router.push(`/space/${activeSpace?.id}/hubs`)}
            >
              <Grid2X2 className="mr-2 h-3.5 w-3.5" />
              Manage Hubs
            </Button>
          )}
        </div>
        <div className="flex flex-col mt-auto space-y-1">{bottomItems.map(renderButton)}</div>
        {appUser && (
            <>
              <Separator className={cn("my-2", !showLabels && "mx-auto w-10")} />
              
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className={cn("h-12 justify-start rounded-md px-2 w-full", !showLabels && "px-0 justify-center h-10 w-10 mx-auto")}>
                        <Avatar className="h-8 w-8 shrink-0">
                          <AvatarImage src={appUser.avatarUrl} alt={appUser.name} />
                          <AvatarFallback>{getInitials(appUser.name)}</AvatarFallback>
                        </Avatar>
                        {showLabels && (
                          <div className="ml-2.5 text-left min-w-0">
                            <p className="text-sm font-medium leading-none truncate">{appUser.name}</p>
                            <p className="text-[10px] leading-none text-muted-foreground truncate mt-1">{appUser.email}</p>
                          </div>
                        )}
                      </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56" align="end" forceMount>
                    <DropdownMenuItem onClick={() => {
                        handleNavigation('settings');
                        router.push('/settings?view=profile');
                    }}>
                      <UserIcon className="mr-2 h-4 w-4" />
                      <span>My Profile</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleLogout}>
                      <LogOut className="mr-2 h-4 w-4" />
                      <span>Log out</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
            </>
        )}
      </div>
    </Sidebar>
  );
};

export default AppSidebar;
