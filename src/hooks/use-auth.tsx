
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
        const userProfile = await getUser(user.uid);
        if (userProfile) {
          setAppUser(userProfile);
          setStatus('authenticated');
        } else {
           // This can happen if the user exists in Firebase Auth but not in Firestore DB.
           // We will let signInWithGoogle handle the creation.
           // Setting status to unauthenticated will show the login page.
           setStatus('unauthenticated');
        }
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
    setFirebaseUser(null);
    setAppUser(null);
    setStatus('unauthenticated');
  }

  const signInWithGoogle = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      
      let userProfile = await getUser(user.uid);
      
      if (!userProfile) {
        const invite = user.email ? await getInvite(user.email) : null;
        
        const newUser: Omit<AppUser, 'id'> = {
          name: user.displayName || 'New User',
          email: user.email!,
          role: invite ? invite.role : 'Member',
          slack_id: '',
          avatarUrl: user.photoURL || `https://placehold.co/100x100?text=${user.displayName?.[0] || 'U'}`,
        };
        userProfile = await addUser(newUser, user.uid);

        if (invite) {
          await addMemberToSpaces(invite.spaces, user.uid);
          await deleteInvite(invite.email);
        }
      }
      
      setFirebaseUser(user);
      setAppUser(userProfile);
      setStatus('authenticated');

    } catch (error) {
      console.error("Error signing in with Google: ", error);
      if (status !== 'authenticated') {
          setStatus('unauthenticated');
      }
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

    