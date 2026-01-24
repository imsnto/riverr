
'use client';

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"; // Adjust path based on your setup
import { Visitor } from '@/lib/data';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Button } from '../ui/button';
import { Separator } from '../ui/separator';
import { AtSign, Calendar, MapPin, Milestone, Users } from 'lucide-react';
import { Badge } from '../ui/badge';
import { ScrollArea } from '../ui/scroll-area';

interface ContactDetailDialogProps {
  visitor: Visitor | null;
  children?: React.ReactNode; // For the trigger button
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const getInitials = (name: string) => {
  if (!name) return '?';
  return name.split(' ').map(n => n[0]).join('').toUpperCase();
}

const DetailRow = ({ icon: Icon, label, value }: { icon: React.ElementType, label: string, value: React.ReactNode }) => (
  <div className="flex items-center text-sm py-1">
    <Icon className="h-4 w-4 mr-3 text-muted-foreground shrink-0" />
    <span className="text-muted-foreground mr-2">{label}:</span>
    <span className="font-medium text-right flex-1 break-all">{value}</span>
  </div>
);

export default function ContactDetailDialog({ visitor: contact, children, open, onOpenChange }: ContactDetailDialogProps) {
  if (!contact) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {children && <DialogTrigger asChild>{children}</DialogTrigger>}
      
      <DialogContent className="sm:max-w-[425px] p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-2 flex flex-col items-center border-b">
          <Avatar className="h-20 w-20 mb-3">
            <AvatarImage src={contact.avatarUrl} alt={contact.name} />
            <AvatarFallback>{getInitials(contact.name)}</AvatarFallback>
          </Avatar>
          <DialogTitle className="text-xl font-bold">{contact.name}</DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]">
          <div className="p-6 space-y-6">
            {/* Account Details */}
            <section>
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
                Account Information
              </h4>
              <div className="space-y-3">
                <DetailRow icon={Milestone} label="User ID" value={contact.id} />
                <DetailRow icon={AtSign} label="Email" value={contact.email} />
                <DetailRow icon={MapPin} label="Location" value={contact.location} />
                <DetailRow icon={Calendar} label="Member Since" value="2 years ago" />
              </div>
            </section>

            <Separator />

            {/* Page/Company Details */}
            <section>
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
                Context Details
              </h4>
              <div className="space-y-3">
                <DetailRow icon={Milestone} label="Domain" value={contact.companyId} />
                <DetailRow icon={Users} label="Pathname" value={contact.companyUsers} />
              </div>
            </section>
          </div>
        </ScrollArea>
        
      </DialogContent>
    </Dialog>
  );
}
