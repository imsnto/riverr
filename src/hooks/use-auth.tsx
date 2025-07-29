
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
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (user) {
        // User is signed in with Firebase, now check our app's database
        try {
          let appUser = await getUserByEmail(user.email!);

          if (!appUser && user.email === 'brad@riverr.app') {
            const newUserInfo: Omit<AppUser, 'id'> = {
              name: user.displayName || 'Brad',
              email: user.email!,
              role: 'Admin',
              slack_id: 'U12345',
              avatarUrl: user.photoURL || `https://placehold.co/100x100?text=B`,
            };
            appUser = await addUser(newUserInfo);
          }
          
          if (appUser) {
            setCurrentUser(appUser);
            setStatus('authenticated');
          } else {
             // If user is not in DB and not the default admin, they are not authorized.
             await auth.signOut();
             setCurrentUser(null);
             setStatus('unauthenticated');
          }
        } catch (error) {
          console.error("Auth error:", error);
          await auth.signOut();
          setCurrentUser(null);
          setStatus('unauthenticated');
        }
      } else {
        // No user is signed in with Firebase
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
