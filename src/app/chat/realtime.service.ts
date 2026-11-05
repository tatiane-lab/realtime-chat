import { Injectable, OnDestroy, computed, signal } from '@angular/core';
import { Subject } from 'rxjs';
import { ConnectionState, RealtimeEvent } from '../core/models';

const CHANNEL = 'rtchat.v1';

/**
 * Camada de transporte. Nesta demo, "o servidor" é um BroadcastChannel compartilhado por todas as abas do
 * navegador, então duas abas logadas como Ana e Bruno conversam de verdade. A interface
 * (`events$`, `publish`, `connection`) independe do transporte: o `WebSocketService` pode ser plugado por trás dela.
 */
@Injectable({ providedIn: 'root' })
export class RealtimeService implements OnDestroy {
  private channel: BroadcastChannel | null = null;
  private readonly _events$ = new Subject<RealtimeEvent>();
  readonly events$ = this._events$.asObservable();

  private readonly _connection = signal<ConnectionState>('connecting');
  readonly connection = this._connection.asReadonly();
  /** Chave controlada pelo usuário para demonstrar o fluxo de falha/reenvio. */
  private readonly _simulateOffline = signal(false);
  readonly simulateOffline = this._simulateOffline.asReadonly();
  readonly isOnline = computed(() => this._connection() === 'connected');

  private connectTimer: ReturnType<typeof setTimeout> | undefined;

  connect(): void {
    if (this.channel) return;
    this._connection.set('connecting');
    if (typeof BroadcastChannel !== 'undefined') {
      this.channel = new BroadcastChannel(CHANNEL);
      this.channel.onmessage = (e: MessageEvent<RealtimeEvent>) => this._events$.next(e.data);
    }
    // Pequeno handshake artificial para o estado "conectando" ficar visível.
    this.connectTimer = setTimeout(() => this._connection.set(this._simulateOffline() ? 'offline' : 'connected'), 700);
  }

  disconnect(): void {
    clearTimeout(this.connectTimer);
    this.channel?.close();
    this.channel = null;
    this._connection.set('connecting');
  }

  /** Envia às outras abas. Retorna false quando a rede (simulada) está fora. */
  publish(event: RealtimeEvent): boolean {
    if (!this.isOnline()) return false;
    this.channel?.postMessage(event);
    return true;
  }

  toggleOffline(): void {
    const next = !this._simulateOffline();
    this._simulateOffline.set(next);
    if (next) {
      this._connection.set('offline');
    } else {
      this._connection.set('connecting');
      clearTimeout(this.connectTimer);
      this.connectTimer = setTimeout(() => this._connection.set('connected'), 900);
    }
  }

  ngOnDestroy(): void {
    this.disconnect();
  }
}
