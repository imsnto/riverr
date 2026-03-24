
// src/lib/data.ts

// --- Core Entities ---
export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl: string;
  role: 'Admin' | 'Member'; // Global role
  onboardingComplete?: boolean;
  onboardingIntent?: string;
  notificationPrefs?: NotificationPrefs;
  preferences?: {
    inboxView?: 'team' | 'mine';
  };
}

export interface NotificationPrefs {
  pushEnabled: boolean;
  emailEnabled: boolean;
}

export interface PushToken {
  id: string;
  token: string;
  platform: 'web';
  enabled: boolean;
  createdAt: string;
  lastSeenAt: string;
  userAgent?: string;
}

export type HubRole = 'admin' | 'member' | 'viewer';

export interface SpaceMember {
  role: 'admin' | 'member' | 'viewer';
  hubAccess?: {
    [hubId: string]: HubRole;
  }
}

export interface Space {
  id: string;
  name: string;
  logoUrl?: string;
  members: Record<string, { role: string }>; // Map of user IDs to their roles
  isSystem?: boolean;
  isOnboarding?: boolean;
  comms?: {
    twilio?: {
      subaccountSid: string;
      status: 'active' | 'pending' | 'suspended';
      provisionedAt: any;
    }
  };
  emailSettings?: {
    replyToEmail?: string;
  };
}

export type ConversationStatus = 'new' | 'automated' | 'ai_active' | 'waiting_human' | 'resolved' | 'open' | 'unassigned' | 'waiting_on_customer' | 'closed';
export type ResponderType = 'automation' | 'ai' | 'human' | 'system';

export type ResolutionStatus =
  | 'unresolved'
  | 'resolved'
  | 'resolution_uncertain'
  | 'unresolved_abandoned'
  | 'unresolved_escalated';

export type ResolutionSource =
  | 'agent_marked'
  | 'customer_confirmed'
  | 'ai_inferred'
  | 'system_timeout'
  | 'phone_disposition';

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
  statuses?: Status[]; // For Projects
  ticketStatuses?: Status[]; // For Tickets
  dealStatuses?: Status[]; // For Deals
  closingStatusName?: string;
  ticketClosingStatusName?: string;
  dealClosingStatusName?: string;
}

// --- Intelligence Pipeline Models ---

export interface ImportedSource {
  id: string;
  spaceId: string;
  hubId?: string | null;

  sourceType: 'pdf' | 'json' | 'csv' | 'email_export' | 'text' | 'other';
  filename?: string | null;
  originalMimeType?: string | null;
  uploadedByUserId?: string | null;
  uploadedByName?: string | null;

  status: 'uploaded' | 'parsing' | 'extracting' | 'completed' | 'failed';
  visibility: 'private';

  stats?: {
    rawUnitCount?: number;
    chunkCount?: number;
    insightCount?: number;
    topicMatches?: number;
  };

  createdAt: string;
  updatedAt: string;
}

export interface SourceChunk {
  id: string;
  spaceId: string;
  importedSourceId: string;

  chunkType: 'semantic_section' | 'message_group' | 'page_block' | 'record_group';
  content: string;

  internalOnly: true;

  embeddingStatus: 'pending' | 'ready' | 'failed';
  embeddingModel?: string | null;
  embeddingVersion?: 'v2' | string | null;
  vectorDocId?: string | null;
  embeddingUpdatedAt?: string | null;

  sourceMetadata?: {
    page?: number | null;
    sectionTitle?: string | null;
    threadId?: string | null;
    messageIds?: string[];
  };

  createdAt: string;
  updatedAt: string;
}

export interface Insight {
  id: string;
  spaceId: string;
  hubId?: string | null;
  topicId?: string | null;

  title: string;
  summary: string;
  content: string; // Structured text (Issue/Resolution/Context)

  kind: 
    | 'support_resolution' 
    | 'operational_knowledge' 
    | 'policy_clarification' 
    | 'product_behavior' 
    | 'imported_learning';

  source: {
    type: 'conversation_message' | 'imported_source' | 'manual_entry';
    importedSourceId?: string | null;
    chunkIds?: string[];
    conversationId?: string | null;
    messageId?: string | null;
    channel?: 'webchat' | 'sms' | 'email' | 'voice' | 'other';
    provider?: string | null;
    label?: string | null;
  };

  author: {
    userId?: string | null;
    name?: string | null;
  };

