
'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';
import { User as AppUser } from '@/lib/data';
import { User as FirebaseUser } from 'firebase/auth';

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface AuthContextType {
  firebaseUser: FirebaseUser | null;
  appUser: AppUser | null;
  status: AuthStatus;
  setAppUser: React.Dispatch<React.SetStateAction<AppUser | null>>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// A mock user object for 'brad@riverr.app'
const MOCK_APP_USER: AppUser = {
  id: 'user-1',
  name: 'Brad',
  email: 'brad@riverr.app',
  role: 'Admin',
  slack_id: 'U12345',
  avatarUrl: 'https://placehold.co/100x100',
};

// A mock Firebase user object
const MOCK_FIREBASE_USER: FirebaseUser = {
    uid: 'mock-firebase-uid',
    email: 'brad@riverr.app',
    displayName: 'Brad',
    photoURL: 'https://placehold.co/100x100',
    emailVerified: true,
    isAnonymous: false,
    metadata: {},
    providerData: [],
    providerId: 'google.com',
    tenantId: null,
    delete: async () => {},
    getIdToken: async () => 'mock-token',
    getIdTokenResult: async () => ({
        token: 'mock-token',
        expirationTime: '',
        authTime: '',
        issuedAtTime: '',
        signInProvider: null,
        signInSecondFactor: null,
        claims: {}
    }),
    reload: async () => {},
    toJSON: () => ({}),
};


export const AuthProvider = ({ children }: { children: ReactNode }) => {
  // Default state is authenticated with the mock user.
  const [appUser, setAppUser] = useState<AppUser | null>(MOCK_APP_USER);
  
  const handleSignOut = async () => {
    // In this mocked setup, signing out doesn't do anything.
    console.log("Signing out...");
  }

  return (
    <AuthContext.Provider value={{ 
        firebaseUser: MOCK_FIREBASE_USER, 
        appUser: appUser, 
        status: 'authenticated', 
        setAppUser, 
        signOut: handleSignOut 
    }}>
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
