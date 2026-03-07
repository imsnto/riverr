
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
  MemoryNode,
  DealAutomationRule,
  Conversation,
} from './data';
import { ContactEvent } from './contacts-types';
import { generateWhimsicalName, normalizePhoneFallback } from './utils';

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

/**
 * Removes a user from a space and all associated private hubs.
 * Also cleans up the memberships collection for data integrity.
 */
export const removeUserFromSpace = async (spaceId: string, userId: string) => {
  const spaceRef = doc(db, 'spaces', spaceId);
  const membershipId = `${spaceId}_${userId}`;
  const membershipRef = doc(db, 'memberships', membershipId);
  const batch = writeBatch(db);

  // 1. Remove from space members map (Primary authorization source)
  batch.update(spaceRef, {
    [`members.${userId}`]: deleteField()
  });
  
  // 2. Delete the dedicated membership document
  batch.delete(membershipRef);
  
  // 3. Remove from all hubs in this space (cleaning up private member lists)
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

/**
 * Real-time subscription for spaces where the user is a member.
 */
export const subscribeToUserSpaces = (userId: string, callback: (spaces: Space[]) => void) => {
  const q = query(collection(db, 'spaces'), where(`members.${userId}.role`, 'in', ['Admin', 'Member', 'Viewer']));
  return onSnapshot(q, (snapshot) => {
    const spaces = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Space));
    callback(spaces);
  }, (error) => {
    console.error("Error subscribing to spaces:", error);
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

export const createDefaultHubForSpace = async (spaceId: string, userId: string, params: { name: string, type: string }) => {
    const hubData: Omit<Hub, 'id'> = {
        name: params.name,
        spaceId,
        type: params.type,
        createdAt: new Date().toISOString(),
        createdBy: userId,
        isDefault: true,
        settings: { components: ['tasks', 'inbox'], defaultView: 'overview' },
        statuses: [
            { name: 'Backlog', color: '#6b7280' },
            { name: 'In Progress', color: '#3b82f6' },
            { name: 'In Review', color: '#f59e0b' },
            { name: 'Done', color: '#22c55e' },
        ],
    };
    return addHub(hubData);
};

// --- Projects ---
export const getProjectsInHub = async (hubId: string): Promise<Project[]> => {
  const q = query(collection(db, 'projects'), where('hubId', '==', hubId));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Project));
};

export const getProjectsInSpace = async (spaceId: string): Promise<Project[]> => {
  const q = query(collection(db, 'projects'), where('spaceId', '==', spaceId));
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

// --- Tickets ---
export const getTicketsInHub = async (hubId: string): Promise<Ticket[]> => {
  const q = query(collection(db, 'tickets'), where('hubId', '==', hubId));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Ticket));
};

export const addTicket = async (ticket: Omit<Ticket, 'id'>): Promise<Ticket> => {
  const docRef = await addDoc(collection(db, 'tickets'), ticket);
  return { id: docRef.id, ...ticket };
};

export const updateTicket = async (ticketId: string, data: Partial<Ticket>) => {
  const docRef = doc(db, 'tickets', ticketId);
  await updateDoc(docRef, data);
};

// --- Deals ---
export const getDealsInHub = async (hubId: string): Promise<Deal[]> => {
  const q = query(collection(db, 'deals'), where('hubId', '==', hubId));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Deal));
};

export const addDeal = async (deal: Omit<Deal, 'id'>): Promise<Deal> => {
  const docRef = await addDoc(collection(db, 'deals'), deal);
  return { id: docRef.id, ...deal };
};

export const updateDeal = async (dealId: string, data: Partial<Deal>) => {
  const docRef = doc(db, 'deals', dealId);
  await updateDoc(docRef, data);
};

// --- Contacts ---
export const getContacts = async (spaceId: string): Promise<Contact[]> => {
  const q = query(collection(db, 'contacts'), where('spaceId', '==', spaceId));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Contact));
};

export const subscribeToContacts = (spaceId: string, callback: (contacts: Contact[]) => void) => {
  const q = query(collection(db, 'contacts'), where('spaceId', '==', spaceId));
  return onSnapshot(q, (snapshot) => {
    const contacts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Contact));
    callback(contacts);
  });
};

export const addContact = async (contact: Omit<Contact, 'id'>): Promise<Contact> => {
  const docRef = await addDoc(collection(db, 'contacts'), contact);
  return { id: docRef.id, ...contact };
};

