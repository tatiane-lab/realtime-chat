import {
  Injectable,
  OnDestroy,
  signal,
  computed,
  inject,
  NgZone,
} from '@angular/core';
import { Subject, Observable, timer, EMPTY } from 'rxjs';
import { webSocket, WebSocketSubject } from 'rxjs/webSocket';
import { retry, tap, catchError } from 'rxjs/operators';

export type ConnectionState = 'connecting' | 'connected' | 'disconnected' | 'error';

export interface WsMessage {
  type: string;
  payload: unknown;
  timestamp: number;
  id: string;
}

const MAX_RETRIES = 10;
const BASE_DELAY_MS = 1_000;
const MAX_DELAY_MS = 30_000;

@Injectable({ providedIn: 'root' })
export class WebSocketService implements OnDestroy {
  private zone = inject(NgZone);
  private socket$: WebSocketSubject<WsMessage> | null = null;
  private messages$ = new Subject<WsMessage>();
  private retryCount = 0;

  connectionState = signal<ConnectionState>('disconnected');
  isConnected = computed(() => this.connectionState() === 'connected');

  connect(url: string): Observable<WsMessage> {
    if (this.socket$) this.disconnect();

    this.connectionState.set('connecting');

    this.socket$ = webSocket<WsMessage>({
      url,
      openObserver: {
        next: () =>
          this.zone.run(() => {
            this.connectionState.set('connected');
            this.retryCount = 0;
          }),
      },
      closeObserver: {
        next: () =>
          this.zone.run(() => this.connectionState.set('disconnected')),
      },
    });

    return this.socket$.pipe(
      tap((msg) => this.messages$.next(msg)),
      retry({
        count: MAX_RETRIES,
        delay: (_err, attempt) => {
          this.zone.run(() => this.connectionState.set('connecting'));
          return timer(Math.min(BASE_DELAY_MS * 2 ** (attempt - 1), MAX_DELAY_MS));
        },
      }),
      catchError(() => {
        this.zone.run(() => this.connectionState.set('error'));
        return EMPTY;
      }),
    );
  }

  send<T>(type: string, payload: T): void {
    this.socket$?.next({
      type,
      payload,
      timestamp: Date.now(),
      id: crypto.randomUUID(),
    });
  }

  messages(type?: string): Observable<WsMessage> {
    return new Observable((observer) => {
      const sub = this.messages$.subscribe((msg) => {
        if (!type || msg.type === type) observer.next(msg);
      });
      return () => sub.unsubscribe();
    });
  }

  disconnect(): void {
    this.socket$?.complete();
    this.socket$ = null;
    this.connectionState.set('disconnected');
    this.retryCount = 0;
  }

  ngOnDestroy() {
    this.disconnect();
  }
}
