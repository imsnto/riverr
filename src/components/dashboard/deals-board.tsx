// src/components/dashboard/deals-board.tsx
'use client';

import React, { useState, DragEvent, useRef, useMemo } from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { User, Deal, Hub, Status, Contact, Space } from '@/lib/data';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Badge } from '../ui/badge';
import { MoreHorizontal, Plus, Edit } from 'lucide-react';
import { Button } from '../ui/button';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import DealDetailsDialog from './deal-details-dialog';
import BoardSettingsDialog from './board-settings-dialog';
import CreateDealDialog from './create-deal-dialog';

const getInitials = (name: string) => {
    if (!name) return '';
    return name.split(' ').map(n => n[0]).join('');
}

const DealCard = ({ deal, onClick, isDragging, allUsers, contacts }: { deal: Deal, onClick: () => void, isDragging: boolean, allUsers: User[], contacts: Contact[] }) => {
  const assignee = allUsers.find(u => u.id === deal.assignedTo);
  const contact = contacts.find(v => v.id === deal.contactId);

  return (
    <Card
      onClick={onClick}
      className={cn(
        "mb-2 bg-card hover:shadow-md transition-shadow duration-200 cursor-pointer",
        isDragging && "opacity-50 ring-2 ring-primary"
      )}
    >
      <CardHeader className="p-3 cursor-grab">
        <CardTitle className="text-sm font-medium">{deal.title}</CardTitle>
        {deal.value && <p className="text-xs text-muted-foreground">${deal.value.toLocaleString()}</p>}
      </CardHeader>
      <CardFooter className="flex justify-between items-center p-3 pt-0">
         <div className="flex items-center gap-2 text-muted-foreground">
            {contact && (
                <div className="flex items-center gap-1 text-xs">
                    <Avatar className="h-4 w-4"><AvatarFallback>{getInitials(contact.name || '?')}</AvatarFallback></Avatar>
                    {contact.name}
                </div>
            )}
         </div>
        {assignee && (
            <Avatar className="h-6 w-6">
                <AvatarImage src={assignee.avatarUrl} alt={assignee.name} />
                <AvatarFallback>{getInitials(assignee.name)}</AvatarFallback>
            </Avatar>
        )}
      </CardFooter>
    </Card>
  );
};

interface DealsBoardProps {
  deals: Deal[];
  onUpdateDeals: (deals: Deal[]) => void;
  onAddDeal: (dealData: Omit<Deal, 'id' | 'hubId' | 'spaceId' | 'status' | 'createdAt' | 'createdBy' | 'updatedAt' | 'isStale' | 'lastActivityAt' >) => void;
  activeHub: Hub;
  activeSpace: Space;
  allUsers: User[];
  contacts: Contact[];
  onUpdateActiveHub: (updatedHub: Partial<Hub>) => void;
  onNavigateToSettings: () => void;
}

const defaultStatuses: Status[] = [
    { name: 'New Lead', color: '#6b7280' }, { name: 'Contacted', color: '#3b82f6' }, 
    { name: 'Qualified', color: '#10b981' }, { name: 'Proposal Sent', color: '#f59e0b' }, 
    { name: 'Won', color: '#22c55e' }, { name: 'Lost', color: '#ef4444' },
];

