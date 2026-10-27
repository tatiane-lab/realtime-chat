export type MessageStatus = 'sending' | 'sent' | 'failed';

export interface Message {
  id: string;
  roomId: string;
  userId: string;
  username: string;
  text: string;
  timestamp: number;
  status: MessageStatus;
}

export interface User {
  id: string;
  username: string;
  /** Matiz (0-360) usado na cor do avatar. */
  hue: number;
  bot?: boolean;
}

export interface Presence {
  userId: string;
  isOnline: boolean;
  lastSeen: number;
}

export interface Room {
  id: string;
  name: string;
  topic: string;
  icon: string;
}

export type ConnectionState = 'connecting' | 'connected' | 'offline';

/** Protocolo compartilhado entre abas (BroadcastChannel) e, em produção, um servidor WebSocket. */
export type RealtimeEvent =
  | { type: 'message'; message: Message }
  | { type: 'typing'; userId: string; roomId: string; isTyping: boolean }
  | { type: 'presence'; user: User; isOnline: boolean }
  | { type: 'hello' };

export const DEMO_USERS: readonly User[] = [
  { id: 'ana', username: 'Ana', hue: 330 },
  { id: 'bruno', username: 'Bruno', hue: 215 },
];

export const BOT_USERS: readonly User[] = [
  { id: 'bot-carla', username: 'Carla', hue: 150, bot: true },
  { id: 'bot-diego', username: 'Diego', hue: 35, bot: true },
];

export const ROOMS: readonly Room[] = [
  { id: 'general', name: 'general', topic: 'Bate-papo geral da equipe', icon: '#' },
  { id: 'angular', name: 'angular', topic: 'Signals, SSR, performance e afins', icon: '#' },
  { id: 'random', name: 'random', topic: 'Qualquer assunto, memes e café', icon: '#' },
];
