
// src/lib/data.ts

// --- Core Entities ---
export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl: string;
  role: 'Admin' | 'Member'; // Global role
}

export interface SpaceMember {
  role: 'Admin' | 'Member';
  permissions?: Permissions;
}

export interface Space {
  id: string;
  name: string;
  members: Record<string, SpaceMember>; // Map of user IDs to their roles/permissions
}

export type ConversationState =
  | "ai_active"
  | "escalation_offered"
  | "escalation_declined"
  | "human_assigned"
  | "closed";

export interface Hub {
  id: string;
  name: string;
  spaceId: string;
  type: string;
  createdAt: string; // ISO String
  createdBy: string; // userId
  settings: { [key: string]: any };
  isDefault: boolean;
  memberIds?: string[];
  isPrivate?: boolean;
  statuses: Status[]; // For Projects
  ticketStatuses?: Status[]; // For Tickets
  dealStatuses?: Status[]; // For Deals
  closingStatusName?: string;
  ticketClosingStatusName?: string;
  dealClosingStatusName?: string;
}


export interface HubPermission {
  id: string; // Composite key like `${userId}-${hubId}`
  userId: string;
  hubId: string;
  role: 'viewer' | 'editor' | 'admin';
  allowedComponents?: string[]; // Optional override
}


export interface Project {
  id: string;
  name: string;
  space_id: string;
  hubId: string; // Hub scope
  members: string[]; // array of user IDs
  status: 'Active' | 'On Hold' | 'Archived';
  created_by: string; // user ID
}

export interface Task {
  id: string;
  name: string;
  description: string;
  project_id: string | null; // Can be null if it's a job flow task
  hubId: string; // Hub scope
  spaceId: string;
  status: string;
  createdAt: string; // ISO String
  createdBy: string; // user ID
  assigned_to: string; // user ID
  due_date: string; // ISO string
  priority: 'Low' | 'Medium' | 'High' | 'Urgent' | null;
  sprint_points: number | null;
  tags: string[];
  time_estimate: number | null; // in hours
  parentId: string | null; // For subtasks
  relationships: TaskRelationship[];
  comments: Comment[];
  activities: Activity[];
  attachments: Attachment[];
  // Escalation fields
  linkedTicketId?: string;
  sourceHubId?: string;
  intakeRuleId?: string;
  contactId?: string;
}

export interface Ticket {
  id: string;
  hubId: string;
  spaceId: string;
  status: string;
  title: string;
  description: string | null;
  type: "bug" | "question" | "feature" | null;
  priority: 'Low' | 'Medium' | 'High' | 'Urgent' | null;
  assignedTo: string | null;
  contactId: string | null;
  conversationId: string | null;
  channel: 'Widget' | 'OpenPhone' | 'Order' | 'Manual' | null;
  lastMessagePreview: string | null;
  lastMessageAt: string | null;
  lastMessageAuthor: string | null;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  escalation?: {
    status: "none" | "queued" | "sent" | "failed";
    requestedAt?: string | null;
    requestedBy?: string | null;
    devHubId?: string | null;
    intakeRuleId?: string | null;
    devBoardId?: string | null;
    devItemId?: string | null;
    lastKnownDevStatus?: string | null;
    lastSyncedAt?: string | null;
    errorMessage?: string | null;
  };
  activities?: Activity[];
}

export interface Deal {
  id: string;
  hubId: string;
  spaceId: string;
  status: string; // This is the Kanban column/stage name
  title: string;
  description: string | null;
  value: number | null;
  currency: string | null;
  closeDate: string | null; // ISO String
  nextStep: string | null; // e.g. “Call”, “Demo”, “Follow-up”
  nextStepAt: string | null; // ISO String
  assignedTo: string | null; // userId
  contactId: string | null;
  source: 'Inbound Chat' | 'Referral' | 'Website' | 'Manual' | 'Import' | null;
  tags?: string[];
  isStale?: boolean;
  createdAt: string; // ISO String
  createdBy: string; // userId
  updatedAt: string; // ISO String
  lastActivityAt: string; // ISO String
}

export interface EscalationIntakeRule {
  id: string;
  hubId: string; // The Dev Hub that owns this rule
  enabled: boolean;
  name: string;
  allowedSourceHubIds: string[];
  allowedTypes: ("bug" | "feature" | "investigation")[];
  destinationBoardId: string; // Project ID in the Dev Hub
  destinationStatus: string;
  defaultAssigneeId: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}