export const subscribeToContactEvents = (contactId: string, callback: (events: ContactEvent[]) => void) => {
    const q = query(collection(db, `contacts/${contactId}/events`));
    return onSnapshot(q, (snapshot) => {
        const events = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ContactEvent));
        callback(events);
    });
};

export const addContactEvent = async (contactId: string, event: Omit<ContactEvent, 'id'>) => {
    return addDoc(collection(db, `contacts/${contactId}/events`), event);
};

export const deleteContactEvent = async (contactId: string, eventId: string) => {
    return deleteDoc(doc(db, `contacts/${contactId}/events`, eventId));
};

// --- Visitors & Conversations ---
export const getOrCreateVisitor = async (visitorId: string, initialData?: any): Promise<Visitor> => {
  const docRef = doc(db, 'visitors', visitorId);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() } as Visitor;
  }
  const newVisitor = { 
      id: visitorId, 
      name: null, 
      email: null, 
      lastSeen: new Date().toISOString(),
      ...initialData 
  };
  await setDoc(docRef, newVisitor);
  return newVisitor as Visitor;
};

export const updateVisitor = async (visitorId: string, data: Partial<Visitor>) => {
  const docRef = doc(db, 'visitors', visitorId);
  await updateDoc(docRef, data);
};

export const updateVisitorActivity = async (conversationId: string) => {
  const docRef = doc(db, 'conversations', conversationId);
  await updateDoc(docRef, {
    lastVisitorActiveAt: new Date().toISOString()
  });
};

export const getConversationsForHub = async (hubId: string): Promise<Conversation[]> => {
  const q = query(collection(db, 'conversations'), where('hubId', '==', hubId));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Conversation));
};

export const getConversation = (convoId: string, callback: (convo: Conversation) => void) => {
  const docRef = doc(db, 'conversations', convoId);
  return onSnapshot(docRef, (docSnap) => {
    if (docSnap.exists()) {
      callback({ id: docSnap.id, ...docSnap.data() } as Conversation);
    }
  });
};

export const addConversation = async (convo: Omit<Conversation, 'id'>): Promise<Conversation> => {
  const docRef = await addDoc(collection(db, 'conversations'), convo);
  return { id: docRef.id, ...convo };
};

export const updateConversation = async (convoId: string, data: Partial<Conversation>) => {
  const docRef = doc(db, 'conversations', convoId);
  await updateDoc(docRef, data);
};

export const setTypingStatus = async (conversationId: string, userId: string, isTyping: boolean) => {
  const docRef = doc(db, 'conversations', conversationId);
  await updateDoc(docRef, {
    [`typing.${userId}`]: isTyping
  });
};

export const updateAgentSeenAt = async (conversationId: string, userId: string) => {
  const docRef = doc(db, 'conversations', conversationId);
  await updateDoc(docRef, {
    [`lastAgentSeenAtByAgent.${userId}`]: new Date().toISOString()
  });
};

export const getMessagesForConversations = (convoIds: string[], callback: (messages: ChatMessage[]) => void, isVisitor = false) => {
  if (convoIds.length === 0) {
      callback([]);
      return () => {};
  }
  const q = query(collection(db, 'chat_messages'), where('conversationId', 'in', convoIds.slice(0, 30)));
  return onSnapshot(q, (snapshot) => {
    const messages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ChatMessage));
    messages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    callback(messages);
  });
};

export const addChatMessage = async (message: Omit<ChatMessage, 'id'>) => {
  return addDoc(collection(db, 'chat_messages'), message);
};

// --- Knowledge Base / Help Center ---
export const getHelpCenters = async (hubId: string): Promise<HelpCenter[]> => {
  const q = query(collection(db, 'help_centers'), where('hubId', '==', hubId));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as HelpCenter));
};

export const addHelpCenter = async (hc: Omit<HelpCenter, 'id'>): Promise<HelpCenter> => {
  const docRef = await addDoc(collection(db, 'help_centers'), hc);
  return { id: docRef.id, ...hc };
};

export const updateHelpCenter = async (id: string, data: Partial<HelpCenter>) => {
  const docRef = doc(db, 'help_centers', id);
  await updateDoc(docRef, data);
};

export const deleteHelpCenter = async (id: string) => {
  const docRef = doc(db, 'help_centers', id);
  await deleteDoc(docRef);
};

