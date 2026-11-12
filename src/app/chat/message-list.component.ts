import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterRenderEffect,
  computed,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { Message } from '../core/models';
import { BOT_USERS, DEMO_USERS } from '../core/models';

const NEAR_BOTTOM_PX = 120;
const HUES = new Map([...DEMO_USERS, ...BOT_USERS].map((u) => [u.id, u.hue]));

interface Row {
  msg: Message;
  own: boolean;
  /** Primeira de uma sequência do mesmo autor: exibe avatar e nome. */
  head: boolean;
  /** Separador de data exibido antes desta mensagem. */
  day: number | null;
  hue: number;
}

/**
 * Container de rolagem simples no lugar do cdk-virtual-scroll: os balões têm altura variável (texto quebrado),
 * o que a virtualização de tamanho fixo trata mal, e um canal tem no máximo algumas centenas de linhas.
 */
@Component({
  selector: 'app-message-list',
  imports: [DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="msgs" #scroller (scroll)="onScroll()" role="log" aria-live="polite" aria-label="Mensagens">
      @if (rows().length === 0) {
        <div class="empty">
          <div class="empty__icon" aria-hidden="true">💬</div>
          <h3>Nenhuma mensagem ainda</h3>
          <p>Seja o primeiro a escrever neste canal.</p>
        </div>
      }
      @for (r of rows(); track r.msg.id) {
        @if (r.day !== null) {
          <div class="day"><span>{{ r.day | date: 'EEEE, d MMM' }}</span></div>
        }
        <div class="row" [class.row--own]="r.own" [class.row--head]="r.head">
          @if (!r.own) {
            <span class="avatar" [class.avatar--ghost]="!r.head" [style.--hue]="r.hue">{{ r.msg.username[0] }}</span>
          }
          <div class="bubble" [class.bubble--own]="r.own" [class.bubble--failed]="r.msg.status === 'failed'">
            @if (r.head && !r.own) {
              <span class="bubble__name" [style.--hue]="r.hue">{{ r.msg.username }}</span>
            }
            <p class="bubble__text">{{ r.msg.text }}</p>
            <span class="bubble__meta">
              <time [attr.datetime]="r.msg.timestamp | date: 'yyyy-MM-ddTHH:mm:ss'">{{ r.msg.timestamp | date: 'HH:mm' }}</time>
              @if (r.own) {
                @switch (r.msg.status) {
                  @case ('sending') { <span class="state state--sending" title="Enviando">●</span> }
                  @case ('sent') { <span class="state" title="Enviada">✓</span> }
                  @case ('failed') { <span class="state state--failed" title="Falhou">!</span> }
                }
              }
            </span>
            @if (r.msg.status === 'failed') {
              <span class="bubble__actions">
                Falha ao enviar.
                <button type="button" class="link" (click)="retry.emit(r.msg.id)">Tentar de novo</button>
                <button type="button" class="link link--muted" (click)="discard.emit(r.msg.id)">Descartar</button>
              </span>
            }
          </div>
        </div>
      }
    </div>
    @if (showJump()) {
      <button type="button" class="jump" (click)="scrollToBottom(true)">↓ Novas mensagens</button>
    }
  `,
  host: { class: 'msglist' },
})
export class MessageListComponent {
  readonly messages = input.required<Message[]>();
  readonly currentUserId = input.required<string>();
  readonly retry = output<string>();
  readonly discard = output<string>();

  private readonly scroller = viewChild.required<ElementRef<HTMLElement>>('scroller');
  private readonly nearBottom = signal(true);
  protected readonly showJump = signal(false);

  protected readonly rows = computed<Row[]>(() => {
    const me = this.currentUserId();
    let prev: Message | undefined;
    return this.messages().map((msg) => {
      const sameDay = prev && new Date(prev.timestamp).toDateString() === new Date(msg.timestamp).toDateString();
      const row: Row = {
        msg,
        own: msg.userId === me,
        head: !prev || prev.userId !== msg.userId || !sameDay || msg.timestamp - prev.timestamp > 5 * 60_000,
        day: sameDay ? null : msg.timestamp,
        hue: HUES.get(msg.userId) ?? 200,
      };
      prev = msg;
      return row;
    });
  });

  constructor() {
    // A cada renderização que muda as linhas: acompanha a conversa, a menos que o leitor tenha rolado para cima.
    afterRenderEffect(() => {
      const rows = this.rows();
      const last = rows.at(-1);
      if (!last) return;
      if (untracked(() => this.nearBottom()) || last.own) {
        this.scrollToBottom(false);
      } else {
        this.showJump.set(true);
      }
    });
  }

  protected onScroll(): void {
    const el = this.scroller().nativeElement;
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX;
    this.nearBottom.set(near);
    if (near) this.showJump.set(false);
  }

  protected scrollToBottom(smooth: boolean): void {
    const el = this.scroller().nativeElement;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
    this.showJump.set(false);
    this.nearBottom.set(true);
  }
}
