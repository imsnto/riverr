
'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User as AppUser, Space, SpaceMember, Invite, Hub } from '@/lib/data';
import { onAuthStateChanged, User as FirebaseUser, signOut as firebaseSignOut, signInWithPopup } from 'firebase/auth';
import { auth, googleProvider } from '@/lib/firebase';
import { getUser, addUser, addSpace, getSpacesForUser, getInvitesForEmail, acceptInvite, declineInvite } from '@/lib/db';
import { writeBatch, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useRouter } from 'next/navigation';


type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

const LOCAL_STORAGE_KEY_USER = 'timeflow_user_v3';
const LOCAL_STORAGE_KEY_ACTIVE_SPACE = 'timeflow_active_space_v2';
const LOCAL_STORAGE_KEY_ACTIVE_HUB = 'timeflow_active_hub_v2';

interface AuthContextType {
  firebaseUser: FirebaseUser | null;
  appUser: AppUser | null;
  status: AuthStatus;
  setAppUser: React.Dispatch<React.SetStateAction<AppUser | null>>;
  signOut: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  userSpaces: Space[];
  setUserSpaces: React.Dispatch<React.SetStateAction<Space[]>>;
  activeSpace: Space | null;
  setActiveSpace: (space: Space | null) => void;
  activeHub: Hub | null;
  setActiveHub: (hub: Hub | null) => void;
  pendingInvites: Invite[];
  acceptInvite: (invite: Invite) => Promise<void>;
  declineInvite: (inviteId: string) => Promise<void>;
  getUserPermissions: (spaceId: string) => SpaceMember | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [userSpaces, setUserSpaces] = useState<Space[]>([]);
  const [activeSpace, _setActiveSpace] = useState<Space | null>(null);
  const [activeHub, _setActiveHub] = useState<Hub | null>(null);
  const [pendingInvites, setPendingInvites] = useState<Invite[]>([]);

  const setActiveSpace = (space: Space | null) => {
    _setActiveSpace(space);
    if (space) {
        localStorage.setItem(LOCAL_STORAGE_KEY_ACTIVE_SPACE, JSON.stringify(space));
    } else {
        localStorage.removeItem(LOCAL_STORAGE_KEY_ACTIVE_SPACE);
    }
  }

  const setActiveHub = (hub: Hub | null) => {
    _setActiveHub(hub);
    if (hub) {
        localStorage.setItem(LOCAL_STORAGE_KEY_ACTIVE_HUB, JSON.stringify(hub));
    } else {
        localStorage.removeItem(LOCAL_STORAGE_KEY_ACTIVE_HUB);
    }
  }


