

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
  spaces: {
    home: boolean;
    messages: boolean;
    tickets: boolean;
  };
  styleSettings?: {
    primaryColor: string;
    backgroundColor: string;
    logoUrl: string;
    headerTextColor?: string;
    customerTextColor?: string;
  };
  promptButtons?: string[];
  agentIds?: string[];
  allowedHelpCenterIds?: string[];
}

export interface Visitor {
  id: string;
  name: string;
  email: string;
  avatarUrl: string;
  location: {pathname: string, domain: string};
  lastSeen: string;
  companyName: string;
  sessions: number;
  companyId: string;
  companyUsers: number;
  companyPlan: string;
  companySpend: string;
  contactId?: string;
}

export interface Conversation {
  id: string;
  hubId: string;
  contactId: string | null;
  visitorId?: string | null;
  assigneeId: string | null;
  status: 'bot' | 'human' | 'closed';
  lastMessage: string;
  lastMessageAt: string; // ISO String
  lastMessageAuthor: string;
  lastMessagePreview?: string;
  updatedAt?: string;
  escalated?: boolean;
  escalationReason?: string;
  visitorName?: string;
  visitorEmail?: string;
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
  isPublic?: boolean;
  allowedUserIds?: string[];
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
    {
        id: 'contact-1',
        name: 'John Doe',
        email: 'john.doe@example.com',
        avatarUrl: 'https://i.pravatar.cc/150?u=john-doe',
        location: {pathname: '/pricing', domain: 'acme.com'},
        lastSeen: '2 hours ago',
        companyName: 'Acme Inc.',
        sessions: 12,
        companyId: 'comp-1',
        companyUsers: 5,
        companyPlan: 'Enterprise',
        companySpend: '$5,000'
    },
    {
        id: 'contact-2',
        name: 'Jane Smith',
        email: 'jane.smith@example.com',
        avatarUrl: 'https://i.pravatar.cc/150?u=jane-smith',
        location: {pathname: '/about', domain: 'innovate.com'},
        lastSeen: '5 minutes ago',
        companyName: 'Innovate LLC',
        sessions: 3,
        companyId: 'comp-2',
        companyUsers: 1,
        companyPlan: 'Startup',
        companySpend: '$250'
    },
    {
        id: 'contact-3',
        name: 'Sarah Lee',
        email: 'sarah.lee@example.com',
        avatarUrl: 'https://i.pravatar.cc/150?u=sarah-lee',
        location: {pathname: '/', domain: 'tech.com'},
        lastSeen: '1 day ago',
        companyName: 'Tech Solutions',
        sessions: 25,
        companyId: 'comp-3',
        companyUsers: 20,
        companyPlan: 'Business',
        companySpend: '$1,200'
    },
    {
        id: 'contact-4',
        name: 'Mike Chen',
        email: 'mike.chen@example.com',
        avatarUrl: 'https://i.pravatar.cc/150?u=mike-chen',
        location: {pathname: '/contact', domain: 'creative.co'},
        lastSeen: '3 hours ago',
        companyName: 'Creative Co.',
        sessions: 8,
        companyId: 'comp-4',
        companyUsers: 10,
        companyPlan: 'Pro',
        companySpend: '$800'
    },
    {
        id: 'contact-5',
        name: 'Emily Carter',
        email: 'emily.carter@example.com',
        avatarUrl: 'https://i.pravatar.cc/150?u=emily-carter',
        location: {pathname: '/features', domain: 'datasys.com'},
        lastSeen: '15 minutes ago',
        companyName: 'Data Systems',
        sessions: 5,
        companyId: 'comp-5',
        companyUsers: 2,
        companyPlan: 'Pro',
        companySpend: '$500'
    },
    {
        id: 'contact-6',
        name: 'David Rodriguez',
        email: 'david.r@example.com',
        avatarUrl: 'https://i.pravatar.cc/150?u=david-rodriguez',
        location: {pathname: '/blog', domain: 'global-exports.com'},
        lastSeen: 'Now',
        companyName: 'Global Exports',
        sessions: 1,
        companyId: 'comp-6',
        companyUsers: 50,
        companyPlan: 'Enterprise',
        companySpend: '$10,000'
    },
    {
        id: 'contact-7',
        name: 'Olivia Martinez',
        email: 'olivia.m@example.com',
        avatarUrl: 'https://i.pravatar.cc/150?u=olivia-martinez',
        location: {pathname: '/jobs', domain: 'bright.co'},
        lastSeen: '20 minutes ago',
        companyName: 'Bright Ideas Co.',
        sessions: 7,
        companyId: 'comp-7',
        companyUsers: 3,
        companyPlan: 'Pro',
        companySpend: '$600'
    },
    {
        id: 'contact-8',
        name: 'Daniel Kim',
        email: 'daniel.k@example.com',
        avatarUrl: 'https://i.pravatar.cc/150?u=daniel-kim',
        location: {pathname: '/', domain: 'future.tech'},
        lastSeen: '8 hours ago',
        companyName: 'Future Tech',
        sessions: 15,
        companyId: 'comp-8',
        companyUsers: 30,
        companyPlan: 'Business',
        companySpend: '$2,500'
    },
    {
        id: 'contact-9',
        name: 'Test User',
        email: 'test.user@example.com',
        avatarUrl: 'https://i.pravatar.cc/150?u=test-user',
        location: {pathname: '/test', domain: 'test.com'},
        lastSeen: new Date().toISOString(),
        companyName: 'Test Corp',
        sessions: 1,
        companyId: 'comp-9',
        companyUsers: 1,
        companyPlan: 'Test Plan',
        companySpend: '$0'
    }
];

