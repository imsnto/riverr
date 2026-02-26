
// src/components/dashboard/settings-layout.tsx
'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import UserSettings from './user-settings';
import SpaceSettings from './space-settings';
import HubSettings from './hub-settings';
import TeamTimesheets from './team-timesheets';
import NotificationSettings from './notification-settings';
import {
  User,
  Space,
  Invite,
  Project,
  Task,
  TimeEntry,
  Hub,
  Bot,
  EscalationIntakeRule,
  Ticket,
  Conversation,
} from '@/lib/data';
import InboxSettings from './inbox-settings';
import { useIsMobile } from '@/hooks/use-mobile';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import DealAutomationSettings from './deal-automation-settings';
import EscalationIntakeSettings from './escalation-intake-settings';
import { LogOut, Phone } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import BrainSettings from './brain-settings';
import PhoneSettings from './phone-settings';
import { deleteToken } from "firebase/messaging";
import { messaging } from '@/lib/firebase';

type SettingsView = 'users' | 'spaces' | 'hub' | 'phone' | 'inbox' | 'timesheets' | 'deal-automation' | 'escalation-intake' | 'brain' | 'notifications';

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
  bots: Bot[];
  onBotUpdate: (botId: string, data: Partial<Bot>) => void;
  onBotAdd: (bot: Omit<Bot, 'id'>) => void;
  onBotDelete: (botId: string) => void;
  escalationRules: EscalationIntakeRule[];
  tickets: Ticket[];
  conversations: Conversation[];
}

export default function SettingsLayout(props: SettingsLayoutProps) {
  const [activeView, setActiveView] = useState<SettingsView>('users');
  const isMobile = useIsMobile();
  const { signOut, activeSpace } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    await signOut();
    deleteToken(messaging);
    router.push('/login');
  };

  const isSpaceAdmin = activeSpace && props.appUser && activeSpace.members[props.appUser.id]?.role === 'Admin';

  const hubHasInbox = props.activeHub?.settings?.components?.includes('inbox');
  const hubHasDeals = props.activeHub?.settings?.components?.includes('deals');
  const hubHasTickets = props.activeHub?.settings?.components?.includes('tickets');
  const hubHasTasks = props.activeHub?.settings?.components?.includes('tasks');


  const navItems = [
    { key: 'users', label: 'Users & Permissions' },
    { key: 'spaces', label: 'Spaces' },
    { key: 'phone', label: 'Phone & SMS', disabled: !isSpaceAdmin },
    { key: 'hub', label: 'Hub Settings', disabled: !props.activeHub },
    { key: 'inbox', label: 'Agents', disabled: !hubHasInbox },
    { key: 'deal-automation', label: 'Deal Automation', disabled: !hubHasDeals },
    { key: 'escalation-intake', label: 'Escalation Intake', disabled: !(hubHasTickets && hubHasTasks) },
    { key: 'timesheets', label: 'Timesheets' },
    { key: 'notifications', label: 'Notifications' },
    { key: 'brain', label: 'Business Brain' },
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
            allHubs={props.allHubs}
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
      case 'phone':
        return activeSpace ? (
          <PhoneSettings space={activeSpace} allHubs={props.allHubs.filter(h => h.spaceId === activeSpace.id)} />
        ) : null;
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
            allUsers={props.allUsers}
            appUser={props.appUser}
            bots={props.bots}
            onBotUpdate={props.onBotUpdate}
            onBotAdd={props.onBotAdd}
            onBotDelete={props.onBotDelete}
            helpCenters={[]}
            tickets={props.tickets}
            conversations={props.conversations}
            activeHub={props.activeHub}
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
          onUpdateActiveHub={props.onUpdateActiveHub}
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
      case 'notifications':
        return <NotificationSettings />;
      case 'brain':
        return <BrainSettings />;
      default:
        return null;
    }
  };

  if (isMobile === undefined) return null;

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
            <main className="flex-1 p-4 overflow-y-auto pb-24">
                {renderContent()}
            </main>
        </div>
    )
  }

  return (
    <div className="flex flex-row h-full overflow-hidden">
      <aside className="w-80 border-r bg-card p-4 flex flex-col shrink-0">
        <div className="flex-1">
          <h2 className="text-xl font-bold mb-4">Settings</h2>
          <nav className="flex flex-col space-y-2">
            {navItems.map((item) => (
              <Button
                key={item.key}
                variant={activeView === item.key ? 'secondary' : 'ghost'}
                onClick={() => setActiveView(item.key as SettingsView)}
                className="justify-start h-10"
                disabled={item.disabled}
              >
                {item.key === 'phone' && <Phone className="mr-2 h-4 w-4" />}
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
        <div className="max-w-4xl">
            {renderContent()}
        </div>
      </main>
    </div>
  );
}
