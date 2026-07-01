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

export const channelId = (platform: Platform, name: string) =>
  `${platform}:${name.toLowerCase().replace(/^#/, "")}`;