export const conversations: (Omit<Conversation, 'id'> & { id: string })[] = [
    {
        id: 'convo-9',
        hubId: 'hub-1',
        contactId: 'contact-9',
        assigneeId: 'user-1', // Assigned to Brad
        status: 'open',
        lastMessage: 'Yes, I can see your test message!',
        lastMessageAt: new Date(Date.now() - 30 * 1000).toISOString(),
        lastMessageAuthor: 'Brad',
    },
    {
        id: 'convo-1',
        hubId: 'hub-1',
        contactId: 'contact-1',
        assigneeId: 'user-1',
        status: 'open',
        lastMessage: 'Hi John, I can certainly help with that. Can you provide me with your order number?',
        lastMessageAt: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
        lastMessageAuthor: 'Brad',
    },
    {
        id: 'convo-2',
        hubId: 'hub-1',
        contactId: 'contact-2',
        assigneeId: null,
        status: 'unassigned',
        lastMessage: 'Can you help me with setting up my account? I am having trouble.',
        lastMessageAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        lastMessageAuthor: 'Jane Smith',
    },
    {
        id: 'convo-3',
        hubId: 'hub-1',
        contactId: 'contact-3',
        assigneeId: 'user-2',
        status: 'open',
        lastMessage: 'Thanks, Alice! That worked perfectly.',
        lastMessageAt: new Date(Date.now() - 22 * 60 * 60 * 1000).toISOString(),
        lastMessageAuthor: 'Sarah Lee',
    },
    {
        id: 'convo-4',
        hubId: 'hub-1',
        contactId: 'contact-4',
        assigneeId: 'user-1',
        status: 'closed',
        lastMessage: 'You\'re welcome! Let us know if you need anything else.',
        lastMessageAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        lastMessageAuthor: 'Brad',
    },
    {
        id: 'convo-5',
        hubId: 'hub-1',
        contactId: 'contact-5',
        assigneeId: 'user-2',
        status: 'open',
        lastMessage: 'I\'m looking for pricing information for your team plan.',
        lastMessageAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
        lastMessageAuthor: 'Emily Carter',
    },
    {
        id: 'convo-6',
        hubId: 'hub-1',
        contactId: 'contact-6',
        assigneeId: null,
        status: 'unassigned',
        lastMessage: 'Hello? Is anyone there?',
        lastMessageAt: new Date(Date.now() - 1 * 60 * 1000).toISOString(),
        lastMessageAuthor: 'David Rodriguez',
    },
    {
        id: 'convo-7',
        hubId: 'hub-1',
        contactId: 'contact-7',
        assigneeId: 'user-2',
        status: 'open',
        lastMessage: 'Perfect, I\'ll take a look at that now. Thanks, Alice!',
        lastMessageAt: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
        lastMessageAuthor: 'Olivia Martinez',
    },
    {
        id: 'convo-8',
        hubId: 'hub-1',
        contactId: 'contact-8',
        assigneeId: null,
        status: 'unassigned',
        lastMessage: 'My dashboard isn\'t loading any data.',
        lastMessageAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
        lastMessageAuthor: 'Daniel Kim',
    }
];

