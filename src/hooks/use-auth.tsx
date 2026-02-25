'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import { User as AppUser, Space, SpaceMember, Invite, Hub } from '@/lib/data';
import { onAuthStateChanged, User as FirebaseUser, signOut as firebaseSignOut, signInWithPopup, createUserWithEmailAndPassword, signInWithEmailAndPassword as firebaseSignIn, updateProfile } from 'firebase/auth';
import { auth, googleProvider } from '@/lib/firebase';
import { getUser, addUser, addSpace, getSpacesForUser, seedDatabase, updateUser, subscribeToUserSpaces } from '@/lib/db';
import { useRouter } from 'next/navigation';


type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

const LOCAL_STORAGE_KEY_USER = 'timeflow_user_v3';
const LOCAL_STORAGE_KEY_ACTIVE_SPACE = 'timeflow_active_space_v2';
const LOCAL_STORAGE_KEY_ACTIVE_HUB = 'timeflow_active_hub_v2';

interface AuthContextType {
  firebaseUser: FirebaseUser | null;
  appUser: AppUser | null;
  status: AuthStatus;
  setAppUser: React.Dispatch<React.SetStateAction<AppUser | null>>;
  signOut: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signUpWithEmailAndPassword: (name: string, email: string, password: string) => Promise<void>;
  signInWithEmailAndPassword: (email: string, password: string) => Promise<void>;
  userSpaces: Space[];
  setUserSpaces: React.Dispatch<React.SetStateAction<Space[]>>;
  activeSpace: Space | null;
  setActiveSpace: (space: Space | null) => void;
  activeHub: Hub | null;
  setActiveHub: (hub: Hub | null) => void;
  getUserPermissions: (spaceId: string) => SpaceMember | null;
  isUserAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [userSpaces, setUserSpaces] = useState<Space[]>([]);
  const [activeSpace, _setActiveSpace] = useState<Space | null>(null);
  const [activeHub, _setActiveHub] = useState<Hub | null>(null);
  const [isUserAdmin, setIsUserAdmin] = useState(false);
  
  const spacesUnsubRef = useRef<(() => void) | null>(null);

  const setActiveSpace = (space: Space | null) => {
    _setActiveSpace(space);
    if (space) {
        localStorage.setItem(LOCAL_STORAGE_KEY_ACTIVE_SPACE, JSON.stringify(space));
    } else {
        localStorage.removeItem(LOCAL_STORAGE_KEY_ACTIVE_SPACE);
    }
  }

  const setActiveHub = (hub: Hub | null) => {
    _setActiveHub(hub);
    if (hub) {
        localStorage.setItem(LOCAL_STORAGE_KEY_ACTIVE_HUB, JSON.stringify(hub));
    } else {
        localStorage.removeItem(LOCAL_STORAGE_KEY_ACTIVE_HUB);
    }
  }


