# Manowar — AI Business OS: Full Documentation

> **Project codename:** `riverr` (repository) / **Product name:** Manowar  
> **Version:** 0.1.0  
> **Last reviewed:** March 2026

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Technology Stack](#2-technology-stack)
3. [Architecture Overview](#3-architecture-overview)
4. [Project Structure](#4-project-structure)
5. [Core Data Models](#5-core-data-models)
6. [Feature Modules](#6-feature-modules)
   - 6.1 [Spaces & Hubs](#61-spaces--hubs)
   - 6.2 [Project & Task Management](#62-project--task-management)
   - 6.3 [Inbox & Conversations](#63-inbox--conversations)
   - 6.4 [CRM — Contacts, Tickets & Deals](#64-crm--contacts-tickets--deals)
   - 6.5 [Help Center & Knowledge Base](#65-help-center--knowledge-base)
   - 6.6 [AI Agents & Bot System](#66-ai-agents--bot-system)
   - 6.7 [Job Flows & Automation](#67-job-flows--automation)
   - 6.8 [Time Tracking & Timesheets](#68-time-tracking--timesheets)
   - 6.9 [Documents](#69-documents)
   - 6.10 [Support Intelligence Pipeline](#610-support-intelligence-pipeline)
7. [AI & Genkit Flows](#7-ai--genkit-flows)
8. [Communication Channels](#8-communication-channels)
9. [API Routes](#9-api-routes)
10. [Firebase & Database Layer](#10-firebase--database-layer)
11. [Authentication & Authorization](#11-authentication--authorization)
12. [Routing & Navigation](#12-routing--navigation)
13. [Environment Variables](#13-environment-variables)
14. [Running the Project](#14-running-the-project)
15. [Key Design Decisions](#15-key-design-decisions)

---

## 1. Project Overview

**Manowar** is a comprehensive, multi-tenant **AI-powered Business Operating System** designed to unify a company's communication, project management, CRM, and intelligence workflows in a single product.

The defining feature is an **intelligence layer**: AI Agents that handle customer-facing communication across Web Chat, SMS, Email, and Voice — all grounded in a knowledge base built from your own documentation and resolved support conversations.

### Core Concept: Spaces → Hubs → Tools

```
Space (Organisation / Company)
  └── Hub (Team Workspace, e.g. "Customer Support", "Sales")
        └── Views / Tools (Tasks, Inbox, Deals, Tickets, Help Center, ...)
```

- **Space** — top-level organisation. Owns phone numbers, members, and global CRM contacts.
- **Hub** — a focused workspace. Each hub activates specific tool panels (views). Hubs can be private.
- **Personal scope** — every user has a personal inbox and personal AI agent for private productivity.

---

## 2. Technology Stack

| Layer | Technology |
|---|---|
| **Framework** | [Next.js 15](https://nextjs.org/) (App Router, Turbopack) |
| **UI Library** | React 18 |
| **Language** | TypeScript 5 |
| **Styling** | Tailwind CSS 3.x + ShadCN UI (Radix primitives) |
| **Rich Text Editor** | Tiptap 2.x (with 15+ extensions) |
| **Flow/Graph UI** | `@xyflow/react` (React Flow) — for bot automation builder |
| **Backend** | Firebase (Firestore, Auth, Storage, Cloud Functions) |
| **AI Runtime** | [Genkit 1.x](https://firebase.google.com/products/genkit) with Google Gemini 2.0 Flash |
| **Embeddings** | `text-embedding-004` via Google Vertex AI |
| **Vector/Search** | Vertex AI Vector Search (Google Cloud) |
| **Communications** | Twilio (SMS + Voice) |
| **Email** | Postmark (transactional) + Google Workspace (Gmail sync via OAuth) |
| **Charts** | Recharts |
| **Date Utils** | date-fns |
| **Forms** | react-hook-form + Zod validation |
| **Deployment** | Firebase App Hosting (`apphosting.yaml`) |

---

## 3. Architecture Overview

```
┌────────────────────────────────────────────────────────────────┐
│                     Next.js 15 Frontend                        │
│  App Router │ RSC + Client Components │ ShadCN UI              │
└──────────────┬─────────────────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────────────┐
│               Firebase Backend                               │
│  ┌──────────┐  ┌────────────┐  ┌──────────┐  ┌──────────┐  │
│  │Firestore │  │   Auth     │  │ Storage  │  │Functions │  │
│  │(real-time│  │(Google /   │  │(assets,  │  │(webhooks,│  │
│  │  data)   │  │Email link) │  │ uploads) │  │ invites) │  │
│  └──────────┘  └────────────┘  └──────────┘  └──────────┘  │
└──────────────────────────────────────────────────────────────┘
               │
               ▼
┌────────────────────────────────────────────────────────────────┐
│               AI & Intelligence Layer                          │
│  Genkit 1.x ─── Google Gemini 2.0 Flash                       │
│  Vertex AI Embeddings (text-embedding-004)                     │
│  Vertex AI Vector Search ─── Firestore (source of truth)       │
└────────────────────────────────────────────────────────────────┘
               │
               ▼
┌────────────────────────────────────────────────────────────────┐
│             External Communication APIs                        │
│   Twilio (SMS / Voice)   │   Postmark (Email)                  │
│   Google Workspace API (Gmail sync)                            │
└────────────────────────────────────────────────────────────────┘
```

### Key Data Flow Patterns

| Flow | Description |
|---|---|
| **Inbound Email/SMS** | Webhook → routed via `emailIndex` / `phoneLookup` → AI Agent drafts or auto-replies → appears in Hub Inbox |
| **Knowledge Indexing** | Article published → Cloud Function generates embedding → upserted to Vertex AI Vector Search → queried during bot chat |
| **Ticket Escalation** | Ticket marked as "Bug" → Escalation rule matched → Task created in Dev Hub → statuses kept in sync |
| **Brain Jobs** | Async background jobs distill support intents, cluster sales personas, recommend next-best actions |

---

## 4. Project Structure

```
riverr/
├── src/
│   ├── app/
│   │   ├── (app)/                        # Authenticated app shell
│   │   │   ├── layout.tsx                # Global sidebar + space/hub context
│   │   │   ├── space/[spaceId]/
│   │   │   │   ├── hubs/                 # Hub listing page
│   │   │   │   └── hub/[hubId]/[view]/   # Dynamic hub view (tasks, inbox, deals…)
│   │   │   ├── contacts/                 # Global contacts CRM
│   │   │   ├── documents/                # Documents browser
│   │   │   ├── profile/                  # User profile settings
│   │   │   └── admin/                    # Admin panel
│   │   ├── api/                          # Next.js API route handlers
│   │   │   ├── admin/                    # Admin endpoints
│   │   │   ├── bot-settings/             # Bot configuration API
│   │   │   ├── email/                    # Email webhook handler
│   │   │   ├── notifications/            # Push notification endpoints
│   │   │   ├── unread/                   # Unread message count API
│   │   │   └── widget/                   # Chat widget embed API
│   │   ├── chatbot/                      # Embeddable chatbot page
│   │   ├── docs/                         # Public-facing help docs
│   │   ├── hc/                           # Help Center public portal
│   │   ├── join/                         # Invite acceptance flow
│   │   ├── login/                        # Authentication page
│   │   ├── onboarding/                   # New user onboarding wizard
│   │   ├── space-selection/              # Space picker for multi-tenant
│   │   └── unauthorized/                 # Access-denied page
│   ├── ai/
│   │   ├── genkit.ts                     # Genkit instance initialisation
│   │   ├── dev.ts                        # Genkit dev server entry
│   │   └── flows/                        # 13 individual AI flows (see §7)
│   ├── components/
│   │   ├── dashboard/                    # Sidebar, TopNav, modals, skeletons
│   │   ├── document/                     # Document viewer/editor components
│   │   ├── editor/                       # Tiptap rich-text editor configuration
│   │   └── ui/                           # ShadCN primitive components
│   ├── hooks/
│   │   ├── use-auth.tsx                  # Auth context + space/hub state
│   │   ├── use-mobile.tsx                # Responsive breakpoint hook
│   │   ├── use-push-notifications.ts     # FCM push notification hook
│   │   └── use-toast.ts                  # Toast notification hook
│   ├── lib/
│   │   ├── data.ts                       # All TypeScript type definitions
│   │   ├── db.ts                         # All Firestore CRUD + subscription helpers
│   │   ├── agent.ts                      # AI agent orchestration logic
│   │   ├── bot-runtime.ts                # Chatbot flow runner
│   │   ├── firebase.ts                   # Firebase client SDK init
│   │   ├── firebase-admin.ts             # Firebase Admin SDK init
│   │   ├── firebase-init.ts              # Shared Firebase config
│   │   ├── typesense.ts                  # Typesense client init
│   │   ├── routes.ts                     # Hub view route constants
│   │   ├── utils.ts                      # Shared utilities (cn, formatters)
│   │   ├── comms/                        # Twilio + phone utilities
│   │   ├── email/                        # Email processing utilities
│   │   ├── knowledge/                    # Knowledge retrieval helpers
│   │   ├── projects/                     # Project-specific utilities
│   │   └── brain/                        # Background intelligence job runners
│   └── functions/                        # Firebase Cloud Functions source
├── functions/                            # Deployed Cloud Functions
├── public/                               # Static assets
├── firestore.rules                       # Firestore security rules
├── firebase.json                         # Firebase project config
├── apphosting.yaml                       # Firebase App Hosting config
├── next.config.ts                        # Next.js config
├── tailwind.config.ts                    # Tailwind theme config
└── components.json                       # ShadCN component registry config
```

---

## 5. Core Data Models

All types are defined in [`src/lib/data.ts`](./src/lib/data.ts).

### Organisational

| Type | Key Fields | Description |
|---|---|---|
| `User` | `id`, `name`, `email`, `role`, `notificationPrefs` | Authenticated platform user |
| `Space` | `id`, `name`, `members`, `comms.twilio` | Top-level organisation/company |
| `Hub` | `id`, `spaceId`, `type`, `settings`, `statuses` | Team workspace within a Space |
| `SpaceMember` | `role`, `hubAccess` | Per-user roles within a Space |

### Workspace / Productivity

| Type | Key Fields | Description |
|---|---|---|
| `Project` | `id`, `hubId`, `key`, `taskCounter`, `defaultView` | A board/list of tasks inside a Hub |
| `Task` | `id`, `taskKey`, `status`, `priority`, `parentId`, `relationships` | A unit of work. Supports subtasks and dependencies |
| `TimeEntry` | `id`, `user_id`, `project_id`, `start_time`, `duration` | Time logged against a project/task |
| `Document` | `id`, `hubId`, `type`, `content`, `isPublic` | Rich-text document (notes, spec, meeting minutes) |
| `JobFlowTemplate` | `id`, `phases[]`, `defaultView` | Multi-phase task automation template |
| `Job` | `id`, `workflowTemplateId`, `currentPhaseIndex`, `status` | Running instance of a JobFlowTemplate |

### CRM / Commercial

| Type | Key Fields | Description |
|---|---|---|
| `Contact` | `id`, `spaceId`, `name`, `email`, `phone` | CRM contact shared at Space level |
| `Ticket` | `id`, `hubId`, `type`, `priority`, `channel`, `escalation` | Customer support ticket |
| `Deal` | `id`, `hubId`, `value`, `currency`, `closeDate`, `isStale` | Sales pipeline deal |
| `EscalationIntakeRule` | `allowedSourceHubIds`, `destinationBoardId` | Routes tickets to dev boards |
| `DealAutomationRule` | `trigger`, `action` | Event-driven deal automation |

### Conversations & Bots

| Type | Key Fields | Description |
|---|---|---|
| `Conversation` | `id`, `hubId`, `status`, `channel`, `lastMessageAt` | A customer conversation thread |
| `ChatMessage` | `id`, `conversationId`, `type`, `timestamp` | Individual message in a conversation |
| `Bot` | `id`, `type`, `behavior`, `escalation`, `channelConfig`, `flow` | AI agent / chat widget config |
| `Visitor` | `id`, `lastSeen`, `name`, `email` | Anonymous or identified website visitor |

### Intelligence Pipeline

| Type | Key Fields | Description |
|---|---|---|
| `ImportedSource` | `sourceType`, `status`, `stats` | A data file imported for AI processing |
| `SourceChunk` | `chunkType`, `content`, `embeddingStatus` | Semantic chunk from an imported source |
| `Insight` | `kind`, `signalScore`, `processingStatus`, `embeddingStatus` | Distilled support/sales intelligence atom |
| `Topic` | `title`, `insightCount`, `signalLevel` | Cluster of related insights |
| `Article` | `sourceType`, `destinationLibraryId`, `status`, `visibility` | Knowledge base article (auto or manual) |

---

## 6. Feature Modules

### 6.1 Spaces & Hubs

- **Multi-tenant design**: Users can belong to multiple Spaces with different roles (`Admin`, `Member`, `Viewer`).
- **Hub types**: A Hub is configured with a set of active views/tools from the available panels (tasks, inbox, deals, etc.).
- **Hub privacy**: Hubs can be private, restricting access to a specific member list.
- **Space creation**: Accessible from the sidebar; launches a dialog (`SpaceFormDialog`) to set up Spaces and their Hubs in one step.
- Firestore collections: `spaces`, `hubs`, `memberships`

### 6.2 Project & Task Management

Available as the **Tasks** view inside a Hub.

**Projects**
- Each Hub can contain multiple Projects.
- Projects have a short `key` (e.g. `XY`) and an auto-incrementing `taskCounter` to generate keys like `XY-1`.
- Views: **Board (Kanban)**, **List**, **Table**, **Timeline (Gantt)**.

**Tasks**
- Full task detail: name, description, status, priority (`Low/Medium/High/Urgent`), due date, start/end date, sprint points, tags, time estimate.
- **Subtasks**: supported via `parentId` linking.
- **Task relationships**: `blocks`, `blocked_by`, `related_to`.
- **Comments** and **Attachments** embedded in the task document.
- Tasks can be linked to a Ticket via `linkedTicketId` for cross-module tracking.

**Statuses**
- Custom statuses defined per Hub (each status has a name and colour).

Firestore collections: `projects`, `tasks`

### 6.3 Inbox & Conversations

Available as the **Inbox** view inside a Hub.

- **Unified inbox**: consolidates Web Chat, SMS, Email, and Voice call threads.
- **Conversation states**: `new`, `automated`, `ai_active`, `waiting_human`, `resolved`, `open`, `closed`, `waiting_on_customer`.
- **Resolution tracking**: Resolution source (`agent_marked`, `customer_confirmed`, `ai_inferred`, `system_timeout`, `phone_disposition`) and status are persisted.
- **Real-time**: messages and typing status are updated via Firestore `onSnapshot` listeners.
- **Unread count**: computed globally based on per-agent `lastAgentSeenAt` timestamps.
- **Notes**: internal-only messages (`type: 'note'`) hidden from customers.
- Agents can assign conversations, mark as waiting on customer, or close/resolve them.

Firestore collections: `conversations`, `chat_messages`

### 6.4 CRM — Contacts, Tickets & Deals

**Contacts** (Space-level)
- Centralised contact database shared across all Hubs in a Space.
- Full event timeline per contact (calls, messages, notes, identity changes) stored in subcollection `contacts/{id}/events`.
- Real-time subscription via `subscribeToContacts`.

**Tickets** (Hub-level)
- Types: `bug`, `question`, `feature`.
- Automated **escalation routing**: a matching `EscalationIntakeRule` routes the ticket to a Dev Hub's project board, creating a linked Task.
- Escalation status tracking: `none → queued → sent → failed`.
- Can be linked to a Conversation and a Contact.

**Deals** (Hub-level)
- Pipeline management with customisable deal stages (configured as Hub `dealStatuses`).
- Fields: value, currency, close date, next step, source, staleness flag.
- **Deal Automation Rules**: trigger on stage change, deal update, or staleness → action: send email, create task, update field, or send notification.

Firestore collections: `contacts`, `tickets`, `deals`, `deal_automation_rules`, `escalation_intake_rules`

### 6.5 Help Center & Knowledge Base

**Help Center**
- Public-facing portal available at `/hc` (and embeddable).
- Collections group articles into categories.
- Articles are written in the Tiptap rich-text editor and can be `draft` or `published`.

**Libraries (Internal Knowledge Base)**
- Private articles indexed for AI agent grounding.
- Articles sourced from: Topics, Insights, or manual authoring.
- Articles go through an embedding pipeline (`text-embedding-004`) before being queryable via Vertex AI Vector Search.
- Retrieval flow: Vertex AI Vector Search returns candidate IDs → Firestore documents hydrated for canonical truth.

Firestore collections: `help_centers`, `help_center_collections`, `help_center_articles`, `articles`

### 6.6 AI Agents & Bot System

Each Hub can have one or more **Bots** (AI agents or chat widgets).

**Bot Configuration** (the `Bot` type is extremely rich):

| Config Area | Options |
|---|---|
| Tone | `formal`, `friendly`, `expert`, `direct`, `warm` |
| Response length | `short`, `balanced`, `detailed` |
| Behaviour mode | `support`, `sales`, `hybrid` |
| Confidence handling | Per-level (`high/medium/low`): `answer`, `answer_softly`, `clarify`, `escalate` |
| Identity capture | When to ask for name/email/phone |
| Escalation | Frustration detection, repeated-failure detection, force-trigger keywords |

**Automation Flow Builder**
- Visual node-based flow editor using `@xyflow/react`.
- Node types: `start`, `message`, `quick_reply`, `capture_input`, `condition`, `ai_step`, `handoff`, `end`, `ai_classifier`, `identity_form`.
- Flows mix deterministic logic with AI reasoning nodes.

**Channel Config** (per bot):
| Channel | Key Settings |
|---|---|
| **Web** | greeting text, returning-user text |
| **SMS** | max response length, lead capture message, handoff keywords |
| **Phone** | operation mode (`full_ai`, `handoff`, `receptionist`), greeting/voicemail scripts, transcription |
| **Email** | approval mode (`auto`, `auto_exceptions`, `manual`), tone override |

**Intelligence Access Levels** (controls what the bot can access):
`none` → `articles_only` → `topics_allowed` → `insights_hidden_support` → `internal_full_access`

Firestore collections: `bots`, `conversations`, `visitors`

### 6.7 Job Flows & Automation

Job Flows are multi-phase project templates that launch a structured sequence of tasks.

- **JobFlowTemplate**: defines Phases → Tasks → Subtasks with assignees and duration estimates.
- **PhaseTemplate** and **TaskTemplate**: reusable building blocks for constructing job flow templates.
- **Job**: a running instance of a template, tracks `currentPhaseIndex` and `roleUserMapping`.
- **JobFlowTask**: links a running Job to its generated Tasks.
- Each phase can require review before the next phase begins.

Firestore collections: `job_flow_templates`, `phase_templates`, `task_templates`, `jobs`, `job_flow_tasks`

### 6.8 Time Tracking & Timesheets

- **Time Entries**: log time against projects/tasks with start/end time, duration, and notes.
- Sources: `Timer` (live) or `Manual` entry.
- **Team Timesheets** view: managers see aggregated effort across the organisation.

Firestore collection: `time_entries`

### 6.9 Documents

- Rich-text documents backed by the Tiptap editor.
- Types: `notes`, `spec`, `meeting_minutes`.
- Permissions: `isPublic` flag and `allowedUserIds` for fine-grained access.
- Documents support comments (`DocumentComment[]`) and can be locked.
- Images can be uploaded to Firebase Storage and embedded inline.
- AI writing assistance available via the `assist-in-document` Genkit flow.

Firestore collection: `documents`

### 6.10 Support Intelligence Pipeline

A background intelligence system that continuously distills knowledge from resolved conversations and imported data.

**Pipeline Steps:**
1. **Import** — upload PDF, CSV, JSON, email export, or plain text (`ImportedSource`).
2. **Chunk** — documents are split into semantic `SourceChunk` units.
3. **Embed** — chunks are vectorised with `text-embedding-004` and stored.
4. **Distill** — the `distill-support-intent` AI flow extracts `Insight` records from conversation history.
5. **Cluster** — related insights are grouped into `Topic` clusters.
6. **Evaluate** — the `evaluate-support-insight` flow scores insights by signal level.
7. **Promote** — high-signal topics can be promoted to `Article` records and published to the knowledge base.

**Brain Jobs** (`BrainJob` documents) track async operations:
- `distill-support-intent` — extract intents from support history
- `cluster-sales-personas` — group leads by behaviour pattern
- `recommend-next-actions` — suggest next best actions for deals

Firestore collections: `imported_sources`, `source_chunks`, `insights`, `topics`, `brain_jobs`

---

## 7. AI & Genkit Flows

All flows are in `src/ai/flows/` and run via Genkit 1.x with Google Gemini 2.0 Flash.

| Flow File | Purpose |
|---|---|
| `agent-response.ts` | Core AI agent response generation (grounded, multi-channel) |
| `assist-in-document.ts` | Document writing assistant (summarise, rewrite, expand) |
| `crawl-website-knowledge.ts` | Crawl a URL and extract structured knowledge for the KB |
| `create-task-from-thread.ts` | Auto-create a task from a conversation thread |
| `distill-sales-intelligence.ts` | Extract structured sales signals from conversation data |
| `distill-support-intent.ts` | Extract support resolution insights from conversations |
| `draft-sales-email.ts` | Generate personalised sales outreach emails |
| `evaluate-support-insight.ts` | Score insight quality and signal level |
| `generate-cover-image.ts` | Generate AI-powered cover images for articles/docs |
| `recommend-next-sales-action.ts` | Recommend next best action for a deal/contact |
| `suggest-library-icon.ts` | Suggest an icon for a knowledge library |
| `suggest-project-from-meeting.ts` | Parse a meeting log and suggest a project structure |
| `summarize-sales-cluster.ts` | Summarise a cluster of sales persona insights |

### Genkit Setup

```ts
// src/ai/genkit.ts
import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

export const ai = genkit({ plugins: [googleAI()] });
```

Development server: `npm run genkit:dev`  
Watch mode: `npm run genkit:watch`

---

## 8. Communication Channels

### Web Chat Widget
- Embeddable widget served from `/chatbot` and `/api/widget`.
- Fully customisable appearance (colours, logo, layout) via the `Bot.styleSettings` field.
- Real-time messaging via Firestore subscriptions.

### SMS (Twilio)
- Inbound SMS routed via webhook → matched to Hub by phone number lookup (`phone_channel_lookups` collection).
- Bot responds based on `channelConfig.sms` settings.
- Handoff to human agent triggered by keywords.

### Email (Google Workspace + Postmark)
- Two-way Gmail sync via OAuth (`emailConfigs` Firestore subcollection).
- Inbound routing via `emailIndex` collection.
- Bot reply approval modes: `auto`, `auto_exceptions`, `manual`.
- Outbound transactional mail via Postmark.

### Voice / Phone (Twilio)
- AI phone call handling with operation modes:
  - `full_ai` — Gemini handles the full call
  - `handoff` — AI greets, then transfers to a human
  - `receptionist` — AI collects info and routes
- Calls can be transcribed and stored.
- Greeting and voicemail scripts are configurable per bot.

### Internal Channels
- Slack-like internal team messaging (planned/in progress).
- Slack meeting logs can be imported (`slack_meeting_logs` collection).

---

## 9. API Routes

Located in `src/app/api/`:

| Route | Description |
|---|---|
| `/api/admin/*` | Admin-only management endpoints |
| `/api/bot-settings` | Read/update bot configuration |
| `/api/email` | Inbound email webhook handler |
| `/api/notifications` | FCM push notification management |
| `/api/unread` | Unread conversation count for a user/hub |
| `/api/widget` | Chat widget embed configuration endpoint |

Firebase Cloud Functions (in `functions/`) handle:
- `resendInvite` — resend a workspace invite email
- Embedding triggers (on Firestore write for articles, insights, topics)
- Webhook processing for SMS and email

---

## 10. Firebase & Database Layer

### Firestore Collections

| Collection | Scope | Purpose |
|---|---|---|
| `users` | Global | User profiles |
| `spaces` | Global | Organisation workspaces |
| `memberships` | Global | User-space membership records |
| `hubs` | Space | Team workspaces |
| `projects` | Hub | Project boards |
| `tasks` | Hub | Individual tasks |
| `tickets` | Hub | Support tickets |
| `deals` | Hub | Sales pipeline deals |
| `contacts` | Space | CRM contacts |
| `conversations` | Hub | Customer conversation threads |
| `chat_messages` | - | Individual messages |
| `visitors` | - | Anonymous/identified web visitors |
| `bots` | Hub | AI agent/widget configurations |
| `documents` | Hub | Rich-text documents |
| `time_entries` | - | Time tracking logs |
| `articles` | Space | Knowledge base articles |
| `insights` | Space | Intelligence pipeline outputs |
| `topics` | Space | Insight clusters |
| `imported_sources` | Space | Raw uploaded data files |
| `source_chunks` | Space | Chunked/embedded content |
| `brain_jobs` | - | Async AI processing jobs |
| `invites` | Space | Pending space invitations |
| `job_flow_templates` | Hub | Job flow blueprints |
| `jobs` | Hub | Running job instances |
| `escalation_intake_rules` | Hub | Ticket escalation routing |
| `deal_automation_rules` | Hub | Deal pipeline automation |
| `phone_channel_lookups` | Space | Phone number → Hub routing |
| `help_centers` | Hub | Help center configs |
| `help_center_collections` | Hub | Article categories |
| `help_center_articles` | Hub | Legacy HC articles |
| `fcmTokens` | Global | Push notification tokens |
| `emailIndex` | Global | Email address → Hub/User routing |

### `src/lib/db.ts`
The central database access layer (~920 lines). Provides:
- CRUD functions for every collection
- Real-time `onSnapshot` subscriptions named `subscribeTo*`
- Batch operations (e.g. `removeUserFromSpace` removes membership from Space + all Hubs atomically)
- Firebase Storage upload helpers for logos, bot images, document attachments, and imported files

### Firestore Security Rules
Defined in `firestore.rules`. Rules enforce role-based access control at the Space and Hub level.

---

## 11. Authentication & Authorization

### Auth Provider
- Firebase Authentication (Email/password + Email link / Google OAuth).

### `useAuth` Hook (`src/hooks/use-auth.tsx`)
The central auth context provider. Exposes:

```ts
const {
  appUser,        // Current User object
  activeSpace,    // Currently selected Space
  activeHub,      // Currently selected Hub
  userSpaces,     // All spaces the user belongs to
  setActiveSpace,
  setActiveHub,
  setUserSpaces,
} = useAuth();
```

### Roles

| Scope | Roles |
|---|---|
| Space | `Admin`, `Member`, `Viewer` |
| Hub | `admin`, `member`, `viewer` |

### User Flow
1. User signs in → Firebase Auth session created.
2. `useAuth` fetches Firestore user document and all their Spaces.
3. If `onboardingComplete === false`, redirected to `/onboarding`.
4. On every page load, URL `spaceId` / `hubId` params are reconciled with context state.
5. Push notification permission is requested via `NotificationPermission` component.

---

## 12. Routing & Navigation

Next.js App Router is used. The URL structure is:

```
/login                                          → Login page
/onboarding                                     → First-run setup
/space-selection                                → Space picker
/space/{spaceId}/hubs                           → Hub listing for a space
/space/{spaceId}/hub/{hubId}/{view}             → Main app view
/contacts                                       → Global contacts CRM
/documents                                      → Documents browser
/chatbot                                        → Embeddable chat widget
/hc                                             → Public Help Center
/docs                                           → Public docs portal
/join                                           → Invite acceptance
/unauthorized                                   → Access denied
```

### Available Hub Views (`AppView`)

Defined in `src/lib/routes.ts`:

```ts
overview | tasks | tickets | deals | inbox | help-center | support-intelligence | team-timesheets | settings | contacts
```

Navigation is managed by the `AppSidebar` and `MobileBottomNav` components, which call `handleViewChange(view)` to push the correct URL.

---

## 13. Environment Variables

The app uses a `.env` file at the project root. Key variables include:

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_FIREBASE_*` | Firebase client SDK configuration |
| `FIREBASE_ADMIN_*` | Firebase Admin credentials for server-side auth |
| `GOOGLE_GENAI_API_KEY` | Gemini AI API key |
| `TWILIO_ACCOUNT_SID` | Twilio account credentials |
| `TWILIO_AUTH_TOKEN` | Twilio auth token |
| `TYPESENSE_*` | (Deprecated - migrated to Vertex AI) |
| `POSTMARK_API_KEY` | Postmark email API key |

> **Note:** Never commit the `.env` file to version control. It is listed in `.gitignore`.

---

## 14. Running the Project

### Prerequisites
- Node.js 20+
- npm
- Firebase project with Firestore, Auth, Storage, and Functions enabled
- A `.env` file with all required variables (see §13)

### Development

```bash
# Install dependencies
npm install

# Start Next.js dev server (with Turbopack)
npm run dev

# Start Genkit AI dev server (in a separate terminal)
npm run genkit:dev

# Type check
npm run typecheck

# Lint
npm run lint
```

### Production Build

```bash
npm run build
npm start
```

### Deployment

The project is configured for **Firebase App Hosting** (`apphosting.yaml`). Deploy with:

```bash
firebase deploy
```

---

## 15. Key Design Decisions

| Decision | Rationale |
|---|---|
| **Next.js App Router** | Enables React Server Components for fast initial load, plus client components for real-time features |
| **Firebase as backend** | Real-time Firestore subscriptions eliminate polling; Auth + Storage + Functions in one ecosystem reduces infra complexity |
| **Genkit for AI** | First-class Firebase integration, flow-based AI orchestration, built-in dev UI for testing prompts |
| **Typesense for search** | Hybrid keyword + vector search out-of-the-box; significantly faster than Firestore full-text search |
| **Tiptap for rich text** | Headless, extensible editor that works with React; supports all document types needed |
| **React Flow for bot builder** | Visual automation flow builder without building a custom canvas; handles node drag, connections, and handles |
| **ShadCN + Radix** | Accessible, unstyled primitives that compose well with Tailwind; gives full control over visual design |
| **Single `db.ts` module** | All Firestore access centralised for consistency, easy to audit, and straightforward to mock in tests |
| **`useAuth` as global context** | Space and Hub selection are cross-cutting concerns; centralising them avoids deep prop-drilling |
| **Embedding pipeline via Cloud Functions** | Embedding text is CPU/memory intensive and has latency; offloading to Functions keeps the UI snappy |
