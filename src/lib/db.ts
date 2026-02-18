
'use client'
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
  arrayRemove,
  limit,
  Timestamp,
  serverTimestamp,
  orderBy,
  onSnapshot,
  runTransaction,
} from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { getApp } from "firebase/app";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "./firebase";
import {
  Space,
  User,
  Project,
  Task,
  TimeEntry,
  SlackMeetingLog,
  Channel,
  Message,
  users,
  spaces,
  Invite,
  SpaceMember,
  JobFlowTemplate,
  Job,
  JobFlowTask,
  PhaseTemplate,
  TaskTemplate,
  Document,
  Hub,
  Status,
  Conversation,
  ChatMessage,
  Visitor,
  Bot,
  HelpCenter,
  HelpCenterCollection,
  HelpCenterArticle,
  Contact,
  ContactEvent,
  Ticket,
  Deal,
  DealAutomationRule,
  EscalationIntakeRule,
  BrainJob,
} from "./data";
import seedData from './riverr-help-data.json';

const generateRandomProjectKey = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  return chars.charAt(Math.floor(Math.random() * chars.length)) + 
         chars.charAt(Math.floor(Math.random() * chars.length));
};

const whimsicalAdjectives = ["Clever", "Silly", "Witty", "Happy", "Brave", "Curious", "Dapper", "Eager", "Fancy", "Gentle", "Jolly", "Kindly", "Lucky", "Merry", "Nifty", "Plucky", "Quirky", "Sunny", "Thrifty", "Zippy", "Agile", "Blissful", "Calm", "Dandy", "Elated", "Fearless"];
const whimsicalNouns = ["Alpaca", "Badger", "Capybara", "Dingo", "Echidna", "Fossa", "Gecko", "Hedgehog", "Impala", "Jerboa", "Koala", "Loris", "Mongoose", "Narwhal", "Okapi", "Pangolin", "Quokka", "Serval", "Tarsier", "Urial", "Wallaby", "Xerus", "Zebra", "Aardvark"];

function generateWhimsicalName() {
  return `${whimsicalAdjectives[Math.floor(Math.random()*whimsicalAdjectives.length)]} ${whimsicalNouns[Math.floor(Math.random()*whimsicalNouns.length)]}`;
}

// --- Seeding ---
export const seedDatabase = async () => {
  const usersRef = collection(db, "users");
  const q = query(usersRef, limit(1));
  const snapshot = await getDocs(q);
  if (snapshot.empty) {
    console.log("Database is empty, seeding data...");
    const batch = writeBatch(db);

    const userIds = ["user-1", "user-2", "user-3", "user-4"];
    users.forEach((user, i) => batch.set(doc(db, "users", userIds[i]), user));

    spaces.forEach((space) => batch.set(doc(db, "spaces", space.id), space));

    const helpData = JSON.parse(JSON.stringify(seedData));
    helpData.helpCenters.forEach((hc: any) => {
        if (hc.id) {
            const { id, ...data } = hc;
            batch.set(doc(db, "help_centers", id), data);
        }
    });
    helpData.collections.forEach((coll: any) => {
        if (coll.id) {
            const { id, ...data } = coll;
            batch.set(doc(db, "help_center_collections", id), data);
        }
    });
    helpData.articles.forEach((art: any) => {
        if (art.id) {
            const { id, ...data } = art;
            batch.set(doc(db, "help_center_articles", id), data);
        }
    });

    await batch.commit();
    console.log("Database seeded successfully!");
  }
};

// --- User Management ---
export const getUser = async (userId: string): Promise<User | null> => {
  const userDoc = await getDoc(doc(db, "users", userId));
  return userDoc.exists()
    ? ({ id: userDoc.id, ...userDoc.data() } as User)
    : null;
};

export const getAllUsers = async (): Promise<User[]> => {
  const querySnapshot = await getDocs(collection(db, "users"));
  return querySnapshot.docs.map(
    (doc) => ({ id: doc.id, ...doc.data() } as User)
  );
};

export const addUser = async (
  user: Omit<User, "id">,
  uid: string
): Promise<User> => {
  await setDoc(doc(db, "users", uid), user);
  return { ...user, id: uid };
};

