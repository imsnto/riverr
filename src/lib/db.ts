
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
  arrayUnion,
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
  HelpCenter,
  HelpCenterCollection,
  HelpCenterArticle,
  ResolutionStatus,
  ResolutionSource,
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

export const savePushToken = async (userId: string, token: string, userAgent?: string) => {
  const tokenRef = doc(db, 'fcmTokens', userId);
  await setDoc(tokenRef, {
    id: userId,
    tokens: arrayUnion(token),
    updatedAt: serverTimestamp(),
    userAgent: userAgent || null
  }, { merge: true });
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

// --- Intelligence Pipeline CRUD (Vertex-Backed) ---

export const createImportedSource = async (source: Omit<ImportedSource, 'id'>): Promise<ImportedSource> => {
  const docRef = await addDoc(collection(db, 'imported_sources'), source);
  return { id: docRef.id, ...source };
};

export const getImportedSources = async (spaceId: string): Promise<ImportedSource[]> => {
  const q = query(collection(db, 'imported_sources'), where('spaceId', '==', spaceId), limit(50));
  const snap = await getDocs(q);
  const results = snap.docs.map(d => ({ id: d.id, ...d.data() } as ImportedSource));
  return results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
};

export const subscribeToInsights = (spaceId: string, callback: (insights: Insight[]) => void) => {
  const q = query(collection(db, 'insights'), where('spaceId', '==', spaceId));
  return onSnapshot(q, (snapshot) => {
    const insights = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Insight));
    insights.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    callback(insights);
  });
};

export const subscribeToTopics = (spaceId: string, callback: (topics: Topic[]) => void) => {
  const q = query(collection(db, 'topics'), where('spaceId', '==', spaceId));
  return onSnapshot(q, (snapshot) => {
    const topics = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Topic));
    topics.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    callback(topics);
  });
};

export const addInsight = async (insight: Omit<Insight, 'id'>): Promise<Insight> => {
  const docRef = await addDoc(collection(db, 'insights'), {
    ...insight,
    embeddingStatus: 'pending',
    embeddingVersion: 'v2',
    embeddingModel: 'text-embedding-004'
  });
  return { id: docRef.id, ...insight };
};

export const updateInsight = async (id: string, data: Partial<Insight>) => {
  await updateDoc(doc(db, 'insights', id), { ...data, updatedAt: new Date().toISOString() });
};

export const addTopic = async (topic: Omit<Topic, 'id'>): Promise<Topic> => {
  const docRef = await addDoc(collection(db, 'topics'), {
    ...topic,
    embeddingStatus: 'pending',
    embeddingVersion: 'v2',
    embeddingModel: 'text-embedding-004'
  });
  return { id: docRef.id, ...topic };
};

export const updateTopic = async (id: string, data: Partial<Topic>) => {
  await updateDoc(doc(db, 'topics', id), { ...data, updatedAt: new Date().toISOString() });
};

/**
 * 🔥 CANONICAL ARTICLE CRUD: Points to the 'articles' collection.
 * Existing 'help_center_articles' will be re-indexed here.
 */
export const addArticle = async (article: Omit<Article, 'id'>): Promise<Article> => {
  const docRef = await addDoc(collection(db, 'articles'), {
    ...article,
    embeddingStatus: 'pending',
    embeddingVersion: 'v2',
    embeddingModel: 'text-embedding-004'
  });
  return { id: docRef.id, ...article };
};

export const getArticles = async (spaceId: string): Promise<Article[]> => {
  const q = query(collection(db, 'articles'), where('spaceId', '==', spaceId));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Article));
};

export const updateArticle = async (id: string, data: Partial<Article>) => {
  await updateDoc(doc(db, 'articles', id), { ...data, updatedAt: new Date().toISOString() });
};

export const deleteArticle = async (id: string) => {
  await deleteDoc(doc(db, 'articles', id));
};

// --- Projects ---
export const getProjectsInHub = async (hubId: string): Promise<Project[]> => {
  const q = query(collection(db, 'projects'), where('hubId', '==', hubId));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Project));
};

