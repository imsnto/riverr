
'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User as AppUser } from '@/lib/data';
import { onAuthStateChanged, User as FirebaseUser, signOut as firebaseSignOut, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth, db, googleProvider } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { getUser, addUser, getInvite, deleteInvite, addMemberToSpaces } from '@/lib/db';

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface AuthContextType {
  firebaseUser: FirebaseUser | null;
  appUser: AppUser | null;
  status: AuthStatus;
  setAppUser: React.Dispatch<React.SetStateAction<AppUser | null>>;
  signOut: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');
  
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setFirebaseUser(user);
        let userProfile = await getUser(user.uid);
        
        if (!userProfile) {
          // This is a new user, check for an invite
          const invite = user.email ? await getInvite(user.email) : null;
          const newUser: Omit<AppUser, 'id'> = {
            name: user.displayName || 'New User',
            email: user.email!,
            role: invite ? invite.role : 'Member', // Default to 'Member' if no invite
            slack_id: '',
            avatarUrl: user.photoURL || `https://placehold.co/100x100?text=${user.displayName?.[0] || 'U'}`,
          };
          userProfile = await addUser(newUser, user.uid);

          if (invite) {
            await addMemberToSpaces(invite.spaces, user.uid);
            await deleteInvite(invite.email);
          }
        }

        setAppUser(userProfile);
        setStatus('authenticated');
      } else {
        setFirebaseUser(null);
        setAppUser(null);
        setStatus('unauthenticated');
      }
    });
    return () => unsubscribe();
  }, []);

  const handleSignOut = async () => {
    await firebaseSignOut(auth);
  }

  const signInWithGoogle = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Error signing in with Google: ", error);
    }
  };

  return (
    <AuthContext.Provider value={{ firebaseUser, appUser, status, setAppUser, signOut: handleSignOut, signInWithGoogle }}>
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
