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
}

const AuthContext = createContext<AuthContextType>({
  currentUser: null,
  firebaseUser: null,
  loading: true,
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setFirebaseUser(user);
        const appUser = users.find(u => u.email.toLowerCase() === user.email?.toLowerCase());
        if (appUser) {
           setCurrentUser(appUser);
        } else {
           setCurrentUser(null);
        }
      } else {
        setFirebaseUser(null);
        setCurrentUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!loading && !firebaseUser && pathname !== '/login') {
      router.push('/login');
    }
  }, [loading, firebaseUser, pathname, router]);

  return (
    <AuthContext.Provider value={{ currentUser, firebaseUser, loading }}>
      {loading ? <div className="flex h-screen items-center justify-center">Authenticating...</div> : children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);