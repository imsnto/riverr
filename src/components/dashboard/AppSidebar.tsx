// src/components/dashboard/AppSidebar.tsx
"use client";

import React from "react";
import { Sidebar, SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
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
  PanelLeft,
  MessageCircle,
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

export type AppView =
  | "overview"
  | "tasks"
  | "mytasks"
  | "mentions"
  | "messages"
  | "documents"
  | "flows"
  | "settings"
  | "team-timesheets"
  | "user-settings"
  | "space-settings"
  | "inbox";

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
  projects: Project[];
  selectedProjectId: string | null;
  onSelectProject: (projectId: string) => void;
  onNewProject: () => void;
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
  { key: "mytasks", icon: <ClipboardCheck className="w-5 h-5" />, label: 'My Tasks', fixed: true },
  { key: "mentions", icon: <AtSign className="w-5 h-5" />, label: 'Mentions', fixed: true },
];

const allMiddleItems: {
  key: AppView;
  icon: React.ReactNode;
  label: string;
  fixed?: boolean;
}[] = [
  // Tasks are now handled separately
  { key: "inbox", icon: <MessageCircle className="w-5 h-5" />, label: 'Inbox' },
  { key: "messages", icon: <MessageSquare className="w-5 h-5" />, label: 'Messages' },
  { key: "documents", icon: <BookOpen className="w-5 h-5" />, label: 'Documents' },
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
  projects,
  selectedProjectId,
  onSelectProject,
  onNewProject,
  activeSpace,
  allSpaces,
  onSpaceChange,
  allHubs,
  activeHub,
  onHubChange,
}) => {
  const { appUser, signOut } = useAuth();
  const { isMobile, state, toggleSidebar, open } = useSidebar();
  const router = useRouter();

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

  const renderButton = (item: {
    key: AppView;
    icon: React.ReactNode;
    label: string;
    fixed?: boolean;
  }) => {
    const isActive = view === item.key;
    const variant = isActive ? "secondary" : "ghost";
    const handleClick = () => {
      onChangeView(item.key);
      if (isMobile) {
        toggleSidebar();
      }
    };
    return (
      <Button
        key={item.key}
        onClick={handleClick}
        variant={variant}
        className={cn("h-12 w-full justify-start rounded-md px-4", !showLabels && "px-0 justify-center w-12 mx-auto")}
      >
        {item.icon}
        {showLabels && <span className="ml-3">{item.label}</span>}
      </Button>
    );
  };
  
  const showTasks = hubComponents.includes('tasks');

  return (
    <Sidebar collapsible="icon">
      <div className="flex flex-col h-full p-2">
         {showLabels && activeSpace && activeHub && (
           <div className="p-2 space-y-2">
             <SpaceSwitcher spaces={allSpaces} activeSpace={activeSpace} onSpaceChange={onSpaceChange} />
             <HubSwitcher hubs={allHubs} activeHub={activeHub} onHubChange={onHubChange} />
             <Separator />
           </div>
         )}
        <div className="flex flex-col flex-1 space-y-1 overflow-y-auto">
          {topItems.map(renderButton)}
          <div className={cn("px-3 py-2", !showLabels && "px-0")}>
            <Separator />
          </div>
          {showTasks && (
            <Collapsible defaultOpen={true}>
              <CollapsibleTrigger asChild>
                 <Button
                    variant={view === 'tasks' ? 'secondary' : 'ghost'}
                    className={cn("h-12 w-full justify-between rounded-md px-4 group", !showLabels && "px-0 justify-center w-12 mx-auto")}
                  >
                    <div className="flex items-center">
                      <FolderKanban className="w-5 h-5" />
                      {showLabels && <span className="ml-3">Tasks</span>}
                    </div>
                    {showLabels && <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]:rotate-180" />}
                  </Button>
              </CollapsibleTrigger>
               <CollapsibleContent className="space-y-1 py-1">
                {showLabels && (
                  <div className="pl-8 pr-2 space-y-1">
                    {projects.map(project => (
                        <Button
                          key={project.id}
                          variant={selectedProjectId === project.id ? 'secondary' : 'ghost'}
                          onClick={() => {
                            onSelectProject(project.id);
                            onChangeView('tasks');
                          }}
                          className="w-full justify-start h-8 text-sm"
                        >
                          {project.name}
                        </Button>
                    ))}
                     <Button
                        variant="ghost"
                        onClick={onNewProject}
                        className="w-full justify-start h-8 text-sm text-muted-foreground"
                      >
                        <Plus className="mr-2 h-4 w-4" /> New Project
                      </Button>
                  </div>
                )}
               </CollapsibleContent>
            </Collapsible>
          )}
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
                
                {!isMobile && (
                  <div className="flex justify-center">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-14 w-14"
                      onClick={toggleSidebar}
                    >
                      <PanelLeft className={cn("transition-transform", !open && "rotate-180")} />
                    </Button>
                  </div>
                )}
            </>
        )}
      </div>
    </Sidebar>
  );
};

export default AppSidebar;
