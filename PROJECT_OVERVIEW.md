# Manowar: The AI Business OS

Manowar is a comprehensive "Command Center" for modern businesses, combining traditional productivity tools (Tasks, CRM, Time Tracking) with a sophisticated, multi-channel AI intelligence layer.

## 🏗 Core Architecture

The system uses a hierarchical multi-tenant structure:
- **Spaces**: The top-level organization (e.g., a company or a large department). Manages global resources like phone number inventory and members.
- **Hubs**: Focused workspaces within a Space (e.g., "Customer Support", "Sales Team", "Q3 Launch"). Each Hub can be customized with specific "Tools".
- **Personal Scopes**: Individual users have a private "Personal" inbox and their own "Personal AI Agent" for private productivity.

## 🧠 Intelligence Layer (The "Brain")

The defining feature of Manowar is its unified intelligence system:
- **AI Agents**: Centralized "Brains" that handle logic for all communication channels. They support custom flows, branding, and knowledge base grounding.
- **Hybrid Flows**: A visual builder allows users to mix deterministic logic (Quick Replies, Input Capture) with AI reasoning (Intent Classification, Knowledge Retrieval).
- **Business Brain Jobs**: Asynchronous processing that distills support intents from history, clusters sales personas, and recommends next best actions for leads.
- **Grounding**: Agents are grounded in "Libraries" (Knowledge Bases) to provide accurate, documentation-backed answers.

## 💬 Communication Channels

Manowar unifies fragmented communication into a single **Inbox**:
- **Web Chat**: A customizable widget for real-time customer interaction.
- **Support Email**: Full two-way sync with Google Workspace (Gmail).
- **SMS**: Integration with Twilio for text-based support and sales.
- **Voice (Phone)**: Advanced AI call handling, triage, warm handoffs, and transcription.
- **Internal Channels**: Slack-like internal team messaging organized by topic.

## 🛠 Functional Modules

### 1. Project & Task Management
- **Kanban Boards**: Drag-and-drop task management with customizable statuses.
- **Views**: Support for List, Table, and Gantt-style Timeline views.
- **Task Hierarchy**: Full support for subtasks and task relationships.
- **Automation**: "Job Flows" allow launching complex, multi-phase sequences of tasks from a template.

### 2. Commercial & CRM
- **Contacts**: A centralized CRM at the Space level. Tracks a full timeline of events (calls, messages, notes, identity changes).
- **Deals**: Sales pipeline management with integrated automation rules (e.g., "If deal is stale for 7 days, notify owner").
- **Tickets**: Customer service management with automated escalation routes to development teams.

### 3. Time & Productivity
- **Time Tracking**: Live timers and manual entry logs associated with specific tasks.
- **Team Timesheets**: High-level reporting for managers to track effort across the organization.
- **Knowledge Bases**: Multi-library documentation system for internal SOPs or public Help Centers.

## 💻 Technical Stack

- **Framework**: Next.js 15 (App Router), React 18, TypeScript.
- **Styling**: Tailwind CSS, ShadCN UI components.
- **Backend**: Firebase (Firestore for data, Auth for identity, Storage for assets, Cloud Functions for compute).
- **AI**: Genkit 1.x with Google Gemini 2.0 Flash.
- **Search**: Typesense (Vector + Keyword search for knowledge and sales intelligence).
- **Communications**: Twilio (Comms), Postmark (Transactional Email).

## 🚀 Key Data Flows

1. **Inbound Email/SMS**: Received via Webhook -> Routed to Hub or User via `emailIndex` or `phoneLookup` -> AI Agent generates a Draft or Auto-reply -> Appears in Inbox.
2. **Knowledge Indexing**: Article Published -> Cloud Function chunks text -> Stored in Typesense with metadata -> Agent queries Typesense during chat.
3. **Task Escalation**: Ticket marked as "Bug" -> Escalation Rule matched -> Task created in Dev Hub project -> Statuses stay synced between Ticket and Task.
