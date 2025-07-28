
// src/hooks/use-auth.tsx
'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { users, User as AppUser } from '@/lib/data';
import { usePathname, useRouter } from 'next/navigation';

interface AuthContextType {
  currentUser: AppUser | null;
  firebaseUser: FirebaseUser | null;
  loading: boolean;
  setCurrentUser: React.Dispatch<React.SetStateAction<AppUser | null>>;
}

const AuthContext = createContext<AuthContextType>({
  currentUser: null,
  firebaseUser: null,
  loading: true,
  setCurrentUser: () => {},
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      if (user) {
        const appUser = users.find(u => u.email.toLowerCase() === user.email?.toLowerCase());
        if (appUser) {
           setCurrentUser(appUser);
        } else {
           setCurrentUser(null);
        }
      } else {
        setCurrentUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!loading && !currentUser && pathname !== '/login') {
      router.push('/login');
    }
  }, [loading, currentUser, pathname, router]);

  useEffect(() => {
    if (firebaseUser && currentUser) {
      const googleName = firebaseUser.displayName;
      const googleAvatar = firebaseUser.photoURL;
      
      const needsUpdate = (googleName && googleName !== currentUser.name) || (googleAvatar && googleAvatar !== currentUser.avatarUrl);

      if (needsUpdate) {
        setCurrentUser(prevUser => {
          if (!prevUser) return null;
          return {
            ...prevUser,
            name: googleName || prevUser.name,
            avatarUrl: googleAvatar || prevUser.avatarUrl,
          };
        });
      }
    }
  }, [firebaseUser, currentUser]);

  return (
    <AuthContext.Provider value={{ currentUser, firebaseUser, loading, setCurrentUser }}>
      {loading ? <div className="flex h-screen items-center justify-center">Authenticating...</div> : children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
