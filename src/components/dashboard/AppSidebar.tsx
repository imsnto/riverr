
// src/components/dashboard/AppSidebar.tsx
"use client";

import React from "react";
import { Sidebar, useSidebar } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import {
  BarChart,
  ClipboardCheck,
  AtSign,
  FolderKanban,
  MessageSquare,
  BookOpen,
  Workflow,
  Settings,
  Clock,
  ChevronDown,
  Plus,
  LifeBuoy,
  LogOut,
  User as UserIcon,
  ChevronsUpDown,
  Check,
  MessageCircle,
  Building2,
  Ticket,
  DollarSign,
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { Project, Space, Hub, User } from "@/lib/data";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../ui/collapsible";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '../ui/command';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "../ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { Label } from "../ui/label";
import { AppView } from "@/lib/routes";
import Image from 'next/image';

interface SpaceSwitcherProps {
  spaces: Space[];
  activeSpace: Space;
  onSpaceChange: (spaceId: string) => void;
}

function SpaceSwitcher({ spaces, activeSpace, onSpaceChange }: SpaceSwitcherProps) {
  const [open, setOpen] = React.useState(false)

  return (
     <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
          disabled={!activeSpace}
        >
          <span className="truncate">{activeSpace ? activeSpace.name : "Select a space"}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
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
                      activeSpace?.id === space.id ? "opacity-100" : "opacity-0"
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
  activeHub: Hub | null;
  onHubChange: (hubId: string) => void;
}

function HubSwitcher({ hubs, activeHub, onHubChange }: HubSwitcherProps) {
  const [open, setOpen] = React.useState(false)

  return (
     <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
          disabled={!activeHub}
        >
          <span className="truncate">{activeHub ? activeHub.name : "Select a hub"}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
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
                      activeHub?.id === hub.id ? "opacity-100" : "opacity-0"
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

const getInitials = (name: string) => {
    if (!name) return '';
    return name.split(' ').map(n => n[0]).join('');
}


interface AppSidebarProps {
  view: AppView;
  onChangeView: (view: AppView) => void;
  className?: string;
  activeSpace: Space | null, 
  onSpaceChange: (spaceId: string) => void; 
  allSpaces: Space[],
  allHubs: Hub[],
  activeHub: Hub | null,
  onHubChange: (hubId: string) => void;
}

const allTopItems: { key: AppView; icon: React.ReactNode; label: string; fixed?: boolean }[] = [
  { key: "overview", icon: <BarChart className="w-5 h-5" />, label: 'Overview', fixed: true },
];

const allMiddleItems: {
  key: AppView;
  icon: React.ReactNode;
  label: string;
  fixed?: boolean;
}[] = [
  { key: "tasks", icon: <FolderKanban className="w-5 h-5" />, label: 'Projects' },
  { key: "tickets", icon: <Ticket className="w-5 h-5" />, label: 'Tickets' },
  { key: "deals", icon: <DollarSign className="w-5 h-5" />, label: 'Deals' },
  { key: "inbox", icon: <MessageCircle className="w-5 h-5" />, label: 'Inbox' },
  { key: "contacts", icon: <AtSign className="w-5 h-5" />, label: 'Contacts' },
  { key: 'help-center', icon: <BookOpen className="w-5 h-5" />, label: 'Knowledge' },
  { key: "flows", icon: <Workflow className="w-5 h-5" />, label: 'Flows' },
];

const allBottomItems: {
  key: AppView;
  icon: React.ReactNode;
  label: string;
  fixed?: boolean;
}[] = [
  { key: "team-timesheets", icon: <Clock className="w-5 h-5" />, label: 'Timesheets', fixed: true },
  { key: "settings", icon: <Settings className="w-5 h-5" />, label: 'Settings', fixed: true },
];

export const AppSidebar: React.FC<AppSidebarProps> = ({
  view,
  onChangeView,
  activeSpace,
  allSpaces,
  onSpaceChange,
  allHubs,
  activeHub,
  onHubChange,
}) => {
  const { appUser, signOut } = useAuth();
  const { isMobile, state, setOpen, openMobile, setOpenMobile } = useSidebar();
  const router = useRouter();

  React.useEffect(() => {
    if (!isMobile) {
      setOpen(false);
    }
  }, [isMobile, setOpen]);

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
    icon: React.ReactNode;
    label: string;
    fixed?: boolean;
  }) => {
    const isActive = view === item.key;
    const variant = isActive ? "secondary" : "ghost";
    
    return (
      <Button
        key={item.key}
        onClick={() => handleNavigation(item.key)}
        variant={variant}
        className={cn("h-12 w-full justify-start rounded-md px-4", !showLabels && "px-0 justify-center w-12 mx-auto")}
      >
        {item.icon}
        {showLabels && <span className="ml-3">{item.label}</span>}
      </Button>
    );
  };
  
  return (
    <Sidebar collapsible="icon">
      <div className="flex flex-col h-full p-2">
         {activeSpace && activeHub && (
           <div className="p-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-center h-12">
                  <Image
                    src="/manowar-icon.png"
                    alt="Manowar Icon"
                    width={24}
                    height={24}
                    className="rounded-sm"
                    data-ai-hint="logo icon"
                  />
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
                        <Label>Space</Label>
                        <SpaceSwitcher spaces={allSpaces} activeSpace={activeSpace} onSpaceChange={onSpaceChange} />
                    </div>
                     <div className="grid grid-cols-[auto_1fr] items-center gap-x-4">
                        <Label>Hub</Label>
                        <HubSwitcher hubs={allHubs} activeHub={activeHub} onHubChange={onHubChange} />
                    </div>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
           </div>
         )}
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
                    <Button variant="ghost" className={cn("h-14 justify-start rounded-md px-4 w-full", !showLabels && "px-0 justify-center w-14 mx-auto")}>
                        <Avatar className="h-9 w-9">
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
                    <DropdownMenuItem>
                      <LifeBuoy className="mr-2 h-4 w-4" />
                      <span>Support</span>
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
