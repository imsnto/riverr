'use client';

import React, { useState, useMemo } from 'react';
import { Bot as BotIcon, Edit, MoreHorizontal, Plus, Trash2, Copy, ChevronRight, MessageSquare, Check } from 'lucide-react';
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

interface InboxSettingsProps {
  allUsers: User[];
  appUser: User | null;
  bots: BotData[]; // Used for both widgets and agents
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
  tickets,
  conversations,
  activeHub,
  activeSpace,
  mode = 'agents',
  onUpdateActiveHub,
}: InboxSettingsProps) {
  const [selectedBot, setSelectedBot] = useState<BotData | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [botToDelete, setBotToDelete] = useState<BotData | null>(null);
  const { toast } = useToast();

  const isWebChatMode = mode === 'web-chat';

  // Separate widgets from agents
  const displayBots = useMemo(() => {
    return bots.filter(b => {
      // Legacy fallback: if type is missing, treat as 'widget'
      const type = b.type || 'widget';
      return type === (isWebChatMode ? 'widget' : 'agent');
    });
  }, [bots, isWebChatMode]);

  const agentsList = useMemo(() => {
    return bots.filter(b => (b.type === 'agent' || !b.type) && b.isEnabled);
  }, [bots]);

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
    
    // Firestore does not allow 'undefined' values.
    const sanitizedRest = Object.fromEntries(
      Object.entries(rest).filter(([_, v]) => v !== undefined)
    );

    const duplicatedData: Omit<BotData, 'id'> = {
      ...sanitizedRest,
      name: `Copy of ${bot.name}`,
      isEnabled: false,
    } as any;
    onBotAdd(duplicatedData);
    toast({ title: `${isWebChatMode ? 'Widget' : 'Agent'} Duplicated` });
  };

  const handleSaveBot = (botData: BotData | Omit<BotData, 'id' | 'hubId'>) => {
    // Firestore does not allow 'undefined' values.
    const sanitizedData = Object.fromEntries(
      Object.entries(botData).filter(([_, v]) => v !== undefined)
    );

    if ('id' in sanitizedData && sanitizedData.id) {
      const existing = bots.find(b => b.id === sanitizedData.id);
      const type = sanitizedData.type || existing?.type || (isWebChatMode ? 'widget' : 'agent');
      onBotUpdate(sanitizedData.id, { ...sanitizedData, type } as any);
    } else if (activeHub) {
      const dataWithDefaults = { 
        ...sanitizedData, 
        hubId: activeHub.id, 
        spaceId: activeHub.spaceId,
        type: isWebChatMode ? 'widget' as const : 'agent' as const
      };
      onBotAdd(dataWithDefaults as Omit<BotData, 'id'>);
    }
  };

  const handleDeleteClick = (bot: BotData) => {
    setBotToDelete(bot);
  };

  const handleDeleteConfirm = async () => {
    if (!botToDelete) return;
    try {
      onBotDelete(botToDelete.id);
      toast({ title: `${isWebChatMode ? 'Widget' : 'Agent'} deleted successfully.` });
    } catch (err) {
      toast({ variant: 'destructive', title: `Failed to delete ${isWebChatMode ? 'widget' : 'agent'}.` });
    } finally {
      setBotToDelete(null);
    }
  };

  const handleAgentAssignment = (widgetId: string, agentId: string) => {
    onBotUpdate(widgetId, { assignedAgentId: agentId === 'none' ? null : agentId });
    toast({ title: 'Assignment updated' });
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
            <Card key={bot.id} className="overflow-hidden">
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
                  <div className="flex items-center gap-1">
                    <Button variant="outline" size="sm" onClick={() => handleEditBot(bot)}>
                      Configure
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onBotUpdate(bot.id, { isEnabled: !bot.isEnabled })}>
                          {bot.isEnabled ? 'Disable' : 'Enable'}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDuplicateBot(bot)}>
                          <Copy className="mr-2 h-4 w-4" /> Duplicate
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => handleDeleteClick(bot)} className="text-destructive">
                          <Trash2 className="mr-2 h-4 w-4" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </CardHeader>
              
              {isWebChatMode && (
                <CardContent className="bg-muted/30 pt-6 border-t">
                  <div className="space-y-4">
                    <div className="flex flex-col gap-2">
                      <Label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">AI Agent Assignment</Label>
                      <Select 
                        value={bot.assignedAgentId || 'none'} 
                        onValueChange={(val) => handleAgentAssignment(bot.id, val)}
                      >
                        <SelectTrigger className="bg-background h-11">
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
                    
                    <div className="p-3 rounded-xl border bg-background/50 flex items-center gap-3">
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
                            <MessageSquare className="h-4 w-4" />
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

      <AgentSettingsDialog
        isOpen={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        bot={selectedBot}
        onSave={handleSaveBot}
        appUser={appUser}
        allUsers={allUsers}
        helpCenters={helpCenters}
        mode={isWebChatMode ? 'widget' : 'agent'}
        hubWidgets={isWebChatMode ? [] : bots.filter(b => b.type === 'widget' || !b.type)}
      />

      <AlertDialog open={!!botToDelete} onOpenChange={() => setBotToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the {isWebChatMode ? 'widget' : 'agent'} "{botToDelete?.name}". This action cannot be undone.
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
