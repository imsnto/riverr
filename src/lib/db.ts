
'use client';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  onSnapshot,
  Timestamp,
  serverTimestamp,
  writeBatch,
  increment,
  limit,
  deleteField,
  orderBy,
} from 'firebase/firestore';
import { db, storage } from '@/lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import {
  User,
  Space,
  Hub,
  Project,
  Task,
  TimeEntry,
  SlackMeetingLog,
  Document,
  Invite,
  JobFlowTemplate,
  Job,
  JobFlowTask,
  PhaseTemplate,
  TaskTemplate,
  Bot,
  Ticket,
  Deal,
  EscalationIntakeRule,
  Contact,
  Visitor,
  ChatMessage,
  BrainJob,
  DealAutomationRule,
  Conversation,
  PhoneChannelLookup,
  EmailConfig,
  Insight,
  Topic,
  ImportedSource,
  SourceChunk,
  Article,
} from './data';

// --- Users ---
export const getUser = async (userId: string): Promise<User | null> => {
  const docRef = doc(db, 'users', userId);
  const docSnap = await getDoc(docRef);
  return docSnap.exists() ? ({ id: docSnap.id, ...docSnap.data() } as User) : null;
};

export const getAllUsers = async (): Promise<User[]> => {
  const querySnapshot = await getDocs(collection(db, 'users'));
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
};

export const addUser = async (user: Omit<User, 'id'>, uid: string): Promise<User> => {
  const userRef = doc(db, 'users', uid);
  await setDoc(userRef, { ...user, onboardingComplete: false });
  return { id: uid, ...user };
};

export const updateUser = async (userId: string, data: Partial<User>) => {
  const userRef = doc(db, 'users', userId);
  await updateDoc(userRef, data);
};

// --- Spaces ---
export const addSpace = async (space: Omit<Space, 'id'>): Promise<string> => {
  const docRef = await addDoc(collection(db, 'spaces'), space);
  return docRef.id;
};

export const updateSpace = async (spaceId: string, data: Partial<Space>) => {
  const docRef = doc(db, 'spaces', spaceId);
  await updateDoc(docRef, data);
};

export const removeUserFromSpace = async (spaceId: string, userId: string) => {
  const spaceRef = doc(db, 'spaces', spaceId);
  const membershipId = `${spaceId}_${userId}`;
  const membershipRef = doc(db, 'memberships', membershipId);
  const batch = writeBatch(db);

  batch.update(spaceRef, {
    [`members.${userId}`]: deleteField()
  });
  
  batch.delete(membershipRef);
  
  const hubsQuery = query(collection(db, 'hubs'), where('spaceId', '==', spaceId));
  const hubsSnap = await getDocs(hubsQuery);
  
  hubsSnap.docs.forEach(hubDoc => {
    const hub = hubDoc.data() as Hub;
    if (hub.memberIds && hub.memberIds.includes(userId)) {
      batch.update(hubDoc.ref, {
        memberIds: hub.memberIds.filter(id => id !== userId)
      });
    }
  });

  await batch.commit();
};

export const deleteSpace = async (spaceId: string) => {
  const docRef = doc(db, 'spaces', spaceId);
  await deleteDoc(docRef);
};

export const getSpacesForUser = async (userId: string): Promise<Space[]> => {
  const q = query(collection(db, 'spaces'), where(`members.${userId}.role`, 'in', ['Admin', 'Member', 'Viewer']));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Space));
};

export const subscribeToUserSpaces = (userId: string, callback: (spaces: Space[]) => void) => {
  const q = query(collection(db, 'spaces'), where(`members.${userId}.role`, 'in', ['Admin', 'Member', 'Viewer']));
  return onSnapshot(q, (snapshot) => {
    const spaces = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Space));
    callback(spaces);
  });
};

// --- Hubs ---
export const getHubsForSpace = async (spaceId: string): Promise<Hub[]> => {
  const q = query(collection(db, 'hubs'), where('spaceId', '==', spaceId));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Hub));
};

export const getHub = async (hubId: string): Promise<Hub | null> => {
  const docRef = doc(db, 'hubs', hubId);
  const docSnap = await getDoc(docRef);
  return docSnap.exists() ? ({ id: docSnap.id, ...docSnap.data() } as Hub) : null;
};

export const addHub = async (hub: Omit<Hub, 'id'>): Promise<Hub> => {
  const docRef = await addDoc(collection(db, 'hubs'), hub);
  return { id: docRef.id, ...hub };
};

export const updateHub = async (hubId: string, data: Partial<Hub>) => {
  const docRef = doc(db, 'hubs', hubId);
  await updateDoc(docRef, data);
};

