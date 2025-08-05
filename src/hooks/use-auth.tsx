
'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User as AppUser, Space, SpaceMember } from '@/lib/data';
import { onAuthStateChanged, User as FirebaseUser, signOut as firebaseSignOut, signInWithPopup } from 'firebase/auth';
import { auth, googleProvider } from '@/lib/firebase';
import { getUser, addUser, addSpace, getSpacesForUser, getInvite, deleteInvite, updateSpace } from '@/lib/db';
import { writeBatch, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

const LOCAL_STORAGE_KEY = 'timeflow_user_v2';

interface AuthContextType {
  firebaseUser: FirebaseUser | null;
  appUser: AppUser | null;
  status: AuthStatus;
  setAppUser: React.Dispatch<React.SetStateAction<AppUser | null>>;
  signOut: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  userSpaces: Space[];
  getUserPermissions: (spaceId: string) => SpaceMember | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [userSpaces, setUserSpaces] = useState<Space[]>([]);

  useEffect(() => {
    const cachedUser = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (cachedUser) {
        try {
            const parsed = JSON.parse(cachedUser);
            setAppUser(parsed.appUser);
            setFirebaseUser(parsed.firebaseUser);
            setUserSpaces(parsed.userSpaces || []);
            setStatus('authenticated');
        } catch (e) {
            localStorage.removeItem(LOCAL_STORAGE_KEY);
        }
    } else {
      setStatus('loading');
    }

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setFirebaseUser(user);
        const token = await user.getIdToken();
        document.cookie = `token=${token}; path=/; max-age=3600`;
        
        let userProfile = await getUser(user.uid);

        if (!userProfile) {
          const invite = user.email ? await getInvite(user.email) : null;

          const newUser: Omit<AppUser, 'id'> = {
            name: user.displayName || 'New User',
            email: user.email!,
            avatarUrl: user.photoURL || `https://placehold.co/100x100.png?text=${user.displayName?.[0] || 'U'}`,
          };
          userProfile = await addUser(newUser, user.uid);

          if (invite) {
             const batch = writeBatch(db);
             for (const spaceId of invite.spaces) {
               const spaceRef = doc(db, 'spaces', spaceId);
               batch.update(spaceRef, {
                 [`members.${userProfile.id}`]: { role: invite.role }
               });
             }
             await batch.commit();
             await deleteInvite(invite.email);
          } else {
             const personalSpace = {
              name: `${userProfile.name}'s Space`,
              members: { [userProfile.id]: { role: 'Admin' as const, permissions: {} } },
              statuses: [
                { name: 'Backlog', color: '#6b7280' },
                { name: 'In Progress', color: '#3b82f6' },
                { name: 'Review', color: '#f59e0b' },
                { name: 'Done', color: '#22c55e' },
              ]
            };
            await addSpace(personalSpace);
          }
        }
        
        const spaces = await getSpacesForUser(userProfile.id);
        setUserSpaces(spaces);
        setAppUser(userProfile);
        
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify({ appUser: userProfile, firebaseUser: user, userSpaces: spaces }));
        setStatus('authenticated');

      } else {
        setFirebaseUser(null);
        setAppUser(null);
        setUserSpaces([]);
        localStorage.removeItem(LOCAL_STORAGE_KEY);
        document.cookie = 'token=; Max-Age=0; path=/;';
        setStatus('unauthenticated');
      }
    });

    return () => unsubscribe();
  }, []);

  const handleSignOut = async () => {
    await firebaseSignOut(auth);
    setAppUser(null);
    setFirebaseUser(null);
    setUserSpaces([]);
    localStorage.removeItem(LOCAL_STORAGE_KEY);
    document.cookie = 'token=; Max-Age=0; path=/;';
    setStatus('unauthenticated');
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