export const updateUser = async (
  userId: string,
  data: Partial<User>
): Promise<void> => {
  const userRef = doc(db, "users", userId);
  await updateDoc(userRef, data);
};

// --- Contact Management ---
export const getContacts = async (spaceId: string): Promise<Contact[]> => {
  const q = query(collection(db, "contacts"), where("spaceId", "==", spaceId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Contact));
};

export const addContact = async (contact: Omit<Contact, "id">): Promise<Contact> => {
  const docRef = await addDoc(collection(db, "contacts"), contact);
  return { ...contact, id: docRef.id } as Contact;
};

export const getContactEvents = async (contactId: string): Promise<ContactEvent[]> => {
  const q = query(collection(db, "contacts", contactId, "events"), orderBy("timestamp", "desc"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ContactEvent));
};

export const addContactEvent = async (contactId: string, event: Omit<ContactEvent, "id">): Promise<ContactEvent> => {
  const docRef = await addDoc(collection(db, "contacts", contactId, "events"), event);
  return { ...event, id: docRef.id } as ContactEvent;
};

export const deleteContactEvent = async (contactId: string, eventId: string): Promise<void> => {
  await deleteDoc(doc(db, "contacts", contactId, "events", eventId));
};

// --- Invite Management ---
export const addInvite = async (invite: Omit<Invite, 'id' | 'status'>): Promise<void> => {
    const inviteWithStatus = {
        ...invite,
        status: 'pending',
        createdAt: serverTimestamp(),
    };
    await addDoc(collection(db, "invites"), inviteWithStatus);
};

export const getPendingInvites = async (spaceIds: string[]): Promise<Invite[]> => {
  if (spaceIds.length === 0) return [];
  const q = query(
    collection(db, "invites"),
    where("spaceId", "in", spaceIds),
    where("status", "==", "pending")
  );
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(
    (doc) => ({ id: doc.id, ...doc.data() } as Invite)
  );
};

export const resendInvite = async (inviteId: string): Promise<void> => {
  const functions = getFunctions(getApp());
  const resendInviteFn = httpsCallable(functions, 'resendInvite');
  await resendInviteFn({ inviteId });
};

export const revokeInvite = async (inviteId: string): Promise<void> => {
  await deleteDoc(doc(db, "invites", inviteId));
};

// --- Space Management ---
export const getSpacesForUser = async (userId: string): Promise<Space[]> => {
  if (!userId) return [];
  const q = query(
    collection(db, "spaces"),
    where(`members.${userId}.role`, 'in', ['Admin', 'Member'])
  );
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(
    (doc) => ({ id: doc.id, ...doc.data() } as Space)
  );
};

export const addSpace = async (space: Omit<Space, 'id'>) => {
  const docRef = await addDoc(collection(db, "spaces"), space);
  return docRef.id;
};

export const updateSpace = async (
  spaceId: string,
  data: Partial<Space>
): Promise<void> => {
  const spaceRef = doc(db, "spaces", spaceId);
  await updateDoc(spaceRef, data);
};

export const deleteSpace = async (spaceId: string): Promise<void> => {
  await deleteDoc(doc(db, "spaces", spaceId));
};

export const uploadSpaceLogo = async (file: File, spaceId: string): Promise<string> => {
  const storageRef = ref(storage, `spaces/${spaceId}/logo_${Date.now()}_${file.name}`);
  const snapshot = await uploadBytes(storageRef, file);
  return getDownloadURL(snapshot.ref);
};

// --- Hub Management ---
export const getHub = async (hubId: string): Promise<Hub | null> => {
    const docRef = doc(db, "hubs", hubId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as Hub;
    }
    return null;
}
export const getHubsForSpace = async (spaceId: string): Promise<Hub[]> => {
  const q = query(collection(db, 'hubs'), where('spaceId', '==', spaceId));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Hub));
};

export const addHub = async (hub: Omit<Hub, 'id'>): Promise<Hub> => {
  const docRef = await addDoc(collection(db, 'hubs'), hub);
  return { ...hub, id: docRef.id };
};