export const addProject = async (project: Omit<Project, 'id'>): Promise<Project> => {
  const docRef = await addDoc(collection(db, 'projects'), project);
  if (project.taskCounter === undefined) {
      await updateDoc(docRef, { taskCounter: 0 });
  }
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

export const uploadBotLogo = async (file: File, botId: string) => {
  const storageRef = ref(storage, `bots/${botId}/logo_${Date.now()}`);
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
    collection(db, 'source_chunks'), 
    where('hubId', '==', hubId), 
    limit(100)
  );
  try {
    const snap = await getDocs(q);
    const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    return docs.sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  } catch (err) {
    const fallbackQ = query(collection(db, 'source_chunks'), where('hubId', '==', hubId), limit(100));
    const fallbackSnap = await getDocs(fallbackQ);
    return fallbackSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  }
};

// --- Help Center CRUD ---
export const getHelpCenters = async (hubId: string): Promise<HelpCenter[]> => {
  const q = query(collection(db, 'help_centers'), where('hubId', '==', hubId));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as HelpCenter));
};

export const addHelpCenter = async (hc: Omit<HelpCenter, 'id'>): Promise<HelpCenter> => {
  const docRef = await addDoc(collection(db, 'help_centers'), hc);
  return { id: docRef.id, ...hc };
};

export const getHelpCenterCollections = async (hubId: string): Promise<HelpCenterCollection[]> => {
  const q = query(collection(db, 'help_center_collections'), where('hubId', '==', hubId));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as HelpCenterCollection));
};

export const saveHelpCenterCollection = async (hubId: string, data: Omit<HelpCenterCollection, 'id' | 'hubId'>, id?: string) => {
  if (id) {
    await updateDoc(doc(db, 'help_center_collections', id), { ...data, updatedAt: new Date().toISOString() });
  } else {
    await addDoc(collection(db, 'help_center_collections'), { ...data, hubId, updatedAt: new Date().toISOString() });
  }
};

export const getHelpCenterArticles = async (hubId: string): Promise<HelpCenterArticle[]> => {
  const q = query(collection(db, 'help_center_articles'), where('hubId', '==', hubId));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as HelpCenterArticle));
};

export const addHelpCenterArticle = async (article: Omit<HelpCenterArticle, 'id'>): Promise<HelpCenterArticle> => {
  const docRef = await addDoc(collection(db, 'help_center_articles'), article);
  return { id: docRef.id, ...article };
};

export const updateHelpCenterArticle = async (id: string, data: Partial<HelpCenterArticle>) => {
  await updateDoc(doc(db, 'help_center_articles', id), data);
};

export const deleteHelpCenterArticle = async (id: string) => {
  await deleteDoc(doc(db, 'help_center_articles', id));
};

// --- Tickets & Deals ---
export const getTicketsInHub = async (hubId: string): Promise<Ticket[]> => {
  const q = query(collection(db, 'tickets'), where('hubId', '==', hubId));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Ticket));
};

export const addTicket = async (td: Omit<Ticket, 'id'>): Promise<Ticket> => {
  const docRef = await addDoc(collection(db, 'tickets'), td);
  return { id: docRef.id, ...td };
};

export const updateTicket = async (id: string, data: Partial<Ticket>) => {
  await updateDoc(doc(db, 'tickets', id), data);
};

export const getDealsInHub = async (hubId: string): Promise<Deal[]> => {
  const q = query(collection(db, 'deals'), where('hubId', '==', hubId));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Deal));
};

export const addDeal = async (dd: Omit<Deal, 'id'>): Promise<Deal> => {
  const docRef = await addDoc(collection(db, 'deals'), dd);
  return { id: docRef.id, ...dd };
};

export const updateDeal = async (id: string, data: Partial<Deal>) => {
  await updateDoc(doc(db, 'deals', id), data);
};

