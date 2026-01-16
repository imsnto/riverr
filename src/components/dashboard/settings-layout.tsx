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
} from '@/lib/data';
import InboxSettings from './inbox-settings';

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
}

export default function SettingsLayout(props: SettingsLayoutProps) {
  const [activeView, setActiveView] = useState<SettingsView>('users');

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
            activeHub={props.activeHub}
            onUpdateHub={props.onUpdateActiveHub}
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

  return (
    <div>
      <h1 className="text-3xl font-bold mb-8">Settings</h1>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
        <aside className="md:col-span-1">
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
        <main className="md:col-span-3">{renderContent()}</main>
      </div>
    </div>
  );
}
