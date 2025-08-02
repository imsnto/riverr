
// src/lib/db.ts
import {
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
import { db } from './firebase';
import * as mockData from './data';

// --- User Management ---
export const getUser = async (userId: string): Promise<mockData.User | null> => {
  const userDoc = await getDoc(doc(db, 'users', userId));
  return userDoc.exists() ? ({ id: userDoc.id, ...userDoc.data() } as mockData.User) : null;
};

export const getUserByEmail = async (email: string): Promise<mockData.User | null> => {
    const q = query(collection(db, 'users'), where("email", "==", email));
    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) return null;
    const userDoc = querySnapshot.docs[0];
    return { id: userDoc.id, ...userDoc.data() } as mockData.User;
}

export const addUser = async (user: Omit<mockData.User, 'id'>, uid: string): Promise<mockData.User> => {
  const newUser = { ...user };
  await setDoc(doc(db, 'users', uid), newUser);
  return { ...newUser, id: uid };
};

export const updateUser = async (userId: string, data: Partial<mockData.User>): Promise<void> => {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, data);
}

// --- Invite Management ---
export const addInvite = async (invite: mockData.Invite): Promise<void> => {
    // Use the email as the document ID for easy lookup
    await setDoc(doc(db, 'invites', invite.email), invite);
}

export const getInvite = async(email: string): Promise<mockData.Invite | null> => {
    const inviteDoc = await getDoc(doc(db, 'invites', email));
    return inviteDoc.exists() ? (inviteDoc.data() as mockData.Invite) : null;
}

export const deleteInvite = async (email: string): Promise<void> => {
    await deleteDoc(doc(db, 'invites', email));
}


// --- Space Management ---
export const getSpacesForUser = async (userId: string): Promise<mockData.Space[]> => {
  const q = query(collection(db, 'spaces'), where('members', 'array-contains', userId));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as mockData.Space));
};

export const getAllSpaces = async (): Promise<mockData.Space[]> => {
    const querySnapshot = await getDocs(collection(db, 'spaces'));
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as mockData.Space));
}

export const addSpace = async (space: Omit<mockData.Space, 'id'>) => {
    const docRef = await addDoc(collection(db, 'spaces'), space);
    return docRef.id;
}

export const updateSpace = async (spaceId: string, data: Partial<mockData.Space>): Promise<void> => {
    const spaceRef = doc(db, 'spaces', spaceId);
    await updateDoc(spaceRef, data);
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
export const getProjectsInSpace = async (spaceId: string): Promise<mockData.Project[]> => {
    // This is a mock implementation
    return mockData.projects.filter(p => p.space_id === spaceId);
}


// --- Task Management ---
export const getTasksInProject = async (projectId: string): Promise<mockData.Task[]> => {
    // This is a mock implementation
    return mockData.tasks.filter(t => t.project_id === projectId);
}

export const getTasksInSpace = async (projectIds: string[]): Promise<mockData.Task[]> => {
    if (projectIds.length === 0) return [];
    // This is a mock implementation
    return mockData.tasks.filter(t => projectIds.includes(t.project_id));
}

export const addTask = async (task: Omit<mockData.Task, 'id'>): Promise<mockData.Task> => {
    const newTask = { ...task, id: `task-${Date.now()}`};
    mockData.tasks.push(newTask);
    return newTask;
}

export const updateTask = async (taskId: string, data: Partial<mockData.Task>): Promise<void> => {
    const taskIndex = mockData.tasks.findIndex(t => t.id === taskId);
    if(taskIndex !== -1) {
        mockData.tasks[taskIndex] = { ...mockData.tasks[taskIndex], ...data };
    }
}

// --- Time Entry Management ---
export const getTimeEntriesInSpace = async (projectIds: string[]): Promise<mockData.TimeEntry[]> => {
    if (projectIds.length === 0) return [];
    return mockData.timeEntries.filter(t => projectIds.includes(t.project_id));
}


// --- Slack Meeting Log Management ---
export const getSlackMeetingLogsInSpace = async (projectIds: string[]): Promise<mockData.SlackMeetingLog[]> => {
    // This logic needs to match the original, fetching logs with matching project_id OR where project_id is null
    const logsWithProject = mockData.slackMeetingLogs.filter(log => log.project_id && projectIds.includes(log.project_id));
    const logsWithoutProject = mockData.slackMeetingLogs.filter(log => log.project_id === null);
    
    return [...logsWithProject, ...logsWithoutProject];
}

// --- Channel & Message Management ---
export const getChannelsInSpace = async (spaceId: string): Promise<mockData.Channel[]> => {
    return mockData.channels.filter(c => c.space_id === spaceId);
}

export const getMessagesInChannel = async (channelId: string): Promise<mockData.Message[]> => {
    return mockData.messages.filter(m => m.channel_id === channelId);
}

export const addMessage = async(message: Omit<mockData.Message, 'id' | 'timestamp' | 'reactions' | 'reply_count'>): Promise<mockData.Message> => {
    const newMessage = { 
        ...message, 
        id: `msg-${Date.now()}`, 
        timestamp: new Date().toISOString(),
        reactions: [],
        reply_count: 0
    };
    mockData.messages.push(newMessage);
    return newMessage;
}

// --- Generic User Data ---
export const getAllUsers = async (): Promise<mockData.User[]> => {
    const querySnapshot = await getDocs(collection(db, 'users'));
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as mockData.User));
}