export const updateHub = async (
  hubId: string,
  data: Partial<Hub>
): Promise<void> => {
  const hubRef = doc(db, "hubs", hubId);
  await updateDoc(hubRef, data);
};

const defaultTaskStatuses: Status[] = [
  { name: 'Backlog', color: '#6b7280' },
  { name: 'In Progress', color: '#3b82f6' },
  { name: 'In Review', color: '#f59e0b' },
  { name: 'Done', color: '#22c55e' },
];

const defaultTicketStatuses: Status[] = [
  { name: 'New', color: '#6b7280' },
  { name: 'Open', color: '#3b82f6' },
  { name: 'Waiting on Customer', color: '#f59e0b' },
  { name: 'Resolved', color: '#22c55e' },
];

export const createDefaultHubForSpace = async (spaceId: string, userId: string, hubData: Partial<Omit<Hub, 'id' | 'spaceId'>>) => {
  const finalHubData: Omit<Hub, 'id'> = {
    name: hubData.name || 'Default Hub',
    spaceId,
    type: hubData.type || 'project-management',
    createdAt: new Date().toISOString(),
    createdBy: userId,
    isDefault: hubData.isDefault || true,
    settings: hubData.settings || { components: ['tasks', 'help-center'], defaultView: 'tasks' },
    isPrivate: hubData.isPrivate || false,
    memberIds: hubData.memberIds || [],
    statuses: hubData.statuses || defaultTaskStatuses,
    ticketStatuses: hubData.ticketStatuses || defaultTicketStatuses,
    ticketClosingStatusName: 'Closed',
  };
  const hubRef = await addDoc(collection(db, 'hubs'), finalHubData);
  return { id: hubRef.id, ...finalHubData };
};

// --- Project Management ---
export const getProjectsInHub = async (hubId: string): Promise<Project[]> => {
  const q = query(collection(db, "projects"), where("hubId", "==", hubId));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(
    (doc) => ({ id: doc.id, ...doc.data() } as Project)
  );
};

export const addProject = async (project: Omit<Project, "id">): Promise<Project> => {
  const projectKey = project.key || generateRandomProjectKey();
  const projectWithKey = { ...project, key: projectKey, taskCounter: 0 };
  const docRef = await addDoc(collection(db, "projects"), projectWithKey);
  return { ...projectWithKey, id: docRef.id };
};

export const updateProject = async (projectId: string, data: Partial<Project>): Promise<void> => {
  const projectRef = doc(db, "projects", projectId);
  await updateDoc(projectRef, data);
};

export const deleteProject = async (projectId: string): Promise<void> => {
  const batch = writeBatch(db);
  const tasksQuery = query(collection(db, "tasks"), where("project_id", "==", projectId));
  const tasksSnapshot = await getDocs(tasksQuery);
  tasksSnapshot.forEach((taskDoc) => {
    batch.delete(taskDoc.ref);
  });
  batch.delete(doc(db, "projects", projectId));
  await batch.commit();
};

// --- Task Management ---
export const getAllTasks = async (hubId: string): Promise<Task[]> => {
  const q = query(collection(db, "tasks"), where("hubId", "==", hubId));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(
    (doc) => ({ id: doc.id, ...doc.data() } as Task)
  );
};

export const addTask = async (task: Omit<Task, "id">): Promise<Task> => {
  const taskRef = doc(collection(db, "tasks"));
  
  if (task.parentId || !task.project_id) {
      await setDoc(taskRef, task);
      return { ...task, id: taskRef.id };
  }
  
  const projectRef = doc(db, "projects", task.project_id);

  try {
      const newTaskData = await runTransaction(db, async (transaction) => {
          const projectDoc = await transaction.get(projectRef);
          if (!projectDoc.exists()) {
              throw "Project not found!";
          }

          const projectData = projectDoc.data() as Project;
          const newCounter = (projectData.taskCounter || 0) + 1;
          const projectKey = projectData.key || generateRandomProjectKey();

          const taskKey = `${projectKey}-${newCounter}`;

          const completeTaskData: Omit<Task, 'id'> = {
              ...task,
              taskKey: taskKey,
          };
          
          transaction.update(projectRef, { taskCounter: newCounter, key: projectKey });
          transaction.set(taskRef, completeTaskData);

          return completeTaskData;
      });
      return { ...(newTaskData as Task), id: taskRef.id };
  } catch (e) {
      console.error("Add task transaction failed: ", e);
      await setDoc(taskRef, task);
      return { ...task, id: taskRef.id };
  }
};