  customer?: {
    contactId?: string | null;
    name?: string | null;
    email?: string | null;
    phone?: string | null;
  };

  issueLabel?: string | null;
  resolutionLabel?: string | null;

  signalScore?: number | null;
  signalLevel?: 'low' | 'medium' | 'high';

  processingStatus: 'pending' | 'processing' | 'completed' | 'failed' | 'pending_resolution';
  groupingStatus: 'ungrouped' | 'grouped' | 'ignored';

  visibility: 'private';
  origin: 'automatic' | 'manual' | 'imported';

  embeddingStatus: 'pending' | 'ready' | 'failed';
  embeddingModel?: string | null;
  embeddingVersion?: 'v2' | string | null;
  vectorDocId?: string | null;
  embeddingUpdatedAt?: string | null;

  createdAt: string;
  updatedAt: string;
  ingestedAt: string;
}

export interface Topic {
  id: string;
  spaceId: string;
  hubId?: string | null;

  title: string;
  summary?: string | null;

  insightCount: number;
  signalLevel: 'low' | 'medium' | 'high';

  articleId?: string | null; // If promoted to an article

  embeddingStatus: 'pending' | 'ready' | 'failed';
  embeddingModel?: string | null;
  embeddingVersion?: 'v2' | string | null;
  vectorDocId?: string | null;
  embeddingUpdatedAt?: string | null;

  createdAt: string;
  updatedAt: string;
}

export interface Article {
  id: string;
  spaceId: string;
  hubId: string;

  sourceType: 'topic' | 'insight' | 'manual';
  sourceTopicId?: string | null;
  sourceInsightId?: string | null;

  destinationLibraryId: string;
  visibility: 'private' | 'public';

  title: string;
  subtitle?: string;
  body: string;
  summary?: string | null;

  status: 'draft' | 'published';

  authorId: string;

  embeddingStatus: 'pending' | 'ready' | 'failed';
  embeddingModel?: string | null;
  embeddingVersion?: 'v2' | string | null;
  vectorDocId?: string | null;
  embeddingUpdatedAt?: string | null;

  createdAt: string;
  updatedAt: string;
}

// --- Core Workspace Entities ---

export interface Project {
  id: string;
  name: string;
  key?: string; // e.g., "XY"
  taskCounter?: number;
  spaceId?: string;
  hubId: string; // Hub scope
  members: string[]; // array of user IDs
  status: 'Active' | 'On Hold' | 'Archived';
  createdBy?: string;
  defaultView?: 'board' | 'list' | 'table' | 'timeline';
}

export interface Task {
  id: string;
  taskKey?: string; // e.g., "XY-1"
  name: string;
  description?: string;
  project_id: string | null; 
  hubId: string;
  spaceId: string;
  status: string;
  createdAt?: string;
  createdBy?: string;
  assigned_to?: string | null;
  due_date?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  sortOrder?: number | null;
  priority?: 'Low' | 'Medium' | 'High' | 'Urgent' | null;
  sprint_points?: number | null;
  tags?: string[];
  time_estimate?: number | null; 
  parentId?: string | null; 
  relationships?: TaskRelationship[];
  comments?: Comment[];
  attachments?: Attachment[];
  linkedTicketId?: string;
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
  channel: 'Widget' | 'OpenPhone' | 'Order' | 'Manual' | 'email' | null;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
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
  status: string;
  title: string;
  description: string | null;
  value: number | null;
  currency: string | null;
  closeDate: string | null;
  nextStep: string | null;
  nextStepAt: string | null;
  assignedTo: string | null;
  contactId: string | null;
  source: 'Inbound Chat' | 'Referral' | 'Website' | 'Manual' | 'Import' | null;
  tags?: string[];
  isStale?: boolean;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  lastActivityAt: string;
}

