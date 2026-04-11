
'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Visitor, User } from '@/lib/data';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Button } from '../ui/button';
import { Separator } from '../ui/separator';
import { AtSign, Calendar, Briefcase, Clock, Compass, DollarSign, HardDrive, MapPin, Milestone, Users, PanelRightClose, Phone } from 'lucide-react';
import { Badge } from '../ui/badge';
import { ScrollArea } from '../ui/scroll-area';
import { getInitials } from '@/lib/utils';

interface InboxContactPanelProps {
  visitor: Visitor | null;
  onToggle: () => void;
}

const DetailRow = ({ icon: Icon, label, value }: { icon: React.ElementType, label: string, value: React.ReactNode }) => (
    <div className="flex items-center text-sm">
        <Icon className="h-4 w-4 w-8 text-muted-foreground" />
        <span className="text-muted-foreground mr-2">{label}:</span>
        <span className="font-semibold text-right flex-1 break-all">{value}</span>
    </div>
);


export default function InboxContactPanel({ visitor, onToggle }: InboxContactPanelProps) {
  if (!visitor) {
    return (
      <div className="flex h-full items-center justify-center bg-muted/50 p-4">
      </div>
    );
  }

  const displayName = visitor.name || "Unknown Visitor";

  return (
    <div className="flex flex-col h-full bg-card border-l">
        {/* Header */}
        <div className="p-4 border-b shrink-0 flex items-start justify-between">
            <div className="flex-1" />
            <div className="flex flex-col items-center text-center flex-1">
                <Avatar className="h-16 w-16 mb-2">
                    <AvatarImage src={visitor.avatarUrl} alt={displayName} />
                    <AvatarFallback>{getInitials(displayName)}</AvatarFallback>
                </Avatar>
                <h3 className="font-semibold text-nowrap">{displayName}</h3>
            </div>
            <div className="flex-1 flex justify-end">
                <Button variant="ghost" size="icon" onClick={onToggle} className="-mr-2 -mt-2">
                    <PanelRightClose className="h-4 w-4" />
                </Button>
            </div>
        </div>
        
        {/* Body */}
        <ScrollArea className="flex-1">
            <div className="p-4 space-y-4">
                {/* Account Details */}
                <div>
                    <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Account</h4>
                    <div className="space-y-2">
                        <DetailRow icon={Milestone} label="User ID" value={visitor.id || '-'} />
                        <DetailRow icon={AtSign} label="Email" value={visitor.email || '-'} />
                        <DetailRow icon={Phone} label="Phone" value={visitor.phone || '-'} />
                        <DetailRow icon={Calendar} label="Last Activity" value={visitor.lastSeen || '-'} />
                    </div>
                </div>

                <Separator />

                {/* Page Details */}
                 <div>
                    <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Page details</h4>
                    <div className="space-y-2">
                        <DetailRow icon={Milestone} label="Domain" value={visitor.location?.domain || '-'} />
                        <DetailRow icon={Users} label="Pathname" value={visitor.location?.pathname || '-'} />
                    </div>
                </div>
            </div>
        </ScrollArea>
    </div>
  );
}