export const updateTask = async (taskId: string, data: Partial<Task>): Promise<void> => {
  const taskRef = doc(db, "tasks", taskId);
  const { id: _omit, ...dataWithoutId } = data;
  await updateDoc(taskRef, dataWithoutId);
};

export const deleteTask = async (taskId: string): Promise<void> => {
  await deleteDoc(doc(db, "tasks", taskId));
};

// --- Ticket Management ---
export const getTicketsInHub = async (hubId: string): Promise<Ticket[]> => {
  const q = query(collection(db, "tickets"), where("hubId", "==", hubId));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(
    (doc) => ({ id: doc.id, ...doc.data() } as Ticket)
  );
};

export const addTicket = async (ticket: Omit<Ticket, "id">): Promise<Ticket> => {
  const docRef = await addDoc(collection(db, "tickets"), ticket);
  return { ...ticket, id: docRef.id };
};

export const updateTicket = async (ticketId: string, data: Partial<Ticket>): Promise<void> => {
  await updateDoc(doc(db, "tickets", ticketId), data);
};

// --- Deal Management ---
export const getDealsInHub = async (hubId: string): Promise<Deal[]> => {
  const q = query(collection(db, "deals"), where("hubId", "==", hubId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Deal));
};

export const addDeal = async (deal: Omit<Deal, "id">): Promise<Deal> => {
  const docRef = await addDoc(collection(db, "deals"), deal);
  return { ...deal, id: docRef.id };
};

export const updateDeal = async (dealId: string, data: Partial<Deal>): Promise<void> => {
  await updateDoc(doc(db, "deals", dealId), data);
};

export const getDealAutomationRules = async (hubId: string): Promise<DealAutomationRule[]> => {
  const q = query(collection(db, "deal_automation_rules"), where("hubId", "==", hubId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DealAutomationRule));
};

export const saveDealAutomationRule = async (rule: Omit<DealAutomationRule, 'id'>, ruleId?: string): Promise<void> => {
  if (ruleId) {
    await updateDoc(doc(db, "deal_automation_rules", ruleId), rule);
  } else {
    await addDoc(collection(db, "deal_automation_rules"), rule);
  }
};

export const deleteDealAutomationRule = async (ruleId: string): Promise<void> => {
  await deleteDoc(doc(db, "deal_automation_rules", ruleId));
};

// --- Time & Log Management ---
export const getTimeEntriesInHub = async (projectIds: string[]): Promise<TimeEntry[]> => {
  if (!projectIds || projectIds.length === 0) return [];
  const results: TimeEntry[] = [];
  for (let i = 0; i < projectIds.length; i += 30) {
    const chunk = projectIds.slice(i, i + 30);
    const q = query(collection(db, "time_entries"), where("project_id", "in", chunk));
    const querySnapshot = await getDocs(q);
    results.push(...querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TimeEntry)));
  }
  return results;
};

export const addTimeEntry = async (timeData: Omit<TimeEntry, "id">): Promise<TimeEntry> => {
  const docRef = await addDoc(collection(db, "time_entries"), timeData);
  return { ...timeData, id: docRef.id };
};

export const getSlackMeetingLogsInSpace = async (spaceId: string): Promise<SlackMeetingLog[]> => {
    const q = query(collection(db, "slack_meeting_logs"), where("space_id", "==", spaceId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SlackMeetingLog));
};

// --- Document Management ---
export const getDocumentsInHub = async (hubId: string): Promise<Document[]> => {
  const q = query(collection(db, "documents"), where("hubId", "==", hubId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Document));
};

