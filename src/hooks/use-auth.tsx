
'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User as AppUser } from '@/lib/data';
import { onAuthStateChanged, User as FirebaseUser, signOut as firebaseSignOut, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth, db, googleProvider } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { getUser, addUser, getInvite, deleteInvite, addMemberToSpaces } from '@/lib/db';

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

const LOCAL_STORAGE_KEY = 'timeflow_user';


interface AuthContextType {
  firebaseUser: FirebaseUser | null;
  appUser: AppUser | null;
  isAdmin: boolean;
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
    // Try to load user from localStorage on initial load
    const cachedUser = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (cachedUser) {
        try {
            const parsedUser = JSON.parse(cachedUser);
            setAppUser(parsedUser);
            setStatus('authenticated'); // Assume authenticated if cached, will be verified by onAuthStateChanged
        } catch (e) {
            console.error("Failed to parse cached user", e);
            localStorage.removeItem(LOCAL_STORAGE_KEY);
        }
    }

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (user) {
        // User is signed in, get their ID token and set it as a cookie
        const token = await user.getIdToken();
        document.cookie = `token=${token}; path=/; max-age=3600`; // 1 hour expiry

        const userProfile = await getUser(user.uid);
        if (userProfile) {
          setAppUser(userProfile);
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(userProfile));
        } else {
            // This case might happen if user exists in Auth but not Firestore. 
            // We'll let signInWithGoogle handle creation.
            // For an existing session, this could be an error state.
             await handleSignOut();
             return;
        }
        setStatus('authenticated');
      } else {
        // User is signed out
        setFirebaseUser(null);
        setAppUser(null);
        localStorage.removeItem(LOCAL_STORAGE_KEY);
        document.cookie = 'token=; Max-Age=0; path=/;'; // Clear cookie on sign out
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
    localStorage.removeItem(LOCAL_STORAGE_KEY);
    document.cookie = 'token=; Max-Age=0; path=/;';
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
          avatarUrl: user.photoURL || `https://placehold.co/100x100.png?text=${user.displayName?.[0] || 'U'}`,
        };
        userProfile = await addUser(newUser, user.uid);

        if (invite) {
          await addMemberToSpaces(invite.spaces, user.uid);
          await deleteInvite(invite.email);
        }
      }
      
      const token = await user.getIdToken();
      document.cookie = `token=${token}; path=/; max-age=3600`;

      setFirebaseUser(user);
      setAppUser(userProfile);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(userProfile));
      setStatus('authenticated');

    } catch (error) {
      console.error("Error signing in with Google: ", error);
      if (status !== 'authenticated') {
          setStatus('unauthenticated');
      }
    }
  };
  
  const isAdmin = !!appUser && (appUser.role === 'Admin');

  return (
    <AuthContext.Provider value={{ firebaseUser, appUser, isAdmin, status, setAppUser, signOut: handleSignOut, signInWithGoogle }}>
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
