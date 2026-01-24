'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Plus, MoreHorizontal, Edit, Trash2 } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Hub, User, DealAutomationRule } from '@/lib/data';
import * as db from '@/lib/db';
import { useToast } from '@/hooks/use-toast';
import DealAutomationRuleDialog from './deal-automation-rule-dialog';

interface DealAutomationSettingsProps {
  activeHub: Hub | null;
  allUsers: User[];
}

export default function DealAutomationSettings({ activeHub, allUsers }: DealAutomationSettingsProps) {
  const [rules, setRules] = useState<DealAutomationRule[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedRule, setSelectedRule] = useState<DealAutomationRule | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (activeHub) {
      db.getDealAutomationRules(activeHub.id).then(setRules);
    }
  }, [activeHub]);

  const handleNewRule = () => {
    setSelectedRule(null);
    setIsDialogOpen(true);
  };

  const handleEditRule = (rule: DealAutomationRule) => {
    setSelectedRule(rule);
    setIsDialogOpen(true);
  };

  const handleSaveRule = async (ruleData: Omit<DealAutomationRule, 'id'>, ruleId?: string) => {
    try {
      await db.saveDealAutomationRule(ruleData, ruleId);
      toast({ title: ruleId ? 'Rule Updated' : 'Rule Created' });
      if (activeHub) {
        db.getDealAutomationRules(activeHub.id).then(setRules);
      }
      setIsDialogOpen(false);
    } catch (error) {
      toast({ variant: 'destructive', title: 'Failed to save rule' });
    }
  };
  
  const handleDeleteRule = async (ruleId: string) => {
      try {
          await db.deleteDealAutomationRule(ruleId);
          toast({ title: 'Rule Deleted' });
          if (activeHub) {
              db.getDealAutomationRules(activeHub.id).then(setRules);
          }
      } catch (error) {
          toast({ variant: 'destructive', title: 'Failed to delete rule' });
      }
  }

  if (!activeHub) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No Hub Selected</CardTitle>
          <CardDescription>Please select a hub to manage deal automations.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Deal Automations</CardTitle>
              <CardDescription>Automate your sales pipeline with triggers and actions.</CardDescription>
            </div>
            <Button onClick={handleNewRule}>
              <Plus className="mr-2 h-4 w-4" /> New Rule
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {rules.map((rule) => (
              <div key={rule.id} className="border p-4 rounded-lg flex justify-between items-center">
                <div>
                  <h3 className="font-semibold">{rule.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    When <span className="font-medium text-primary">{rule.trigger.type}</span>, then <span className="font-medium text-primary">{rule.action.type}</span>.
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
            ))}
            {rules.length === 0 && (
              <div className="text-center py-12 border-2 border-dashed rounded-lg">
                <h3 className="mt-2 text-sm font-semibold text-foreground">No Automation Rules</h3>
                <p className="mt-1 text-sm text-muted-foreground">Get started by creating a new rule.</p>
                <Button className="mt-4" onClick={handleNewRule}>
                  <Plus className="mr-2 h-4 w-4" /> Create Rule
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <DealAutomationRuleDialog
        isOpen={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        rule={selectedRule}
        onSave={handleSaveRule}
        activeHub={activeHub}
        allUsers={allUsers}
      />
    </>
  );
}
