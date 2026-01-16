
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
import * as db from '@/lib/db';


interface InboxSettingsProps {
  onSendMessageFromBotPreview: (content: string) => void;
  chatMessages: ChatMessage[];
  chatContacts: ChatContact[];
  chatConversations: Conversation[];
  allUsers: User[];
  appUser: User | null;
  bots: BotData[];
  onBotUpdate: (botId: string, data: Partial<BotData>) => void;
  onBotAdd: (bot: Omit<BotData, 'id'>) => void;
}

export default function InboxSettings({ 
    onSendMessageFromBotPreview,
    chatMessages,
    chatContacts,
    chatConversations,
    allUsers,
    appUser,
    bots,
    onBotUpdate,
    onBotAdd,
}: InboxSettingsProps) {
  const [selectedBot, setSelectedBot] = useState<BotData | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { activeHub } = useAuth();

  const handleEditBot = (bot: BotData) => {
    setSelectedBot(bot);
    setIsDialogOpen(true);
  };
  
  const handleNewBot = () => {
    setSelectedBot(null);
    setIsDialogOpen(true);
  };

  const handleSaveBot = (botData: BotData | Omit<BotData, 'id' | 'hubId'>) => {
    if ('id' in botData && botData.id) {
        onBotUpdate(botData.id, botData);
    } else if (activeHub) {
        const botWithHubId = { ...botData, hubId: activeHub.id };
        onBotAdd(botWithHubId as Omit<BotData, 'id'>);
    }
  };

  const previewContact = chatContacts.find(c => c.id === 'preview-contact-1');
  const previewConversation = chatConversations.find(c => c.contactId === previewContact?.id);
  const previewMessages = previewConversation ? chatMessages.filter(m => m.conversationId === previewConversation.id) : [];


  return (
    <>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>Chat Bots</CardTitle>
                <CardDescription>
                  Manage your customer-facing chat bots for this hub.
                </CardDescription>
              </div>
              <Button onClick={handleNewBot}>
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
                  <Button className="mt-4" onClick={handleNewBot}>
                    <Plus className="mr-2 h-4 w-4" />
                    Create Bot
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
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
    </>
  );
}
