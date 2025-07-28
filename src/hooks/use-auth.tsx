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
      setFirebaseUser(user);
      if (user) {
        // In a real app, you might fetch user profile from your database
        const appUser = users.find(u => u.email === user.email);
        
        // This is important: if the user is not in the system, we should treat them as not logged in
        if (appUser) {
           setCurrentUser(appUser);
        } else {
           // User is authenticated with Firebase but not in our system.
           // The login page will handle showing the error.
           // Here, we ensure they don't have access to the main app.
           setCurrentUser(null);
           if (pathname !== '/login') {
             router.push('/login');
           }
        }
      } else {
        setCurrentUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [pathname, router]);

  useEffect(() => {
    if (!loading && !firebaseUser && pathname !== '/login') {
      router.push('/login');
    }
  }, [loading, firebaseUser, pathname, router]);

  return (
    <AuthContext.Provider value={{ currentUser, firebaseUser, loading }}>
      {loading ? <div className="flex h-screen items-center justify-center">Loading...</div> : children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
