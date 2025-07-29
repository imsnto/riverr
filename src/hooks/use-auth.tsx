
'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { User as AppUser } from '@/lib/data';
import { getUserByEmail, addUser } from '@/lib/db';
import { useRouter } from 'next/navigation';

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface AuthContextType {
  currentUser: AppUser | null;
  status: AuthStatus;
  setCurrentUser: React.Dispatch<React.SetStateAction<AppUser | null>>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');
  const router = useRouter();
  
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // User is signed in with Firebase, now verify with our DB
        try {
          let appUser = await getUserByEmail(firebaseUser.email!);

          if (!appUser) {
            // If user doesn't exist, check if it's our default user.
            if (firebaseUser.email === 'brad@riverr.app') {
               const newUserInfo: Omit<AppUser, 'id'> = {
                 name: firebaseUser.displayName || 'Brad',
                 email: firebaseUser.email,
                 role: 'Admin',
                 slack_id: 'U12345',
                 avatarUrl: firebaseUser.photoURL || `https://placehold.co/100x100?text=B`,
               };
               appUser = await addUser(newUserInfo);
            }
          }

          if (appUser) {
            setCurrentUser(appUser);
            setStatus('authenticated');
          } else {
            await auth.signOut();
            setCurrentUser(null);
            setStatus('unauthenticated');
            router.push('/login?error=' + encodeURIComponent('You are not an authorized user.'));
          }
        } catch (error) {
          console.error("Authentication error:", error);
          await auth.signOut();
          setCurrentUser(null);
          setStatus('unauthenticated');
        }
      } else {
        // No firebase user is signed in
        setCurrentUser(null);
        setStatus('unauthenticated');
      }
    });

    return () => unsubscribe();
  }, [router]);

  return (
    <AuthContext.Provider value={{ currentUser, status, setCurrentUser }}>
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
