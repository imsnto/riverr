'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Bot, Edit, MoreHorizontal, Plus, Trash2, ChevronsUpDown, Check } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Bot as BotData, ChatContact, ChatMessage, Conversation, Hub, User } from '@/lib/data';
import BotSettingsDialog from './bot-settings-dialog';
import { Label } from '../ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '../ui/command';
import { Badge } from '../ui/badge';
import { cn } from '@/lib/utils';


const initialMockBots: BotData[] = [
  {
    id: 'bot-1',
    hubId: 'hub-1',
    name: 'Fin',
    welcomeMessage: 'Hi there, welcome to Intercom 👋\nWhat would you like help with?',
    layout: 'default',
    spaces: {
        home: false,
        messages: true,
        tickets: true,
    },
    styleSettings: {
      primaryColor: '#3b82f6',
      backgroundColor: '#111827',
      logoUrl: '',
    },
    promptButtons: [
        'Choosing a pricing plan',
        'Learn more about Intercom',
        'Start a free 14-day trial',
    ]
  },
  {
    id: 'bot-2',
    hubId: 'hub-1',
    name: 'Sales Inquiries',
    welcomeMessage: 'Hello! How can I help you with sales today?',
    layout: 'default',
    spaces: {
        home: false,
        messages: true,
        tickets: false,
    },
    styleSettings: {
      primaryColor: '#10b981',
      backgroundColor: '#111827',
      logoUrl: '',
    },
    promptButtons: [
        'Get a demo',
        'Talk to sales',
    ]
  },
];

// MemberSelect component copied and adapted
function MemberSelect({ allUsers, selectedUsers, onChange }: { allUsers: User[], selectedUsers: string[], onChange: (users: string[]) => void }) {
    const [open, setOpen] = React.useState(false);
  
    const handleSelect = (userId: string) => {
        const newSelected = selectedUsers.includes(userId)
            ? selectedUsers.filter(id => id !== userId)
            : [...selectedUsers, userId];
        onChange(newSelected);
    };

    return (
      <div>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className="w-full justify-between h-auto min-h-10"
            >
             <div className="flex flex-wrap gap-1">
                 {selectedUsers.length > 0 ? selectedUsers.map(id => {
                     const user = allUsers.find(u => u.id === id);
                     return <Badge variant="secondary" key={id}>{user?.name || 'Unknown'}</Badge>;
                 }) : "Select agents..."}
             </div>
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
            <Command>
              <CommandInput placeholder="Search users..." />
              <CommandList>
                <CommandEmpty>No users found.</CommandEmpty>
                <CommandGroup>
                  {allUsers.map((user) => (
                    <CommandItem
                      key={user.id}
                      value={user.name}
                      onSelect={() => handleSelect(user.id)}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          selectedUsers.includes(user.id) ? "opacity-100" : "opacity-0"
                        )}
                      />
                      {user.name}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>
    );
}

interface InboxSettingsProps {
  onSendMessageFromBotPreview: (content: string) => void;
  chatMessages: ChatMessage[];
  chatContacts: ChatContact[];
  chatConversations: Conversation[];
  allUsers: User[];
  appUser: User | null;
  activeHub: Hub | null;
  onUpdateHub: (updatedData: Partial<Hub>) => void;
}

export default function InboxSettings({ 
    onSendMessageFromBotPreview,
    chatMessages,
    chatContacts,
    chatConversations,
    allUsers,
    appUser,
    activeHub,
    onUpdateHub,
}: InboxSettingsProps) {
  const [bots, setBots] = useState<BotData[]>(initialMockBots);
  const [selectedBot, setSelectedBot] = useState<BotData | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const { activeSpace } = useAuth();

  const spaceUsers = useMemo(() => {
      if (!activeSpace) return [];
      return allUsers.filter(u => activeSpace.members[u.id]);
  }, [activeSpace, allUsers]);

  const [liveAgentIds, setLiveAgentIds] = useState<string[]>(activeHub?.settings?.liveAgentIds || []);

  useEffect(() => {
      if (activeHub) {
          setLiveAgentIds(activeHub.settings?.liveAgentIds || []);
      }
  }, [activeHub]);

  const handleSaveAgents = () => {
      if (!activeHub) return;
      onUpdateHub({
          settings: {
              ...activeHub.settings,
              liveAgentIds: liveAgentIds
          }
      });
  };

  const hasAgentChanges = activeHub ? JSON.stringify(liveAgentIds.sort()) !== JSON.stringify((activeHub.settings?.liveAgentIds || []).sort()) : false;

  const handleEditBot = (bot: BotData) => {
    setSelectedBot(bot);
    setIsDialogOpen(true);
  };
  
  const handleSaveBot = (updatedBot: BotData) => {
    setBots(bots.map(b => b.id === updatedBot.id ? updatedBot : b));
  };

  const previewContact = chatContacts.find(c => c.id === 'preview-contact-1');
  const previewConversation = chatConversations.find(c => c.contactId === previewContact?.id);
  const previewMessages = previewConversation ? chatMessages.filter(m => m.conversationId === previewConversation.id) : [];


  return (
    <>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Live Agent Assignment</CardTitle>
            <CardDescription>
              Choose which users will be assigned to new conversations that come into the inbox.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Label>Agents</Label>
            <MemberSelect 
                allUsers={spaceUsers}
                selectedUsers={liveAgentIds}
                onChange={setLiveAgentIds}
            />
          </CardContent>
          <CardFooter>
            <Button onClick={handleSaveAgents} disabled={!hasAgentChanges}>Save Agents</Button>
          </CardFooter>
        </Card>
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>Chat Bots</CardTitle>
                <CardDescription>
                  Manage your customer-facing chat bots for this hub.
                </CardDescription>
              </div>
              <Button disabled>
                <Plus className="mr-2 h-4 w-4" />
                New Bot
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {bots.map((bot) => (
                <div
                  key={bot.id}
                  className="border p-4 rounded-lg flex justify-between items-center"
                >
                  <div className="flex items-center gap-4">
                    <div
                      className="p-3 rounded-full"
                      style={{ backgroundColor: `${bot.styleSettings?.primaryColor}1A` }} // Add alpha for background
                    >
                      <Bot
                        className="h-6 w-6"
                        style={{ color: bot.styleSettings?.primaryColor }}
                      />
                    </div>
                    <div>
                      <h3 className="font-semibold">{bot.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {bot.welcomeMessage
                          ? `Welcome: "${bot.welcomeMessage.substring(0, 40)}..."`
                          : 'No welcome message set.'}
                      </p>
                    </div>
                  </div>
                  <div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEditBot(bot)}>
                          <Edit className="mr-2 h-4 w-4" />
                          Edit Bot & Install
                        </DropdownMenuItem>
                        <DropdownMenuItem disabled className="text-destructive">
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
              {bots.length === 0 && (
                <div className="text-center py-12 border-2 border-dashed rounded-lg">
                  <Bot className="mx-auto h-12 w-12 text-muted-foreground" />
                  <h3 className="mt-2 text-sm font-semibold text-foreground">
                    No Chat Bots
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Get started by creating a new chat bot.
                  </p>
                  <Button className="mt-4" disabled>
                    <Plus className="mr-2 h-4 w-4" />
                    Create Bot
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
      {selectedBot && (
        <BotSettingsDialog
            isOpen={isDialogOpen}
            onOpenChange={setIsDialogOpen}
            bot={selectedBot}
            onSave={handleSaveBot}
            onSendMessage={onSendMessageFromBotPreview}
            messages={previewMessages}
            contact={previewContact || null}
            appUser={appUser}
            allUsers={allUsers}
        />
      )}
    </>
  );
}
