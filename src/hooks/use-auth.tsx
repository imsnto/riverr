
'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User as AppUser } from '@/lib/data';
import { onAuthStateChanged, User as FirebaseUser, signOut as firebaseSignOut, signInWithPopup } from 'firebase/auth';
import { auth, db, googleProvider } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { getUser, addUser, addSpace } from '@/lib/db';

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

const LOCAL_STORAGE_KEY = 'timeflow_user_v2';

interface AuthContextType {
  firebaseUser: FirebaseUser | null;
  appUser: AppUser | null;
  status: AuthStatus;
  setAppUser: React.Dispatch<React.SetStateAction<AppUser | null>>;
  signOut: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  getUserPermissions: (spaceId: string) => { role: 'Admin' | 'Member', permissions: any } | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [userSpaces, setUserSpaces] = useState<any[]>([]);

  useEffect(() => {
    const cachedUser = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (cachedUser) {
        try {
            const parsed = JSON.parse(cachedUser);
            setAppUser(parsed.appUser);
            setFirebaseUser(parsed.firebaseUser);
            setStatus('authenticated');
        } catch (e) {
            localStorage.removeItem(LOCAL_STORAGE_KEY);
        }
    }

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setFirebaseUser(user);
        const token = await user.getIdToken();
        document.cookie = `token=${token}; path=/; max-age=3600`;
        
        let userProfile = await getUser(user.uid);

        if (!userProfile) {
          // If no profile, create one
          const newUser: Omit<AppUser, 'id'> = {
            name: user.displayName || 'New User',
            email: user.email!,
            avatarUrl: user.photoURL || `https://placehold.co/100x100.png?text=${user.displayName?.[0] || 'U'}`,
          };
          userProfile = await addUser(newUser, user.uid);

          // Create a personal space for the new user
          const newSpace = {
            name: `${userProfile.name}'s Space`,
            members: {
              [userProfile.id]: { role: 'Admin' }
            },
            statuses: [
              { name: 'Backlog', color: '#6b7280' },
              { name: 'In Progress', color: '#3b82f6' },
              { name: 'Review', color: '#f59e0b' },
              { name: 'Done', color: '#22c55e' },
            ]
          };
          await addSpace(newSpace);
        }
        
        setAppUser(userProfile);
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify({ appUser: userProfile, firebaseUser: user }));
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
  };

  const signInWithGoogle = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      // The onAuthStateChanged listener will handle the rest
    } catch (error) {
      console.error("Error during Google Sign-In:", error);
      setStatus('unauthenticated');
    }
  };

  const getUserPermissions = (spaceId: string) => {
    // This part is tricky without fetching spaces here.
    // This is a simplified placeholder. In a real app, you might fetch user's spaces
    // within the AuthProvider or have a separate hook for permissions.
    return null;
  }

  const value: AuthContextType = {
    firebaseUser,
    appUser,
    status,
    setAppUser,
    signOut: handleSignOut,
    signInWithGoogle,
    getUserPermissions,
    // A placeholder for isAdmin, true if user is admin in ANY space.
    // A more granular check should be used in components.
    get isAdmin() {
      // This is a simplification. A real app would need to check the active space.
      return true; 
    }
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

    