export const getDocument = async (docId: string): Promise<Document | null> => {
  const docRef = doc(db, "documents", docId);
  const docSnap = await getDoc(docRef);
  return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } as Document : null;
};

export const addDocument = async (document: Omit<Document, "id">): Promise<Document> => {
  const docRef = await addDoc(collection(db, "documents"), document);
  return { ...document, id: docRef.id } as Document;
};

export const updateDocument = async (docId: string, data: Partial<Document>): Promise<void> => {
  await updateDoc(doc(db, "documents", docId), data);
};

export const deleteDocument = async (docId: string): Promise<void> => {
  await deleteDoc(doc(db, "documents", docId));
};

export const uploadImageToFirebase = async (file: File, hubId: string, docId: string): Promise<string> => {
  const storageRef = ref(storage, `hubs/${hubId}/docs/${docId}/${Date.now()}_${file.name}`);
  const snapshot = await uploadBytes(storageRef, file);
  return getDownloadURL(snapshot.ref);
};

// --- Help Center Management ---
export const getHelpCenters = async (hubId: string): Promise<HelpCenter[]> => {
  const q = query(collection(db, 'help_centers'), where('hubId', '==', hubId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as HelpCenter));
}

export const addHelpCenter = async (helpCenter: Omit<HelpCenter, 'id'>): Promise<HelpCenter> => {
  const docRef = await addDoc(collection(db, 'help_centers'), helpCenter);
  return { id: docRef.id, ...helpCenter };
}

export const updateHelpCenter = async (helpCenterId: string, data: Partial<HelpCenter>): Promise<void> => {
  await updateDoc(doc(db, 'help_centers', helpCenterId), data);
}

export const deleteHelpCenter = async (helpCenterId: string): Promise<void> => {
  const batch = writeBatch(db);
  const articlesQuery = query(collection(db, 'help_center_articles'), where('helpCenterId', '==', helpCenterId));
  const articlesSnapshot = await getDocs(articlesQuery);
  articlesSnapshot.forEach(doc => batch.delete(doc.ref));
  const collectionsQuery = query(collection(db, 'help_center_collections'), where('helpCenterId', '==', helpCenterId));
  const collectionsSnapshot = await getDocs(collectionsQuery);
  collectionsSnapshot.forEach(doc => batch.delete(doc.ref));
  batch.delete(doc(db, "help_centers", helpCenterId));
  await batch.commit();
};

export const uploadHelpCenterCoverImage = async (file: File, helpCenterId: string): Promise<string> => {
  const storageRef = ref(storage, `help_centers/${helpCenterId}/cover_${Date.now()}_${file.name}`);
  const snapshot = await uploadBytes(storageRef, file);
  return getDownloadURL(snapshot.ref);
};

export const getHelpCenterCollections = async (hubId: string): Promise<HelpCenterCollection[]> => {
  const q = query(collection(db, 'help_center_collections'), where('hubId', '==', hubId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as HelpCenterCollection));
}

export const addHelpCenterCollection = async (collectionData: Omit<HelpCenterCollection, 'id'>): Promise<HelpCenterCollection> => {
  const docRef = await addDoc(collection(db, "help_center_collections"), collectionData);
  return { id: docRef.id, ...collectionData };
}

export const updateHelpCenterCollection = async (collectionId: string, data: Partial<HelpCenterCollection>): Promise<void> => {
  await updateDoc(doc(db, "help_center_collections", collectionId), data);
}

export const deleteHelpCenterCollection = async (collectionId: string): Promise<void> => {
  await deleteDoc(doc(db, "help_center_collections", collectionId));
}

export const getHelpCenterArticles = async (hubId: string): Promise<HelpCenterArticle[]> => {
  const q = query(collection(db, 'help_center_articles'), where('hubId', '==', hubId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as HelpCenterArticle));
}

export const addHelpCenterArticle = async (articleData: Omit<HelpCenterArticle, 'id'>): Promise<HelpCenterArticle> => {
  const docRef = await addDoc(collection(db, 'help_center_articles'), articleData);
  return { id: docRef.id, ...articleData };
}

