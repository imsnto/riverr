
export const HUB_VIEWS = {
  tasks: "/tasks",
  documents: "/documents",
  contacts: "/contacts",
  messages: "/messages",
  inbox: "/inbox",
  settings: "/settings"
} as const;

export type AppView = keyof typeof HUB_VIEWS;
