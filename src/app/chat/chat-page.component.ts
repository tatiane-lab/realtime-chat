import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { BOT_USERS, DEMO_USERS, ROOMS, User } from '../core/models';
import { ChatStore } from './chat.store';
import { MessageListComponent } from './message-list.component';
import { RealtimeService } from './realtime.service';

@Component({
  selector: 'app-chat-page',
  imports: [FormsModule, MessageListComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="shell" [class.shell--nav-open]="navOpen()">
      <button type="button" class="shell__scrim" aria-label="Fechar menu" (click)="navOpen.set(false)"></button>

      <aside class="side" aria-label="Navegação">
        <header class="side__head">
          <div class="brand">
            <span class="brand__logo" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z" stroke-linejoin="round" /></svg>
            </span>
            Realtime Chat
          </div>
        </header>

        <nav class="side__section">
          <h2>Canais</h2>
          @for (r of rooms; track r.id) {
            <button
              type="button"
              class="room"
              [class.room--active]="store.currentRoomId() === r.id"
              [attr.aria-current]="store.currentRoomId() === r.id ? 'page' : null"
              (click)="selectRoom(r.id)"
            >
              <span class="room__hash">#</span>
              <span class="room__name">{{ r.name }}</span>
              @if ((store.unread()[r.id] ?? 0) > 0) {
                <span class="badge">{{ store.unread()[r.id] }}</span>
              }
            </button>
          }
        </nav>

        <section class="side__section side__section--grow">
          <h2>Pessoas <span class="count">{{ onlineCount() }} online</span></h2>
          @for (u of people(); track u.id) {
            <div class="person" [class.person--off]="!store.onlineIds().has(u.id)">
              <span class="avatar avatar--sm" [style.--hue]="u.hue">
                {{ u.username[0] }}
                <i class="dot" [class.dot--on]="store.onlineIds().has(u.id)"></i>
              </span>
              <span class="person__name">{{ u.username }}{{ u.id === me()?.id ? ' (você)' : '' }}</span>
              @if (u.bot) { <span class="tag">bot</span> }
            </div>
          }
        </section>

        <footer class="side__foot">
          <div class="me">
            <span class="avatar avatar--sm" [style.--hue]="me()?.hue ?? 200">{{ me()?.username?.[0] }}</span>
            <span class="me__name">{{ me()?.username }}</span>
            <button type="button" class="btn btn--ghost btn--sm" (click)="logout()">Sair</button>
          </div>
          <label class="switch" title="Simula queda de rede para ver o fluxo de falha e reenvio">
            <input type="checkbox" [checked]="rt.simulateOffline()" (change)="rt.toggleOffline()" />
            <span class="switch__track"></span>
            Simular offline
          </label>
        </footer>
      </aside>

      <section class="main">
        <header class="main__head">
          <button type="button" class="icon-btn menu-btn" aria-label="Abrir menu" (click)="navOpen.set(true)">☰</button>
          <div class="main__title">
            <h1># {{ store.currentRoom().name }}</h1>
            <p>{{ store.currentRoom().topic }}</p>
          </div>
          <span class="conn" [class]="'conn conn--' + rt.connection()" role="status">
            <i></i>{{ connLabel() }}
          </span>
        </header>

        @if (rt.connection() === 'connecting' && store.roomMessages().length === 0) {
          <div class="loading" role="status">
            <span class="spinner"></span> Conectando ao servidor...
          </div>
        } @else {
          <app-message-list
            [messages]="store.roomMessages()"
            [currentUserId]="me()?.id ?? ''"
            (retry)="store.retry($event)"
            (discard)="store.discard($event)"
          />
        }

        @if (rt.connection() === 'offline') {
          <div class="banner" role="alert">Sem conexão. As mensagens enviadas agora vão falhar e podem ser reenviadas.</div>
        }

        <div class="typing" aria-live="polite">
          @if (typingLabel(); as label) {
            <span class="typing__dots" aria-hidden="true"><i></i><i></i><i></i></span> {{ label }}
          }
        </div>

        <form class="composer" (ngSubmit)="send()">
          <textarea
            rows="1"
            name="message"
            [placeholder]="'Mensagem em #' + store.currentRoom().name"
            aria-label="Mensagem"
            maxlength="2000"
            [ngModel]="draft()"
            (ngModelChange)="onDraft($event)"
            (keydown.enter)="onEnter($event)"
          ></textarea>
          <button type="submit" class="btn btn--primary" [disabled]="!draft().trim()" aria-label="Enviar">
            Enviar
          </button>
        </form>
      </section>
    </div>
  `,
})
export class ChatPageComponent {
  protected readonly store = inject(ChatStore);
  protected readonly rt = inject(RealtimeService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly rooms = ROOMS;
  protected readonly me = this.auth.user;
  protected readonly navOpen = signal(false);
  protected readonly draft = signal('');

  protected readonly people = computed<User[]>(() => {
    const online = this.store.onlineIds();
    return [...DEMO_USERS, ...BOT_USERS].sort((a, b) => Number(online.has(b.id)) - Number(online.has(a.id)));
  });
  protected readonly onlineCount = computed(() => this.store.onlineIds().size);

  protected readonly connLabel = computed(
    () => ({ connected: 'Conectado', connecting: 'Conectando...', offline: 'Offline' })[this.rt.connection()],
  );

  protected readonly typingLabel = computed(() => {
    const n = this.store.typingNames();
    if (n.length === 0) return '';
    if (n.length === 1) return `${n[0]} está digitando...`;
    return `${n.join(' e ')} estão digitando...`;
  });

  constructor() {
    const user = this.auth.user();
    if (user) this.store.init(user);
    inject(DestroyRef).onDestroy(() => this.store.destroy());
  }

  protected selectRoom(id: string): void {
    this.store.selectRoom(id);
    this.navOpen.set(false);
  }

  protected onDraft(value: string): void {
    this.draft.set(value);
    if (value) this.store.notifyTyping();
  }

  protected onEnter(event: Event): void {
    const e = event as KeyboardEvent;
    if (e.shiftKey) return;
    e.preventDefault();
    this.send();
  }

  protected send(): void {
    const text = this.draft().trim();
    if (!text) return;
    this.store.sendMessage(text);
    this.draft.set('');
  }

  protected logout(): void {
    this.auth.logout();
    void this.router.navigateByUrl('/login');
  }
}
