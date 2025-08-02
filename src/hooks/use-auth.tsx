
'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User as AppUser } from '@/lib/data';
import { onAuthStateChanged, User as FirebaseUser, signOut as firebaseSignOut } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { getUser, addUser, getInvite, deleteInvite, addMemberToSpaces } from '@/lib/db';

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
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(MOCK_FIREBASE_USER);
  const [appUser, setAppUser] = useState<AppUser | null>(MOCK_APP_USER);
  const [status, setStatus] = useState<AuthStatus>('authenticated');
  
  // Commenting out real auth for now to keep using mock data
  // useEffect(() => {
  //   const unsubscribe = onAuthStateChanged(auth, async (user) => {
  //     if (user) {
  //       setFirebaseUser(user);
  //       let userProfile = await getUser(user.uid);
        
  //       if (!userProfile) {
  //         // This is a new user, check for an invite
  //         const invite = user.email ? await getInvite(user.email) : null;
  //         const newUser: Omit<AppUser, 'id'> = {
  //           name: user.displayName || 'New User',
  //           email: user.email!,
  //           role: invite ? invite.role : 'Member', // Default to 'Member' if no invite
  //           slack_id: '',
  //           avatarUrl: user.photoURL || `https://placehold.co/100x100?text=${user.displayName?.[0] || 'U'}`,
  //         };
  //         userProfile = await addUser(newUser, user.uid);

  //         if (invite) {
  //           await addMemberToSpaces(invite.spaces, user.uid);
  //           await deleteInvite(invite.email);
  //         }
  //       }

  //       setAppUser(userProfile);
  //       setStatus('authenticated');
  //     } else {
  //       setFirebaseUser(null);
  //       setAppUser(null);
  //       setStatus('unauthenticated');
  //     }
  //   });
  //   return () => unsubscribe();
  // }, []);

  const handleSignOut = async () => {
    // await firebaseSignOut(auth);
    // For now, just log to console
    console.log("Signing out...");
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