  useEffect(() => {
    seedDatabase();
    try {
        const cachedUser = localStorage.getItem(LOCAL_STORAGE_KEY_USER);
        const cachedSpace = localStorage.getItem(LOCAL_STORAGE_KEY_ACTIVE_SPACE);
        const cachedHub = localStorage.getItem(LOCAL_STORAGE_KEY_ACTIVE_HUB);

        if (cachedUser) {
            const parsed = JSON.parse(cachedUser);
            setAppUser(parsed.appUser);
            setFirebaseUser(parsed.firebaseUser);
            setUserSpaces(parsed.userSpaces || []);
            setStatus('authenticated');
        }
        if (cachedSpace) {
            _setActiveSpace(JSON.parse(cachedSpace));
        }
        if (cachedHub) {
            _setActiveHub(JSON.parse(cachedHub));
        }
    } catch (e) {
        localStorage.removeItem(LOCAL_STORAGE_KEY_USER);
        localStorage.removeItem(LOCAL_STORAGE_KEY_ACTIVE_SPACE);
        localStorage.removeItem(LOCAL_STORAGE_KEY_ACTIVE_HUB);
    }

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setFirebaseUser(user);
        const token = await user.getIdToken();
        document.cookie = `token=${token}; path=/; max-age=3600`;
        
        let userProfile = await getUser(user.uid);

        if (!userProfile) {
          const newUser: Omit<AppUser, 'id'> = {
            name: user.displayName || 'New User',
            email: user.email!,
            avatarUrl: user.photoURL || `https://placehold.co/100x100.png?text=${user.displayName?.[0] || 'U'}`,
            role: 'Admin', // Default global role
            onboardingComplete: false,
          };
          userProfile = await addUser(newUser, user.uid);
          
          const systemSpace: Omit<Space, 'id'> = {
            name: "Getting Started",
            members: { [userProfile.id]: { role: 'Admin' } },
            isSystem: true,
            isOnboarding: true,
          };
          await addSpace(systemSpace);
        }
        
        setAppUser(userProfile);

        // Setup real-time listener for spaces
        if (spacesUnsubRef.current) spacesUnsubRef.current();
        spacesUnsubRef.current = subscribeToUserSpaces(user.uid, (spaces) => {
            setUserSpaces(spaces);
            
            // Sync with current active space if its metadata changed
            _setActiveSpace(prev => {
                if (!prev) return null;
                const updated = spaces.find(s => s.id === prev.id);
                return updated || null;
            });

            // Update admin status
            const realSpaces = spaces.filter(s => !s.isSystem);
            const isAdminInAnySpace = realSpaces.some(s => s.members[userProfile!.id]?.role === 'Admin');
            setIsUserAdmin(isAdminInAnySpace);

            // Update cache
            localStorage.setItem(LOCAL_STORAGE_KEY_USER, JSON.stringify({ 
                appUser: userProfile, 
                firebaseUser: user, 
                userSpaces: spaces 
            }));
        });

        setStatus('authenticated');

      } else {
        setFirebaseUser(null);
        setAppUser(null);
        setUserSpaces([]);
        setActiveSpace(null);
        setActiveHub(null);
        setIsUserAdmin(false);
        if (spacesUnsubRef.current) spacesUnsubRef.current();
        spacesUnsubRef.current = null;
        localStorage.removeItem(LOCAL_STORAGE_KEY_USER);
        localStorage.removeItem(LOCAL_STORAGE_KEY_ACTIVE_SPACE);
        localStorage.removeItem(LOCAL_STORAGE_KEY_ACTIVE_HUB);
        document.cookie = 'token=; Max-Age=0; path=/;';
        setStatus('unauthenticated');
      }
    });

    return () => {
        unsubscribeAuth();
        if (spacesUnsubRef.current) spacesUnsubRef.current();
    };
  }, []);

  const handleSignOut = async () => {
    await firebaseSignOut(auth);
  };

  const signInWithGoogle = async () => {
    setStatus('loading');
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Error during Google Sign-In:", error);
      setStatus('unauthenticated');
    }
  };

  const signUpWithEmailAndPassword = async (name: string, email: string, password: string) => {
    setStatus('loading');
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(userCredential.user, { displayName: name });
    } catch (error) {
      console.error("Error during Email/Password Sign-Up:", error);
      setStatus('unauthenticated');
      throw error;
    }
  };

  const signInWithEmailAndPassword = async (email: string, password: string) => {
    setStatus('loading');
    try {
      await firebaseSignIn(auth, email, password);
    } catch (error) {
      console.error("Error during Email/Password Sign-In:", error);
      setStatus('unauthenticated');
      throw error;
    }
  };
  
  const getUserPermissions = (spaceId: string) => {
    const space = userSpaces.find(s => s.id === spaceId);
    if (!space || !appUser) return null;
    return space.members[appUser.id] || null;
  }

  const value: AuthContextType = {
    firebaseUser,
    appUser,
    status,
    setAppUser,
    signOut: handleSignOut,
    signInWithGoogle,
    signUpWithEmailAndPassword,
    signInWithEmailAndPassword,
    userSpaces,
    setUserSpaces,
    activeSpace,
    setActiveSpace,
    activeHub,
    setActiveHub,
    getUserPermissions,
    isUserAdmin,
  };

  return (
    <AuthContext.Provider value={value}>
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
