import { TestBed } from '@angular/core/testing';
import { DEMO_USERS } from '../core/models';
import { ChatStore } from './chat.store';
import { RealtimeService } from './realtime.service';

describe('ChatStore', () => {
  let store: InstanceType<typeof ChatStore>;
  let rt: RealtimeService;

  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    TestBed.configureTestingModule({});
    store = TestBed.inject(ChatStore);
    rt = TestBed.inject(RealtimeService);
    store.init(DEMO_USERS[0]);
  });

  afterEach(() => {
    store.destroy();
    vi.useRealTimers();
  });

  it('seeds greetings and starts in #general', () => {
    expect(store.currentRoomId()).toBe('general');
    expect(store.roomMessages().length).toBeGreaterThan(0);
  });

  it('appends optimistically then confirms the message', () => {
    vi.advanceTimersByTime(1000); // handshake
    store.sendMessage('olá');
    const mine = () => store.roomMessages().find((m) => m.text === 'olá')!;
    expect(mine().status).toBe('sending');
    vi.advanceTimersByTime(400);
    expect(mine().status).toBe('sent');
  });

  it('marks as failed while offline and recovers on retry', () => {
    vi.advanceTimersByTime(1000);
    rt.toggleOffline();
    store.sendMessage('falha');
    vi.advanceTimersByTime(400);
    const id = store.roomMessages().find((m) => m.text === 'falha')!.id;
    expect(store.messages().find((m) => m.id === id)!.status).toBe('failed');

    rt.toggleOffline();
    vi.advanceTimersByTime(1000);
    store.retry(id);
    vi.advanceTimersByTime(400);
    expect(store.messages().find((m) => m.id === id)!.status).toBe('sent');
  });

  it('counts unread for other rooms and clears on select', () => {
    vi.advanceTimersByTime(1000);
    store.sendMessage('oi'); // bot answers in general
    store.selectRoom('random');
    vi.advanceTimersByTime(6000);
    expect(store.unread()['general']).toBeGreaterThan(0);
    store.selectRoom('general');
    expect(store.unread()['general']).toBe(0);
  });
});
