'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import UserSettings from './user-settings';
import SpaceSettings from './space-settings';
import HubSettings from './hub-settings';
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
  HelpCenter,
} from '@/lib/data';
import InboxSettings from './inbox-settings';
import { useIsMobile } from '@/hooks/use-mobile';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import DealAutomationSettings from './deal-automation-settings';
import EscalationIntakeSettings from './escalation-intake-settings';
import { LogOut, Phone, User as UserIcon, Building2, LayoutGrid, Bell, BrainCircuit, Clock, Mail } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import BrainSettings from './brain-settings';
import PhoneSettings from './phone-settings';
import HubEmailSettings from './hub-email-settings';
import { getToken } from "firebase/messaging";
import { messaging } from '@/lib/firebase';
import { ScrollArea } from '../ui/scroll-area';
import TeamTimesheets from './team-timesheets';
import { arrayRemove, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

type SettingsView = 'users' | 'space-general' | 'hub-general' | 'phone' | 'email' | 'agents' | 'timesheets' | 'deal-automation' | 'escalation-intake' | 'brain' | 'notifications';

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
  helpCenters: HelpCenter[];
}

const NavButton = ({ 
  item, 
  activeView, 
  setActiveView 
}: { 
  item: { key: SettingsView, label: string, icon: any, hidden?: boolean },
  activeView: SettingsView,
  setActiveView: (view: SettingsView) => void
}) => {
  if (item.hidden) return null;
  const Icon = item.icon;
  return (
    <Button
      variant={activeView === item.key ? 'secondary' : 'ghost'}
      onClick={() => setActiveView(item.key)}
      className="justify-start h-9 px-3 w-full"
    >
      <Icon className="mr-2 h-4 w-4" />
      {item.label}
    </Button>
  );
};

