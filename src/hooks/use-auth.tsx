
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
        // This is for returning users.
        const userProfile = await getUser(user.uid);
        if (userProfile) {
          setAppUser(userProfile);
          setStatus('authenticated');
        } else {
          // If the user is authenticated with Firebase but has no profile in our DB,
          // it's an inconsistent state. This can happen if the DB entry was deleted
          // manually. Signing them out is the safest course of action.
           setStatus('loading'); // Stay in loading while we decide
           const invite = user.email ? await getInvite(user.email) : null;
           if (invite) {
             // This is a new user signing up who was invited.
             await signInWithGoogle(true); // pass a flag to indicate this is part of the initial check
           } else {
             // A returning user with no DB record and no invite. Sign them out.
             console.warn("User exists in Firebase Auth but not in DB. Forcing sign-out.");
             await firebaseSignOut(auth);
             setStatus('unauthenticated');
           }
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
  }

  const signInWithGoogle = async (isInitialCheck = false) => {
    try {
      // If called from the onAuthStateChanged listener, we don't need to show the popup again.
      const result = isInitialCheck && auth.currentUser 
        ? { user: auth.currentUser } 
        : await signInWithPopup(auth, googleProvider);
        
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
      // Don't set to unauthenticated if the popup is closed by the user
      // This check might need to be more sophisticated based on error codes
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
