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
  Visitor,
  Conversation,
  ChatMessage,
  Bot,
  DealAutomationRule,
  EscalationIntakeRule,
} from '@/lib/data';
import InboxSettings from './inbox-settings';
import { useIsMobile } from '@/hooks/use-mobile';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import DealAutomationSettings from './deal-automation-settings';
import EscalationIntakeSettings from './escalation-intake-settings';
import { LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import KnowledgeBaseSettings from './knowledge-base-settings';

type SettingsView = 'users' | 'spaces' | 'hub' | 'inbox' | 'timesheets' | 'deal-automation' | 'escalation-intake' | 'knowledge-base';

interface SettingsLayoutProps {
  allUsers: User[];
  allSpaces: Space[];
  allHubs: Hub[];
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
  visitors: Visitor[];
  chatConversations: Conversation[];
  bots: Bot[];
  onBotUpdate: (botId: string, data: Partial<Bot>) => void;
  onBotAdd: (bot: Omit<Bot, 'id'>) => void;
  escalationRules: EscalationIntakeRule[];
}

export default function SettingsLayout(props: SettingsLayoutProps) {
  const [activeView, setActiveView] = useState<SettingsView>('users');
  const isMobile = useIsMobile();
  const { signOut } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    await signOut();
    router.push('/login');
  };

  const hubHasInbox = props.activeHub?.settings?.components?.includes('inbox');
  const hubHasDeals = props.activeHub?.settings?.components?.includes('deals');
  const hubHasHelpCenter = props.activeHub?.settings?.components?.includes('help-center');

  const navItems = [
    { key: 'users', label: 'Users & Permissions' },
    { key: 'spaces', label: 'Spaces' },
    { key: 'hub', label: 'Hub Settings', disabled: !props.activeHub },
    { key: 'inbox', label: 'Inbox', disabled: !hubHasInbox },
    { key: 'deal-automation', label: 'Deal Automation', disabled: !hubHasDeals },
    { key: 'escalation-intake', label: 'Escalation Intake', disabled: !props.activeHub },
    { key: 'knowledge-base', label: 'Knowledge Base', disabled: !hubHasHelpCenter },
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
            allHubs={props.allHubs}
            projects={props.projects}
            escalationRules={props.escalationRules}
          />
        );
       case 'inbox':
        return <InboxSettings 
            onSendMessageFromBotPreview={props.onSendMessageFromBotPreview}
            chatMessages={props.chatMessages}
            visitors={props.visitors}
            chatConversations={props.chatConversations}
            allUsers={props.allUsers}
            appUser={props.appUser}
            bots={props.bots}
            onBotUpdate={props.onBotUpdate}
            onBotAdd={props.onBotAdd}
         />;
      case 'deal-automation':
        return <DealAutomationSettings 
          activeHub={props.activeHub} 
          allUsers={props.allUsers}
          allHubs={props.allHubs}
          projects={props.projects}
        />;
      case 'escalation-intake':
        return <EscalationIntakeSettings
          activeHub={props.activeHub}
          allUsers={props.allUsers}
          allHubs={props.allHubs}
          projects={props.projects}
          rules={props.escalationRules}
        />;
      case 'knowledge-base':
        return <KnowledgeBaseSettings activeHub={props.activeHub} />;
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

  if (isMobile === undefined) {
    return null;
  }

  if (isMobile) {
    return (
        <div className="flex flex-col h-full">
            <div className="p-4 border-b flex items-center gap-2">
                <Select value={activeView} onValueChange={(v) => setActiveView(v as SettingsView)}>
                    <SelectTrigger className="flex-1">
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
                <Button variant="outline" size="icon" onClick={handleLogout}>
                    <LogOut className="h-4 w-4" />
                </Button>
            </div>
            <main className="flex-1 p-4 overflow-y-auto">
                {renderContent()}
            </main>
        </div>
    )
  }

  return (
    <div className="flex flex-row h-full">
      <aside className="w-80 border-r bg-card p-4 flex flex-col">
        <div className="flex-1">
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
        </div>
        <div>
          <Button variant="outline" className="w-full justify-start" onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              Log Out
          </Button>
        </div>
      </aside>
      <main className="flex-1 p-8 overflow-y-auto">
        {renderContent()}
      </main>
    </div>
  );
}