export const getHelpCenterCollections = async (hubId: string): Promise<HelpCenterCollection[]> => {
  const q = query(collection(db, 'help_center_collections'), where('hubId', '==', hubId));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as HelpCenterCollection));
};

export const addHelpCenterCollection = async (coll: Omit<HelpCenterCollection, 'id'>): Promise<HelpCenterCollection> => {
  const docRef = await addDoc(collection(db, 'help_center_collections'), coll);
  return { id: docRef.id, ...coll };
};

export const updateHelpCenterCollection = async (id: string, data: Partial<HelpCenterCollection>) => {
  const docRef = doc(db, 'help_center_collections', id);
  await updateDoc(docRef, data);
};

export const deleteHelpCenterCollection = async (id: string) => {
  const docRef = doc(db, 'help_center_collections', id);
  await deleteDoc(docRef);
};

export const getHelpCenterArticles = async (hubId: string): Promise<HelpCenterArticle[]> => {
  const q = query(collection(db, 'help_center_articles'), where('hubId', '==', hubId));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as HelpCenterArticle));
};

export const addHelpCenterArticle = async (art: Omit<HelpCenterArticle, 'id'>): Promise<HelpCenterArticle> => {
  const docRef = await addDoc(collection(db, 'help_center_articles'), art);
  return { id: docRef.id, ...art };
};

export const updateHelpCenterArticle = async (id: string, data: Partial<HelpCenterArticle>) => {
  const docRef = doc(db, 'help_center_articles', id);
  await updateDoc(docRef, data);
};

export const deleteHelpCenterArticle = async (id: string) => {
  const docRef = doc(db, 'help_center_articles', id);
  await deleteDoc(docRef);
};

// --- Documents ---
export const getDocumentsInHub = async (hubId: string): Promise<Document[]> => {
  const q = query(collection(db, 'documents'), where('hubId', '==', hubId));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Document));
};

export const getDocument = async (id: string): Promise<Document | null> => {
  const docRef = doc(db, 'documents', id);
  const docSnap = await getDoc(docRef);
  return docSnap.exists() ? ({ id: docSnap.id, ...docSnap.data() } as Document) : null;
};

export const addDocument = async (docData: Omit<Document, 'id'>): Promise<Document> => {
  const docRef = await addDoc(collection(db, 'documents'), docData);
  return { id: docRef.id, ...docData };
};

export const updateDocument = async (id: string, data: Partial<Document>) => {
  const docRef = doc(db, 'documents', id);
  await updateDoc(docRef, data);
};

export const deleteDocument = async (id: string) => {
  const docRef = doc(db, 'documents', id);
  await deleteDoc(docRef);
};

// --- Flows / Job Templates ---
export const getJobFlowTemplates = async (hubId: string): Promise<JobFlowTemplate[]> => {
  const q = query(collection(db, 'job_flow_templates'), where('hubId', '==', hubId));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as JobFlowTemplate));
};

export const addJobFlowTemplate = async (template: Omit<JobFlowTemplate, 'id'>) => {
  return addDoc(collection(db, 'job_flow_templates'), template);
};

export const getPhaseTemplates = async (hubId: string): Promise<PhaseTemplate[]> => {
  const q = query(collection(db, 'phase_templates'), where('hubId', '==', hubId));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PhaseTemplate));
};

export const addPhaseTemplate = async (template: Omit<PhaseTemplate, 'id'>) => {
  return addDoc(collection(db, 'phase_templates'), template);
};

export const getTaskTemplates = async (hubId: string): Promise<TaskTemplate[]> => {
  const q = query(collection(db, 'task_templates'), where('hubId', '==', hubId));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TaskTemplate));
};