export interface DealAutomationRule {
    id: string;
    hubId: string;
    name: string;
    trigger: {
        type: 'stage_changed' | 'deal_updated' | 'deal_stale';
        fromStage?: string;
        toStage?: string;
        staleDays?: number;
    };
    action: {
        type: 'send_email' | 'create_task' | 'update_field' | 'send_notification';
        templateId?: string; // for email
        taskTitle?: string; // for task
        assignTo?: string; // for task
        field?: string; // for update_field
        value?: any; // for update_field
        channel?: string; // for notification
        message?: string; // for notification
    };
    isEnabled: boolean;
    createdAt: string;
    createdBy: string;
}


export interface Document {
  id: string;
  name: string;
  content: string;
  spaceId: string;
  hubId: string; // Hub scope
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  type: 'notes' | 'spec' | 'meeting_minutes';
  isPublic: boolean;
  allowedUserIds?: string[];
  isLocked: boolean;
  tags: string[];
  comments: DocumentComment[];
}

export interface Channel {
  id:string;
  name: string;
  description?: string;
  space_id: string;
  hubId: string; // Hub scope
  members: string[]; // Array of user IDs
}

export interface Message {
  id: string;
  channel_id: string;
  user_id: string;
  content: string;
  timestamp: string; // ISO String
  attachments?: Attachment[];
  reactions: Reaction[];
  thread_id?: string;
  reply_count?: number;
  linked_task_id?: string;
}


// --- Supporting Interfaces ---
export interface Status {
  name: string;
  color: string;
}

export interface Permissions {
  canViewTasks: boolean;
  canEditTasks: boolean;
  canLogTime: boolean;
  canSeeAllTimesheets: boolean;
  canViewReports: boolean;
  canInviteMembers: boolean;
}

export interface TaskRelationship {
  id: string;
  type: 'blocks' | 'blocked_by' | 'related_to';
  related_task_id: string;
}

export interface Comment {
  id: string;
  user_id: string;
  comment: string;
  timestamp: string;
  attachments?: Attachment[];
}

export interface DocumentComment {
  id: string;
  userId: string;
  content: string;
  createdAt: string; // ISO string
}

export interface Activity {
  id: string;
  user_id: string;
  timestamp: string;
  type: 'task_creation' | 'status_change' | 'assignee_change' | 'comment' | 'priority_change' | 'due_date_change' | 'subtask_completion' | 'ticket_creation';
  from?: string; // Previous value
  to?: string; // New value
  comment_id?: string; // Link to a comment
  comment?: string; // The comment text
  subtask_name?: string;
}

export interface Attachment {
  id: string;
  name:string;
  url: string;
  type: 'image' | 'file';
}

export interface Reaction {
  emoji: string;
  count: number;
  user_ids: string[];
}

export interface TimeEntry {
  id: string;
  user_id: string;
  project_id: string;
  task_id?: string;
  source: 'Timer' | 'Manual';
  notes: string;
  start_time: string; // ISO String
  end_time: string; // ISO String
  duration: number; // in hours
  spaceId: string;
}

export interface SlackMeetingLog {
    id: string;
    user_id: string;
    channel_name: string;
    meeting_start: string; // ISO string
    duration: number; // in hours
    project_id?: string;
}

export interface Invite {
    id: string;
    email: string;
    role: 'Admin' | 'Member';
    spaces: string[];
    invitedBy: string;
    token: string;
    status: 'pending' | 'accepted' | 'declined';
    permissions?: Permissions;
}

// --- Job Flow Interfaces ---
export interface JobFlowTemplate {
  id: string;
  name: string;
  description: string;
  phases: JobFlowPhase[];
  defaultView: 'kanban' | 'stepper' | 'list';
  space_id: string;
  hubId: string;
}

export interface JobFlowPhase {
  id: string;
  phaseIndex: number;
  name: string;
  tasks: JobFlowTaskTemplate[];
  requiresReview: boolean;
  defaultReviewerId?: string;
}

export interface JobFlowTaskTemplate {
  id: string;
  titleTemplate: string;
  descriptionTemplate?: string;
  defaultAssigneeId: string;
  estimatedDurationDays: number;
  subtaskTemplates?: JobFlowSubtaskTemplate[];
}

