// components/dashboard/top-bar.tsx
"use client"

import { cn } from "@/lib/utils"
import { SidebarTrigger, useSidebar } from "@/components/ui/sidebar" 
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Space, User } from '@/lib/data';
import { LifeBuoy, LogOut, User as UserIcon, ChevronsUpDown, Check } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '../ui/command';
import React from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';

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
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-[200px] justify-between"
          disabled={!activeSpace}
        >
          {activeSpace ? activeSpace.name : "Select a space"}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0">
        <Command>
          <CommandInput placeholder="Search space..." />
          <CommandList>
            <CommandEmpty>No space found.</CommandEmpty>
            <CommandGroup>
              {spaces.map((space) => (
                <CommandItem
                  key={space.id}
                  value={space.id}
                  onSelect={(currentValue) => {
                    onSpaceChange(currentValue)
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

const getInitials = (name: string) => {
    if (!name) return '';
    return name.split(' ').map(n => n[0]).join('');
}


export function TopBar({ className, activeSpace, onSpaceChange, allSpaces }: { className?: string; activeSpace: Space | null, onSpaceChange: (spaceId: string) => void; allSpaces: Space[] }) {
  const { toggleSidebar } = useSidebar()
  const router = useRouter();
  const { signOut, appUser } = useAuth();

  if (!appUser) return null;

  const handleLogout = async () => {
    await signOut();
    router.push('/login');
  };

  return (
    <header
      className={cn(
        "fixed top-0 z-20 flex h-16 items-center justify-between border-b bg-background px-4 shadow-sm w-full",
        className
      )}
    >
      <div className="flex items-center gap-2">
        <SidebarTrigger onClick={toggleSidebar} />
        {activeSpace && <SpaceSwitcher spaces={allSpaces} activeSpace={activeSpace} onSpaceChange={onSpaceChange} />}
      </div>
      <div className="flex items-center gap-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-10 w-10 rounded-full">
              <Avatar className="h-10 w-10">
                <AvatarImage src={appUser.avatarUrl} alt={appUser.name} />
                <AvatarFallback>{getInitials(appUser.name)}</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end" forceMount>
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">{appUser.name}</p>
                <p className="text-xs leading-none text-muted-foreground">{appUser.email}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
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
      </div>
    </header>
  )
}
