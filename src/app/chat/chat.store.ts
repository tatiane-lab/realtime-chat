import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { Subscription } from 'rxjs';
import { BOT_USERS, DEMO_USERS, Message, Presence, ROOMS, RealtimeEvent, User } from '../core/models';
import { GREETINGS, pickReply } from './bots';
import { RealtimeService } from './realtime.service';

export interface TypingEntry {
  userId: string;
  roomId: string;
}

export interface ChatState {
  currentUser: User | null;
  currentRoomId: string;
  messages: Message[];
  presence: Record<string, Presence>;
  typing: TypingEntry[];
  unread: Record<string, number>;
}

const STORAGE_KEY = 'rtchat.messages';
const MAX_STORED = 200;
const PEER_TTL_MS = 12_000;
const HEARTBEAT_MS = 4_000;
const TYPING_TTL_MS = 3_000;
const ALL_USERS: readonly User[] = [...DEMO_USERS, ...BOT_USERS];

const initialState: ChatState = {
  currentUser: null,
  currentRoomId: ROOMS[0].id,
  messages: [],
  presence: {},
  typing: [],
  unread: {},
};

function loadMessages(): Message[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Message[]) : [];
  } catch {
    return [];
  }
}

function saveMessages(messages: Message[]): void {
  try {
    const stable = messages.filter((m) => m.status === 'sent').slice(-MAX_STORED);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stable));
  } catch {
    /* cota ou modo privado: o histórico apenas não persiste */
  }
}

function seedMessages(): Message[] {
  const base = Date.now() - 60 * 60_000;
  let i = 0;
  return Object.entries(GREETINGS).flatMap(([roomId, list]) =>
    list.map((g): Message => {
      const bot = BOT_USERS.find((b) => b.id === g.bot)!;
      const n = i++;
      return {
        id: `seed-${roomId}-${n}`,
        roomId,
        userId: bot.id,
        username: bot.username,
        text: g.text,
        timestamp: base + n * 90_000,
        status: 'sent',
      };
    }),
  );
}