export interface JobFlowSubtaskTemplate {
    id: string;
    titleTemplate: string;
    defaultAssigneeId: string;
    estimatedDurationDays: number;
}

export interface Job {
  id: string;
  name: string;
  workflowTemplateId: string;
  space_id: string;
  hubId: string;
  currentPhaseIndex: number;
  status: 'active' | 'completed' | 'on-hold';
  createdAt: string; // ISO string
  createdBy: string; // userId
  roleUserMapping: Record<string, string>; // Maps defaultAssigneeId from template to a real userId
}

// Represents the link between a job and a created task
export interface JobFlowTask {
  id: string;
  jobId: string;
  taskId: string;
  phaseIndex: number;
  createdAt: string;
  reviewedBy?: string; // userId of reviewer
}


// --- Template Interfaces (for building blocks) ---

export interface PhaseTemplate {
    id: string;
    space_id: string;
    hubId: string;
    name: string;
    description?: string;
    tasks: JobFlowTaskTemplate[];
    requiresReview: boolean;
    defaultReviewerId?: string;
}

export interface TaskTemplate {
    id: string;
    space_id: string;
    hubId: string;
    titleTemplate: string;
    descriptionTemplate?: string;
    defaultAssigneeId: string;
    estimatedDurationDays: number;
    subtaskTemplates?: JobFlowSubtaskTemplate[];
}

// --- Chatbot / Inbox Interfaces ---
export interface Bot {
  id: string;
  hubId: string;
  name: string;
  welcomeMessage?: string;
  layout: 'default' | 'compact';
  styleSettings?: {
    primaryColor: string;
    backgroundColor: string;
    logoUrl: string;
    headerTextColor?: string;
    customerTextColor?: string;
  };
  agentIds: string[];
  allowedHelpCenterIds?: string[];
  identityCapture: {
    enabled: boolean;
    required: boolean;
    captureMessage?: string;
  };
  escalationTriggers: {
    billingKeywords?: string[];
    sentimentThreshold?: number;
  };
}

export interface Visitor {
  id: string;
  name: string | null;
  email: string | null;
  avatarUrl?: string;
  location?: {pathname: string, domain: string};
  lastSeen?: string;
  companyName?: string;
  sessions?: number;
  companyId?: string;
  companyUsers?: number;
  companyPlan?: string;
  companySpend?: string;
  contactId?: string;
}

export interface Conversation {
  id: string;
  hubId: string;
  contactId: string | null;
  visitorId?: string | null;
  assigneeId: string | null;
  status: 'bot' | 'human' | 'closed' | 'unassigned';
  lastMessage: string;
  lastMessageAt: string; // ISO String
  lastMessageAuthor: string | null;
  lastMessagePreview?: string;
  updatedAt?: string;
  escalated?: boolean;
  escalationReason?: string;
  visitorName?: string;
  visitorEmail?: string;
  state?: ConversationState;
  lastIntent?: string | null;
  handoff?: {
    status: "none" | "offered" | "declined" | "completed";
    reason?: string;
    offeredAt?: string; // ISO
  } | null;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  authorId: string; // Can be a Visitor ID or a User ID
  type: 'message' | 'note' | 'event';
  content: string;
  timestamp: string; // ISO String
  senderType?: 'contact' | 'agent';
  linked_ticket_id?: string;
  attachments?: Attachment[];
  visibility?: 'public' | 'internal';
  isInternal?: boolean;
}

// --- Help Center Interfaces ---
export interface HelpCenter {
  id: string;
  name: string;
  hubId: string;
  coverImageUrl?: string;
}

export interface HelpCenterCollection {
  id: string;
  name: string;
  description: string;
  hubId: string;
  parentId: string | null;
  helpCenterIds?: string[];
  updatedAt?: string;
}

export interface HelpCenterArticle {
  id: string;
  title: string;
  subtitle?: string;
  content: string;
  status: 'draft' | 'published';
  folderId: string | null;
  helpCenterIds?: string[];
  type: 'article' | 'snippet' | 'pdf';
  authorId: string;
  createdAt: string; // ISO String
  updatedAt: string; // ISO String
  hubId: string;
  spaceId: string;
  isPublic?: boolean;
  allowedUserIds?: string[];
  slug?: string;
  publicUrl?: string;
  language?: string;
}