export const updateHelpCenterArticle = async (articleId: string, data: Partial<HelpCenterArticle>): Promise<void> => {
  await updateDoc(doc(db, "help_center_articles", articleId), data);
};

export const deleteHelpCenterArticle = async (articleId: string): Promise<void> => {
    await deleteDoc(doc(db, "help_center_articles", articleId));
};

// --- Inbox / Chat Management ---
export const getConversationsForSpace = async (spaceId: string): Promise<Conversation[]> => {
  const hubsInSpace = await getHubsForSpace(spaceId);
  const hubIds = hubsInSpace.map(h => h.id);
  if (hubIds.length === 0) return [];
  const q = query(collection(db, 'conversations'), where('hubId', 'in', hubIds));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Conversation));
};

export const getMessagesForConversations = (conversationIds: string[], onUpdate: (messages: ChatMessage[]) => void) => {
  if (conversationIds.length === 0) return onUpdate([]);
  const q = query(collection(db, 'chat_messages'), where('conversationId', 'in', conversationIds), orderBy('timestamp', 'asc'));
  return onSnapshot(q, (snapshot) => {
    const messages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ChatMessage));
    onUpdate(messages);
  });
};

export const addChatMessage = async (message: Omit<ChatMessage, "id">): Promise<ChatMessage> => {
    const docRef = await addDoc(collection(db, "chat_messages"), message);
    return { ...message, id: docRef.id };
};

export const updateConversation = async (conversationId: string, data: Partial<Conversation>): Promise<void> => {
  await updateDoc(doc(db, "conversations", conversationId), data);
};

export const getConversation = (conversationId: string, onUpdate: (convo: Conversation) => void) => {
  return onSnapshot(doc(db, 'conversations', conversationId), (doc) => {
    if (doc.exists()) {
      onUpdate({ id: doc.id, ...doc.data() } as Conversation);
    }
  });
};

export const getConversationsForHub = async (hubId: string): Promise<Conversation[]> => {
  const q = query(collection(db, 'conversations'), where('hubId', '==', hubId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Conversation));
};

export const addConversation = async (convo: Omit<Conversation, 'id'>): Promise<Conversation> => {
    const docRef = await addDoc(collection(db, 'conversations'), convo);
    return { id: docRef.id, ...convo };
}

// --- Escalation & Automation Management ---
export const getEscalationIntakeRules = async (hubId: string): Promise<EscalationIntakeRule[]> => {
  const rulesRef = collection(db, 'hubs', hubId, 'escalation_intake');
  const snapshot = await getDocs(rulesRef);
  return snapshot.docs.map(doc => ({ id: doc.id, hubId, ...doc.data() } as EscalationIntakeRule));
};

export const saveEscalationIntakeRule = async (hubId: string, rule: Omit<EscalationIntakeRule, 'id' | 'hubId'>, ruleId?: string): Promise<EscalationIntakeRule> => {
  if (ruleId) {
    await updateDoc(doc(db, 'hubs', hubId, 'escalation_intake', ruleId), rule);
    return { ...rule, id: ruleId, hubId };
  } else {
    const docRef = await addDoc(collection(db, 'hubs', hubId, 'escalation_intake'), rule);
    return { ...rule, id: docRef.id, hubId };
  }
};

export const deleteEscalationIntakeRule = async (hubId: string, ruleId: string): Promise<void> => {
  await deleteDoc(doc(db, 'hubs', hubId, 'escalation_intake', ruleId));
};

export const getBots = async (hubId: string): Promise<Bot[]> => {
  const q = query(collection(db, "bots"), where("hubId", "==", hubId));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Bot));
};

export const getBot = async (botId: string): Promise<Bot | null> => {
    const docSnap = await getDoc(doc(db, 'bots', botId));
    return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } as Bot : null;
}

export const updateBot = async (botId: string, data: Partial<Bot>): Promise<void> => {
  await updateDoc(doc(db, "bots", botId), data);
};

export const deleteBot = async (botId: string): Promise<void> => {
  await deleteDoc(doc(db, "bots", botId));
};

