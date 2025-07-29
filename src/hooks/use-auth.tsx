
'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { User as AppUser } from '@/lib/data';
import { getUser, addUser } from '@/lib/db';
import { users as mockUsers } from '@/lib/data';

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface AuthContextType {
  firebaseUser: FirebaseUser | null;
  appUser: AppUser | null;
  status: AuthStatus;
  setAppUser: React.Dispatch<React.SetStateAction<AppUser | null>>;
  signOut: () => Promise<void>;
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
        // This is the key change: We only attempt to get the app user *after* onAuthStateChanged has given us a user.
        try {
            let appUserDoc = await getUser(user.uid);

            if (!appUserDoc) {
                // If user is not in DB, check if they are an authorized mock user
                const mockUser = mockUsers.find(u => u.email === user.email);
                if (mockUser) {
                    console.log("Creating new user from mock data in AuthProvider");
                    const newUserInfo: Omit<AppUser, 'id'> = {
                        name: user.displayName || 'New User',
                        email: user.email!,
                        role: mockUser.role,
                        slack_id: '',
                        avatarUrl: user.photoURL || `https://placehold.co/100x100.png`,
                    };
                    appUserDoc = await addUser(newUserInfo, user.uid);
                }
            }
            
            if (appUserDoc) {
                setAppUser(appUserDoc);
                setStatus('authenticated');
            } else {
                // This case means the user signed in with Google but is not in our mock data.
                console.error("Unauthorized user:", user.email);
                await auth.signOut(); // Sign them out
                setAppUser(null);
                setFirebaseUser(null);
                setStatus('unauthenticated');
            }
        } catch (error) {
            console.error("Error fetching user data, client might be offline or other issues.", error);
            // We'll treat this as a loading state for now, maybe retry logic is needed for production
            // For now, let's just log it and stay in 'loading' or go to 'unauthenticated'
             await auth.signOut();
             setAppUser(null);
             setFirebaseUser(null);
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
    await auth.signOut();
    // State will be updated by the onAuthStateChanged listener
  }

  return (
    <AuthContext.Provider value={{ firebaseUser, appUser, status, setAppUser, signOut: handleSignOut }}>
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