  useEffect(() => {
    try {
        const cachedUser = localStorage.getItem(LOCAL_STORAGE_KEY_USER);
        const cachedSpace = localStorage.getItem(LOCAL_STORAGE_KEY_ACTIVE_SPACE);
        const cachedHub = localStorage.getItem(LOCAL_STORAGE_KEY_ACTIVE_HUB);

        if (cachedUser) {
            const parsed = JSON.parse(cachedUser);
            setAppUser(parsed.appUser);
            setFirebaseUser(parsed.firebaseUser);
            setUserSpaces(parsed.userSpaces || []);
            setStatus('authenticated');
        }
        if (cachedSpace) {
            _setActiveSpace(JSON.parse(cachedSpace));
        }
        if (cachedHub) {
            _setActiveHub(JSON.parse(cachedHub));
        }
    } catch (e) {
        localStorage.removeItem(LOCAL_STORAGE_KEY_USER);
        localStorage.removeItem(LOCAL_STORAGE_KEY_ACTIVE_SPACE);
        localStorage.removeItem(LOCAL_STORAGE_KEY_ACTIVE_HUB);
    }

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setFirebaseUser(user);
        const token = await user.getIdToken();
        document.cookie = `token=${token}; path=/; max-age=3600`;
        
        let userProfile = await getUser(user.uid);
        let spaces: Space[] = [];

        if (!userProfile) {
          const newUser: Omit<AppUser, 'id'> = {
            name: user.displayName || 'New User',
            email: user.email!,
            avatarUrl: user.photoURL || `https://placehold.co/100x100.png?text=${user.displayName?.[0] || 'U'}`,
            role: 'Admin', // Default global role
          };
          userProfile = await addUser(newUser, user.uid);
          
          const personalSpace: Omit<Space, 'id'> = {
            name: `${userProfile.name}'s Space`,
            members: { [userProfile.id]: { role: 'Admin' as const } },
            statuses: [
              { name: 'Backlog', color: '#6b7280' },
              { name: 'In Progress', color: '#3b82f6' },
              { name: 'In Review', color: '#f59e0b' },
              { name: 'Done', color: '#22c55e' },
            ]
          };
          await addSpace(personalSpace);
          spaces = await getSpacesForUser(userProfile.id);
        } else {
           spaces = await getSpacesForUser(userProfile.id);
        }
        
        const invites = await getInvitesForEmail(userProfile.email);
        setAppUser(userProfile);
        setUserSpaces(spaces);
        setPendingInvites(invites);
        localStorage.setItem(LOCAL_STORAGE_KEY_USER, JSON.stringify({ appUser: userProfile, firebaseUser: user, userSpaces: spaces }));
        
        if (activeSpace) {
            const stillMember = spaces.find(s => s.id === activeSpace.id);
            if (!stillMember) {
                setActiveSpace(null);
                setActiveHub(null);
            }
        }
        
        setStatus('authenticated');

      } else {
        setFirebaseUser(null);
        setAppUser(null);
        setUserSpaces([]);
        setActiveSpace(null);
        setActiveHub(null);
        setPendingInvites([]);
        localStorage.removeItem(LOCAL_STORAGE_KEY_USER);
        localStorage.removeItem(LOCAL_STORAGE_KEY_ACTIVE_SPACE);
        localStorage.removeItem(LOCAL_STORAGE_KEY_ACTIVE_HUB);
        document.cookie = 'token=; Max-Age=0; path=/;';
        setStatus('unauthenticated');
      }
    });

    return () => unsubscribe();
  }, []);

  const handleSignOut = async () => {
    await firebaseSignOut(auth);
  };

  const signInWithGoogle = async () => {
    setStatus('loading');
    try {
      await signInWithPopup(auth, googleProvider);
      // The onAuthStateChanged listener will handle the rest
    } catch (error) {
      console.error("Error during Google Sign-In:", error);
      setStatus('unauthenticated');
    }
  };

  const handleAcceptInvite = async (invite: Invite) => {
    if (!appUser) return;
    await acceptInvite(invite, appUser.id);
    setPendingInvites(prev => prev.filter(i => i.id !== invite.id));
    const updatedSpaces = await getSpacesForUser(appUser.id);
    setUserSpaces(updatedSpaces);
    localStorage.setItem(LOCAL_STORAGE_KEY_USER, JSON.stringify({ appUser, firebaseUser, userSpaces: updatedSpaces }));
  };

  const handleDeclineInvite = async (inviteId: string) => {
      await declineInvite(inviteId);
      setPendingInvites(prev => prev.filter(i => i.id !== inviteId));
  };
  
  const getUserPermissions = (spaceId: string) => {
    const space = userSpaces.find(s => s.id === spaceId);
    if (!space || !appUser) return null;
    return space.members[appUser.id] || null;
  }

  const value: AuthContextType = {
    firebaseUser,
    appUser,
    status,
    setAppUser,
    signOut: handleSignOut,
    signInWithGoogle,
    userSpaces,
    setUserSpaces,
    activeSpace,
    setActiveSpace,
    activeHub,
    setActiveHub,
    pendingInvites,
    acceptInvite: handleAcceptInvite,
    declineInvite: handleDeclineInvite,
    getUserPermissions,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