// --- Escalation Rules ---
export const getEscalationIntakeRules = async (hubId: string): Promise<EscalationIntakeRule[]> => {
    const q = query(collection(db, 'escalation_intake_rules'), where('hubId', '==', hubId));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as EscalationIntakeRule));
};

export const saveEscalationIntakeRule = async (hubId: string, rule: Omit<EscalationIntakeRule, 'id' | 'hubId'>, id?: string) => {
  if (id) {
    await updateDoc(doc(db, 'escalation_intake_rules', id), rule);
  } else {
    await addDoc(collection(db, 'escalation_intake_rules'), { ...rule, hubId });
  }
};

export const deleteEscalationIntakeRule = async (hubId: string, id: string) => {
  await deleteDoc(doc(db, 'escalation_intake_rules', id));
};

// --- Automation Rules ---
export const getDealAutomationRules = async (hubId: string): Promise<DealAutomationRule[]> => {
  const q = query(collection(db, 'deal_automation_rules'), where('hubId', '==', hubId));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as DealAutomationRule));
};

export const saveDealAutomationRule = async (rule: Omit<DealAutomationRule, 'id'>, id?: string) => {
  if (id) {
    await updateDoc(doc(db, 'deal_automation_rules', id), rule);
  } else {
    await addDoc(collection(db, 'deal_automation_rules'), rule);
  }
};

export const deleteDealAutomationRule = async (id: string) => {
  await deleteDoc(doc(db, 'deal_automation_rules', id));
};

// --- Time Entries ---
export const getTimeEntriesInHub = async (projectIds: string[]): Promise<TimeEntry[]> => {
  if (projectIds.length === 0) return [];
  const q = query(collection(db, 'time_entries'), where('project_id', 'in', projectIds.slice(0, 10)));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TimeEntry));
};

export const addTimeEntry = async (entry: Omit<TimeEntry, 'id'>): Promise<TimeEntry> => {
  const docRef = await addDoc(collection(db, 'time_entries'), entry);
  return { id: docRef.id, ...entry };
};

// --- Slack Logs ---
export const getSlackMeetingLogsInSpace = async (spaceId: string): Promise<SlackMeetingLog[]> => {
  const q = query(collection(db, 'slack_meeting_logs'), where('spaceId', '==', spaceId));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SlackMeetingLog));
};

// --- Bots & Agents ---
export const getBots = async (hubId: string): Promise<Bot[]> => {
  const q = query(collection(db, 'bots'), where('hubId', '==', hubId));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Bot));
};

export const addBot = async (bot: Omit<Bot, 'id'>): Promise<Bot> => {
  const docRef = await addDoc(collection(db, 'bots'), bot);
  return { id: docRef.id, ...bot };
};

export const updateBot = async (id: string, data: Partial<Bot>) => {
  const docRef = doc(db, 'bots', id);
  await updateDoc(docRef, data);
};

export const deleteBot = async (id: string) => {
  const docRef = doc(db, 'bots', id);
  await deleteDoc(docRef);
};

// --- Job Flows ---
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

// --- Invites ---
export const addInvite = async (invite: Omit<Invite, 'id'>): Promise<Invite> => {
  const docRef = await addDoc(collection(db, 'invites'), invite);
  return { id: docRef.id, ...invite };
};

export const getPendingInvites = async (spaceIds: string[]): Promise<Invite[]> => {
  if (spaceIds.length === 0) return [];
  const q = query(collection(db, 'invites'), where('spaceId', 'in', spaceIds), where('status', '==', 'pending'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Invite));
};

export const resendInvite = async (inviteId: string) => {
  const functions = getFunctions(getApp());
  const resend = httpsCallable(functions, 'resendInvite');
  await resend({ inviteId });
};

export const revokeInvite = async (inviteId: string) => {
  await updateDoc(doc(db, 'invites', inviteId), { status: 'expired' });
};

// --- Comms ---
export const getCommsNumbersForSpace = (spaceId: string, callback: (nums: any[]) => void) => {
  const q = collection(db, `spaces/${spaceId}/commsNumbers`);
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
  });
};

