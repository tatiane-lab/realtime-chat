import { computed, inject, signal } from '@angular/core';
import {
  signalStore,
  withState,
  withComputed,
  withMethods,
  patchState,
} from '@ngrx/signals';
import { WebSocketService } from './websocket.service';

export interface Message {
  id: string;
  roomId: string;
  userId: string;
  username: string;
  text: string;
  timestamp: number;
  status: 'sending' | 'sent' | 'failed';
  editedAt?: number;
}

export interface User {
  id: string;
  username: string;
  avatarUrl: string;
  isOnline: boolean;
  isTyping: boolean;
  lastSeen: number;
}

export interface ChatState {
  messages: Message[];
  users: User[];
  currentRoomId: string | null;
  currentUserId: string;
  pendingMessages: Map<string, Message>;
}

export const ChatStore = signalStore(
  { providedIn: 'root' },
  withState<ChatState>({
    messages: [],
    users: [],
    currentRoomId: null,
    currentUserId: '',
    pendingMessages: new Map(),
  }),
  withComputed(({ messages, users, currentUserId }) => ({
    onlineUsers: computed(() => users().filter((u) => u.isOnline)),
    typingUsers: computed(() =>
      users().filter((u) => u.isTyping && u.id !== currentUserId())
    ),
    sortedMessages: computed(() =>
      [...messages()].sort((a, b) => a.timestamp - b.timestamp)
    ),
    unreadCount: computed(
      () =>
        messages().filter(
          (m) => m.userId !== currentUserId() && m.status === 'sent'
        ).length
    ),
  })),
  withMethods((store, ws = inject(WebSocketService)) => ({
    sendMessage(text: string) {
      const tempId = `temp_${crypto.randomUUID()}`;
      const optimistic: Message = {
        id: tempId,
        roomId: store.currentRoomId()!,
        userId: store.currentUserId(),
        username: 'You',
        text,
        timestamp: Date.now(),
        status: 'sending',
      };

      patchState(store, {
        messages: [...store.messages(), optimistic],
      });

      ws.send('message:send', {
        tempId,
        roomId: store.currentRoomId(),
        text,
      });
    },

    confirmMessage(tempId: string, savedMessage: Message) {
      patchState(store, {
        messages: store
          .messages()
          .map((m) => (m.id === tempId ? { ...savedMessage, status: 'sent' } : m)),
      });
    },

    failMessage(tempId: string) {
      patchState(store, {
        messages: store
          .messages()
          .map((m) =>
            m.id === tempId ? { ...m, status: 'failed' } : m
          ),
      });
    },

    receiveMessage(message: Message) {
      const exists = store.messages().some((m) => m.id === message.id);
      if (!exists) {
        patchState(store, { messages: [...store.messages(), message] });
      }
    },

    setUserTyping(userId: string, isTyping: boolean) {
      patchState(store, {
        users: store
          .users()
          .map((u) => (u.id === userId ? { ...u, isTyping } : u)),
      });
    },

    setUserPresence(userId: string, isOnline: boolean) {
      patchState(store, {
        users: store
          .users()
          .map((u) => (u.id === userId ? { ...u, isOnline, lastSeen: Date.now() } : u)),
      });
    },
  }))
);