export const chatMessages: (Omit<ChatMessage, 'id'> & { id: string })[] = [
    {
        id: 'msg-1',
        conversationId: 'convo-1',
        authorId: 'contact-1',
        type: 'message',
        content: 'Hey, I have a question about my recent order. It seems to be delayed.',
        timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    },
     {
        id: 'msg-3',
        conversationId: 'convo-1',
        authorId: 'user-1',
        type: 'message',
        content: 'Hi John, I can certainly help with that. Can you provide me with your order number?',
        timestamp: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
    },
    {
        id: 'msg-2',
        conversationId: 'convo-2',
        authorId: 'contact-2',
        type: 'message',
        content: 'Can you help me with setting up my account? I am having trouble.',
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    },
    {
        id: 'msg-4',
        conversationId: 'convo-3',
        authorId: 'contact-3',
        type: 'message',
        content: 'I\'m having trouble exporting my data. It keeps giving me an error.',
        timestamp: new Date(Date.now() - 23 * 60 * 60 * 1000).toISOString(),
    },
    {
        id: 'msg-5',
        conversationId: 'convo-3',
        authorId: 'user-2',
        type: 'message',
        content: 'Hi Sarah, sorry to hear that. Could you try clearing your browser cache and trying again? That often resolves the issue.',
        timestamp: new Date(Date.now() - 22 * 60 * 60 * 1000 - 30000).toISOString(),
    },
    {
        id: 'msg-6',
        conversationId: 'convo-3',
        authorId: 'contact-3',
        type: 'message',
        content: 'Thanks, Alice! That worked perfectly.',
        timestamp: new Date(Date.now() - 22 * 60 * 60 * 1000).toISOString(),
    },
    {
        id: 'msg-7',
        conversationId: 'convo-4',
        authorId: 'contact-4',
        type: 'message',
        content: 'Just wanted to say this new feature is amazing! Great job.',
        timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000 - 60000).toISOString(),
    },
    {
        id: 'msg-8',
        conversationId: 'convo-4',
        authorId: 'user-1',
        type: 'message',
        content: 'Thanks so much, Mike! We really appreciate the feedback.',
        timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000 - 30000).toISOString(),
    },
    {
        id: 'msg-9',
        conversationId: 'convo-4',
        authorId: 'user-1',
        type: 'message',
        content: 'You\'re welcome! Let us know if you need anything else.',
        timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
        id: 'msg-10',
        conversationId: 'convo-5',
        authorId: 'contact-5',
        type: 'message',
        content: 'I\'m looking for pricing information for your team plan.',
        timestamp: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    },
    {
        id: 'msg-11',
        conversationId: 'convo-6',
        authorId: 'contact-6',
        type: 'message',
        content: 'Hello? Is anyone there?',
        timestamp: new Date(Date.now() - 1 * 60 * 1000).toISOString(),
    },
    {
        id: 'msg-12',
        conversationId: 'convo-7',
        authorId: 'contact-7',
        type: 'message',
        content: 'I\'m having trouble finding my recent invoices.',
        timestamp: new Date(Date.now() - 27 * 60 * 1000).toISOString(),
    },
    {
        id: 'msg-13',
        conversationId: 'convo-7',
        authorId: 'user-2',
        type: 'message',
        content: 'Hi Olivia! You can find all your invoices under the "Billing" section in your account settings.',
        timestamp: new Date(Date.now() - 26 * 60 * 1000).toISOString(),
    },
    {
        id: 'msg-14',
        conversationId: 'convo-7',
        authorId: 'contact-7',
        type: 'message',
        content: 'Perfect, I\'ll take a look at that now. Thanks, Alice!',
        timestamp: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
    },
    {
        id: 'msg-15',
        conversationId: 'convo-8',
        authorId: 'contact-8',
        type: 'message',
        content: 'My dashboard isn\'t loading any data.',
        timestamp: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
    },
    {
        id: 'msg-16',
        conversationId: 'convo-9',
        authorId: 'contact-9',
        type: 'message',
        content: 'I am a test message, can you see me?',
        timestamp: new Date(Date.now() - 1 * 60 * 1000).toISOString(),
    },
    {
        id: 'msg-17',
        conversationId: 'convo-9',
        authorId: 'user-1',
        type: 'message',
        content: 'Yes, I can see your test message!',
        timestamp: new Date(Date.now() - 30 * 1000).toISOString(),
    }
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

    