export const addTaskTemplate = async (template: Omit<TaskTemplate, 'id'>) => {
  return addDoc(collection(db, 'task_templates'), template);
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

// --- Job Engine Logic ---
export const launchJob = async (name: string, template: JobFlowTemplate, roleMapping: Record<string, string>, userId: string, spaceId: string) => {
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
        createdBy: userId,
        roleUserMapping: roleMapping,
    };
    const jobRef = await addDoc(collection(db, 'jobs'), jobData);
    
    const firstPhase = template.phases[0];
    for (const taskTpl of firstPhase.tasks) {
        const assignedTo = roleMapping[taskTpl.defaultAssigneeId] || taskTpl.defaultAssigneeId;
        const taskData: Omit<Task, 'id'> = {
            name: taskTpl.titleTemplate,
            description: taskTpl.descriptionTemplate || '',
            project_id: null,
            hubId,
            spaceId,
            status: 'Pending',
            createdAt: now,
            createdBy: userId,
            assigned_to: assignedTo,
            due_date: new Date(Date.now() + taskTpl.estimatedDurationDays * 86400000).toISOString(),
            priority: 'Medium',
            tags: ['workflow'],
            activities: [],
            comments: [],
            attachments: [],
            relationships: []
        };
        const taskRef = await addDoc(collection(db, 'tasks'), taskData);
        await addDoc(collection(db, 'job_flow_tasks'), {
            jobId: jobRef.id,
            taskId: taskRef.id,
            phaseIndex: 0,
            createdAt: now,
            hubId,
        });
    }
    return jobRef.id;
};

export const reviewJobPhase = async (jobId: string, phaseIndex: number, userId: string) => {
    const q = query(collection(db, 'job_flow_tasks'), where('jobId', '==', jobId), where('phaseIndex', '==', phaseIndex));
    const snap = await getDocs(q);
    const batch = writeBatch(db);
    snap.docs.forEach(doc => {
        batch.update(doc.ref, { reviewedBy: userId });
    });
    await batch.commit();
};

export const updateJobPhase = async (job: Job, template: JobFlowTemplate, allTasks: Task[], jobFlowTasks: JobFlowTask[]) => {
    const nextPhaseIndex = job.currentPhaseIndex + 1;
    const isLastPhase = nextPhaseIndex >= template.phases.length;
    
    const update: Partial<Job> = {
        currentPhaseIndex: isLastPhase ? job.currentPhaseIndex : nextPhaseIndex,
        status: isLastPhase ? 'completed' : 'active',
    };
    
    await updateDoc(doc(db, 'jobs', job.id), update);
    
    if (!isLastPhase) {
        const nextPhase = template.phases[nextPhaseIndex];
        const now = new Date().toISOString();
        for (const taskTpl of nextPhase.tasks) {
            const assignedTo = job.roleUserMapping[taskTpl.defaultAssigneeId] || taskTpl.defaultAssigneeId;
            const taskData: Omit<Task, 'id'> = {
                name: taskTpl.titleTemplate,
                description: taskTpl.descriptionTemplate || '',
                project_id: null,
                hubId: job.hubId,
                spaceId: job.space_id,
                status: 'Pending',
                createdAt: now,
                createdBy: job.createdBy,
                assigned_to: assignedTo,
                due_date: new Date(Date.now() + taskTpl.estimatedDurationDays * 86400000).toISOString(),
                priority: 'Medium',
                tags: ['workflow'],
                activities: [],
                comments: [],
                attachments: [],
                relationships: []
            };
            const taskRef = await addDoc(collection(db, 'tasks'), taskData);
            await addDoc(collection(db, 'job_flow_tasks'), {
                jobId: job.id,
                taskId: taskRef.id,
                phaseIndex: nextPhaseIndex,
                createdAt: now,
                hubId: job.hubId,
            });
        }
    }
};

// --- Invites ---
export const getPendingInvites = async (spaceIds: string[]): Promise<Invite[]> => {
  if (spaceIds.length === 0) return [];
  const q = query(collection(db, 'invites'), where('spaceId', 'in', spaceIds.slice(0, 10)), where('status', '==', 'pending'));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Invite));
};

export const addInvite = async (invite: Omit<Invite, 'id'>) => {
  return addDoc(collection(db, 'invites'), invite);
};

export const resendInvite = async (inviteId: string) => {
    await updateDoc(doc(db, 'invites', inviteId), { sentAt: null, tokenHash: null });
};

export const revokeInvite = async (inviteId: string) => {
    await updateDoc(doc(db, 'invites', inviteId), { status: 'expired' });
};

// --- Storage ---
export const uploadSpaceLogo = async (file: File, spaceId: string) => {
  const storageRef = ref(storage, `spaces/${spaceId}/logo_${Date.now()}`);
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
};

export const uploadHelpCenterCoverImage = async (file: File, hcId: string) => {
  const storageRef = ref(storage, `help_centers/${hcId}/cover_${Date.now()}`);
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
};

