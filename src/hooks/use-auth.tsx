
'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { User as AppUser } from '@/lib/data';
import { getUser, addUser, getInvite, deleteInvite, addMemberToSpaces } from '@/lib/db';
import { useRouter } from 'next/navigation';

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
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setFirebaseUser(user);
        let appUserDoc = await getUser(user.uid);

        if (!appUserDoc && user.email) {
            const invite = await getInvite(user.email);
            if (invite) {
                const newUser: Omit<User, 'id'> = {
                    name: user.displayName || 'New User',
                    email: user.email,
                    avatarUrl: user.photoURL || `https://placehold.co/100x100.png`,
                    role: invite.role,
                    slack_id: '',
                };
                appUserDoc = await addUser(newUser, user.uid);
                await addMemberToSpaces(invite.spaces, user.uid);
                await deleteInvite(user.email);
            }
        }
        
        if (appUserDoc) {
            setAppUser(appUserDoc);
            setStatus('authenticated');
        } else {
            // No app user doc and no invite, treat as unauthorized
            await auth.signOut();
            setFirebaseUser(null);
            setAppUser(null);
            setStatus('unauthenticated');
            router.push('/login?error=' + encodeURIComponent('You are not authorized to access this application.'));
        }

      } else {
        setFirebaseUser(null);
        setAppUser(null);
        setStatus('unauthenticated');
      }
    });

    return () => unsubscribe();
  }, [router]);

  const handleSignOut = async () => {
    await auth.signOut();
    router.push('/login');
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
