

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
  return mockData.users.find(u => u.id === userId) || null;
};

export const getUserByEmail = async (email: string): Promise<mockData.User | null> => {
    return mockData.users.find(u => u.email === email) || null;
}

export const addUser = async (user: Omit<mockData.User, 'id'>, uid: string): Promise<mockData.User> => {
  const newUser = { ...user, id: uid };
  mockData.users.push(newUser);
  return newUser;
};

export const updateUser = async (userId: string, data: Partial<mockData.User>): Promise<void> => {
    const userIndex = mockData.users.findIndex(u => u.id === userId);
    if (userIndex !== -1) {
        mockData.users[userIndex] = { ...mockData.users[userIndex], ...data };
    }
}

// --- Invite Management ---
export const addInvite = async (invite: mockData.Invite): Promise<void> => {
    console.log("Invite added (mock):", invite);
}

export const getInvite = async(email: string): Promise<mockData.Invite | null> => {
    return null;
}

export const deleteInvite = async (email: string): Promise<void> => {
    console.log("Invite deleted (mock):", email);
}


// --- Space Management ---
export const getSpacesForUser = async (userId: string): Promise<mockData.Space[]> => {
  return mockData.spaces.filter(s => s.members.includes(userId));
};

export const getAllSpaces = async (): Promise<mockData.Space[]> => {
    return mockData.spaces;
}

export const addSpace = async (space: Omit<mockData.Space, 'id'>) => {
    const newId = `space-${Date.now()}`;
    mockData.spaces.push({ ...space, id: newId });
    return newId;
}

export const updateSpace = async (spaceId: string, data: Partial<mockData.Space>): Promise<void> => {
    const spaceIndex = mockData.spaces.findIndex(s => s.id === spaceId);
    if (spaceIndex !== -1) {
        mockData.spaces[spaceIndex] = { ...mockData.spaces[spaceIndex], ...data };
    }
}

export const addMemberToSpaces = async (spaceIds: string[], userId: string): Promise<void> => {
    spaceIds.forEach(spaceId => {
        const space = mockData.spaces.find(s => s.id === spaceId);
        if (space && !space.members.includes(userId)) {
            space.members.push(userId);
        }
    })
}

export const deleteSpace = async (spaceId: string): Promise<void> => {
    const index = mockData.spaces.findIndex(s => s.id === spaceId);
    if (index !== -1) mockData.spaces.splice(index, 1);
}

// --- Project Management ---
export const getProjectsInSpace = async (spaceId: string): Promise<mockData.Project[]> => {
    return mockData.projects.filter(p => p.space_id === spaceId);
}


// --- Task Management ---
export const getTasksInProject = async (projectId: string): Promise<mockData.Task[]> => {
    return mockData.tasks.filter(t => t.project_id === projectId);
}

export const getTasksInSpace = async (projectIds: string[]): Promise<mockData.Task[]> => {
    if (projectIds.length === 0) return [];
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

export const addMessage = async(message: Omit<mockData.Message, 'id'>): Promise<mockData.Message> => {
    const newMessage = { ...message, id: `msg-${Date.now()}` };
    mockData.messages.push(newMessage);
    return newMessage;
}

// --- Generic User Data ---
export const getAllUsers = async (): Promise<mockData.User[]> => {
    return mockData.users;
}