export const ChatStore = signalStore(
  { providedIn: 'root' },
  withState<ChatState>(initialState),
  withComputed(({ messages, currentRoomId, currentUser, typing, presence, unread }) => ({
    roomMessages: computed(() =>
      messages()
        .filter((m) => m.roomId === currentRoomId())
        .sort((a, b) => a.timestamp - b.timestamp),
    ),
    currentRoom: computed(() => ROOMS.find((r) => r.id === currentRoomId()) ?? ROOMS[0]),
    typingNames: computed(() => {
      const me = currentUser()?.id;
      return typing()
        .filter((t) => t.roomId === currentRoomId() && t.userId !== me)
        .map((t) => ALL_USERS.find((u) => u.id === t.userId)?.username ?? 'Alguém');
    }),
    onlineIds: computed(
      () => new Set(Object.values(presence()).filter((p) => p.isOnline).map((p) => p.userId)),
    ),
    totalUnread: computed(() => Object.values(unread()).reduce((a, b) => a + b, 0)),
  })),
  withMethods((store, rt = inject(RealtimeService)) => {
    let sub: Subscription | undefined;
    let heartbeat: ReturnType<typeof setInterval> | undefined;
    let lastTypingSent = 0;
    const typingTimers = new Map<string, ReturnType<typeof setTimeout>>();
    const pending = new Set<ReturnType<typeof setTimeout>>();

    const later = (fn: () => void, ms: number) => {
      const t = setTimeout(() => {
        pending.delete(t);
        fn();
      }, ms);
      pending.add(t);
    };

    const markPresence = (userId: string, isOnline: boolean) =>
      patchState(store, (s) => ({
        presence: { ...s.presence, [userId]: { userId, isOnline, lastSeen: Date.now() } },
      }));

    const setTyping = (userId: string, roomId: string, isTyping: boolean) => {
      const key = `${userId}:${roomId}`;
      clearTimeout(typingTimers.get(key));
      typingTimers.delete(key);
      patchState(store, (s) => {
        const rest = s.typing.filter((t) => !(t.userId === userId && t.roomId === roomId));
        return { typing: isTyping ? [...rest, { userId, roomId }] : rest };
      });
      if (isTyping) {
        // Proteção: um evento perdido de "parou de digitar" não pode travar o indicador.
        typingTimers.set(key, setTimeout(() => setTyping(userId, roomId, false), TYPING_TTL_MS));
      }
    };

    const addMessage = (message: Message) => {
      if (store.messages().some((m) => m.id === message.id)) return; // evita duplicidade (eco / reenvio)
      const me = store.currentUser();
      patchState(store, (s) => ({
        messages: [...s.messages, message],
        unread:
          message.userId !== me?.id && message.roomId !== s.currentRoomId
            ? { ...s.unread, [message.roomId]: (s.unread[message.roomId] ?? 0) + 1 }
            : s.unread,
      }));
      setTyping(message.userId, message.roomId, false);
      saveMessages(store.messages());
    };

    const updateMessage = (id: string, patch: Partial<Message>) =>
      patchState(store, (s) => ({ messages: s.messages.map((m) => (m.id === id ? { ...m, ...patch } : m)) }));

    const announce = (online: boolean) => {
      const user = store.currentUser();
      if (user) rt.publish({ type: 'presence', user, isOnline: online });
    };

    const handle = (e: RealtimeEvent) => {
      switch (e.type) {
        case 'message':
          addMessage({ ...e.message, status: 'sent' });
          break;
        case 'typing':
          setTyping(e.userId, e.roomId, e.isTyping);
          break;
        case 'presence':
          markPresence(e.user.id, e.isOnline);
          break;
        case 'hello':
          announce(true);
          break;
      }
    };

    /** O bot responde após uma mensagem humana: primeiro "digitando", depois a resposta. */
    const botRespond = (message: Message) => {
      const { bot, text } = pickReply(message, BOT_USERS);
      later(() => setTyping(bot.id, message.roomId, true), 500);
      later(
        () => {
          const reply: Message = {
            id: crypto.randomUUID(),
            roomId: message.roomId,
            userId: bot.id,
            username: bot.username,
            text,
            timestamp: Date.now(),
            status: 'sent',
          };
          addMessage(reply);
          rt.publish({ type: 'message', message: reply });
        },
        1800 + Math.random() * 1500,
      );
    };

    const deliver = (message: Message) => {
      later(() => {
        if (rt.publish({ type: 'message', message })) {
          updateMessage(message.id, { status: 'sent' });
          saveMessages(store.messages());
          botRespond(message);
        } else {
          updateMessage(message.id, { status: 'failed' });
        }
      }, 350);
    };

    const onPageHide = () => announce(false);

    return {
      init(user: User) {
        const stored = loadMessages();
        const initial = stored.length ? stored : seedMessages();
        const now = Date.now();
        patchState(store, {
          ...initialState,
          currentUser: user,
          messages: initial,
          presence: Object.fromEntries(
            [...BOT_USERS.map((b) => b.id), user.id].map((id) => [id, { userId: id, isOnline: true, lastSeen: now }]),
          ),
        });
        saveMessages(initial);

        rt.connect();
        sub = rt.events$.subscribe(handle);
        heartbeat = setInterval(() => {
          announce(true);
          const cutoff = Date.now() - PEER_TTL_MS;
          patchState(store, (s) => ({
            presence: Object.fromEntries(
              Object.entries(s.presence).map(([id, p]) => {
                const isPeer = DEMO_USERS.some((u) => u.id === id) && id !== user.id;
                return [id, isPeer && p.isOnline && p.lastSeen < cutoff ? { ...p, isOnline: false } : p];
              }),
            ),
          }));
        }, HEARTBEAT_MS);
        // Após o handshake: pergunta quem está online e se anuncia aos outros.
        later(() => {
          rt.publish({ type: 'hello' });
          announce(true);
        }, 1000);
        window.addEventListener('pagehide', onPageHide);
      },

      destroy() {
        announce(false);
        sub?.unsubscribe();
        clearInterval(heartbeat);
        pending.forEach(clearTimeout);
        pending.clear();
        typingTimers.forEach(clearTimeout);
        typingTimers.clear();
        window.removeEventListener('pagehide', onPageHide);
        rt.disconnect();
        patchState(store, initialState);
      },

      selectRoom(roomId: string) {
        patchState(store, (s) => ({ currentRoomId: roomId, unread: { ...s.unread, [roomId]: 0 } }));
      },

      sendMessage(text: string) {
        const user = store.currentUser();
        const clean = text.trim();
        if (!user || !clean) return;
        const message: Message = {
          id: crypto.randomUUID(),
          roomId: store.currentRoomId(),
          userId: user.id,
          username: user.username,
          text: clean,
          timestamp: Date.now(),
          status: 'sending',
        };
        patchState(store, (s) => ({ messages: [...s.messages, message] }));
        rt.publish({ type: 'typing', userId: user.id, roomId: message.roomId, isTyping: false });
        deliver(message);
      },

      retry(id: string) {
        const message = store.messages().find((m) => m.id === id);
        if (!message) return;
        const retried: Message = { ...message, status: 'sending', timestamp: Date.now() };
        updateMessage(id, { status: 'sending', timestamp: retried.timestamp });
        deliver(retried);
      },

      discard(id: string) {
        patchState(store, (s) => ({ messages: s.messages.filter((m) => m.id !== id) }));
      },

      notifyTyping() {
        const user = store.currentUser();
        const now = Date.now();
        if (!user || now - lastTypingSent < 1500) return;
        lastTypingSent = now;
        rt.publish({ type: 'typing', userId: user.id, roomId: store.currentRoomId(), isTyping: true });
      },

      clearHistory() {
        const seeded = seedMessages();
        patchState(store, { messages: seeded, unread: {} });
        saveMessages(seeded);
      },
    };
  }),
);