export interface EscalationIntakeRule {
  id: string;
  hubId: string;
  enabled: boolean;
  name: string;
  allowedSourceHubIds: string[];
  allowedTypes: ("bug" | "feature" | "investigation")[];
  destinationBoardId: string;
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
        templateId?: string;
        taskTitle?: string;
        assignTo?: string;
        field?: string;
        value?: any;
        channel?: string;
        message?: string;
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
  hubId: string;
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

export interface Message {
  id: string;
  channel_id: string;
  user_id: string;
  content: string;
  timestamp: string;
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
  createdAt: string;
}

export interface Activity {
  id: string;
  user_id: string;
  timestamp: string;
  type: 'task_creation' | 'status_change' | 'assignee_change' | 'comment' | 'priority_change' | 'due_date_change' | 'subtask_completion' | 'ticket_creation';
  from?: string;
  to?: string;
  comment_id?: string;
  comment?: string;
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
  start_time: string;
  end_time: string;
  duration: number;
  spaceId: string;
}

export interface SlackMeetingLog {
    id: string;
    user_id: string;
    channel_name: string;
    meeting_start: string;
    duration: number;
    project_id?: string;
}

export interface Invite {
  id: string;
  spaceId: string;
  spaceName: string;
  email: string;
  spaceRole: 'Member' | 'Admin' | 'Viewer';
  hubAccess?: { [hubId: string]: 'Hub Admin' | 'Member' | 'Viewer' | 'None' };
  status: 'pending' | 'accepted' | 'expired';
  expiresAt?: any;
  createdBy: string;
  createdAt: any;
  tokenHash?: string;
  sentAt?: any;
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
  createdAt: string;
  createdBy: string;
  roleUserMapping: Record<string, string>;
}

export interface JobFlowTask {
  id: string;
  jobId: string;
  taskId: string;
  phaseIndex: number;
  createdAt: string;
  reviewedBy?: string;
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

// --- Automation Flows ---
export type AutomationNodeType = 'start' | 'message' | 'quick_reply' | 'capture_input' | 'condition' | 'ai_step' | 'handoff' | 'end' | 'ai_classifier' | 'identity_form';

export interface AutomationNode {
  id: string;
  type: AutomationNodeType;
  position: { x: number; y: number };
  data: {
    text?: string;
    buttons?: { id: string; label: string; nextStepId?: string }[];
    defaultNextStepId?: string;
    variableName?: string;
    prompt?: string;
    conditionField?: 'email' | 'name' | 'identified';
    conditionValue?: string;
    matchNextStepId?: string;
    fallbackNextStepId?: string;
    intents?: { id: string; label: string; nextStepId?: string; description?: string }[];
    saveToProfile?: boolean;
    inputType?: 'text' | 'email' | 'phone' | 'number' | 'url';
    validation?: {
      errorMessage?: string;
      retryAttempts?: number;
    };
  };
}

export interface AutomationEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
}

export interface AutomationFlow {
  nodes: AutomationNode[];
  edges: AutomationEdge[];
}

// --- Intelligence Retrieval Types ---

export type IntelligenceAccessLevel = 
  | 'none' 
  | 'topics_only' 
  | 'insights_hidden_support' 
  | 'internal_full_access';

// --- Chatbot / Inbox Interfaces ---
export interface Bot {
  id: string;
  type: 'agent' | 'widget';
  hubId: string;
  spaceId: string;
  name: string;
  webAgentName?: string;
  roleTitle?: string;
  isEnabled?: boolean;
  aiEnabled?: boolean;
  
  intelligenceAccessLevel?: IntelligenceAccessLevel;

  tone?: 'formal' | 'friendly' | 'expert' | 'direct' | 'warm';
  voiceNotes?: string;
  primaryGoal?: string;
  closingTemplate?: string;

  businessContext?: {
    businessName: string;
    location?: string;
    whatYouDo: string;
    targetAudience: string;
    hours?: string;
    minOrder?: string;
    turnaround?: string;
    differentiation?: string;
    forbiddenTopics?: string;
  };
  
  welcomeMessage?: string;
  assignedAgentId?: string | null;
  layout: 'default' | 'compact';
  styleSettings?: {
    primaryColor: string;
    backgroundColor: string;
    logoUrl: string;
    chatbotIconsColor: string;
    chatbotIconsTextColor: string;
    headerTextColor?: string;
    customerTextColor?: string;
    agentMessageBackgroundColor?: string;
    agentMessageTextColor?: string;
  };
  agentIds: string[];
  allowedHelpCenterIds?: string[];
  identityCapture: {
    enabled: boolean;
    required: boolean;
    timing: 'before' | 'after';
    captureMessage?: string;
    fields: {
      name: boolean;
      email: boolean;
      phone: boolean;
    };
  };
  conversationGoal?: string; 
  automations?: {
    handoffKeywords?: string[];
    quickReplies?: string[];
  };
  flow?: AutomationFlow; 
  channelConfig?: {
    web?: { 
      enabled: boolean;
      greeting?: { text: string; returningText?: string };
    };
  };
}

export interface Visitor {
  id: string;
  name: string | null;
  email: string | null;
  phone?: string | null;
  avatarUrl?: string;
  location?: {pathname: string, domain: string};
  lastSeen?: string;
  contactId?: string;
}

export interface Conversation {
  id: string;
  hubId: string;
  spaceId: string;
  contactId: string | null;
  visitorId?: string | null;
  assigneeId: string | null;
  assignedAgentIds?: string[];
  status: ConversationStatus;
  
