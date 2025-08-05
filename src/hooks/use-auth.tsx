
'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User as AppUser } from '@/lib/data';
import { onAuthStateChanged, User as FirebaseUser, signOut as firebaseSignOut, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth, db, googleProvider } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { getUser, addUser, getInvite, deleteInvite, addMemberToSpaces, getPreApprovedUser, deletePreApprovedUser } from '@/lib/db';

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
    const cachedUser = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (cachedUser) {
      try {
        const parsedUser = JSON.parse(cachedUser);
        setAppUser(parsedUser);
        setStatus('authenticated');
      } catch (e) {
        console.error("Failed to parse cached user", e);
        localStorage.removeItem(LOCAL_STORAGE_KEY);
      }
    }

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (user) {
        const token = await user.getIdToken();
        document.cookie = `token=${token}; path=/; max-age=3600`;

        const userProfile = await getUser(user.uid);
        if (userProfile) {
          setAppUser(userProfile);
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(userProfile));
        } else {
          // This case handles when the user is authenticated with Firebase,
          // but their profile creation might have been interrupted or they were deleted.
          // It's safer to sign them out to force the profile creation flow again.
          // The signInWithGoogle logic will handle creating the user profile properly.
        }
        setStatus('authenticated');
      } else {
        setFirebaseUser(null);
        setAppUser(null);
        localStorage.removeItem(LOCAL_STORAGE_KEY);
        document.cookie = 'token=; Max-Age=0; path=/;';
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
  };

  const signInWithGoogle = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      const email = user.email;

      if (!email) {
        throw new Error("No email associated with this Google account.");
      }

      let userProfile = await getUser(user.uid);

      if (!userProfile) {
        const preApprovedUser = await getPreApprovedUser(email);
        
        if (!preApprovedUser) {
          const invite = await getInvite(email);
          if (!invite) {
            await firebaseSignOut(auth);
            alert("You are not authorized to use this platform. Please contact an admin.");
            return;
          }
          // If they have an old invite, we can proceed, but the pre-approved flow is preferred
        }

        const authSource = preApprovedUser || await getInvite(email);

        if (!authSource) {
           await firebaseSignOut(auth);
           alert("You are not authorized to use this platform. Please contact an admin.");
           return;
        }

        const newUser: Omit<AppUser, 'id'> = {
          name: user.displayName || 'New User',
          email,
          role: authSource.role,
          slack_id: '',
          avatarUrl: user.photoURL || `https://placehold.co/100x100.png?text=${user.displayName?.[0] || 'U'}`,
        };

        userProfile = await addUser(newUser, user.uid);
        await addMemberToSpaces(authSource.spaces, user.uid);
        
        // Clean up the pre-approval/invite records
        if (preApprovedUser) await deletePreApprovedUser(email);
        else await deleteInvite(email);
      }

      const token = await user.getIdToken();
      document.cookie = `token=${token}; path=/; max-age=3600`;

      // Explicitly set user state to prevent race conditions
      setFirebaseUser(user);
      setAppUser(userProfile);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(userProfile));
      setStatus('authenticated');

    } catch (error) {
      console.error("Error during Google Sign-In:", error);
      // Don't alert here, just log and set to unauthenticated
      setStatus('unauthenticated');
    }
  };

  const isAdmin = !!appUser && appUser.role === 'Admin';

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
