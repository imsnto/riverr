
'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { User as AppUser, users as mockUsers } from '@/lib/data';
import { getUserByEmail, addUser, getInvite, deleteInvite, updateUser, addMemberToSpaces } from '@/lib/db';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface AuthContextType {
  currentUser: AppUser | null;
  status: AuthStatus;
  setCurrentUser: React.Dispatch<React.SetStateAction<AppUser | null>>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');
  const router = useRouter();
  
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // User is signed in with Firebase, now verify with our DB
        try {
          // Check if user exists in our DB
          let appUser = await getUserByEmail(firebaseUser.email!);

          if (!appUser) {
            // If user doesn't exist, check for an invite or if they are a mock user
            const invite = await getInvite(firebaseUser.email!);
            const mockUser = mockUsers.find(u => u.email === firebaseUser.email!);
            
            const canBeCreated = invite || mockUser;

            if (canBeCreated) {
               const newUserInfo = invite || mockUser!;
               const newUser: Omit<AppUser, 'id'> = {
                 name: firebaseUser.displayName || newUserInfo.name || firebaseUser.email!,
                 email: firebaseUser.email!,
                 role: newUserInfo.role,
                 slack_id: newUserInfo.slack_id || '',
                 avatarUrl: firebaseUser.photoURL || `https://placehold.co/100x100?text=${firebaseUser.email![0].toUpperCase()}`,
               };
               appUser = await addUser(newUser);
              
               if(invite) {
                 await addMemberToSpaces(invite.spaces, appUser.id);
                 await deleteInvite(firebaseUser.email!);
               }
            }
          }

          if (appUser) {
             // Sync display name and avatar from Google if they've changed
            if ((firebaseUser.displayName && firebaseUser.displayName !== appUser.name) || (firebaseUser.photoURL && firebaseUser.photoURL !== appUser.avatarUrl)) {
                const updatedInfo = {
                    name: firebaseUser.displayName || appUser.name,
                    avatarUrl: firebaseUser.photoURL || appUser.avatarUrl
                };
                await updateUser(appUser.id, updatedInfo);
                appUser = { ...appUser, ...updatedInfo };
            }
            setCurrentUser(appUser);
            setStatus('authenticated');
          } else {
            // User is authenticated with Firebase, but not authorized in our system
            await auth.signOut();
            setCurrentUser(null);
            setStatus('unauthenticated');
            router.push('/login?error=' + encodeURIComponent('You are not an authorized user. Please contact an administrator to get access.'));
          }
        } catch (error) {
          console.error("Authentication error during DB check:", error);
          await auth.signOut();
          setCurrentUser(null);
          setStatus('unauthenticated');
        }
      } else {
        // No firebase user is signed in
        setCurrentUser(null);
        setStatus('unauthenticated');
      }
    });

    return () => unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AuthContext.Provider value={{ currentUser, status, setCurrentUser }}>
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
