'use client';

import React, { useState, useEffect } from 'react';
import { EmailConfig } from '@/lib/data';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Mail, Loader2, CheckCircle2, Trash2 } from 'lucide-react';
import * as db from '@/lib/db';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from '../ui/scroll-area';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface EmailConfigDrawerProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  config: EmailConfig;
  spaceId: string;
  hubId: string;
  onSave: (config: EmailConfig) => void;
  onDisconnect: (id: string) => Promise<void>;
}

export default function EmailConfigDrawer({ isOpen, onOpenChange, config, spaceId, hubId, onSave, onDisconnect }: EmailConfigDrawerProps) {
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [isDisconnectAlertOpen, setIsDisconnectAlertOpen] = useState(false);
  const [formData, setFormData] = useState<Partial<EmailConfig>>({});

  useEffect(() => {
    if (isOpen) {
      setFormData({
        label: config.label || '',
      });
    }
  }, [isOpen, config]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      if (hubId === 'agent') {
        // For personal configs, spaceId is the userId
        await db.updateAgentEmailConfig(spaceId, config.id, formData);
      } else {
        await db.updateEmailConfig(spaceId, hubId, config.id, formData);
      }
      onSave({ ...config, ...formData } as EmailConfig);
      toast({ title: "Configuration saved" });
    } catch (e) {
      toast({ variant: 'destructive', title: "Failed to save configuration" });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <Sheet open={isOpen} onOpenChange={onOpenChange}>
        <SheetContent className="sm:max-w-xl p-0 flex flex-col">
          <SheetHeader className="p-6 border-b shrink-0 text-left">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                <Mail className="h-5 w-5" />
              </div>
              <div>
                <SheetTitle>Configure Address</SheetTitle>
                <SheetDescription>{config.emailAddress}</SheetDescription>
              </div>
            </div>
          </SheetHeader>

          <ScrollArea className="flex-1">
            <div className="p-6 space-y-8 pb-20">
              <div className="space-y-4">
                <Label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">Internal Label</Label>
                <Input 
                  value={formData.label} 
                  onChange={(e) => setFormData(prev => ({ ...prev, label: e.target.value }))}
                  placeholder="e.g. Support Inbox"
                  className="bg-muted/20 border-white/10 h-11"
                />
              </div>

              <div className="p-4 rounded-xl bg-primary/5 border border-primary/10">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  <span className="font-bold text-primary mr-1">Note:</span>
                  AI behavior and writing scripts for this email address are managed globally in your **Agent Settings**.
                </p>
              </div>

              <div className="pt-4">
                <Button 
                  variant="ghost" 
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive w-full justify-start h-12 rounded-xl"
                  onClick={() => setIsDisconnectAlertOpen(true)}
                >
                  <Trash2 className="h-4 w-4 mr-3" />
                  Disconnect Email Address
                </Button>
              </div>
            </div>
          </ScrollArea>

          <SheetFooter className="p-6 border-t bg-background shrink-0">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={isSaving} className="px-8 font-bold">
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
              Save Configuration
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <AlertDialog open={isDisconnectAlertOpen} onOpenChange={setIsDisconnectAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect Support Email?</AlertDialogTitle>
            <AlertDialogDescription>
              This will stop all real-time syncing for {config.emailAddress}. Existing conversation history will remain in the inbox, but you will no longer receive or send emails from this address.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => onDisconnect(config.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Disconnect
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
