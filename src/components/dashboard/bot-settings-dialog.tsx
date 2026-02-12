'use client';

import React, { useState } from 'react';
import { Bot as BotIcon, Edit, MoreHorizontal, Plus, Trash2 } from 'lucide-react';
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
import { Bot as BotData, User, HelpCenter } from '@/lib/data';
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
}

export default function InboxSettings({
  allUsers,
  appUser,
  bots,
  onBotUpdate,
  onBotAdd,
  onBotDelete,
  helpCenters,
}: InboxSettingsProps) {
  const [selectedAgent, setSelectedAgent] = useState<BotData | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { activeHub } = useAuth();
  const [agentToDelete, setAgentToDelete] = useState<BotData | null>(null);
  const { toast } = useToast();

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
          {bots.map((bot) => (
            <Card key={bot.id}>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle className="flex items-center gap-3">
                    <span className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                    </span>
                    {bot.name}
                  </CardTitle>
                  <div className="flex items-center gap-1">
                    <Button variant="outline" size="sm" onClick={() => handleEditAgent(bot)}>
                      Configure
                    </Button>
                    <Button variant="ghost" size="sm" disabled>
                      Analytics
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem disabled>Disable</DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={(e) => { e.preventDefault(); handleDeleteClick(bot); }}
                          className="text-destructive"
                        >
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
                      <dd className="font-medium">Web</dd>
                  </div>
                  <div>
                      <dt className="text-muted-foreground">Knowledge</dt>
                      <dd className="font-medium">Connected</dd>
                  </div>
                  <div>
                      <dt className="text-muted-foreground">Conversations Today</dt>
                      <dd className="font-medium">34</dd>
                  </div>
                  <div>
                      <dt className="text-muted-foreground">Resolution Rate</dt>
                      <dd className="font-medium">72%</dd>
                  </div>
              </CardContent>
            </Card>
          ))}

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
        allUsers={allUsers}
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