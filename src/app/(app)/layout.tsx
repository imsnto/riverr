
// src/app/(app)/layout.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { AppSidebar } from '@/components/dashboard/AppSidebar';
import { useAuth } from '@/hooks/use-auth';
import { Space, Hub, User, Conversation } from '@/lib/data';
import * as db from '@/lib/db';
import { useRouter, useParams } from 'next/navigation';
import { AppView } from '@/lib/routes';
import { SidebarProvider } from '@/components/ui/sidebar';
import { DashboardSkeleton } from '@/components/dashboard/dashboard-skeleton';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import MobileBottomNav from '@/components/dashboard/mobile-bottom-nav';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db as firestoreDb } from '@/lib/firebase';

export default function AppLayout({ children }: { children: React.ReactNode }) {
    const { appUser, activeSpace, userSpaces, setActiveSpace, activeHub, setActiveHub } = useAuth();
    const router = useRouter();
    const params = useParams();
    const isMobile = useIsMobile();
    const [isLoading, setIsLoading] = useState(true);
    const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);

    const [spaceHubs, setSpaceHubs] = useState<Hub[]>([]);
    
    const currentView = (params.view as AppView) || (params.view as AppView) || 'overview';
    
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

    // Global listener for unread messages count
    useEffect(() => {
      if (!appUser || !activeSpace) return;

      const q = query(
        collection(firestoreDb, 'conversations'),
        where('spaceId', '==', activeSpace.id)
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
    }, [appUser, activeSpace]);

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
        // Find the target space
        const targetSpace = userSpaces.find(s => s.id === spaceId);
        if (!targetSpace) return;

        // Fetch hubs for that space to find the target hub object
        const hubs = await db.getHubsForSpace(spaceId);
        const targetHub = hubs.find(h => h.id === hubId);

        if (targetHub) {
            setActiveSpace(targetSpace);
            setActiveHub(targetHub);
            const defaultView = targetHub.settings?.defaultView || 'overview';
            router.push(`/space/${targetSpace.id}/hub/${targetHub.id}/${defaultView}`);
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
            />
            <main className={cn(
              "flex flex-col flex-1 min-h-0 min-w-0 overflow-hidden",
              isMobile && activeHub && "pb-20"
            )}>
              {children}
            </main>
          </div>
          {isMobile && activeHub && (
            <MobileBottomNav
              currentView={currentView}
              onChangeView={handleViewChange}
              activeHub={activeHub}
            />
          )}
        </SidebarProvider>
    );
}