export const getAllPhoneLookupsForSpace = async (spaceId: string): Promise<PhoneChannelLookup[]> => {
  const q = query(collection(db, 'phone_channel_lookups'), where('spaceId', '==', spaceId));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as PhoneChannelLookup));
};

export const getPhoneLookupsForHub = async (hubId: string): Promise<PhoneChannelLookup[]> => {
  const q = query(collection(db, 'phone_channel_lookups'), where('hubId', '==', hubId));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as PhoneChannelLookup));
};

export const savePhoneChannelLookup = async (id: string, data: Partial<PhoneChannelLookup>) => {
  await updateDoc(doc(db, 'phone_channel_lookups', id), data);
};

export const getDirectPhoneNumbersForUser = async (userId: string): Promise<PhoneChannelLookup[]> => {
  const q = query(collection(db, 'phone_channel_lookups'), where('userId', '==', userId));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as PhoneChannelLookup));
};

// --- Email Configs ---
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

export const updateEmailConfig = async (spaceId: string, hubId: string, configId: string, data: Partial<EmailConfig>) => {
  await updateDoc(doc(db, `spaces/${spaceId}/hubs/${hubId}/emailConfigs`, configId), data);
};

export const updateAgentEmailConfig = async (userId: string, configId: string, data: Partial<EmailConfig>) => {
  await updateDoc(doc(db, `users/${userId}/emailConfigs`, configId), data);
};

export const deleteAgentEmailConfig = async (userId: string, configId: string) => {
  await deleteDoc(doc(db, `users/${userId}/emailConfigs`, configId));
  // Also clean up index
  const configs = await getDocs(query(collection(db, 'emailIndex'), where('emailConfigId', '==', configId)));
  const batch = writeBatch(db);
  configs.docs.forEach(d => batch.delete(d.ref));
  await batch.commit();
};

// --- Conversations & Messages ---
export const addConversation = async (convo: Omit<Conversation, 'id'>): Promise<Conversation> => {
  const docRef = await addDoc(collection(db, 'conversations'), convo);
  return { id: docRef.id, ...convo };
};

export const updateConversation = async (id: string, data: Partial<Conversation>) => {
  await updateDoc(doc(db, 'conversations', id), data);
};

export const getConversationsForHub = async (hubId: string): Promise<Conversation[]> => {
  const q = query(collection(db, 'conversations'), where('hubId', '==', hubId));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Conversation));
};

export const getConversation = (id: string, callback: (convo: Conversation) => void) => {
  return onSnapshot(doc(db, 'conversations', id), (doc) => {
    if (doc.exists()) callback({ id: doc.id, ...doc.data() } as Conversation);
  });
};

export const getMessagesForConversations = (convoIds: string[], callback: (messages: ChatMessage[]) => void, publicOnly = false) => {
  if (convoIds.length === 0) {
    callback([]);
    return () => {};
  }
  let q = query(collection(db, 'chat_messages'), where('conversationId', 'in', convoIds.slice(0, 10)));
  return onSnapshot(q, (snapshot) => {
    let msgs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as ChatMessage));
    if (publicOnly) msgs = msgs.filter(m => m.type !== 'note');
    msgs.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    callback(msgs);
  });
};

export const addChatMessage = async (msg: Omit<ChatMessage, 'id'>): Promise<ChatMessage> => {
  const docRef = await addDoc(collection(db, 'chat_messages'), msg);
  return { id: docRef.id, ...msg };
};

export const setTypingStatus = async (conversationId: string, userId: string, isTyping: boolean) => {
  const convoRef = doc(db, 'conversations', conversationId);
  await updateDoc(convoRef, {
    [`typing.${userId}`]: isTyping
  });
};

export const updateAgentSeenAt = async (conversationId: string, agentId: string) => {
  const convoRef = doc(db, 'conversations', conversationId);
  await updateDoc(convoRef, {
    [`lastAgentSeenAtByAgent.${agentId}`]: new Date().toISOString()
  });
};