export const uploadImageToFirebase = async (file: File, hubId: string, docId: string) => {
  const storageRef = ref(storage, `hubs/${hubId}/docs/${docId}/${Date.now()}_${file.name}`);
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

export const getMemoryNodes = async (type: string): Promise<any[]> => {
    const q = query(collection(db, 'memory_nodes'), where('type', '==', type));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

export const getSalesExtractions = async (spaceId: string) => {
    const q = query(collection(db, 'sales_extractions'), where('spaceId', '==', spaceId), limit(50));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

// --- Deal Automation ---
export const getDealAutomationRules = async (hubId: string): Promise<DealAutomationRule[]> => {
    const q = query(collection(db, 'deal_automation_rules'), where('hubId', '==', hubId));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as DealAutomationRule));
};

export const saveDealAutomationRule = async (rule: Omit<DealAutomationRule, 'id'>, ruleId?: string) => {
    if (ruleId) {
        await updateDoc(doc(db, 'deal_automation_rules', ruleId), rule);
    } else {
        await addDoc(collection(db, 'deal_automation_rules'), rule);
    }
};

export const deleteDealAutomationRule = async (ruleId: string) => {
    await deleteDoc(doc(db, 'deal_automation_rules', ruleId));
};

// --- Intake / Escalation Rules ---
export const getEscalationIntakeRules = async (hubId: string): Promise<EscalationIntakeRule[]> => {
    const q = query(collection(db, 'escalation_intake_rules'), where('hubId', '==', hubId));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as EscalationIntakeRule));
};

export const saveEscalationIntakeRule = async (hubId: string, rule: Omit<EscalationIntakeRule, 'id' | 'hubId'>, ruleId?: string) => {
    const data = { ...rule, hubId };
    if (ruleId) {
        await updateDoc(doc(db, 'escalation_intake_rules', ruleId), data);
    } else {
        await addDoc(collection(db, 'escalation_intake_rules'), data);
    }
};

export const deleteEscalationIntakeRule = async (hubId: string, ruleId: string) => {
    await deleteDoc(doc(db, 'escalation_intake_rules', ruleId));
};

// --- Slack Meeting Logs ---
export const getSlackMeetingLogsInSpace = async (spaceId: string): Promise<SlackMeetingLog[]> => {
  const q = query(collection(db, 'slack_meeting_logs'), where('spaceId', '==', spaceId));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SlackMeetingLog));
};

// --- Bots ---
export const getBots = async (hubId: string): Promise<Bot[]> => {
  const q = query(collection(db, 'bots'), where('hubId', '==', hubId));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Bot));
};

export const getBot = async (botId: string): Promise<Bot | null> => {
  const docRef = doc(db, 'bots', botId);
  const docSnap = await getDoc(docRef);
  return docSnap.exists() ? ({ id: docSnap.id, ...docSnap.data() } as Bot) : null;
};

export const addBot = async (bot: Omit<Bot, 'id'>): Promise<Bot> => {
  const docRef = await addDoc(collection(db, 'bots'), bot);
  return { id: docRef.id, ...bot };
};

export const updateBot = async (botId: string, data: Partial<Bot>) => {
  const docRef = doc(db, 'bots', botId);
  await updateDoc(docRef, data);
};

export const deleteBot = async (botId: string) => {
  const docRef = doc(db, 'bots', botId);
  await deleteDoc(docRef);
};

// --- Push Notifications ---
export const savePushToken = async (userId: string, token: string, userAgent: string) => {
  const tokenHash = btoa(token).substring(0, 20);
  const tokenRef = doc(db, `users/${userId}/pushTokens/${tokenHash}`);
  const now = new Date().toISOString();
  await setDoc(tokenRef, {
    token,
    platform: 'web',
    enabled: true,
    createdAt: now,
    lastSeenAt: now,
    userAgent
  }, { merge: true });
};

// --- Comms (Numbers) ---
export const getCommsNumbersForSpace = (spaceId: string, callback: (numbers: any[]) => void) => {
  const q = query(collection(db, `spaces/${spaceId}/commsNumbers`));
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
  });
};

// DIRECT WRITES TO phone_channel_lookups ARE NOW FORBIDDEN BY RULES.
// Use assignNumberToHub callable function instead.

export const releaseNumberFromHub = async (type: 'sms' | 'voice', e164: string) => {
  // Logic moved to server or needs to be adapted to callable if direct delete is forbidden.
  // For now, we leave as a reminder that direct writes are blocked.
};

// --- Seeding ---
export const seedDatabase = async () => {};
