
'use client';

import React, { useState, useEffect } from 'react';
import { EmailConfig } from '@/lib/data';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { cn } from '@/lib/utils';
import { Mail, Bot, Sparkles, MessageSquare, ShieldAlert, CheckCircle2, Loader2, Trash2 } from 'lucide-react';
import * as db from '@/lib/db';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Separator } from '../ui/separator';
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
        aiMode: config.aiMode || 'off',
        aiGreeting: config.aiGreeting || '',
      });
    }
  }, [isOpen, config]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await db.updateEmailConfig(spaceId, hubId, config.id, formData);
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

              <Separator />

              <div className="space-y-4">
                <Label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">AI Integration Mode</Label>
                <RadioGroup 
                  value={formData.aiMode} 
                  onValueChange={(val) => setFormData(prev => ({ ...prev, aiMode: val as any }))}
                  className="grid grid-cols-1 gap-3"
                >
                  <ModeCard 
                    id="mode-draft"
                    value="draft"
                    icon={Sparkles}
                    title="Draft Approvals"
                    desc="AI drafts replies for agent approval. Safest for complex support."
                    active={formData.aiMode === 'draft'}
                  />
                  <ModeCard 
                    id="mode-auto"
                    value="auto"
                    icon={Bot}
                    title="AI Auto-Respond"
                    desc="AI responds instantly to recognized queries using your Knowledge Base."
                    active={formData.aiMode === 'auto'}
                  />
                  <ModeCard 
                    id="mode-off"
                    value="off"
                    icon={MessageSquare}
                    title="Manual (Off)"
                    desc="Direct agent-to-customer communication only."
                    active={formData.aiMode === 'off'}
                  />
                </RadioGroup>
              </div>

              {formData.aiMode !== 'off' && (
                <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                  <Label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">Address-Specific AI Context</Label>
                  <Textarea 
                    value={formData.aiGreeting}
                    onChange={(e) => setFormData(prev => ({ ...prev, aiGreeting: e.target.value }))}
                    placeholder="e.g. For this address, always mention our 30-day return policy..."
                    className="min-h-[120px] bg-muted/20 border-white/10 text-sm leading-relaxed"
                  />
                  <p className="text-[10px] text-muted-foreground italic">This is added to the AI's system prompt for conversations on this specific address.</p>
                </div>
              )}

              <Separator />

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

function ModeCard({ id, value, icon: Icon, title, desc, active }: { id: string, value: string, icon: any, title: string, desc: string, active: boolean }) {
  return (
    <label htmlFor={id} className={cn(
      "flex items-start gap-4 p-4 rounded-xl border-2 transition-all cursor-pointer",
      active ? "bg-primary/10 border-primary ring-4 ring-primary/5 shadow-md" : "bg-muted/20 border-white/5 hover:border-white/10"
    )}>
      <RadioGroupItem value={value} id={id} className="sr-only" />
      <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center shrink-0", active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn("font-bold text-sm", active ? "text-primary" : "text-foreground")}>{title}</p>
        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{desc}</p>
      </div>
    </label>
  );
}