// --- Mock Data (for initial setup) ---

export const users: Omit<User, 'id'>[] = [
  { name: 'Brad', email: 'brad@test.com', avatarUrl: 'https://placehold.co/100x100/EFEFEF/333333/png?text=B', role: 'Admin' },
  { name: 'Alice', email: 'alice@test.com', avatarUrl: 'https://placehold.co/100x100/EFEFEF/333333/png?text=A', role: 'Member' },
  { name: 'Charlie', email: 'charlie@test.com', avatarUrl: 'https://placehold.co/100x100/EFEFEF/313333/png?text=C', role: 'Member' },
  { name: 'Diana', email: 'diana@test.com', avatarUrl: 'https://placehold.co/100x100/EFEFEF/323333/png?text=D', role: 'Member' },
];

export const spaces: (Omit<Space, 'id'> & { id: string })[] = [
  { id: 'space-1', name: "Brad's Personal Space", members: { 'user-1': { role: 'Admin' } } },
  { id: 'space-2', name: 'Client Work', members: { 'user-1': { role: 'Admin' }, 'user-2': { role: 'Member' }, 'user-3': { role: 'Member' } } },
];

export const hubs: (Omit<Hub, 'id'> & { id: string })[] = [
    {
        id: 'hub-1',
        name: 'Client Onboarding',
        spaceId: 'space-2',
        type: 'tasks',
        createdAt: new Date().toISOString(),
        createdBy: 'user-1',
        settings: { defaultView: 'tasks', components: ['tasks', 'inbox', 'help-center'] },
        isDefault: true,
        statuses: [
              { name: 'Backlog', color: '#6b7280' },
              { name: 'In Progress', color: '#3b82f6' },
              { name: 'In Review', color: '#f59e0b' },
              { name: 'Done', color: '#22c55e' },
        ],
    },
    {
        id: 'hub-2',
        name: 'Support Tickets',
        spaceId: 'space-2',
        type: 'inbox',
        createdAt: new Date().toISOString(),
        createdBy: 'user-1',
        settings: { defaultView: 'inbox', components: ['inbox', 'help-center'] },
        isDefault: false,
        statuses: [
              { name: 'New', color: '#6b7280' },
              { name: 'Assigned', color: '#3b82f6' },
              { name: 'Resolved', color: '#22c55e' },
        ],
    },
    {
        id: 'hub-3',
        name: 'Client Docs',
        spaceId: 'space-2',
        type: 'custom',
        createdAt: new Date().toISOString(),
        createdBy: 'user-1',
        settings: { defaultView: 'documents', components: [] },
        isDefault: false,
        statuses: [],
    }
];

export const projects: Project[] = [
  // This will be empty, projects should be created within hubs
];

export const tasks: Task[] = [
  // Populated by DB seed
];

export const tickets: Ticket[] = [];
export const deals: Deal[] = [];

export const timeEntries: TimeEntry[] = [
  // Populated by DB seed
];

export const slackMeetingLogs: SlackMeetingLog[] = [
  // Populated by DB seed
];

export const channels: Channel[] = [
    // Populated by DB seed
];

export const messages: Message[] = [
    // Populated by DB seed
];

export const visitors: (Omit<Visitor, 'id'> & { id: string })[] = [
    // ... (rest of your mock data)
];

export const conversations: (Omit<Conversation, 'id'> & { id: string })[] = [
    // ... (rest of your mock data)
];

export const chatMessages: (Omit<ChatMessage, 'id'> & { id: string })[] = [
    // ... (rest of your mock data)
];


// MOCK DATA for Admin Mappings
export const adminMappings: Record<string, string> = {
  'channel-design': 'proj-1',
  'channel-mobile': 'proj-2',
};

// --- MOCK JOB FLOW DATA ---

export const taskTemplates: TaskTemplate[] = [];
export const phaseTemplates: PhaseTemplate[] = [];
export const jobFlowTemplates: JobFlowTemplate[] = [];
export const jobs: Job[] = [];
export const jobFlowTasks: JobFlowTask[] = [];

export type { Contact, ContactEvent, ContactEventType, ContactSource, VisitorType, CallRecord } from './contacts-types';

    