  // Resolution System
  resolutionStatus: ResolutionStatus;
  resolutionSource?: ResolutionSource | null;
  resolvedAt?: string | null;
  resolvedByUserId?: string | null;
  resolvedByName?: string | null;
  resolutionSummary?: string | null;
  customerConfirmed?: boolean;
  customerConfirmationAt?: string | null;
  disposition?: string | null;

  lastMessage: string;
  lastMessageAt: string;
  lastMessageAuthor: string | null;
  visitorName?: string;
  visitorEmail?: string;
  visitorPhone?: string;
  channel: 'webchat' | 'sms' | 'voice' | 'email';
  ownerType: 'hub' | 'user';
  ownerAgentId: string | null;
  sharedWithTeam: boolean;
  typing?: Record<string, boolean>;
  lastAgentSeenAtByAgent?: Record<string, string>;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  authorId: string;
  type: 'message' | 'note' | 'event';
  responderType?: ResponderType;
  content: string;
  timestamp: string;
  senderType?: 'visitor' | 'agent' | 'bot' | 'contact';
  attachments?: Attachment[];
  deliveryStatus?: 'created'|'queued'|'sent'|'delivered'|'failed'|'undelivered';
  emailHeaders?: {
    messageId: string;
    inReplyTo?: string;
    references?: string;
  };
}

// --- Comms Config ---
export interface PhoneChannelLookup {
  id: string;
  spaceId: string;
  hubId: string;
  channelAddress: string;
  isActive: boolean;
  twilioSubaccountSid: string;
  label?: string;
  autoAckEnabled?: boolean;
  autoAckText?: string;
  updatedAt: any;
}

// --- Help Center ---
export interface HelpCenter {
  id: string;
  name: string;
  hubId: string;
  icon?: string;
  coverImageUrl?: string;
  visibility?: 'public' | 'internal';
  customDomain?: string;
  primaryDomainType?: 'default' | 'custom';
}

export interface HelpCenterCollection {
  id: string;
  name: string;
  description: string;
  hubId: string;
  parentId: string | null;
  helpCenterId: string;
  updatedAt?: string;
}

export interface HelpCenterArticle {
  id: string;
  title: string;
  subtitle?: string;
  content: string;
  status: 'draft' | 'published';
  folderId: string | null;
  helpCenterId: string;
  authorId: string;
  createdAt: string;
  updatedAt: string;
  hubId: string;
  spaceId: string;
  type: 'article' | 'snippet' | 'playbook' | 'pdf';
  visibility: 'public' | 'private';
  allowedUserIds?: string[];
  isAiIndexed: boolean;
  isSeoIndexed: boolean;
  publicUrl?: string;
  chunkCount?: number;
  chunkedAt?: string;
}

// --- Brain Jobs ---
export interface BrainJob {
    id: string;
    type: 
      | 'ingest_conversations' 
      | 'distill_support_intents' 
      | 'distill_sales_intelligence' 
      | 'cluster_sales_personas' 
      | 'process_imported_source' 
      | 'process_vector_indexing';
    status: 'pending' | 'running' | 'completed' | 'failed';
    params: Record<string, any>;
    createdAt: string;
    startedAt?: string;
    completedAt?: string;
    error?: string;
    progress?: {
        current: number;
        total: number;
        message: string;
    }
}

export interface EmailTokens {
  accessToken: string;
  refreshToken: string;
  tokenExpiry: string;
}

export interface WatchConfig {
  historyId: string;
  expiresAt: string;
}

export type EmailProviderName = 'google' | 'microsoft' | 'imap';

export interface EmailConfig {
  id: string;
  label: string;
  provider: EmailProviderName;
  emailAddress: string;
  connected: boolean;
  accessToken: string;
  refreshToken: string;
  tokenExpiry: string;
  watchConfig?: WatchConfig;
  connectedBy: string;
  connectedAt: string;
  aiMode: 'off' | 'suggest' | 'auto';
  autoAckEnabled?: boolean;
  autoAckSubject?: string;
  autoAckBody?: string;
}
