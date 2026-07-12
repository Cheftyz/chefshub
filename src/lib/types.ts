export type Platform = "twitch" | "kick";

export interface Account {
  id: string;
  platform: Platform;
  username: string;
  /**
   * Twitch: oauth:xxxx token (chat:read + chat:edit).
   * Kick: bearer token used by the local proxy to send messages.
   */
  token: string;
  /** whether this account is used for auto-send / shows in dropdown */
  visible: boolean;
  /** optional per-bot proxy (used for Kick server-side sends) */
  proxy?: string;
  /**
   * Channel names (lowercase, no #) this account is connected to and views.
   * When set, the account joins/reads only these; when empty it falls back to
   * every channel that's been added.
   */
  channels?: string[];
}

export interface Channel {
  /** stable id `${platform}:${name}` */
  id: string;
  platform: Platform;
  /** login / slug, lowercase */
  name: string;
  /** resolved for kick channels via the proxy */
  kickChatroomId?: number;
  kickBroadcasterId?: number;
}

export interface Phrase {
  id: string;
  text: string;
  /** delay in seconds the clock button waits before sending */
  delay: number;
}

/** A named preset set of phrases (e.g. one per game). */
export interface PhraseGroup {
  id: string;
  name: string;
  phrases: Phrase[];
}

export interface ChatMessage {
  id: string;
  channelId: string;
  username: string;
  displayName: string;
  color: string;
  text: string;
  ts: number;
  /** true if this message was sent by one of the user's own accounts */
  self?: boolean;
  /** system notice rendered in italics (e.g. "Connecting to #x") */
  system?: boolean;
}

export interface Scheduled {
  id: string;
  platform: Platform;
  accountId: string;
  accountName: string;
  channelId: string;
  channelName: string;
  text: string;
  /** epoch ms when it should fire */
  fireAt: number;
}

export type ConnState = "idle" | "connecting" | "open" | "closed" | "error";

// ---- tools (persisted per user on the server) ----
export interface Command {
  id: string;
  trigger: string; // e.g. "!discord"
  response: string;
  cooldown: number; // seconds
  enabled: boolean;
}
export interface Timer {
  id: string;
  name: string;
  message: string;
  intervalMin: number;
  enabled: boolean;
}
export interface Quote {
  id: string;
  text: string;
  author: string;
  addedAt: number;
}
export type ToolKind = "commands" | "timers" | "quotes";

// ---- live / client-only ----
export interface GiveawayState {
  active: boolean;
  keyword: string;
  channelId: string | null;
  entrants: string[];
  winner: string | null;
}
export interface ActivityEvent {
  id: string;
  ts: number;
  kind: "sent" | "command" | "timer" | "giveaway" | "system";
  text: string;
}

export type NavPage =
  | "dashboard"
  | "activity"
  | "chat"
  | "commands"
  | "timers"
  | "quotes"
  | "giveaways"
  | "admin";

export const channelId = (platform: Platform, name: string) =>
  `${platform}:${name.toLowerCase().replace(/^#/, "")}`;