export const updateVisitorActivity = async (conversationId: string) => {
  const convoRef = doc(db, 'conversations', conversationId);
  await updateDoc(convoRef, {
    lastVisitorActiveAt: new Date().toISOString()
  });
};

export const resolveConversation = async (id: string, userId: string, userName: string, source: ResolutionStatus, summary?: string) => {
  const convoRef = doc(db, 'conversations', id);
  await updateDoc(convoRef, {
    status: 'closed',
    resolutionStatus: 'resolved',
    resolutionSource: source,
    resolvedAt: new Date().toISOString(),
    resolvedByUserId: userId,
    resolvedByName: userName,
    resolutionSummary: summary || null,
    updatedAt: new Date().toISOString()
  });
};

export const setWaitingOnCustomer = async (id: string) => {
  const convoRef = doc(db, 'conversations', id);
  await updateDoc(convoRef, {
    status: 'waiting_on_customer',
    updatedAt: new Date().toISOString()
  });
};

// --- Visitors ---
export const getOrCreateVisitor = async (id: string, initialData?: Partial<Visitor>): Promise<Visitor> => {
  const docRef = doc(db, 'visitors', id);
  const snap = await getDoc(docRef);
  if (snap.exists()) return { id: snap.id, ...snap.data() } as Visitor;
  const now = new Date().toISOString();
  const newData = { ...initialData, lastSeen: now };
  await setDoc(docRef, newData);
  return { id, ...newData } as Visitor;
};

export const updateVisitor = async (id: string, data: Partial<Visitor>) => {
  await updateDoc(doc(db, 'visitors', id), data);
};

// --- Shared Assets ---
export const getDocumentsInHub = async (hubId: string): Promise<Document[]> => {
  const q = query(collection(db, 'documents'), where('hubId', '==', hubId));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Document));
};

export const getDocument = async (id: string): Promise<Document | null> => {
  const docSnap = await getDoc(doc(db, 'documents', id));
  return docSnap.exists() ? ({ id: docSnap.id, ...docSnap.data() } as Document) : null;
};

export const addDocument = async (d: Omit<Document, 'id'>): Promise<Document> => {
  const docRef = await addDoc(collection(db, 'documents'), d);
  return { id: docRef.id, ...d };
};

export const updateDocument = async (id: string, data: Partial<Document>) => {
  await updateDoc(doc(db, 'documents', id), data);
};

export const deleteDocument = async (id: string) => {
  await deleteDoc(doc(db, 'documents', id));
};

export const uploadImageToFirebase = async (file: File, hubId: string, docId: string): Promise<string> => {
  const storageRef = ref(storage, `hubs/${hubId}/documents/${docId}/${Date.now()}_${file.name}`);
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
};

// --- Contacts ---
export const getContacts = async (spaceId: string): Promise<Contact[]> => {
  const q = query(collection(db, 'contacts'), where('spaceId', '==', spaceId));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Contact));
};

export const subscribeToContacts = (spaceId: string, callback: (contacts: Contact[]) => void) => {
  const q = query(collection(db, 'contacts'), where('spaceId', '==', spaceId));
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Contact)));
  });
};

export const addContact = async (c: Omit<Contact, 'id'>): Promise<Contact> => {
  const docRef = await addDoc(collection(db, 'contacts'), c);
  return { id: docRef.id, ...c };
};

export const addContactEvent = async (contactId: string, event: any) => {
  await addDoc(collection(db, `contacts/${contactId}/events`), event);
};

export const subscribeToContactEvents = (contactId: string, callback: (events: any[]) => void) => {
  const q = query(collection(db, `contacts/${contactId}/events`), orderBy('timestamp', 'desc'));
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
  });
};

export const deleteContactEvent = async (contactId: string, eventId: string) => {
  await deleteDoc(doc(db, `contacts/${contactId}/events`, eventId));
};

