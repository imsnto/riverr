'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Plus, MoreHorizontal, Edit, Trash2, GitMerge } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Hub, User, EscalationIntakeRule, Project } from '@/lib/data';
import * as db from '@/lib/db';
import { useToast } from '@/hooks/use-toast';
import EscalationRuleDialog from './escalation-rule-dialog';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

interface EscalationIntakeSettingsProps {
  activeHub: Hub | null;
  allUsers: User[];
  allHubs: Hub[];
  projects: Project[];
  rules: EscalationIntakeRule[];
  onUpdateActiveHub: (updatedData: Partial<Hub>) => void;
}

export default function EscalationIntakeSettings({ activeHub, allUsers, allHubs, projects, rules: initialRules, onUpdateActiveHub }: EscalationIntakeSettingsProps) {
  const [rules, setRules] = useState<EscalationIntakeRule[]>(initialRules);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedRule, setSelectedRule] = useState<EscalationIntakeRule | null>(null);
  const [intraHubEscalationProjectId, setIntraHubEscalationProjectId] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    setRules(initialRules);
  }, [initialRules]);
  
  useEffect(() => {
    if (activeHub) {
        db.getEscalationIntakeRules(activeHub.id).then(setRules);
        setIntraHubEscalationProjectId(activeHub.settings?.intraHubEscalationProjectId || null);
    }
  }, [activeHub]);


  const handleNewRule = () => {
    setSelectedRule(null);
    setIsDialogOpen(true);
  };

  const handleEditRule = (rule: EscalationIntakeRule) => {
    setSelectedRule(rule);
    setIsDialogOpen(true);
  };

  const handleSaveRule = async (ruleData: Omit<EscalationIntakeRule, 'id' | 'hubId'>, ruleId?: string) => {
    if (!activeHub) return;
    try {
      await db.saveEscalationIntakeRule(activeHub.id, ruleData, ruleId);
      toast({ title: ruleId ? 'Rule Updated' : 'Rule Created' });
      db.getEscalationIntakeRules(activeHub.id).then(setRules);
      setIsDialogOpen(false);
    } catch (error) {
      toast({ variant: 'destructive', title: 'Failed to save rule' });
    }
  };
  
  const handleDeleteRule = async (ruleId: string) => {
      if (!activeHub) return;
      try {
          await db.deleteEscalationIntakeRule(activeHub.id, ruleId);
          toast({ title: 'Rule Deleted' });
          db.getEscalationIntakeRules(activeHub.id).then(setRules);
      } catch (error) {
          toast({ variant: 'destructive', title: 'Failed to delete rule' });
      }
  }

  const handleIntraHubSave = () => {
    if (!activeHub) return;
    onUpdateActiveHub({
        settings: {
            ...activeHub.settings,
            intraHubEscalationProjectId: intraHubEscalationProjectId,
        }
    });
    toast({ title: "Intra-Hub escalation project updated." });
  }

  if (!activeHub) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No Hub Selected</CardTitle>
          <CardDescription>Please select a hub to manage escalation rules.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const hasTickets = activeHub.settings?.components?.includes('tickets');
  const hasTasks = activeHub.settings?.components?.includes('tasks');
  const showIntraHubSetting = hasTickets && hasTasks;

  const hasIntraHubChanges = intraHubEscalationProjectId !== (activeHub.settings?.intraHubEscalationProjectId || null);


  return (
    <div className="space-y-6">
      {showIntraHubSetting && (
         <Card>
            <CardHeader>
                <CardTitle>Intra-Hub Escalation Project</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-2">
                    <Label htmlFor="intraHubEscalation">Default Escalation Project</Label>
                    <Select value={intraHubEscalationProjectId ?? 'none'} onValueChange={(value) => setIntraHubEscalationProjectId(value === 'none' ? null : value)}>
                        <SelectTrigger id="intraHubEscalation">
                            <SelectValue placeholder="Select a project for local escalations" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="none">None</SelectItem>
                            {projects.filter(p => p.hubId === activeHub.id).map(p => (
                                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                        When a ticket is escalated, a linked task will be created in this project.
                    </p>
                </div>
            </CardContent>
             <CardFooter>
                <Button onClick={handleIntraHubSave} disabled={!hasIntraHubChanges}>Save Changes</Button>
            </CardFooter>
         </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Cross-Hub Escalation Intake Rules</CardTitle>
              <CardDescription>Manage how other hubs can escalate items to this hub.</CardDescription>
            </div>
            <Button onClick={handleNewRule}>
              <Plus className="mr-2 h-4 w-4" /> New Rule
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {rules.map((rule) => {
                const destProject = projects.find(p => p.id === rule.destinationBoardId);
                return (
                    <div key={rule.id} className="border p-4 rounded-lg flex justify-between items-center">
                        <div>
                        <h3 className="font-semibold">{rule.name}</h3>
                        <p className="text-sm text-muted-foreground">
                            When a <span className="font-medium text-primary">{rule.allowedTypes.join(' or ')}</span> is escalated, create task in <span className="font-medium text-primary">{destProject?.name || 'N/A'}</span>.
                        </p>
                        </div>
                        <div>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                            </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEditRule(rule)}>
                                <Edit className="mr-2 h-4 w-4" /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDeleteRule(rule.id)} className="text-destructive">
                                <Trash2 className="mr-2 h-4 w-4" /> Delete
                            </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                        </div>
                    </div>
                )
            })}
            {rules.length === 0 && (
              <div className="text-center py-12 border-2 border-dashed rounded-lg">
                <GitMerge className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-2 text-sm font-semibold text-foreground">No Intake Rules</h3>
                <p className="mt-1 text-sm text-muted-foreground">Get started by creating a rule to allow other hubs to escalate work to you.</p>
                <Button className="mt-4" onClick={handleNewRule}>
                  <Plus className="mr-2 h-4 w-4" /> Create Rule
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <EscalationRuleDialog
        isOpen={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        rule={selectedRule}
        onSave={handleSaveRule}
        activeHub={activeHub}
        allUsers={allUsers}
        allHubs={allHubs}
        projects={projects.filter(p => p.hubId === activeHub.id)}
      />
    </div>
  );
}