export const addBot = async (bot: Omit<Bot, "id">): Promise<Bot> => {
  const docRef = await addDoc(collection(db, "bots"), bot);
  return { ...bot, id: docRef.id };
};

// --- Visitor Management ---
export const getOrCreateVisitor = async (visitorId: string, data?: Partial<Visitor>): Promise<Visitor> => {
  const visitorRef = doc(db, "visitors", visitorId);
  const visitorSnap = await getDoc(visitorRef);
  if (visitorSnap.exists()) {
    return { id: visitorSnap.id, ...visitorSnap.data() } as Visitor;
  }
  const newVisitor = { 
    id: visitorId, 
    name: generateWhimsicalName(), 
    ...data, 
    lastSeen: new Date().toISOString() 
  };
  await setDoc(visitorRef, newVisitor);
  return newVisitor as Visitor;
};

export const updateVisitor = async (visitorId: string, data: Partial<Visitor>): Promise<void> => {
  await updateDoc(doc(db, "visitors", visitorId), data);
};

// --- Job Flow Management ---
export const getJobFlowTemplates = async (hubId: string): Promise<JobFlowTemplate[]> => {
  const q = query(collection(db, "job_flow_templates"), where("hubId", "==", hubId));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as JobFlowTemplate));
};

export const getPhaseTemplates = async (hubId: string): Promise<PhaseTemplate[]> => {
  const q = query(collection(db, "phase_templates"), where("hubId", "==", hubId));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PhaseTemplate));
};

export const getTaskTemplates = async (hubId: string): Promise<TaskTemplate[]> => {
  const q = query(collection(db, "task_templates"), where("hubId", "==", hubId));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TaskTemplate));
};

export const getAllJobs = async (hubId: string): Promise<Job[]> => {
  const q = query(collection(db, "jobs"), where("hubId", "==", hubId));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Job));
};

export const getAllJobFlowTasks = async (hubId: string): Promise<JobFlowTask[]> => {
  const q = query(collection(db, "job_flow_tasks"), where("hubId", "==", hubId));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as JobFlowTask));
};

export const launchJob = async (name: string, template: JobFlowTemplate, roleMapping: Record<string, string>, creatorId: string, spaceId: string) => {
    const jobRef = await addDoc(collection(db, "jobs"), {
        name,
        workflowTemplateId: template.id,
        space_id: spaceId,
        hubId: template.hubId,
        currentPhaseIndex: 0,
        status: 'active',
        createdAt: new Date().toISOString(),
        createdBy: creatorId,
        roleUserMapping: roleMapping,
    });
    return jobRef.id;
};

export const updateJobPhase = async (job: Job, template: JobFlowTemplate, tasks: Task[], flowTasks: JobFlowTask[]) => {
    const nextPhaseIndex = job.currentPhaseIndex + 1;
    if (nextPhaseIndex >= template.phases.length) {
        await updateDoc(doc(db, "jobs", job.id), { status: 'completed' });
    } else {
        await updateDoc(doc(db, "jobs", job.id), { currentPhaseIndex: nextPhaseIndex });
    }
};

export const reviewJobPhase = async (jobId: string, phaseIndex: number, userId: string) => {
    const q = query(collection(db, "job_flow_tasks"), where("jobId", "==", jobId), where("phaseIndex", "==", phaseIndex));
    const snapshot = await getDocs(q);
    const batch = writeBatch(db);
    snapshot.docs.forEach(d => batch.update(d.ref, { reviewedBy: userId }));
    await batch.commit();
};

// --- Business Brain Management ---
export const startBrainJob = async (type: BrainJob['type'], params: Record<string, any>): Promise<string> => {
    const jobData = { type, params, status: 'pending', createdAt: new Date().toISOString() };
    const docRef = await addDoc(collection(db, 'brain_jobs'), jobData);
    return docRef.id;
};

export const getMemoryNodes = async (type: string): Promise<any[]> => {
  const q = query(collection(db, "memory_nodes"), where("type", "==", type));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
};

export const getSalesExtractions = async (spaceId: string): Promise<any[]> => {
  const q = query(collection(db, "sales_extractions"), where("spaceId", "==", spaceId), limit(50));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
};
