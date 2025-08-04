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
  limit
} from 'firebase/firestore';
import { db } from './firebase';
import * as mockData from './data';
import type { Space, User, Invite, Project, Task, TimeEntry, SlackMeetingLog, Channel, Message } from './data';

let isSeeding = false;
let isSeeded = false;

// Seed the database with initial data if it's empty
export const seedDatabase = async () => {
    if (isSeeded || isSeeding) return;
    isSeeding = true;

    try {
        const usersCollection = collection(db, 'users');
        const snapshot = await getDocs(query(usersCollection, limit(1)));
        
        if (snapshot.empty) {
            console.log('Database is empty, seeding with initial data...');
            const batch = writeBatch(db);

            // Seed Users
            mockData.users.forEach(user => {
                const userRef = doc(db, 'users', user.id);
                // The user object from mockData includes the id, so we need to destructure it
                const { id, ...userData } = user;
                batch.set(userRef, userData);
            });
            
            // Seed Spaces
             mockData.spaces.forEach(space => {
                const spaceRef = doc(db, 'spaces', space.id);
                const { id, ...spaceData } = space;
                batch.set(spaceRef, spaceData);
            });

             // Seed Projects
             mockData.projects.forEach(project => {
                const projectRef = doc(db, 'projects', project.id);
                 const { id, ...projectData } = project;
                batch.set(projectRef, projectData);
            });

            // Seed Tasks
            mockData.tasks.forEach(task => {
                const taskRef = doc(db, 'tasks', task.id);
                 const { id, ...taskData } = task;
                batch.set(taskRef, taskData);
            });

            // Seed Time Entries
            mockData.timeEntries.forEach(entry => {
                const entryRef = doc(db, 'timeEntries', entry.id);
                 const { id, ...entryData } = entry;
                batch.set(entryRef, entryData);
            });

            // Seed Slack Meeting Logs
            mockData.slackMeetingLogs.forEach(log => {
                const logRef = doc(db, 'slackMeetingLogs', log.id);
                 const { id, ...logData } = log;
                batch.set(logRef, logData);
            });

            // Seed Channels
            mockData.channels.forEach(channel => {
                const channelRef = doc(db, 'channels', channel.id);
                 const { id, ...channelData } = channel;
                batch.set(channelRef, channelData);
            });

            // Seed Messages
            mockData.messages.forEach(message => {
                const messageRef = doc(db, 'messages', message.id);
                 const { id, ...messageData } = message;
                batch.set(messageRef, messageData);
            });

            await batch.commit();
            console.log('Database seeded successfully.');
            isSeeded = true;
        } else {
             isSeeded = true;
        }
    } catch (error) {
        console.error("Error seeding database: ", error);
    } finally {
        isSeeding = false;
    }
};


// --- User Management ---
export const getUser = async (userId: string): Promise<User | null> => {
  const userDoc = await getDoc(doc(db, 'users', userId));
  return userDoc.exists() ? ({ id: userDoc.id, ...userDoc.data() } as User) : null;
};

export const getUserByEmail = async (email: string): Promise<User | null> => {
    const q = query(collection(db, 'users'), where("email", "==", email));
    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) return null;
    const userDoc = querySnapshot.docs[0];
    return { id: userDoc.id, ...userDoc.data() } as User;
}

export const addUser = async (user: Omit<User, 'id'>, uid: string): Promise<User> => {
  const newUser = { ...user };
  await setDoc(doc(db, 'users', uid), newUser);
  return { ...newUser, id: uid };
};

export const updateUser = async (userId: string, data: Partial<User>): Promise<void> => {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, data);
}

// --- Invite Management ---
export const addInvite = async (invite: Invite): Promise<void> => {
    // Use the email as the document ID for easy lookup
    await setDoc(doc(db, 'invites', invite.email), invite);
}

export const getInvite = async(email: string): Promise<Invite | null> => {
    const inviteDoc = await getDoc(doc(db, 'invites', email));
    return inviteDoc.exists() ? (inviteDoc.data() as Invite) : null;
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
    const docRef = await addDoc(collection(db, 'spaces'), space);
    return docRef.id;
}

export const updateSpace = async (spaceId: string, data: Partial<Space>): Promise<void> => {
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
    return { ...task, id: docRef.id };
}

export const updateTask = async (taskId: string, data: Partial<Task>): Promise<void> => {
    const taskRef = doc(db, 'tasks', taskId);
    await updateDoc(taskRef, data);
}

// --- Time Entry Management ---
export const getTimeEntriesInSpace = async (projectIds: string[]): Promise<TimeEntry[]> => {
    if (projectIds.length === 0) return [];
    const q = query(collection(db, 'timeEntries'), where('project_id', 'in', projectIds));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TimeEntry));
}


// --- Slack Meeting Log Management ---
export const getSlackMeetingLogsInSpace = async (projectIds: string[]): Promise<SlackMeetingLog[]> => {
    const logs: SlackMeetingLog[] = [];
    if(projectIds.length > 0) {
        const q1 = query(collection(db, 'slackMeetingLogs'), where('project_id', 'in', projectIds));
        const snapshot1 = await getDocs(q1);
        logs.push(...snapshot1.docs.map(doc => ({ id: doc.id, ...doc.data() } as SlackMeetingLog)));
    }
    
    const q2 = query(collection(db, 'slackMeetingLogs'), where('project_id', '==', null));
    const snapshot2 = await getDocs(q2);
    logs.push(...snapshot2.docs.map(doc => ({ id: doc.id, ...doc.data() } as SlackMeetingLog)));

    // Deduplicate logs in case a log somehow matches both
    const uniqueLogs = Array.from(new Map(logs.map(log => [log.id, log])).values());

    return uniqueLogs;
}

// --- Channel & Message Management ---
export const getChannelsInSpace = async (spaceId: string): Promise<Channel[]> => {
    const q = query(collection(db, 'channels'), where('space_id', '==', spaceId));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Channel));
}

export const getMessagesInChannel = async (channelId: string): Promise<Message[]> => {
    const q = query(collection(db, 'messages'), where('channel_id', '==', channelId));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message)).sort((a,b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}

export const addMessage = async(message: Omit<Message, 'id' | 'timestamp' | 'reactions' | 'reply_count'>): Promise<Message> => {
    const newMessage = { 
        ...message, 
        timestamp: new Date().toISOString(),
        reactions: [],
        reply_count: 0
    };
    const docRef = await addDoc(collection(db, 'messages'), newMessage);
    return { ...newMessage, id: docRef.id };
}

// --- Generic User Data ---
export const getAllUsers = async (): Promise<User[]> => {
    const querySnapshot = await getDocs(collection(db, 'users'));
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
}
