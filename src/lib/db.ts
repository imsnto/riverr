
// src/lib/db.ts
import {
  getFirestore,
  collection,
  getDocs,
  doc,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  query,
  where,
  deleteDoc,
  writeBatch,
  arrayUnion
} from 'firebase/firestore';
import { auth } from './firebase';
import { Space, User, Project, Task, TimeEntry, SlackMeetingLog, Invite } from './data';

const db = getFirestore();

// --- User Management ---
export const getUser = async (userId: string): Promise<User | null> => {
  const userDoc = await getDoc(doc(db, 'users', userId));
  return userDoc.exists() ? ({ id: userDoc.id, ...userDoc.data() } as User) : null;
};

export const getUserByEmail = async (email: string): Promise<User | null> => {
    const q = query(collection(db, 'users'), where('email', '==', email));
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
        const userDoc = querySnapshot.docs[0];
        return { id: userDoc.id, ...userDoc.data() } as User;
    }
    return null;
}

export const addUser = async (user: Omit<User, 'id'>, uid: string): Promise<User> => {
  const userRef = doc(db, 'users', uid);
  await setDoc(userRef, user);
  const newUserDoc = await getDoc(userRef);
  return { id: newUserDoc.id, ...newUserDoc.data() } as User;
};

export const updateUser = async (userId: string, data: Partial<User>): Promise<void> => {
    await updateDoc(doc(db, 'users', userId), data);
}

// --- Invite Management ---
export const addInvite = async (invite: Invite): Promise<void> => {
    const inviteRef = doc(db, 'invites', invite.email);
    await setDoc(inviteRef, invite);
}

export const getInvite = async(email: string): Promise<Invite | null> => {
    const inviteDoc = await getDoc(doc(db, 'invites', email));
    return inviteDoc.exists() ? inviteDoc.data() as Invite : null;
}

export const deleteInvite = async (email: string): Promise<void> => {
    await deleteDoc(doc(db, 'invites', email));
}


// --- Space Management ---
export const getSpacesForUser = async (userId: string): Promise<Space[]> => {
  const q = query(collection(db, 'spaces'), where('members', 'array-contains', userId));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Space));
};

export const getAllSpaces = async (): Promise<Space[]> => {
    const querySnapshot = await getDocs(collection(db, 'spaces'));
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Space));
}

export const addSpace = async (space: Omit<Space, 'id'>) => {
    const docRef = await addDoc(collection(db, "spaces"), space);
    return docRef.id;
}

export const updateSpace = async (spaceId: string, data: Partial<Space>): Promise<void> => {
    await updateDoc(doc(db, 'spaces', spaceId), data);
}

export const addMemberToSpaces = async (spaceIds: string[], userId: string): Promise<void> => {
    const batch = writeBatch(db);
    spaceIds.forEach(spaceId => {
        const spaceRef = doc(db, 'spaces', spaceId);
        batch.update(spaceRef, { members: arrayUnion(userId) });
    });
    await batch.commit();
}

export const deleteSpace = async (spaceId: string): Promise<void> => {
    await deleteDoc(doc(db, 'spaces', spaceId));
}

// --- Project Management ---
export const getProjectsInSpace = async (spaceId: string): Promise<Project[]> => {
    const q = query(collection(db, 'projects'), where('space_id', '==', spaceId));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Project));
}


// --- Task Management ---
export const getTasksInProject = async (projectId: string): Promise<Task[]> => {
    const q = query(collection(db, 'tasks'), where('project_id', '==', projectId));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task));
}

export const getTasksInSpace = async (projectIds: string[]): Promise<Task[]> => {
    if (projectIds.length === 0) return [];
    const q = query(collection(db, 'tasks'), where('project_id', 'in', projectIds));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task));
}

export const addTask = async (task: Omit<Task, 'id'>): Promise<Task> => {
    const docRef = await addDoc(collection(db, 'tasks'), task);
    return { id: docRef.id, ...task };
}

export const updateTask = async (taskId: string, data: Partial<Task>): Promise<void> => {
    await updateDoc(doc(db, 'tasks', taskId), data);
}

// --- Time Entry Management ---
export const getTimeEntriesInSpace = async (projectIds: string[]): Promise<TimeEntry[]> => {
    if (projectIds.length === 0) return [];
    const q = query(collection(db, 'time_entries'), where('project_id', 'in', projectIds));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TimeEntry));
}


// --- Slack Meeting Log Management ---
export const getSlackMeetingLogsInSpace = async (projectIds: string[]): Promise<SlackMeetingLog[]> => {
    if (projectIds.length === 0) return [];
    // This query needs to also fetch logs where project_id is null
    const logsWithProject = query(collection(db, 'slack_meeting_logs'), where('project_id', 'in', projectIds));
    const logsWithoutProject = query(collection(db, 'slack_meeting_logs'), where('project_id', '==', null));
    
    const [withProjectSnapshot, withoutProjectSnapshot] = await Promise.all([
      getDocs(logsWithProject),
      getDocs(logsWithoutProject)
    ]);
    
    const logs1 = withProjectSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SlackMeetingLog));
    const logs2 = withoutProjectSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SlackMeetingLog));

    return [...logs1, ...logs2];
}

// --- Generic User Data ---
export const getAllUsers = async (): Promise<User[]> => {
    const querySnapshot = await getDocs(collection(db, 'users'));
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
}
