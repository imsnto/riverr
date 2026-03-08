'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { AppSidebar } from '@/components/dashboard/AppSidebar';
import { useAuth } from '@/hooks/use-auth';
import { Space, Hub, User, Conversation } from '@/lib/data';
import * as db from '@/lib/db';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { AppView } from '@/lib/routes';
import { SidebarProvider } from '@/components/ui/sidebar';
import { DashboardSkeleton } from '@/components/dashboard/dashboard-skeleton';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import MobileBottomNav from '@/components/dashboard/mobile-bottom-nav';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db as firestoreDb } from '@/lib/firebase';
import NotificationPermission from '@/components/dashboard/NotificationPermission';
import SpaceFormDialog, { HubFormValues } from '@/components/dashboard/space-form-dialog';
import { useToast } from '@/hooks/use-toast';

function AppLayoutContent({ children }: { children: React.Node }) {
    const { appUser, activeSpace, userSpaces, setUserSpaces, setActiveSpace, activeHub, setActiveHub } = useAuth();
    const router = useRouter();
    const params = useParams();
    const searchParams = useSearchParams();
    const isMobile = useIsMobile();
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(true);
    const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);
    const [isNewSpaceDialogOpen, setIsNewSpaceDialogOpen] = useState(false);
    const [allUsers, setAllUsers] = useState<User[]>([]);

    const [spaceHubs, setSpaceHubs] = useState<Hub[]>([]);
    
    const currentView = (params.view as AppView) || 'overview';
    const isChatActive = isMobile && searchParams.has('conversationId');

    // SYNC: Ensure global context matches the URL on refresh/navigation
    useEffect(() => {
        if (!userSpaces.length) return;

        const spaceIdFromUrl = params.spaceId as string;
        const hubIdFromUrl = params.hubId as string;

        if (spaceIdFromUrl && activeSpace?.id !== spaceIdFromUrl) {
            const targetSpace = userSpaces.find(s => s.id === spaceIdFromUrl);
            if (targetSpace) {
                setActiveSpace(targetSpace);
            }
        }

        if (hubIdFromUrl && activeHub?.id !== hubIdFromUrl) {
            db.getHubsForSpace(spaceIdFromUrl || activeSpace?.id || '').then(hubs => {
                const targetHub = hubs.find(h => h.id === hubIdFromUrl);
                if (targetHub) {
                    setActiveHub(targetHub);
                }
            });
        }
    }, [params.spaceId, params.hubId, userSpaces, activeSpace?.id, activeHub?.id]);
    
    useEffect(() => {
        if (activeSpace) {
            setIsLoading(true);
            db.getHubsForSpace(activeSpace.id).then(hubs => {
                setSpaceHubs(hubs);
                setIsLoading(false);
            });
        } else if (appUser) {
            setIsLoading(false);
        }
    }, [activeSpace, appUser]);

    useEffect(() => {
        if (appUser) {
            db.getAllUsers().then(setAllUsers);
        }
    }, [appUser]);

    // Global listener for unread messages count
    useEffect(() => {
      if (!appUser || !activeSpace || !activeHub) return;

      const q = query(
        collection(firestoreDb, 'conversations'),
        where('hubId', '==', activeHub?.id)
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const convos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Conversation));
        
        const count = convos.reduce((acc, convo) => {
          const lastSeen = convo.lastAgentSeenAtByAgent?.[appUser.id] ? new Date(convo.lastAgentSeenAtByAgent[appUser.id]).getTime() : 0;
          const lastMessageAt = new Date(convo.lastMessageAt).getTime();
          
          if (convo.lastMessageAuthor !== appUser.name && lastMessageAt > lastSeen) {
            return acc + 1;
          }
          return acc;
        }, 0);

        setUnreadMessagesCount(count);
      });

      return () => unsubscribe();
    }, [appUser, activeSpace, activeHub]);

    const handleViewChange = (newView: AppView) => {
        if (activeHub) {
            router.push(`/space/${activeSpace?.id}/hub/${activeHub.id}/${newView}`);
        } else if (activeSpace) {
            if (spaceHubs.length > 0) {
                const targetHub = spaceHubs[0];
                setActiveHub(targetHub);
                router.push(`/space/${activeSpace.id}/hub/${targetHub.id}/${newView}`);
            } else {
                router.push(`/space/${activeSpace.id}/hubs`);
            }
        } else if (newView === 'contacts') {
            router.push('/contacts');
        } else {
            router.push('/space-selection');
        }
    };

    const handleHubChange = async (hubId: string, spaceId: string) => {
        const targetSpace = userSpaces.find(s => s.id === spaceId);
        if (!targetSpace) return;

        const hubs = await db.getHubsForSpace(spaceId);
        const targetHub = hubs.find(h => h.id === hubId);

        if (targetHub) {
            setActiveSpace(targetSpace);
            setActiveHub(targetHub);
            const defaultView = targetHub.settings?.defaultView || 'overview';
            router.push(`/space/${targetSpace.id}/hub/${targetHub.id}/${defaultView}`);
        }
    };

    const handleSaveSpace = async (spaceData: Omit<Space, 'id'>, hubsData: HubFormValues[]) => {
        if (!appUser) return;
        try {
            const newSpaceId = await db.addSpace(spaceData);
            for (const hub of hubsData) {
                const finalHubData: Omit<Hub, 'id'> = {
                    name: hub.name,
                    spaceId: newSpaceId,
                    type: 'project-management',
                    createdAt: new Date().toISOString(),
                    createdBy: appUser.id,
                    isDefault: hubsData.length === 1,
                    settings: { components: hub.components, defaultView: 'overview' },
                    isPrivate: hub.isPrivate,
                    memberIds: hub.isPrivate ? hub.memberIds : [],
                    statuses: hub.statuses
                };
                await db.addHub(finalHubData);
            }
            
            const updatedSpaces = await db.getSpacesForUser(appUser.id);
            setUserSpaces(updatedSpaces);
            const newSpace = updatedSpaces.find(s => s.id === newSpaceId);
            if (newSpace) {
                setActiveSpace(newSpace);
                setActiveHub(null);
                router.push(`/space/${newSpaceId}/hubs`);
            }

            toast({ title: 'Space Created' });
        } catch (e) {
            toast({ variant: "destructive", title: "Failed to create space" });
            console.error(e);
        }
    };

    if (isLoading) {
        return <DashboardSkeleton />;
    }
    
    return (
        <SidebarProvider>
          <div className="flex h-screen min-h-0 w-full bg-background text-foreground">
            <AppSidebar
              view={currentView}
              onChangeView={handleViewChange}
              activeSpace={activeSpace}
              allSpaces={userSpaces}
              activeHub={activeHub}
              onHubChange={handleHubChange}
              unreadMessagesCount={unreadMessagesCount}
              onNewSpace={() => setIsNewSpaceDialogOpen(true)}
            />
            <main className={cn(
              "flex flex-col flex-1 min-h-0 min-w-0 overflow-hidden",
              isMobile && !isChatActive && "pb-20"
            )}>
              <NotificationPermission />
              {children}
            </main>
          </div>
          {isMobile && !isChatActive && (
            <MobileBottomNav
              currentView={currentView}
              onChangeView={handleViewChange}
              activeHub={activeHub}
              activeSpace={activeSpace}
              allSpaces={userSpaces}
              onHubChange={handleHubChange}
              unreadMessagesCount={unreadMessagesCount}
            />
          )}
          {appUser && (
            <SpaceFormDialog
                isOpen={isNewSpaceDialogOpen}
                onOpenChange={setIsNewSpaceDialogOpen}
                onSave={handleSaveSpace}
                space={null}
                allUsers={allUsers}
                currentUser={appUser}
            />
          )}
        </SidebarProvider>
    );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
    return (
        <Suspense fallback={<DashboardSkeleton />}>
            <AppLayoutContent>{children}</AppLayoutContent>
        </Suspense>
    );
}
