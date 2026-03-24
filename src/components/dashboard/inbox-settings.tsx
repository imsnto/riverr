
'use client';

import React, { useState, useMemo } from 'react';
import { Bot as BotIcon, Edit, MoreHorizontal, Plus, Trash2, Copy, Check } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { Button, buttonVariants } from '@/components/ui/button';
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
import { Bot as BotData, User, HelpCenter, Conversation, Ticket, Hub, Space } from '@/lib/data';
import AgentSettingsDialog from './agent-settings-dialog';
import WidgetSettingsDialog from './widget-settings-dialog';
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
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Switch } from '../ui/switch';

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
  mode?: 'web-chat' | 'agents';
  onUpdateActiveHub?: (data: Partial<Hub>) => void;
}

export default function InboxSettings({
  allUsers,
  appUser,
  bots,
  onBotUpdate,
  onBotAdd,
  onBotDelete,
  helpCenters,
  activeHub,
  activeSpace,
  mode = 'agents',
}: InboxSettingsProps) {
  const [selectedBot, setSelectedBot] = useState<BotData | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [botToDelete, setBotToDelete] = useState<BotData | null>(null);
  const { toast } = useToast();

  const isWebChatMode = mode === 'web-chat';

  // Filter bots by type
  const displayBots = useMemo(() => {
    return bots.filter(b => {
      const type = b.type || 'widget';
      return type === (isWebChatMode ? 'widget' : 'agent');
    });
  }, [bots, isWebChatMode]);

  // Filter agents for brain assignment
  const agentsList = useMemo(() => {
    return bots.filter(b => b.type === 'agent' && b.isEnabled);
  }, [bots]);

  // Filter users specifically for the current Hub context
  const hubMembers = useMemo(() => {
    if (!activeHub || !activeSpace) return [];
    
    let memberIds: string[] | undefined;

    // Use explicit hub members if private, otherwise use all space members
    if (activeHub.isPrivate && activeHub.memberIds) {
      memberIds = activeHub.memberIds;
    } else {
      memberIds = Object.keys(activeSpace.members);
    }
    
    return allUsers.filter(u => memberIds?.includes(u.id));
  }, [activeHub, activeSpace, allUsers]);

  const handleEditBot = (bot: BotData) => {
    setSelectedBot(bot);
    setIsDialogOpen(true);
  };

  const handleNewBot = () => {
    setSelectedBot(null);
    setIsDialogOpen(true);
  };

  const handleDuplicateBot = (bot: BotData) => {
    const { id, ...rest } = bot;
    
    const deepSanitize = (obj: any): any => {
      if (Array.isArray(obj)) return obj.map(deepSanitize);
      if (obj !== null && typeof obj === 'object') {
        return Object.fromEntries(
          Object.entries(obj)
            .filter(([_, v]) => v !== undefined)
            .map(([k, v]) => [k, deepSanitize(v)])
        );
      }
      return obj;
    };

    const duplicatedData: Omit<BotData, 'id'> = {
      ...deepSanitize(rest),
      name: `Copy of ${bot.name}`,
      isEnabled: false,
    } as any;
    onBotAdd(duplicatedData);
    toast({ title: `${isWebChatMode ? 'Widget' : 'Agent'} Duplicated` });
  };

  const handleSaveBot = (botData: BotData | Omit<BotData, 'id' | 'hubId'>) => {
    const deepSanitize = (obj: any): any => {
      if (Array.isArray(obj)) return obj.map(deepSanitize);
      if (obj !== null && typeof obj === 'object') {
        return Object.fromEntries(
          Object.entries(obj)
            .filter(([_, v]) => v !== undefined)
            .map(([k, v]) => [k, deepSanitize(v)])
        );
      }
      return obj;
    };

    const sanitizedData = deepSanitize(botData);

    if ('id' in sanitizedData && sanitizedData.id) {
      onBotUpdate(sanitizedData.id, sanitizedData as any);
    } else if (activeHub) {
      const dataWithDefaults = { 
        ...sanitizedData, 
        hubId: activeHub.id, 
        spaceId: activeHub.spaceId,
        type: isWebChatMode ? 'widget' : 'agent'
      };
      onBotAdd(dataWithDefaults as Omit<BotData, 'id'>);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!botToDelete) return;
    try {
      onBotDelete(botToDelete.id);
      toast({ title: 'Deleted successfully.' });
    } catch (err) {
      toast({ variant: 'destructive', title: 'Failed to delete.' });
    } finally {
      setBotToDelete(null);
    }
  };

  return (
    <>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
            <div>
                <h1 className="text-2xl font-bold">{isWebChatMode ? 'Web Chat Widgets' : 'AI Agents'}</h1>
                <p className="text-muted-foreground">
                    {isWebChatMode 
                        ? 'Manage your website chat interfaces and branding.' 
                        : 'Configure high-intelligence brains to handle your conversations.'}
                </p>
            </div>
            <Button onClick={handleNewBot}>
                <Plus className="mr-2 h-4 w-4" />
                {isWebChatMode ? 'Create Widget' : 'Create Agent'}
            </Button>
        </div>

        <div className="space-y-4">
          {displayBots.map((bot) => (
            <Card key={bot.id} className="overflow-hidden border border-white/10">
              <CardHeader className="pb-4">
                <div className="flex justify-between items-center">
                  <CardTitle className="flex items-center gap-3">
                    <span className="relative flex h-3 w-3">
                      {(bot.isEnabled ?? true) && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>}
                      <span className={cn(
                        "relative inline-flex rounded-full h-3 w-3",
                        (bot.isEnabled ?? true) ? 'bg-green-500' : 'bg-gray-400'
                      )}></span>
                    </span>
                    <span>{bot.name}</span>
                  </CardTitle>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 mr-2">
                        <span className="text-[10px] uppercase font-black tracking-widest text-muted-foreground opacity-50">Active</span>
                        <Switch 
                            checked={bot.isEnabled ?? true} 
                            onCheckedChange={(val) => onBotUpdate(bot.id, { isEnabled: val })}
                            className="scale-75"
                        />
                    </div>
                    <Button variant="outline" size="sm" onClick={() => handleEditBot(bot)} className="h-8 text-xs font-bold px-4 rounded-lg">
                      Configure
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleDuplicateBot(bot)}>
                          <Copy className="mr-2 h-4 w-4" /> Duplicate
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => setBotToDelete(bot)} className="text-destructive">
                          <Trash2 className="mr-2 h-4 w-4" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </CardHeader>
              
              {isWebChatMode && (
                <CardContent className="bg-muted/30 pt-6 border-t border-white/5">
                  <div className="space-y-4">
                    <div className="flex flex-col gap-2">
                      <Label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">AI Agent Brain</Label>
                      <Select 
                        value={bot.assignedAgentId || 'none'} 
                        onValueChange={(val) => onBotUpdate(bot.id, { assignedAgentId: val === 'none' ? null : val })}
                      >
                        <SelectTrigger className="bg-background h-11 border-white/10">
                          <SelectValue placeholder="No Agent (Route to Inbox)" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None (Route to Inbox)</SelectItem>
                          {agentsList.map(agent => (
                            <SelectItem key={agent.id} value={agent.id}>{agent.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="p-3 rounded-xl border border-white/5 bg-background/50 flex items-center gap-3">
                      {bot.assignedAgentId ? (
                        <>
                          <div className="h-8 w-8 rounded-lg bg-green-500/10 flex items-center justify-center text-green-500">
                            <Check className="h-4 w-4" />
                          </div>
                          <p className="text-xs font-medium">
                            <span className="font-bold text-foreground">
                              {agentsList.find(a => a.id === bot.assignedAgentId)?.name || 'Agent'}
                            </span> is active on this widget
                          </p>
                        </>
                      ) : (
                        <>
                          <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-500">
                            <BotIcon className="h-4 w-4" />
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Conversations route to inbox. <span className="font-bold">No AI involvement.</span>
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
              )}
            </Card>
          ))}

          {displayBots.length === 0 && (
            <div className="text-center py-16 border-2 border-dashed rounded-lg">
              <BotIcon className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-2 text-lg font-semibold text-foreground">
                No {isWebChatMode ? 'Widgets' : 'Agents'} Created
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Get started by creating a new {isWebChatMode ? 'web chat widget' : 'AI agent'}.
              </p>
              <Button className="mt-4" onClick={handleNewBot}>
                <Plus className="mr-2 h-4 w-4" />
                {isWebChatMode ? 'Create Widget' : 'Create Agent'}
              </Button>
            </div>
          )}
        </div>
      </div>

      {isWebChatMode ? (
        <WidgetSettingsDialog
          isOpen={isDialogOpen}
          onOpenChange={setIsDialogOpen}
          bot={selectedBot}
          onSave={handleSaveBot}
          allUsers={hubMembers}
          hubAgents={agentsList}
          activeHub={activeHub}
          activeSpace={activeSpace}
        />
      ) : (
        <AgentSettingsDialog
          isOpen={isDialogOpen}
          onOpenChange={setIsDialogOpen}
          bot={selectedBot}
          onSave={handleSaveBot}
          appUser={appUser}
          allUsers={[]}
          helpCenters={helpCenters}
        />
      )}

      <AlertDialog open={!!botToDelete} onOpenChange={() => setBotToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{botToDelete?.name}". This action cannot be undone.
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
