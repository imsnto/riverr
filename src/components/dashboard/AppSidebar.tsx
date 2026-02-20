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
  Workflow,
  Settings,
  Clock,
  LogOut,
  User as UserIcon,
  ChevronsUpDown,
  Check,
  MessageCircle as MessageCircleIcon,
  Ticket,
  DollarSign,
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { Space, Hub, User } from "@/lib/data";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '../ui/command';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "../ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { Label } from "../ui/label";
import { AppView } from "@/lib/routes";
import { getInitials } from "@/lib/utils";
import * as db from '@/lib/db';

interface SpaceSwitcherProps {
  spaces: Space[];
  selectedSpaceId: string | undefined;
  onSpaceChange: (spaceId: string) => void;
}

function SpaceSwitcher({ spaces, selectedSpaceId, onSpaceChange }: SpaceSwitcherProps) {
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
            <CommandGroup>
              {spaces.map((space) => (
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
  { key: "flows", icon: Workflow, label: 'Flows' },
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
}) => {
  const { appUser, signOut } = useAuth();
  const { isMobile, state, setOpen, openMobile, setOpenMobile } = useSidebar();
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
    await signOut();
    router.push('/login');
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
    
    return (
      <Button
        key={item.key}
        onClick={() => handleNavigation(item.key)}
        variant={variant}
        className={cn("h-12 w-full justify-start rounded-md px-4", !showLabels && "px-0 justify-center w-12 mx-auto")}
      >
        <Icon className="w-4 h-4" />
        {showLabels && <span className="ml-3">{item.label}</span>}
      </Button>
    );
  };
  
  return (
    <Sidebar collapsible="icon">
      <div className={cn("flex flex-col h-full", showLabels ? "p-2" : "p-1")}>
         <div className="flex justify-center p-2">
          <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-12 h-12 justify-center p-0 rounded-lg">
                  <Avatar className="h-full w-full rounded-lg">
                    <AvatarImage src={activeSpace?.logoUrl} className="object-cover" />
                    <AvatarFallback className="rounded-lg text-lg font-bold">
                      {activeSpace ? getInitials(activeSpace.name) : "W"}
                    </AvatarFallback>
                  </Avatar>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 ml-2" side="right" align="start">
              <div className="grid gap-4">
                <div className="space-y-1">
                  <h4 className="font-medium leading-none">Workspace</h4>
                  <p className="text-sm text-muted-foreground">
                    Switch between your spaces and hubs.
                  </p>
                </div>
                <Separator />
                <div className="space-y-4">
                  <div className="grid grid-cols-[auto_1fr] items-center gap-x-4">
                      <Label className="w-12">Space</Label>
                      <SpaceSwitcher 
                        spaces={allSpaces} 
                        selectedSpaceId={browsingSpaceId} 
                        onSpaceChange={setBrowsingSpaceId} 
                      />
                  </div>
                   <div className="grid grid-cols-[auto_1fr] items-center gap-x-4">
                      <Label className="w-12">Hub</Label>
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
         <Separator className={cn("my-2", !showLabels && "mx-auto w-12")} />
        <div className="flex flex-col flex-1 space-y-1 overflow-y-auto">
          {topItems.map(renderButton)}
          <div className={cn("px-3 py-2", !showLabels && "px-0")}>
            <Separator />
          </div>
          {middleItems.map(renderButton)}
        </div>
        <div className="flex flex-col mt-auto space-y-1">{bottomItems.map(renderButton)}</div>
        {appUser && (
            <>
              <Separator className={cn("my-2", !showLabels && "mx-auto w-12")} />
              
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className={cn("h-14 justify-start rounded-md px-4 w-full", !showLabels && "px-0 justify-center h-12 w-12 mx-auto")}>
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={appUser.avatarUrl} alt={appUser.name} />
                          <AvatarFallback>{getInitials(appUser.name)}</AvatarFallback>
                        </Avatar>
                        {showLabels && (
                          <div className="ml-3 text-left">
                            <p className="text-sm font-medium leading-none">{appUser.name}</p>
                            <p className="text-xs leading-none text-muted-foreground">{appUser.email}</p>
                          </div>
                        )}
                      </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56" align="end" forceMount>
                    <DropdownMenuItem onClick={() => router.push('/profile')}>
                      <UserIcon className="mr-2 h-4 w-4" />
                      <span>Profile</span>
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
