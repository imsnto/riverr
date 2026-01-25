
'use client';

import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Deal, User, Contact } from '@/lib/data';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { AtSign, Calendar, Flag, User as UserIcon, DollarSign, Pin } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { ScrollArea } from '../ui/scroll-area';
import { Input } from '../ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Calendar as CalendarPicker } from '../ui/calendar';
import { Button } from '../ui/button';

const getInitials = (name: string) => {
    return name ? name.split(' ').map(n => n[0]).join('') : '';
}

interface DetailRowProps {
    icon: React.ElementType;
    label: string;
    children: React.ReactNode;
    className?: string;
}
const DetailRow: React.FC<DetailRowProps> = ({ icon: Icon, label, children, className }) => (
    <div className={cn("space-y-2 md:grid md:grid-cols-[8rem_1fr] md:items-start md:gap-4 md:space-y-0", className)}>
        <div className="flex items-center gap-2 text-muted-foreground md:pt-1.5">
            <Icon className="h-4 w-4" />
            <span className="text-sm font-medium">{label}</span>
        </div>
        <div className="md:col-span-1">{children}</div>
    </div>
);


interface DealDetailsDialogProps {
    deal: Deal | null;
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
    onUpdateDeal: (deal: Deal) => void;
    statuses: string[];
    allUsers: User[];
    contact: Contact | null;
}

export default function DealDetailsDialog({ deal: initialDeal, isOpen, onOpenChange, onUpdateDeal, statuses, allUsers, contact }: DealDetailsDialogProps) {
    const [deal, setDeal] = useState(initialDeal);

    useEffect(() => {
        setDeal(initialDeal);
    }, [initialDeal]);
    
    if (!deal) return null;
    
    const handleFieldChange = (field: keyof Deal, value: any) => {
        const updatedDeal = { ...deal, [field]: value, updatedAt: new Date().toISOString() };
        setDeal(updatedDeal);
        onUpdateDeal(updatedDeal);
    };

    const assignee = allUsers.find(u => u.id === deal.assignedTo);
    
    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className={cn("max-w-4xl h-[90vh] flex flex-col p-0 gap-0")}>
                <DialogHeader className="p-6 pb-4 border-b">
                    <DialogTitle>{deal.title}</DialogTitle>
                </DialogHeader>

                <ScrollArea className="flex-1">
                    <div className="p-4 md:p-6 space-y-6">
                        <DetailRow icon={Flag} label="Stage">
                            <Select value={deal.status} onValueChange={(value) => handleFieldChange('status', value)}>
                                <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                                <SelectContent>{statuses.map(status => <SelectItem key={status} value={status}>{status}</SelectItem>)}</SelectContent>
                            </Select>
                        </DetailRow>
                        <DetailRow icon={UserIcon} label="Owner">
                             <Select value={deal.assignedTo || 'unassigned'} onValueChange={(value) => handleFieldChange('assignedTo', value === 'unassigned' ? null : value)}>
                                <SelectTrigger className="h-8">
                                    <SelectValue>
                                        {assignee ? (
                                            <div className="flex items-center gap-2">
                                                <Avatar className="h-6 w-6"><AvatarImage src={assignee.avatarUrl} /><AvatarFallback>{getInitials(assignee.name)}</AvatarFallback></Avatar>
                                                {assignee.name}
                                            </div>
                                        ) : 'Unassigned'}
                                    </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="unassigned">Unassigned</SelectItem>
                                    {allUsers.map(user => (
                                        <SelectItem key={user.id} value={user.id}>
                                            <div className="flex items-center gap-2">
                                                <Avatar className="h-6 w-6"><AvatarImage src={user.avatarUrl} /><AvatarFallback>{getInitials(user.name)}</AvatarFallback></Avatar>
                                                {user.name}
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </DetailRow>
                        <DetailRow icon={DollarSign} label="Value">
                            <Input 
                                type="number" 
                                className="h-8" 
                                value={deal.value || ''}
                                onChange={(e) => setDeal(d => d ? {...d, value: parseFloat(e.target.value)}: null)}
                                onBlur={() => handleFieldChange('value', deal.value)}
                            />
                        </DetailRow>
                         <DetailRow icon={Calendar} label="Close Date">
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" className={cn("h-8 w-full justify-start text-left font-normal", !deal.closeDate && "text-muted-foreground")}>
                                        {deal.closeDate ? format(parseISO(deal.closeDate), "PPP") : <span>Pick a date</span>}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0">
                                    <CalendarPicker
                                        mode="single"
                                        selected={deal.closeDate ? parseISO(deal.closeDate) : undefined}
                                        onSelect={(date) => handleFieldChange('closeDate', date?.toISOString())}
                                        initialFocus
                                    />
                                </PopoverContent>
                            </Popover>
                        </DetailRow>
                        <DetailRow icon={Pin} label="Next Step">
                            <Input 
                                className="h-8"
                                value={deal.nextStep || ''}
                                onChange={(e) => setDeal(d => d ? {...d, nextStep: e.target.value } : null)}
                                onBlur={() => handleFieldChange('nextStep', deal.nextStep)}
                            />
                        </DetailRow>
                        {contact && (
                            <DetailRow icon={AtSign} label="Contact">
                                <div className="flex items-center gap-2">
                                    <Avatar className="h-6 w-6"><AvatarFallback>{getInitials(contact.name || '?')}</AvatarFallback></Avatar>
                                    {contact.name} ({contact.primaryEmail})
                                </div>
                            </DetailRow>
                        )}
                    </div>
                </ScrollArea>
            </DialogContent>
        </Dialog>
    )
}