// --- Intelligence Pipeline CRUD ---

export const createImportedSource = async (source: Omit<ImportedSource, 'id'>): Promise<ImportedSource> => {
  const docRef = await addDoc(collection(db, 'imported_sources'), source);
  return { id: docRef.id, ...source };
};

export const getImportedSources = async (spaceId: string): Promise<ImportedSource[]> => {
  const q = query(collection(db, 'imported_sources'), where('spaceId', '==', spaceId), orderBy('createdAt', 'desc'), limit(50));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as ImportedSource));
};

export const subscribeToInsights = (spaceId: string, callback: (insights: Insight[]) => void) => {
  const q = query(collection(db, 'insights'), where('spaceId', '==', spaceId), orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Insight)));
  });
};

export const subscribeToTopics = (spaceId: string, callback: (topics: Topic[]) => void) => {
  const q = query(collection(db, 'topics'), where('spaceId', '==', spaceId), orderBy('updatedAt', 'desc'));
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Topic)));
  });
};

export const addInsight = async (insight: Omit<Insight, 'id'>): Promise<Insight> => {
  const docRef = await addDoc(collection(db, 'insights'), insight);
  return { id: docRef.id, ...insight };
};

export const updateInsight = async (id: string, data: Partial<Insight>) => {
  await updateDoc(doc(db, 'insights', id), data);
};

export const addTopic = async (topic: Omit<Topic, 'id'>): Promise<Topic> => {
  const docRef = await addDoc(collection(db, 'topics'), topic);
  return { id: docRef.id, ...topic };
};

export const updateTopic = async (id: string, data: Partial<Topic>) => {
  await updateDoc(doc(db, 'topics', id), data);
};

export const promoteToArticle = async (article: Omit<Article, 'id'>): Promise<Article> => {
  const docRef = await addDoc(collection(db, 'articles'), article);
  return { id: docRef.id, ...article };
};

// --- Projects ---
export const getProjectsInHub = async (hubId: string): Promise<Project[]> => {
  const q = query(collection(db, 'projects'), where('hubId', '==', hubId));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Project));
};

export const addProject = async (project: Omit<Project, 'id'>): Promise<Project> => {
  const docRef = await addDoc(collection(db, 'projects'), project);
  return { id: docRef.id, ...project };
};

export const updateProject = async (projectId: string, data: Partial<Project>) => {
  const docRef = doc(db, 'projects', projectId);
  await updateDoc(docRef, data);
};

export const deleteProject = async (projectId: string) => {
  const docRef = doc(db, 'projects', projectId);
  await deleteDoc(docRef);
};

// --- Tasks ---
export const getAllTasks = async (hubId: string): Promise<Task[]> => {
  const q = query(collection(db, 'tasks'), where('hubId', '==', hubId));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task));
};

export const addTask = async (task: Omit<Task, 'id'>): Promise<Task> => {
  const docRef = await addDoc(collection(db, 'tasks'), task);
  if (task.project_id) {
      const projRef = doc(db, 'projects', task.project_id);
      await updateDoc(projRef, { taskCounter: increment(1) });
  }
  return { id: docRef.id, ...task };
};

export const updateTask = async (taskId: string, data: Partial<Task>) => {
  const docRef = doc(db, 'tasks', taskId);
  await updateDoc(docRef, data);
};

export const deleteTask = async (taskId: string) => {
  const docRef = doc(db, 'tasks', taskId);
  await deleteDoc(docRef);
};

// --- Storage ---
export const uploadImportedFile = async (file: File, spaceId: string) => {
  const storageRef = ref(storage, `imports/${spaceId}/${Date.now()}_${file.name}`);
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
};

export const uploadSpaceLogo = async (file: File, spaceId: string) => {
  const storageRef = ref(storage, `spaces/${spaceId}/logo_${Date.now()}`);
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
};

// --- Brain Jobs ---
export const startBrainJob = async (type: BrainJob['type'], params: Record<string, any>) => {
    const jobData: Omit<BrainJob, 'id'> = {
        type,
        status: 'pending',
        params,
        createdAt: new Date().toISOString(),
    };
    const docRef = await addDoc(collection(db, 'brain_jobs'), jobData);
    return docRef.id;
};

export const getBrainChunks = async (hubId: string): Promise<any[]> => {
  const q = query(
    collection(db, 'brain_chunks'), 
    where('hubId', '==', hubId), 
    orderBy('createdAt', 'desc'),
    limit(100)
  );
  try {
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (err) {
    const fallbackQ = query(collection(db, 'brain_chunks'), where('hubId', '==', hubId), limit(100));
    const fallbackSnap = await getDocs(fallbackQ);
    return fallbackSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  }
};

// --- Other syncs ---
export const getHelpCenters = async (hubId: string): Promise<HelpCenter[]> => {
  const q = query(collection(db, 'help_centers'), where('hubId', '==', hubId));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as HelpCenter));
};