export default function SettingsLayout(props: SettingsLayoutProps) {
  const [activeView, setActiveView] = useState<SettingsView>('users');
  const isMobile = useIsMobile();
  const { signOut, activeSpace } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    try {
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted' && messaging) {
        try {
          const token = await getToken(messaging);
          const userId = props?.appUser?.id;
          if (token && userId) {
            const userTokensRef = doc(db, "fcmTokens", userId);
            await updateDoc(userTokensRef, { tokens: arrayRemove(token) });
          }
        } catch (tokenErr) {
          console.warn("FCM token cleanup skipped or failed during logout:", tokenErr);
        }
      }
    } catch (error) {
      console.error("General error during logout cleanup:", error);
    } finally {
      await signOut();
      window.location.replace('/login');
    }
  };

  const isSpaceAdmin = activeSpace && props.appUser && activeSpace.members[props.appUser.id]?.role === 'Admin';

  const hubHasInbox = props.activeHub?.settings?.components?.includes('inbox');
  const hubHasDeals = props.activeHub?.settings?.components?.includes('deals');
  const hubHasTickets = props.activeHub?.settings?.components?.includes('tickets');
  const hubHasTasks = props.activeHub?.settings?.components?.includes('tasks');

  const spaceNavItems = [
    { key: 'users' as SettingsView, label: 'Members', icon: UserIcon },
    { key: 'space-general' as SettingsView, label: 'Space Settings', icon: Building2 },
    { key: 'brain' as SettingsView, label: 'Business Brain', icon: BrainCircuit },
    { key: 'phone' as SettingsView, label: 'Phone & SMS', icon: Phone, hidden: !isSpaceAdmin },
  ];

  const hubNavItems = [
    { key: 'hub-general' as SettingsView, label: 'General', icon: LayoutGrid },
    { key: 'email' as SettingsView, label: 'Support Email', icon: Mail, hidden: !hubHasInbox },
    { key: 'agents' as SettingsView, label: 'Agents', icon: BrainCircuit, hidden: !hubHasInbox },
    { key: 'deal-automation' as SettingsView, label: 'Deal Automation', icon: LayoutGrid, hidden: !hubHasDeals },
    { key: 'escalation-intake' as SettingsView, label: 'Escalation Intake', icon: LayoutGrid, hidden: !(hubHasTickets && hubHasTasks) },
  ];

  const workspaceNavItems = [
    { key: 'timesheets' as SettingsView, label: 'Timesheets', icon: Clock },
    { key: 'notifications' as SettingsView, label: 'Notifications', icon: Bell },
  ];

  const renderContent = () => {
    if (!activeSpace) return <div className="text-center p-8">No active workspace context.</div>;

    switch (activeView) {
      case 'users':
        return (
          <UserSettings
            activeSpace={activeSpace}
            allUsers={props.allUsers}
            appUser={props.appUser}
            handleInvite={props.handleInvite}
            onInvite={props.onInvite}
            allHubs={props.allHubs.filter(h => h.spaceId === activeSpace.id)}
          />
        );
      case 'space-general':
        return (
          <SpaceSettings
            activeSpace={activeSpace}
            allUsers={props.allUsers}
            onSave={props.onSave}
            onDelete={props.onDelete}
            appUser={props.appUser}
          />
        );
      case 'brain':
        return <BrainSettings />;
      case 'phone':
        return <PhoneSettings space={activeSpace} allHubs={props.allHubs.filter(h => h.spaceId === activeSpace.id)} />;
      case 'hub-general':
        return props.activeHub ? (
          <HubSettings
            activeHub={props.activeHub}
            onUpdateHub={props.onUpdateActiveHub}
            allUsers={props.allUsers}
          />
        ) : null;
      case 'email':
        return props.activeHub ? <HubEmailSettings activeHub={props.activeHub} spaceId={activeSpace.id} /> : null;
       case 'agents':
        return props.activeHub ? (
            <InboxSettings 
                allUsers={props.allUsers}
                appUser={props.appUser}
                bots={props.bots}
                onBotUpdate={props.onBotUpdate}
                onBotAdd={props.onBotAdd}
                onBotDelete={props.onBotDelete}
                helpCenters={props.helpCenters}
                tickets={props.tickets}
                conversations={props.conversations}
                activeHub={props.activeHub}
                activeSpace={activeSpace}
            />
        ) : null;
      case 'deal-automation':
        return props.activeHub ? (
            <DealAutomationSettings 
                activeHub={props.activeHub} 
                allUsers={props.allUsers}
                allHubs={props.allHubs}
                projects={props.projects}
            />
        ) : null;
      case 'escalation-intake':
        return props.activeHub ? (
            <EscalationIntakeSettings
                activeHub={props.activeHub}
                allUsers={props.allUsers}
                allHubs={props.allHubs}
                projects={props.projects}
                rules={props.escalationRules}
                onUpdateActiveHub={props.onUpdateActiveHub}
            />
        ) : null;
      case 'timesheets':
        return (
          <TeamTimesheets
            allSpaces={props.allSpaces}
            allUsers={props.allUsers}
            projects={props.projects}
            tasks={props.tasks}
            timeEntries={props.timeEntries}
            appUser={props.appUser!}
            activeHub={props.activeHub}
          />
        );
      case 'notifications':
        return <NotificationSettings />;
      default:
        return null;
    }
  };

  if (isMobile) {
    return (
        <div className="flex flex-col h-full">
            <div className="p-4 border-b flex items-center gap-2">
                <Select value={activeView} onValueChange={(v) => setActiveView(v as SettingsView)}>
                    <SelectTrigger className="flex-1 h-10">
                        <SelectValue placeholder="Select a setting" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="users">Space: Members</SelectItem>
                        <SelectItem value="space-general">Space: Settings</SelectItem>
                        <SelectItem value="brain">Space: Business Brain</SelectItem>
                        {isSpaceAdmin && <SelectItem value="phone">Space: Phone & SMS</SelectItem>}
                        {props.activeHub && (
                            <>
                                <SelectItem value="hub-general">Hub: General</SelectItem>
                                {hubHasInbox && <SelectItem value="email">Hub: Support Email</SelectItem>}
                                {hubHasInbox && <SelectItem value="agents">Hub: Agents</SelectItem>}
                                {hubHasDeals && <SelectItem value="deal-automation">Hub: Deal Automation</SelectItem>}
                                {(hubHasTickets && hubHasTasks) && <SelectItem value="escalation-intake">Hub: Escalation Intake</SelectItem>}
                            </>
                        )}
                        <SelectItem value="timesheets">Workspace: Timesheets</SelectItem>
                        <SelectItem value="notifications">Workspace: Notifications</SelectItem>
                    </SelectContent>
                </Select>
                <Button variant="outline" size="icon" onClick={handleLogout} className="h-10 w-10">
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
    <div className="flex flex-row h-full overflow-hidden bg-background">
      <aside className="w-64 border-r bg-card flex flex-col shrink-0">
        <div className="p-4 border-b">
            <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground/70">Settings</h2>
        </div>
        <ScrollArea className="flex-1">
            <div className="p-3 space-y-6">
                <div className="space-y-1">
                    <p className="px-3 mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50">Space: {activeSpace?.name}</p>
                    {spaceNavItems.map(item => (
                      <NavButton 
                        key={item.key} 
                        item={item} 
                        activeView={activeView} 
                        setActiveView={setActiveView} 
                      />
                    ))}
                </div>

                {props.activeHub && (
                    <div className="space-y-1">
                        <p className="px-3 mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50">Hub: {props.activeHub.name}</p>
                        {hubNavItems.map(item => (
                          <NavButton 
                            key={item.key} 
                            item={item} 
                            activeView={activeView} 
                            setActiveView={setActiveView} 
                          />
                        ))}
                    </div>
                )}

                <div className="space-y-1">
                    <p className="px-3 mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50">Global Workspace</p>
                    {workspaceNavItems.map(item => (
                      <NavButton 
                        key={item.key} 
                        item={item} 
                        activeView={activeView} 
                        setActiveView={setActiveView} 
                      />
                    ))}
                </div>
            </div>
        </ScrollArea>
        <div className="p-4 border-t mt-auto">
          <Button variant="ghost" className="w-full justify-start h-9 px-3 text-muted-foreground hover:text-foreground" onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              Log Out
          </Button>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-4xl p-8 mx-auto">
            {renderContent()}
        </div>
      </main>
    </div>
  );
}
