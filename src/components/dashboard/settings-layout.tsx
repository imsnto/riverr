
// src/components/dashboard/settings-layout.tsx
'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import UserSettings from './user-settings';
import SpaceSettings from './space-settings';
import HubSettings from './hub-settings';
import TeamTimesheets from './team-timesheets';
import {
  User,
  Space,
  Invite,
  Project,
  Task,
  TimeEntry,
  Hub,
  ChatContact,
  Conversation,
  ChatMessage,
  Bot,
} from '@/lib/data';
import InboxSettings from './inbox-settings';
import { useIsMobile } from '@/hooks/use-mobile';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

type SettingsView = 'users' | 'spaces' | 'hub' | 'inbox' | 'timesheets';

interface SettingsLayoutProps {
  allUsers: User[];
  allSpaces: Space[];
  onSave: (space: Omit<Space, 'id'>, spaceId?: string) => void;
  onDelete: (spaceId: string) => void;
  appUser: User | null;
  onInvite: () => void;
  handleInvite: (values: Omit<Invite, 'id' | 'token' | 'status'>) => void;
  projects: Project[];
  tasks: Task[];
  timeEntries: TimeEntry[];
  activeHub: Hub | null;
  onUpdateActiveHub: (updatedHub: Partial<Hub>) => void;
  onSendMessageFromBotPreview: (content: string) => void;
  chatMessages: ChatMessage[];
  chatContacts: ChatContact[];
  chatConversations: Conversation[];
  bots: Bot[];
  onBotUpdate: (botId: string, data: Partial<Bot>) => void;
  onBotAdd: (bot: Omit<Bot, 'id'>) => void;
}

export default function SettingsLayout(props: SettingsLayoutProps) {
  const [activeView, setActiveView] = useState<SettingsView>('users');
  const isMobile = useIsMobile();

  const hubHasInbox = props.activeHub?.settings?.components?.includes('inbox');

  const navItems = [
    { key: 'users', label: 'Users & Permissions' },
    { key: 'spaces', label: 'Spaces' },
    { key: 'hub', label: 'Hub Settings', disabled: !props.activeHub },
    { key: 'inbox', label: 'Inbox', disabled: !hubHasInbox },
    { key: 'timesheets', label: 'Timesheets' },
  ];

  const renderContent = () => {
    switch (activeView) {
      case 'users':
        return (
          <UserSettings
            allUsers={props.allUsers}
            allSpaces={props.allSpaces}
            appUser={props.appUser}
            handleInvite={props.handleInvite}
            onInvite={() => {}}
          />
        );
      case 'spaces':
        return (
          <SpaceSettings
            allUsers={props.allUsers}
            onSave={props.onSave}
            onDelete={props.onDelete}
            appUser={props.appUser}
          />
        );
      case 'hub':
        return (
          <HubSettings
            activeHub={props.activeHub}
            onUpdateHub={props.onUpdateActiveHub}
            allUsers={props.allUsers}
          />
        );
       case 'inbox':
        return <InboxSettings 
            onSendMessageFromBotPreview={props.onSendMessageFromBotPreview}
            chatMessages={props.chatMessages}
            chatContacts={props.chatContacts}
            chatConversations={props.chatConversations}
            allUsers={props.allUsers}
            appUser={props.appUser}
            bots={props.bots}
            onBotUpdate={props.onBotUpdate}
            onBotAdd={props.onBotAdd}
         />;
      case 'timesheets':
        return (
          <TeamTimesheets
            allSpaces={props.allSpaces}
            allUsers={props.allUsers}
            projects={props.projects}
            tasks={props.tasks}
            timeEntries={props.timeEntries}
            appUser={props.appUser!}
          />
        );
      default:
        return null;
    }
  };

  if (isMobile) {
    return (
        <div className="flex flex-col h-full">
            <div className="p-4 border-b">
                <Select value={activeView} onValueChange={(v) => setActiveView(v as SettingsView)}>
                    <SelectTrigger>
                        <SelectValue placeholder="Select a setting" />
                    </SelectTrigger>
                    <SelectContent>
                        {navItems.map((item) => (
                            <SelectItem key={item.key} value={item.key} disabled={item.disabled}>
                                {item.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <main className="flex-1 p-4 overflow-y-auto">
                {renderContent()}
            </main>
        </div>
    )
  }

  return (
    <div className="flex flex-row h-full">
      <aside className="w-80 border-r bg-card p-4">
        <h2 className="text-xl font-bold mb-4">Settings</h2>
        <nav className="flex flex-col space-y-2">
          {navItems.map((item) => (
            <Button
              key={item.key}
              variant={activeView === item.key ? 'secondary' : 'ghost'}
              onClick={() => setActiveView(item.key as SettingsView)}
              className="justify-start"
              disabled={item.disabled}
            >
              {item.label}
            </Button>
          ))}
        </nav>
      </aside>
      <main className="flex-1 p-8 overflow-y-auto">
        {renderContent()}
      </main>
    </div>
  );
}
