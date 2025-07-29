
'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { User as AppUser } from '@/lib/data';
import { getUserByEmail, addUser, getInvite, deleteInvite, updateUser, addMemberToSpaces } from '@/lib/db';
import { useRouter } from 'next/navigation';

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

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setStatus('loading');
        let appUser = await getUserByEmail(firebaseUser.email!);

        if (appUser) {
          const googleName = firebaseUser.displayName;
          const googleAvatar = firebaseUser.photoURL;
          let userChanged = false;

          if (googleName && googleName !== appUser.name) {
            appUser.name = googleName;
            userChanged = true;
          }
          if (googleAvatar && googleAvatar !== appUser.avatarUrl) {
            appUser.avatarUrl = googleAvatar;
            userChanged = true;
          }

          if (userChanged) {
            await updateUser(appUser.id, { name: appUser.name, avatarUrl: appUser.avatarUrl });
          }
          
          setCurrentUser(appUser);
          setStatus('authenticated');

        } else {
          const invite = await getInvite(firebaseUser.email!);
          if (invite) {
            const newUser: Omit<AppUser, 'id'> = {
              name: firebaseUser.displayName || firebaseUser.email!.split('@')[0],
              email: firebaseUser.email!,
              role: invite.role,
              slack_id: '',
              avatarUrl: firebaseUser.photoURL || `https://placehold.co/100x100?text=${firebaseUser.email![0].toUpperCase()}`,
            };
            const createdUser = await addUser(newUser);
            await addMemberToSpaces(invite.spaces, createdUser.id);
            await deleteInvite(firebaseUser.email!);
            
            setCurrentUser(createdUser);
            setStatus('authenticated');
          } else {
            await auth.signOut();
            setCurrentUser(null);
            setStatus('unauthenticated');
          }
        }
      } else {
        setCurrentUser(null);
        setStatus('unauthenticated');
      }
    });

    return () => unsubscribe();
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
