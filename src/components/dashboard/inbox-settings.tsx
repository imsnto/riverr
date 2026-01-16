
'use client';

import React, { useState } from 'react';
import { Bot, Edit, MoreHorizontal, Plus, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Bot as BotData, ChatContact, ChatMessage, Conversation, User } from '@/lib/data';
import BotSettingsDialog from './bot-settings-dialog';

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
      logoUrl: '',
    },
    promptButtons: [
        'Get a demo',
        'Talk to sales',
    ]
  },
];

interface InboxSettingsProps {
  onSendMessageFromBotPreview: (content: string) => void;
  chatMessages: ChatMessage[];
  chatContacts: ChatContact[];
  chatConversations: Conversation[];
  allUsers: User[];
  appUser: User | null;
}

export default function InboxSettings({ 
    onSendMessageFromBotPreview,
    chatMessages,
    chatContacts,
    chatConversations,
    allUsers,
    appUser 
}: InboxSettingsProps) {
  const [bots, setBots] = useState<BotData[]>(initialMockBots);
  const [selectedBot, setSelectedBot] = useState<BotData | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

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
