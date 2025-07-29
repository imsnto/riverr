
'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { User as AppUser } from '@/lib/data';
import { getUserByEmail, addUser } from '@/lib/db';

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface AuthContextType {
  currentUser: AppUser | null;
  firebaseUser: FirebaseUser | null;
  status: AuthStatus;
  setCurrentUser: React.Dispatch<React.SetStateAction<AppUser | null>>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');
  
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      setFirebaseUser(fbUser);
      if (fbUser) {
        try {
          // Check if user exists in our DB
          let appUser = await getUserByEmail(fbUser.email!);
          
          if (!appUser && fbUser.email === 'brad@riverr.app') {
            // If it's the default user, create them
            const newUserInfo: Omit<AppUser, 'id'> = {
              name: fbUser.displayName || 'Brad',
              email: fbUser.email!,
              role: 'Admin',
              slack_id: 'U12345',
              avatarUrl: fbUser.photoURL || `https://placehold.co/100x100?text=B`,
            };
            appUser = await addUser(newUserInfo);
          }

          if (appUser) {
            setCurrentUser(appUser);
            setStatus('authenticated');
          } else {
            // This is a valid Firebase user, but not in our app's DB
            // and not the default admin. We should sign them out.
            await auth.signOut();
            setCurrentUser(null);
            setFirebaseUser(null);
            setStatus('unauthenticated');
          }
        } catch (error) {
           console.error("Error during auth state change:", error);
           await auth.signOut();
           setCurrentUser(null);
           setFirebaseUser(null);
           setStatus('unauthenticated');
        }
      } else {
        // No firebase user
        setCurrentUser(null);
        setStatus('unauthenticated');
      }
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ currentUser, firebaseUser, status, setCurrentUser }}>
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
