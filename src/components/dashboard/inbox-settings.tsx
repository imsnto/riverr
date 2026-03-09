
'use client';

import React, { useState, useMemo } from 'react';
import { Bot as BotIcon, Edit, MoreHorizontal, Plus, Trash2, Globe, Smartphone, Phone, Mail } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Bot as BotData, User, HelpCenter, Conversation, Ticket, Hub, Space } from '@/lib/data';
import AgentSettingsDialog from './agent-settings-dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface InboxSettingsProps {
  allUsers: User[];
  appUser: User | null;
  bots: BotData[];
  onBotUpdate: (botId: string, data: Partial<BotData>) => void;
  onBotAdd: (bot: Omit<BotData, 'id'>) => void;
  onBotDelete: (botId: string) => void;
  helpCenters: HelpCenter[];
  tickets: Ticket[];
  conversations: Conversation[];
  activeHub: Hub | null;
  activeSpace: Space | null;
}

export default function InboxSettings({
  allUsers,
  appUser,
  bots,
  onBotUpdate,
  onBotAdd,
  onBotDelete,
  helpCenters,
  tickets,
  conversations,
  activeHub,
  activeSpace,
}: InboxSettingsProps) {
  const [selectedAgent, setSelectedAgent] = useState<BotData | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [agentToDelete, setAgentToDelete] = useState<BotData | null>(null);
  const { toast } = useToast();

  const hubMembers = useMemo(() => {
    if (!activeHub || !activeSpace) return [];
    
    let allowedUserIds: string[];
    if (activeHub.isPrivate && activeHub.memberIds) {
      allowedUserIds = activeHub.memberIds;
    } else {
      allowedUserIds = Object.keys(activeSpace.members || {});
    }
    
    return allUsers.filter(u => allowedUserIds.includes(u.id));
  }, [allUsers, activeHub, activeSpace]);

  const handleEditAgent = (bot: BotData) => {
    setSelectedAgent(bot);
    setIsDialogOpen(true);
  };

  const handleNewAgent = () => {
    setSelectedAgent(null);
    setIsDialogOpen(true);
  };

  const handleSaveAgent = (agentData: BotData | Omit<BotData, 'id' | 'hubId'>) => {
    if ('id' in agentData && agentData.id) {
      onBotUpdate(agentData.id, agentData);
    } else if (activeHub) {
      const agentWithHubId = { ...agentData, hubId: activeHub.id };
      onBotAdd(agentWithHubId as Omit<BotData, 'id'>);
    }
  };

  const handleDeleteClick = (bot: BotData) => {
    setAgentToDelete(bot);
  };

  const handleDeleteConfirm = async () => {
    if (!agentToDelete) return;
    try {
      onBotDelete(agentToDelete.id);
      toast({ title: 'Agent deleted successfully.' });
    } catch (err) {
      toast({ variant: 'destructive', title: 'Failed to delete agent.' });
    } finally {
      setAgentToDelete(null);
    }
  };

  const handleToggleAgentStatus = (bot: BotData) => {
    onBotUpdate(bot.id, { isEnabled: !(bot.isEnabled ?? true) });
    toast({
        title: `Agent ${!(bot.isEnabled ?? true) ? 'Enabled' : 'Disabled'}`,
        description: `${bot.name} has been ${!(bot.isEnabled ?? true) ? 'enabled' : 'disabled'}.`,
    });
  };

  return (
    <>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
            <div>
                <h1 className="text-2xl font-bold">Agents</h1>
                <p className="text-muted-foreground">Manage AI assistants that handle customer conversations.</p>
            </div>
            <Button onClick={handleNewAgent}>
                <Plus className="mr-2 h-4 w-4" />
                Create Agent
            </Button>
        </div>

        <div className="space-y-4">
          {bots.map((bot) => {
            const now = new Date();
            const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

            const conversationsForBot = conversations.filter(c => c.hubId === bot.hubId);
            
            const conversationsToday = conversationsForBot.filter(c => {
                const lastMessageDate = new Date(c.lastMessageAt);
                return lastMessageDate >= todayStart;
            }).length;

            const ticketsForBotHub = tickets.filter(t => t.hubId === bot.hubId);
            const totalTicketsForBot = ticketsForBotHub.length;
            const closingStatusName = activeHub?.ticketClosingStatusName || 'Closed';
            const resolvedTicketsForBot = ticketsForBotHub.filter(t => t.status === closingStatusName).length;
            const resolutionRate = totalTicketsForBot > 0 ? Math.round((resolvedTicketsForBot / totalTicketsForBot) * 100) : 0;

            const activeChannels = [];
            if (bot.channelConfig?.web?.enabled !== false) activeChannels.push('Web');
            if (bot.channelConfig?.sms?.enabled) activeChannels.push('SMS');
            if (bot.channelConfig?.voice?.enabled) activeChannels.push('Voice');
            if (bot.channelConfig?.email?.enabled) activeChannels.push('Email');

            return (
              <Card key={bot.id}>
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <CardTitle className="flex items-center gap-3">
                       <span className="relative flex h-3 w-3">
                        {(bot.isEnabled ?? true) && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>}
                        <span className={cn(
                          "relative inline-flex rounded-full h-3 w-3",
                          (bot.isEnabled ?? true) ? 'bg-green-500' : 'bg-gray-400'
                        )}></span>
                      </span>
                      <div className="space-y-1">
                        <span>{bot.name}</span>
                        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase font-black tracking-widest leading-none">
                          {activeChannels.map((ch, i) => (
                            <React.Fragment key={ch}>
                              {i > 0 && <span className="opacity-30">·</span>}
                              <span>{ch}</span>
                            </React.Fragment>
                          ))}
                        </div>
                      </div>
                    </CardTitle>
                    <div className="flex items-center gap-1">
                      <Button variant="outline" size="sm" onClick={() => handleEditAgent(bot)}>
                        Configure
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          <DropdownMenuItem onClick={() => handleToggleAgentStatus(bot)}>
                            {(bot.isEnabled ?? true) ? 'Disable' : 'Enable'}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onSelect={(e) => { e.preventDefault(); handleDeleteClick(bot); }}
                            className="text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </CardHeader>
                 <CardContent className="grid grid-cols-2 text-sm md:grid-cols-4 gap-x-4 gap-y-2">
                    <div>
                        <dt className="text-muted-foreground">Channels</dt>
                        <dd className="font-medium flex gap-1 mt-1">
                          {bot.channelConfig?.web?.enabled !== false && <Globe className="h-3 w-3" />}
                          {bot.channelConfig?.sms?.enabled && <Smartphone className="h-3 w-3" />}
                          {bot.channelConfig?.voice?.enabled && <Phone className="h-3 w-3" />}
                          {bot.channelConfig?.email?.enabled && <Mail className="h-3 w-3" />}
                        </dd>
                    </div>
                    <div>
                        <dt className="text-muted-foreground">Knowledge</dt>
                        <dd className="font-medium">Connected</dd>
                    </div>
                    <div>
                        <dt className="text-muted-foreground">Conversations Today</dt>
                        <dd className="font-medium">{conversationsToday}</dd>
                    </div>
                    <div>
                        <dt className="text-muted-foreground">Resolution Rate</dt>
                        <dd className="font-medium">{resolutionRate}%</dd>
                    </div>
                </CardContent>
              </Card>
            )
          })}

          {bots.length === 0 && (
            <div className="text-center py-16 border-2 border-dashed rounded-lg">
              <BotIcon className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-2 text-lg font-semibold text-foreground">
                No Agents Created
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Get started by creating a new AI agent.
              </p>
              <Button className="mt-4" onClick={handleNewAgent}>
                <Plus className="mr-2 h-4 w-4" />
                Create Agent
              </Button>
            </div>
          )}
        </div>
      </div>
      <AgentSettingsDialog
        isOpen={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        bot={selectedAgent}
        onSave={handleSaveAgent}
        appUser={appUser}
        allUsers={hubMembers}
        helpCenters={helpCenters}
      />
      <AlertDialog open={!!agentToDelete} onOpenChange={() => setAgentToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the agent "{agentToDelete?.name}". This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className={cn(buttonVariants({ variant: 'destructive' }))}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
