
'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { User as AppUser, users as mockUsers } from '@/lib/data';
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
  const router = useRouter();
  
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          let appUser = await getUserByEmail(firebaseUser.email!);

          if (!appUser) {
            // User not in DB, check for invite or if they are a mock user
            const invite = await getInvite(firebaseUser.email!);
            const mockUser = mockUsers.find(u => u.email === firebaseUser.email!);
            
            if (invite || mockUser) {
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
            // If we found or created a user, update their details from Google if needed
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
             // No user, no invite. This is an unauthorized user.
            await auth.signOut();
            // Redirect happens in AuthGuard now to prevent races
          }
        } catch (error) {
          console.error("Auth error:", error);
          await auth.signOut();
          setStatus('unauthenticated');
        }
      } else {
        // No user is signed in to Firebase
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
