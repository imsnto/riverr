
'use client';

import React, { useState } from 'react';
import { Channel, Space, User } from '@/lib/data';
import { Button } from '../ui/button';
import { Plus, Hash, MoreHorizontal, Edit, Trash2 } from 'lucide-react';
import { ScrollArea } from '../ui/scroll-area';
import { cn } from '@/lib/utils';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu';
import CreateChannelDialog from './create-channel-dialog';
import { useAuth } from '@/hooks/use-auth';

interface ChannelListProps {
  channels: Channel[];
  activeChannelId: string | null;
  onChannelSelect: (id: string) => void;
  onSaveChannel: (channelData: Omit<Channel, 'id'>, channelId?: string) => void;
  activeSpace: Space;
  appUser: User;
}

export default function ChannelList({ channels, activeChannelId, onChannelSelect, onSaveChannel, activeSpace, appUser }: ChannelListProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingChannel, setEditingChannel] = useState<Channel | null>(null);

  const handleNewChannel = () => {
    setEditingChannel(null);
    setIsDialogOpen(true);
  }

  const handleEditChannel = (channel: Channel) => {
    setEditingChannel(channel);
    setIsDialogOpen(true);
  }
  
  const spaceMembers = activeSpace ? Object.keys(activeSpace.members).map(id => {
      // This is a placeholder, you should fetch full user objects
      return { id, name: `User ${id.substring(0,4)}`, email: '', avatarUrl: '', role: 'Member' as const }
  }) : [];


  return (
    <>
      <div className="flex flex-col h-full p-2">
        <div className="flex justify-between items-center p-2 mb-2">
          <h2 className="text-lg font-semibold">Channels</h2>
          <Button variant="ghost" size="icon" onClick={handleNewChannel} className="h-7 w-7">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <ScrollArea className="flex-1">
          <div className="space-y-1 px-2">
            {channels.map(channel => (
              <div 
                key={channel.id} 
                className={cn(
                    "group flex items-center justify-between p-2 rounded-md cursor-pointer",
                    activeChannelId === channel.id ? 'bg-primary/10 text-primary font-semibold' : 'hover:bg-accent/50'
                )}
                onClick={() => onChannelSelect(channel.id)}
              >
                  <div className="flex items-center gap-2 truncate">
                      <Hash className="h-4 w-4" />
                      <span className="truncate">{channel.name}</span>
                  </div>
                   <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                           <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100">
                              <MoreHorizontal className="h-4 w-4" />
                           </Button>
                      </DropdownMenuTrigger>
                       <DropdownMenuContent>
                           <DropdownMenuItem onClick={() => handleEditChannel(channel)}>
                                <Edit className="mr-2 h-4 w-4" />
                                Edit Channel
                           </DropdownMenuItem>
                            <DropdownMenuItem disabled className="text-destructive">
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete Channel
                           </DropdownMenuItem>
                       </DropdownMenuContent>
                   </DropdownMenu>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>
      <CreateChannelDialog 
        isOpen={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        spaceId={activeSpace.id}
        spaceMembers={spaceMembers}
        onSave={onSaveChannel}
        editingChannel={editingChannel}
      />
    </>
  );
}