// --- Complex Workflow Helpers ---
export const launchJob = async (name: string, template: JobFlowTemplate, roleMapping: Record<string, string>, creatorId: string, spaceId: string) => {
    const hubId = template.hubId;
    const now = new Date().toISOString();
    
    const jobData: Omit<Job, 'id'> = {
        name,
        workflowTemplateId: template.id,
        space_id: spaceId,
        hubId,
        currentPhaseIndex: 0,
        status: 'active',
        createdAt: now,
        createdBy: creatorId,
        roleUserMapping: roleMapping
    };
    
    const jobRef = await addDoc(collection(db, 'jobs'), jobData);
    
    // Create initial tasks for phase 0
    const firstPhase = template.phases[0];
    for (const taskTemplate of firstPhase.tasks) {
        const assigneeId = roleMapping[taskTemplate.defaultAssigneeId] || taskTemplate.defaultAssigneeId;
        
        const newTask: Omit<Task, 'id'> = {
            name: taskTemplate.titleTemplate,
            description: taskTemplate.descriptionTemplate || '',
            project_id: null,
            hubId,
            spaceId,
            status: 'Backlog',
            assigned_to: assigneeId,
            createdBy: creatorId,
            createdAt: now,
            due_date: new Date(Date.now() + taskTemplate.estimatedDurationDays * 86400000).toISOString(),
            priority: 'Medium',
            tags: ['workflow-task'],
            activities: [],
            comments: [],
            attachments: [],
            relationships: []
        };
        
        const createdTask = await addTask(newTask);
        
        await addDoc(collection(db, 'job_flow_tasks'), {
            jobId: jobRef.id,
            taskId: createdTask.id,
            phaseIndex: 0,
            createdAt: now,
            hubId,
        });
    }
    
    return jobRef.id;
};

export const updateJobPhase = async (job: Job, template: JobFlowTemplate, allTasks: Task[], jobLinks: JobFlowTask[]) => {
    const nextPhaseIndex = job.currentPhaseIndex + 1;
    const isLastPhase = nextPhaseIndex >= template.phases.length;
    
    const update: any = {
        currentPhaseIndex: isLastPhase ? job.currentPhaseIndex : nextPhaseIndex,
        status: isLastPhase ? 'completed' : 'active',
        updatedAt: new Date().toISOString()
    };
    
    await updateDoc(doc(db, 'jobs', job.id), update);
    
    if (!isLastPhase) {
        const nextPhase = template.phases[nextPhaseIndex];
        const now = new Date().toISOString();
        
        for (const taskTemplate of nextPhase.tasks) {
            const assigneeId = job.roleUserMapping[taskTemplate.defaultAssigneeId] || taskTemplate.defaultAssigneeId;
            const newTask: Omit<Task, 'id'> = {
                name: taskTemplate.titleTemplate,
                description: taskTemplate.descriptionTemplate || '',
                project_id: null,
                hubId: job.hubId,
                spaceId: job.space_id,
                status: 'Backlog',
                assigned_to: assigneeId,
                createdBy: job.createdBy,
                createdAt: now,
                due_date: new Date(Date.now() + taskTemplate.estimatedDurationDays * 86400000).toISOString(),
                priority: 'Medium',
                tags: ['workflow-task'],
                activities: [],
                comments: [],
                attachments: [],
                relationships: []
            };
            const createdTask = await addTask(newTask);
            await addDoc(collection(db, 'job_flow_tasks'), {
                jobId: job.id,
                taskId: createdTask.id,
                phaseIndex: nextPhaseIndex,
                createdAt: now,
                hubId: job.hubId,
            });
        }
    }
};

export const reviewJobPhase = async (jobId: string, phaseIndex: number, reviewerId: string) => {
    const q = query(collection(db, 'job_flow_tasks'), where('jobId', '==', jobId), where('phaseIndex', '==', phaseIndex));
    const snap = await getDocs(q);
    const batch = writeBatch(db);
    snap.docs.forEach(d => {
        batch.update(d.ref, { reviewedBy: reviewerId, reviewedAt: new Date().toISOString() });
    });
    await batch.commit();
};

export const seedDatabase = async () => {};