export const getTicketsInHub = async (hubId: string): Promise<Ticket[]> => {
  const q = query(collection(db, 'tickets'), where('hubId', '==', hubId));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Ticket));
};

export const getDealsInHub = async (hubId: string): Promise<Deal[]> => {
  const q = query(collection(db, 'deals'), where('hubId', '==', hubId));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Deal));
};

export const getTimeEntriesInHub = async (projectIds: string[]): Promise<TimeEntry[]> => {
  if (projectIds.length === 0) return [];
  const q = query(collection(db, 'time_entries'), where('project_id', 'in', projectIds.slice(0, 10)));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TimeEntry));
};

export const getSlackMeetingLogsInSpace = async (spaceId: string): Promise<SlackMeetingLog[]> => {
  const q = query(collection(db, 'slack_meeting_logs'), where('spaceId', '==', spaceId));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SlackMeetingLog));
};

export const getBots = async (hubId: string): Promise<Bot[]> => {
  const q = query(collection(db, 'bots'), where('hubId', '==', hubId));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Bot));
};

export const getEscalationIntakeRules = async (hubId: string): Promise<EscalationIntakeRule[]> => {
    const q = query(collection(db, 'escalation_intake_rules'), where('hubId', '==', hubId));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as EscalationIntakeRule));
};

export const getJobFlowTemplates = async (hubId: string): Promise<JobFlowTemplate[]> => {
  const q = query(collection(db, 'job_flow_templates'), where('hubId', '==', hubId));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as JobFlowTemplate));
};

export const getPhaseTemplates = async (hubId: string): Promise<PhaseTemplate[]> => {
  const q = query(collection(db, 'phase_templates'), where('hubId', '==', hubId));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PhaseTemplate));
};

export const getTaskTemplates = async (hubId: string): Promise<TaskTemplate[]> => {
  const q = query(collection(db, 'task_templates'), where('hubId', '==', hubId));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TaskTemplate));
};

export const getAllJobs = async (hubId: string): Promise<Job[]> => {
  const q = query(collection(db, 'jobs'), where('hubId', '==', hubId));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Job));
};

export const getAllJobFlowTasks = async (hubId: string): Promise<JobFlowTask[]> => {
  const q = query(collection(db, 'job_flow_tasks'), where('hubId', '==', hubId));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as JobFlowTask));
};

export const getPersonalAgents = async (userId: string): Promise<Bot[]> => {
  const q = query(collection(db, 'bots'), where('ownerType', '==', 'user'), where('ownerId', '==', userId));
  const snap = await getDocs(q);
  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Bot));
};

export const getDirectPhoneNumbersForUser = async (userId: string): Promise<PhoneChannelLookup[]> => {
  const q = query(collection(db, 'phone_channel_lookups'), where('userId', '==', userId));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as PhoneChannelLookup));
};

export const subscribeToEmailConfigs = (spaceId: string, hubId: string, callback: (configs: EmailConfig[]) => void) => {
  const q = query(collection(db, `spaces/${spaceId}/hubs/${hubId}/emailConfigs`), where('connected', '==', true));
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as EmailConfig)));
  });
};

export const subscribeToAgentEmailConfigs = (userId: string, callback: (configs: EmailConfig[]) => void) => {
  const q = query(collection(db, `users/${userId}/emailConfigs`), where('connected', '==', true));
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as EmailConfig)));
  });
};

export const getPhoneLookupsForHub = async (hubId: string): Promise<PhoneChannelLookup[]> => {
  const q = query(collection(db, 'phone_channel_lookups'), where('hubId', '==', hubId));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as PhoneChannelLookup));
};

export const updateAgentSeenAt = async (conversationId: string, userId: string) => {
  const docRef = doc(db, 'conversations', conversationId);
  await updateDoc(docRef, {
    [`lastAgentSeenAtByAgent.${userId}`]: new Date().toISOString()
  });
};

export const updateVisitorActivity = async (conversationId: string) => {
  const docRef = doc(db, 'conversations', conversationId);
  await updateDoc(docRef, {
    lastVisitorActiveAt: new Date().toISOString()
  });
};

export const setTypingStatus = async (conversationId: string, userId: string, isTyping: boolean) => {
  const docRef = doc(db, 'conversations', conversationId);
  await updateDoc(docRef, {
    [`typing.${userId}`]: isTyping
  });
};

export const seedDatabase = async () => {};
