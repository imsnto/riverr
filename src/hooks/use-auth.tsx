
'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { User as AppUser, users as mockUsers } from '@/lib/data';
import { getUserByEmail, addUser, getInvite, deleteInvite, updateUser, addMemberToSpaces } from '@/lib/db';

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
        try {
          // Check if user exists in our DB
          let appUser = await getUserByEmail(firebaseUser.email!);

          // If not, check for an invite or if they are a mock user
          if (!appUser) {
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

          // If we have an app user (either found or created), they are authenticated
          if (appUser) {
             // Sync display name and avatar from Google if they've changed
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
            // No user in DB and no invite/mock data means they are not authorized
            await auth.signOut(); // Sign them out of firebase
            setCurrentUser(null);
            setStatus('unauthenticated');
          }
        } catch (error) {
          console.error("Authentication error:", error);
          await auth.signOut();
          setCurrentUser(null);
          setStatus('unauthenticated');
        }
      } else {
        // No firebase user
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
