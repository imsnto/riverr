
'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { ChatContact, User } from '@/lib/data';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Button } from '../ui/button';
import { Separator } from '../ui/separator';
import { AtSign, Calendar, Briefcase, Clock, Compass, DollarSign, HardDrive, MapPin, Milestone, Users } from 'lucide-react';
import { Badge } from '../ui/badge';

interface InboxContactPanelProps {
  contact: ChatContact | null;
}

const getInitials = (name: string) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
}

const DetailRow = ({ icon: Icon, label, value }: { icon: React.ElementType, label: string, value: React.ReactNode }) => (
    <div className="flex items-center text-sm">
        <Icon className="h-4 w-4 w-8 text-muted-foreground" />
        <span className="text-muted-foreground mr-2">{label}:</span>
        <span className="font-semibold text-right flex-1">{value}</span>
    </div>
);


export default function InboxContactPanel({ contact }: InboxContactPanelProps) {
  if (!contact) {
    return (
      <div className="flex h-full items-center justify-center bg-muted/50 p-4">
        <div className="text-center">
            <Users className="mx-auto h-10 w-10 text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">Select a conversation to see details</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-card">
        {/* Header */}
        <div className="p-4 border-b">
            <div className="flex flex-col items-center text-center">
                <Avatar className="h-16 w-16 mb-2">
                    <AvatarImage src={contact.avatarUrl} alt={contact.name} />
                    <AvatarFallback>{getInitials(contact.name)}</AvatarFallback>
                </Avatar>
                <h3 className="font-semibold">{contact.name}</h3>
                <p className="text-sm text-muted-foreground">{contact.companyName}</p>
                <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                    <MapPin className="h-3 w-3" />
                    <span>{contact.location}</span>
                    <span className="text-xs">·</span>
                    <span>10:11 PM GMT</span>
                </div>
                <div className="flex gap-2 mt-3">
                    <Button variant="outline" size="sm">Add tag...</Button>
                    <Badge variant="secondary" className="bg-green-100 text-green-800">Active</Badge>
                </div>
            </div>
        </div>
        
        {/* Body */}
        <div className="flex-1 overflow-y-auto">
            <div className="p-4 space-y-4">
                {/* Account Details */}
                <div>
                    <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Account</h4>
                    <div className="space-y-2">
                        <DetailRow icon={AtSign} label="Email" value={contact.email} />
                        <DetailRow icon={Milestone} label="User ID" value={contact.id} />
                        <DetailRow icon={Calendar} label="Signed up" value="5mth ago" />
                        <DetailRow icon={Clock} label="Last Seen" value={contact.lastSeen} />
                        <DetailRow icon={HardDrive} label="Sessions" value={contact.sessions} />
                    </div>
                </div>

                <Separator />

                {/* Company Details */}
                 <div>
                    <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">{contact.companyName}</h4>
                    <div className="space-y-2">
                        <DetailRow icon={Milestone} label="Company ID" value={contact.companyId} />
                        <DetailRow icon={Clock} label="Last Seen" value="1hr ago" />
                        <DetailRow icon={Calendar} label="Created" value="2y ago" />
                        <DetailRow icon={Users} label="Users" value={contact.companyUsers} />
                        <DetailRow icon={Briefcase} label="Plan" value={contact.companyPlan} />
                        <DetailRow icon={DollarSign} label="Spend" value={contact.companySpend} />
                    </div>
                </div>
            </div>
        </div>
    </div>
  );
}
