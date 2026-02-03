export type ContactSource = "order" | "chat" | "manual" | "call";

export interface Contact {
  id: string;
  spaceId: string;
  name: string | null;
  company: string | null;
  emails: string[];
  phones: string[];
  primaryEmail: string | null;
  primaryPhone: string | null;
  source: ContactSource;
  externalIds: Record<string, string>;
  tags: string[];
  createdAt: any; // Firebase Timestamp
  updatedAt: any; // Firebase Timestamp
  lastSeenAt: any | null;
  lastMessageAt: any | null;
  lastOrderAt: any | null;
  lastCallAt: any | null;
  mergeParentId: string | null;
  isMerged: boolean;
}

export type VisitorType = "chat" | "call";

export interface Visitor {
  id: string;
  spaceId: string;
  visitorId: string;
  visitorType: VisitorType;
  anonymous: boolean;
  firstSeenAt: any; // Timestamp
  lastSeenAt: any; // Timestamp
  contactId: string | null;
  emails: string[];
  phones: string[];
  name: string | null;
  activeConversationId: string | null;
  metadata: Record<string, any>;
}

export type ContactEventType =
  | "chat_started"
  | "chat_message"
  | "order_created"
  | "call_started"
  | "call_missed"
  | "call_completed"
  | "voicemail_received"
  | "note"
  | "identity_added"
  | "contact_merged";

export interface ContactEvent {
  id: string;
  type: ContactEventType;
  timestamp: any; // Timestamp
  summary: string;
  ref: Record<string, any>;     // { conversationId, orderId, visitorId, openPhoneCallId, callId }
  payload?: Record<string, any>;
}

export interface CallRecord {
  id: string;
  spaceId: string;
  callId: string;
  openPhoneCallId: string;
  openPhoneNumberId: string;
  contactId: string | null;
  visitorId: string | null;
  direction: "inbound" | "outbound";
  fromPhone: string | null;
  toPhone: string | null;
  durationSec: number | null;
  outcome: "completed" | "missed" | "voicemail" | "unknown";
  recordingUrl: string | null;
  createdAt: any;
  updatedAt: any;
}
