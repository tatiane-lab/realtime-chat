import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../core/auth.service';

@Component({
  selector: 'app-login',
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="login">
      <section class="login__card" aria-labelledby="login-title">
        <div class="login__logo" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z" stroke-linejoin="round" />
          </svg>
        </div>
        <h1 id="login-title">Realtime Chat</h1>
        <p class="login__sub">Entre com uma conta demo e abra uma segunda aba com o outro usuário para conversar em tempo real.</p>

        <div class="login__demo" role="group" aria-label="Contas demo">
          @for (u of auth.demoUsers; track u.id) {
            <button type="button" class="demo-btn" (click)="enter(u.id)">
              <span class="avatar avatar--lg" [style.--hue]="u.hue">{{ u.username[0] }}</span>
              <span>Entrar como <strong>{{ u.username }}</strong></span>
            </button>
          }
        </div>

        <div class="login__divider"><span>ou digite o usuário</span></div>

        <form class="login__form" (ngSubmit)="submit()">
          <label for="username">Usuário</label>
          <input
            id="username"
            name="username"
            autocomplete="username"
            placeholder="ana ou bruno"
            [ngModel]="username()"
            (ngModelChange)="username.set($event); error.set('')"
          />
          @if (error()) {
            <p class="login__error" role="alert">{{ error() }}</p>
          }
          <button type="submit" class="btn btn--primary" [disabled]="!username().trim()">Entrar</button>
        </form>
        <p class="login__hint">Demo sem backend: as abas conversam via BroadcastChannel e os bots Carla e Diego respondem.</p>
      </section>
    </main>
  `,
})
export class LoginComponent {
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly username = signal('ana');
  protected readonly error = signal('');

  protected enter(id: string): void {
    this.auth.login(id);
    void this.router.navigateByUrl('/chat');
  }

  protected submit(): void {
    if (this.auth.login(this.username())) {
      void this.router.navigateByUrl('/chat');
    } else {
      this.error.set('Usuário não encontrado. Use "ana" ou "bruno".');
    }
  }
}
