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
import { Space, User, Invite, Project, Task, TimeEntry, SlackMeetingLog, Channel, Message, users, spaces, projects, tasks, timeEntries, slackMeetingLogs, channels, messages } from './data';
import { randomBytes } from 'crypto';

// --- Seeding ---
export const seedDatabase = async () => {
    const usersRef = collection(db, 'users');
    const q = query(usersRef, limit(1));
    const snapshot = await getDocs(q);
    if (snapshot.empty) {
        console.log('Database is empty, seeding data...');
        const batch = writeBatch(db);

        users.forEach(user => batch.set(doc(db, 'users', user.id), user));
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
  const existing = await getUser(uid);
  if (existing) return existing;

  const preApprovedUser = await getPreApprovedUser(user.email);
  const invite = await getInvite(user.email);

  const role = preApprovedUser?.role || invite?.role || 'Member';
  const spaces = preApprovedUser?.spaces || invite?.spaces || [];

  const userWithRole = { ...user, role };

  await setDoc(doc(db, 'users', uid), userWithRole);
  
  if (spaces.length > 0) {
    await addMemberToSpaces(spaces, uid);
  }

  if (preApprovedUser) {
    await deletePreApprovedUser(preApprovedUser.email);
  }
  if (invite) {
    await deleteInvite(invite.email);
  }

  return { ...userWithRole, id: uid };
};

export const updateUser = async (userId: string, data: Partial<User>): Promise<void> => {
  const userRef = doc(db, 'users', userId);
  await updateDoc(userRef, data);
};

// --- Direct User Pre-Approval ---
export const addPreApprovedUser = async (userData: Omit<Invite, 'token'>): Promise<void> => {
    await setDoc(doc(db, 'pre-approved-users', userData.email), userData);
}

export const getPreApprovedUser = async (email: string): Promise<Omit<Invite, 'token'> | null> => {
    const userDoc = await getDoc(doc(db, 'pre-approved-users', email));
    return userDoc.exists() ? (userDoc.data() as Omit<Invite, 'token'>) : null;
}

export const deletePreApprovedUser = async (email: string): Promise<void> => {
    await deleteDoc(doc(db, 'pre-approved-users', email));
}


// --- Invite Management ---
export const addInvite = async (inviteData: Omit<Invite, 'token'>): Promise<void> => {
    const token = randomBytes(16).toString('hex');
    const inviteWithToken: Invite = { ...inviteData, token };
    await setDoc(doc(db, 'invites', inviteData.email), inviteWithToken);
};

export const getInvite = async(email: string): Promise<Invite | null> => {
  const inviteDoc = await getDoc(doc(db, 'invites', email));
  return inviteDoc.exists() ? (inviteDoc.data() as Invite) : null;
};

export const getAllInvites = async (): Promise<Invite[]> => {
    const querySnapshot = await getDocs(collection(db, 'invites'));
    return querySnapshot.docs.map(doc => doc.data() as Invite);
};

export const deleteInvite = async (email: string): Promise<void> => {
  await deleteDoc(doc(db, 'invites', email));
};

export const resendInvite = async (email: string): Promise<boolean> => {
  const invite = await getInvite(email);
  if (!invite) {
    console.error("No invite found for this email to resend.");
    return false;
  }
  
  const inviteData: Omit<Invite, 'token'> = {
    email: invite.email,
    role: invite.role,
    spaces: invite.spaces,
  }

  await deleteInvite(email);
  await addInvite(inviteData);
  return true;
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
};

export const addSpace = async (space: Omit<Space, 'id'>) => {
  const docRef = await addDoc(collection(db, 'spaces'), space);
  return docRef.id;
};

export const updateSpace = async (spaceId: string, data: Partial<Space>): Promise<void> => {
  const spaceRef = doc(db, 'spaces', spaceId);
  await updateDoc(spaceRef, data);
};

export const addMemberToSpaces = async (spaceIds: string[], userId: string): Promise<void> => {
  const batch = writeBatch(db);
  spaceIds.forEach(spaceId => {
    const spaceRef = doc(db, 'spaces', spaceId);
    batch.update(spaceRef, { members: arrayUnion(userId) });
  });
  await batch.commit();
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
    // This is not a query that scales well in firestore.
    // In a real app we'd likely duplicate spaceId on the log, or query projects first.
    // For this prototype, it's acceptable.
    const projectsInSpace = await getProjectsInSpace(spaceId);
    const projectIds = projectsInSpace.map(p => p.id);

    if (projectIds.length === 0) return [];
    
    // Add unassigned logs
    const unassignedQ = query(collection(db, 'slack_meeting_logs'), where('project_id', '==', null));
    const unassignedSnapshot = await getDocs(unassignedQ);
    const unassignedLogs = unassignedSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SlackMeetingLog));

    // Add assigned logs
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