export default function DealsBoard({ deals, onUpdateDeals, onAddDeal, activeHub, activeSpace, allUsers, contacts, onUpdateActiveHub, onNavigateToSettings }: DealsBoardProps) {
  const [draggedDeal, setDraggedDeal] = useState<string | null>(null);
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isCreateDealOpen, setIsCreateDealOpen] = useState(false);
  const { appUser } = useAuth();
  
  const statuses = activeHub.dealStatuses || defaultStatuses;
  
  const [dropIndicator, setDropIndicator] = useState<{ status: string; index: number } | null>(null);
  const dealCardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const hubMembers = useMemo(() => {
    if (!activeHub || !activeSpace) return [];
    
    let memberIds: string[] | undefined;

    if (activeHub.settings?.dealMembers) {
      memberIds = activeHub.settings.dealMembers;
    } else if (activeHub.isPrivate && activeHub.memberIds) {
      memberIds = activeHub.memberIds;
    } else {
      memberIds = Object.keys(activeSpace.members);
    }
    
    return allUsers.filter(u => memberIds?.includes(u.id));
  }, [activeHub, activeSpace, allUsers]);

  const handleDragStart = (e: DragEvent<HTMLDivElement>, dealId: string) => {
    e.dataTransfer.setData('dealId', dealId);
    setDraggedDeal(dealId);
  };

    const handleDragOver = (e: DragEvent<HTMLDivElement>, status: string) => {
        e.preventDefault();
        const columnDeals = deals.filter(t => t.status === status);
        const mouseY = e.clientY;
        let closestIndex = columnDeals.length;

        for (let i = 0; i < columnDeals.length; i++) {
            const d = columnDeals[i];
            if (d.id === draggedDeal) continue;
            const el = dealCardRefs.current[d.id];
            if (!el) continue;
            const { top, height } = el.getBoundingClientRect();
            const mid = top + height / 2;
            if (mouseY < mid) {
                closestIndex = i;
                break;
            }
        }
        if (dropIndicator?.status !== status || dropIndicator?.index !== closestIndex) {
            setDropIndicator({ status, index: closestIndex });
        }
    };
  
    const handleColumnDragLeave = (e: DragEvent<HTMLDivElement>) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          setDropIndicator(null);
        }
    };

    const handleDrop = (e: DragEvent<HTMLDivElement>, newStatus: string) => {
        e.preventDefault();
        const dealId = e.dataTransfer.getData('dealId');
        if (!dealId || !dropIndicator) return;
        const dealToMove = deals.find(t => t.id === dealId);
        if (!dealToMove) return;

        const sameColumn = dealToMove.status === newStatus;
        const fromIndex = deals.filter(t => t.status === dealToMove.status).findIndex(t => t.id === dealId);
        let insertIndex = dropIndicator.index;
        if (sameColumn && fromIndex !== -1 && fromIndex < insertIndex) {
            insertIndex -= 1;
        }

        const newDeals = deals.filter(t => t.id !== dealId);
        const targetColumnDeals = newDeals.filter(t => t.status === newStatus);
        targetColumnDeals.splice(insertIndex, 0, { ...dealToMove, status: newStatus, updatedAt: new Date().toISOString() });
        const otherColumnDeals = newDeals.filter(t => t.status !== newStatus);
        
        onUpdateDeals([...otherColumnDeals, ...targetColumnDeals]);
        setDropIndicator(null);
        setDraggedDeal(null);
    };

    const handleDragEnd = () => {
        setDraggedDeal(null);
        setDropIndicator(null);
    };
    
    const handleUpdateDeal = (updatedDeal: Deal) => {
        onUpdateDeals(deals.map(d => d.id === updatedDeal.id ? updatedDeal : d));
    };

     const handleSaveSettings = (newMemberIds: string[]) => {
        onUpdateActiveHub({
            settings: {
                ...activeHub.settings,
                dealMembers: newMemberIds,
            }
        });
        setIsSettingsOpen(false);
    }
    
    const handleSaveDeal = (dealData: Omit<Deal, 'id' | 'hubId' | 'spaceId' | 'status' | 'createdAt' | 'createdBy' | 'updatedAt' | 'isStale' | 'lastActivityAt' >) => {
        onAddDeal(dealData);
        setIsCreateDealOpen(false);
    };


    const renderStatusColumn = (status: Status) => {
      const columnDeals = deals.filter(deal => deal.status === status.name);
      return (
        <div key={status.name} className="flex-shrink-0 w-64 md:w-72 h-full min-h-0 flex flex-col"
            onDrop={(e) => handleDrop(e, status.name)}
            onDragOver={(e) => handleDragOver(e, status.name)}
            onDragLeave={handleColumnDragLeave}
        >
            <div className="flex justify-between items-center mb-4 px-1 shrink-0">
                <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: status.color }}/>
                    <h2 className="text-lg font-semibold">{status.name}</h2>
                </div>
            </div>
            <div className="bg-primary/5 rounded-lg p-2 flex-1 min-h-0 overflow-y-auto">
                <div className="space-y-0.5">
                    {columnDeals.map((deal, index) => {
                        const showIndicator = dropIndicator?.status === status.name && dropIndicator.index === index;
                        return (
                            <React.Fragment key={deal.id}>
                                {showIndicator && <div className="h-10 border-2 border-dashed border-primary rounded-lg" />}
                                <div ref={el => dealCardRefs.current[deal.id] = el} draggable onDragStart={(e) => handleDragStart(e, deal.id)} onDragEnd={handleDragEnd}
                                    className={cn("transition-all duration-200", draggedDeal === deal.id ? "opacity-30" : "opacity-100")}>
                                    <DealCard deal={deal} onClick={() => setSelectedDeal(deal)} isDragging={draggedDeal === deal.id} allUsers={allUsers} contacts={contacts} />
                                </div>
                            </React.Fragment>
                        );
                    })}
                    {dropIndicator?.status === status.name && dropIndicator.index === columnDeals.length && <div className="h-10 border-2 border-dashed border-primary rounded-lg" />}
                </div>
            </div>
        </div>
      )
    };

  return (
    <>
      <div className="flex h-full min-w-0 flex-col overflow-hidden">
        <div className="hidden md:flex w-full min-w-0 shrink-0 justify-between items-center px-6 pt-6 pb-4 border-b">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">Deals</h1>
               <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setIsSettingsOpen(true)}>
                  <Edit className="h-4 w-4" />
              </Button>
            </div>
             <div className="flex items-center gap-4">
                <Button onClick={() => setIsCreateDealOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Deal
                </Button>
                <div className="flex -space-x-2">
                    {hubMembers.slice(0, 5).map(member => (
                        <Avatar key={member.id} className="h-8 w-8 border-2 border-background">
                            <AvatarImage src={member.avatarUrl} alt={member.name} />
                            <AvatarFallback>{getInitials(member.name)}</AvatarFallback>
                        </Avatar>
                    ))}
                    {hubMembers.length > 5 && (
                        <Avatar className="h-8 w-8 border-2 border-background">
                            <AvatarFallback>+{hubMembers.length - 5}</AvatarFallback>
                        </Avatar>
                    )}
                </div>
            </div>
        </div>
        <div className="flex-1 min-h-0 min-w-0 overflow-hidden">
          <div className="h-full w-full min-w-0 overflow-x-auto overflow-y-hidden">
            <div className="flex w-max gap-4 p-4 md:p-6 md:pt-2 h-full">
              {statuses.map(renderStatusColumn)}
            </div>
          </div>
        </div>
      </div>
      {selectedDeal && (
        <DealDetailsDialog
            deal={selectedDeal}
            isOpen={!!selectedDeal}
            onOpenChange={() => setSelectedDeal(null)}
            onUpdateDeal={handleUpdateDeal}
            statuses={statuses.map(s => s.name)}
            allUsers={allUsers}
            contact={contacts.find(c => c.id === selectedDeal.contactId) || null}
        />
      )}
       <BoardSettingsDialog
        isOpen={isSettingsOpen}
        onOpenChange={setIsSettingsOpen}
        boardName="Deal"
        allUsers={allUsers.filter(u => activeSpace.members[u.id])}
        initialMembers={activeHub.settings?.dealMembers || Object.keys(activeSpace.members)}
        onSave={handleSaveSettings}
        appUser={appUser}
      />
      <CreateDealDialog
        isOpen={isCreateDealOpen}
        onOpenChange={setIsCreateDealOpen}
        onSave={handleSaveDeal}
        allUsers={hubMembers}
        contacts={contacts}
        defaultStage={statuses[0]?.name || 'New Lead'}
      />
    </>
  );
}
    