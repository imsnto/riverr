// src/hooks/use-auth.tsx
'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { auth, signOut } from '@/lib/firebase';
import { User as AppUser, Invite } from '@/lib/data';
import { getUserByEmail, addUser, getInvite, deleteInvite, updateSpace } from '@/lib/db';
import { usePathname, useRouter } from 'next/navigation';

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface AuthContextType {
  currentUser: AppUser | null;
  firebaseUser: FirebaseUser | null;
  status: AuthStatus;
  setCurrentUser: React.Dispatch<React.SetStateAction<AppUser | null>>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (user && user.email) {
        let appUser = await getUserByEmail(user.email);

        if (appUser) {
          // User exists in DB
          const googleName = user.displayName;
          const googleAvatar = user.photoURL;
          let userChanged = false;

          if (googleName && googleName !== appUser.name) {
            appUser.name = googleName;
            userChanged = true;
          }
          if (googleAvatar && googleAvatar !== appUser.avatarUrl) {
            appUser.avatarUrl = googleAvatar;
            userChanged = true;
          }

          setCurrentUser(appUser);
          if (userChanged) {
            // In a real app, you would update the user document in the DB here
          }
          setStatus('authenticated');
        } else {
          // User does not exist in DB, check for an invite
          const invite = await getInvite(user.email);
          if(invite) {
            // Create user from invite
            const newUser: Omit<User, 'id'> = {
              name: user.displayName || user.email.split('@')[0],
              email: user.email,
              role: invite.role,
              slack_id: '',
              avatarUrl: user.photoURL || `https://placehold.co/100x100?text=${user.email[0].toUpperCase()}`,
            };
            const createdUser = await addUser(newUser);
            
            // Add user to invited spaces
            for (const spaceId of invite.spaces) {
                // This part needs a proper implementation of adding a member to a space in the db
                // For now, we assume it's handled or we can add a db function for it.
            }
            
            await deleteInvite(user.email);
            setCurrentUser(createdUser);
            setStatus('authenticated');

          } else {
             // Not in DB and not invited
            setCurrentUser(null);
            setStatus('unauthenticated');
            await signOut(auth);
          }
        }
      } else {
        // No firebase user
        setCurrentUser(null);
        setStatus('unauthenticated');
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (status === 'unauthenticated' && pathname !== '/login') {
      router.push('/login');
    }
    if (status === 'authenticated' && pathname === '/login') {
      router.push('/');
    }
  }, [status, pathname, router]);

  const value = { currentUser, firebaseUser, status, setCurrentUser };
  
  if (status === 'loading') {
    return <div className="flex h-screen items-center justify-center">Authenticating...</div>
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
