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
  arrayUnion,
  limit,
} from 'firebase/firestore';
import { db } from './firebase';
import { Space, User, Project, Task, TimeEntry, SlackMeetingLog, Channel, Message, users, spaces, projects, tasks, timeEntries, slackMeetingLogs, channels, messages } from './data';
import { randomBytes } from 'crypto';

// --- Seeding ---
export const seedDatabase = async () => {
    const usersRef = collection(db, 'users');
    const q = query(usersRef, limit(1));
    const snapshot = await getDocs(q);
    if (snapshot.empty) {
        console.log('Database is empty, seeding data...');
        const batch = writeBatch(db);
        
        // Let's create mock users with specific IDs for reproducible seeding
        const userIds = ['user-1', 'user-2', 'user-3', 'user-4'];
        users.forEach((user, i) => batch.set(doc(db, 'users', userIds[i]), user));
        
        spaces.forEach(space => batch.set(doc(db, 'spaces', space.id), space));
        projects.forEach(project => batch.set(doc(db, 'projects', project.id), project));
        tasks.forEach(task => batch.set(doc(db, 'tasks', task.id), task));
        timeEntries.forEach(entry => batch.set(doc(db, 'time_entries', entry.id), entry));
        slackMeetingLogs.forEach(log => batch.set(doc(db, 'slack_meeting_logs', log.id), log));
        channels.forEach(channel => batch.set(doc(db, 'channels', channel.id), channel));
        messages.forEach(message => batch.set(doc(db, 'messages', message.id), message));
        
        await batch.commit();
        console.log('Database seeded successfully!');
    }
}


// --- User Management ---
export const getUser = async (userId: string): Promise<User | null> => {
  const userDoc = await getDoc(doc(db, 'users', userId));
  return userDoc.exists() ? ({ id: userDoc.id, ...userDoc.data() } as User) : null;
};

export const getAllUsers = async (): Promise<User[]> => {
    const querySnapshot = await getDocs(collection(db, 'users'));
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
}

export const getUserByEmail = async (email: string): Promise<User | null> => {
  const q = query(collection(db, 'users'), where("email", "==", email));
  const querySnapshot = await getDocs(q);
  if (querySnapshot.empty) return null;
  const userDoc = querySnapshot.docs[0];
  return { id: userDoc.id, ...userDoc.data() } as User;
};

export const addUser = async (user: Omit<User, 'id'>, uid: string): Promise<User> => {
  await setDoc(doc(db, 'users', uid), user);
  return { ...user, id: uid };
};

export const updateUser = async (userId: string, data: Partial<User>): Promise<void> => {
  const userRef = doc(db, 'users', userId);
  await updateDoc(userRef, data);
};

// --- Obsolete Invite Management ---
// These functions are no longer needed with the new auth model but are kept for reference,
// they should be removed in a future cleanup.
export const getInvite = async(email: string): Promise<any | null> => {
  const inviteDoc = await getDoc(doc(db, 'invites', email));
  return inviteDoc.exists() ? (inviteDoc.data() as any) : null;
};
export const deleteInvite = async (email: string): Promise<void> => {
  await deleteDoc(doc(db, 'invites', email));
};


// --- Space Management ---
export const getSpacesForUser = async (userId: string): Promise<Space[]> => {
  const q = query(collection(db, 'spaces'), where(`members.${userId}`, '!=', null));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Space));
};

export const getAllSpaces = async (): Promise<Space[]> => {
  const querySnapshot = await getDocs(collection(db, 'spaces'));
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Space));
};

export const addSpace = async (space: Omit<Space, 'id'>) => {
  const docRef = await addDoc(collection(db, 'spaces'), space);
  return docRef.id;
};

export const updateSpace = async (spaceId: string, data: Partial<Space>): Promise<void> => {
  const spaceRef = doc(db, 'spaces', spaceId);
  await updateDoc(spaceRef, data);
};

export const deleteSpace = async (spaceId: string): Promise<void> => {
  await deleteDoc(doc(db, 'spaces', spaceId));
};

// --- Project Management ---
export const getProjectsInSpace = async (spaceId: string): Promise<Project[]> => {
  const q = query(collection(db, 'projects'), where('space_id', '==', spaceId));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Project));
};

// --- Task Management ---
export const getTasksInProject = async (projectId: string): Promise<Task[]> => {
  const q = query(collection(db, 'tasks'), where('project_id', '==', projectId));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task));
};

export const getTasksInSpace = async (projectIds: string[]): Promise<Task[]> => {
  if (projectIds.length === 0) return [];
  const q = query(collection(db, 'tasks'), where('project_id', 'in', projectIds));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task));
};

export const addTask = async (task: Omit<Task, 'id'>): Promise<Task> => {
  const docRef = await addDoc(collection(db, 'tasks'), task);
  return { ...task, id: docRef.id };
};

export const updateTask = async (taskId: string, data: Partial<Task>): Promise<void> => {
  const taskRef = doc(db, 'tasks', taskId);
  await updateDoc(taskRef, data);
};


// --- Time & Log Management ---
export const getTimeEntriesInSpace = async (projectIds: string[]): Promise<TimeEntry[]> => {
    if (projectIds.length === 0) return [];
    const q = query(collection(db, 'time_entries'), where('project_id', 'in', projectIds));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TimeEntry));
}

export const getSlackMeetingLogsInSpace = async (spaceId: string): Promise<SlackMeetingLog[]> => {
    const projectsInSpace = await getProjectsInSpace(spaceId);
    const projectIds = projectsInSpace.map(p => p.id);

    if (projectIds.length === 0) return [];
    
    const unassignedQ = query(collection(db, 'slack_meeting_logs'), where('project_id', '==', null));
    const unassignedSnapshot = await getDocs(unassignedQ);
    const unassignedLogs = unassignedSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SlackMeetingLog));

    const q = query(collection(db, 'slack_meeting_logs'), where('project_id', 'in', projectIds));
    const querySnapshot = await getDocs(q);
    const assignedLogs = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SlackMeetingLog));
    
    return [...unassignedLogs, ...assignedLogs];
}


// --- Channel & Message Management ---
export const getChannelsInSpace = async (spaceId: string): Promise<Channel[]> => {
    const q = query(collection(db, 'channels'), where('space_id', '==', spaceId));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({id: doc.id, ...doc.data()} as Channel))
}

export const getMessagesInChannel = async (channelId: string): Promise<Message[]> => {
    const q = query(collection(db, 'messages'), where('channel_id', '==', channelId));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({id: doc.id, ...doc.data()} as Message))
}

export const addMessage = async (message: Omit<Message, 'id'>): Promise<Message> => {
    const docRef = await addDoc(collection(db, 'messages'), message);
    const savedMessage = { ...message, id: docRef.id };

    if (message.thread_id) {
        const parentMessageRef = doc(db, 'messages', message.thread_id);
        const parentMessageSnap = await getDoc(parentMessageRef);
        if (parentMessageSnap.exists()) {
            const parentMessage = parentMessageSnap.data();
            const currentReplies = parentMessage.reply_count || 0;
            await updateDoc(parentMessageRef, { reply_count: currentReplies + 1 });
        }
    }
    
    return savedMessage;
}

    