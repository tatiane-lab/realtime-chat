import { Injectable, computed, signal } from '@angular/core';
import { DEMO_USERS, User } from './models';

const KEY = 'rtchat.user';

/** Autenticação de demonstração: a identidade fica no sessionStorage, então cada aba pode ser um usuário. */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly _user = signal<User | null>(this.restore());
  readonly user = this._user.asReadonly();
  readonly isLoggedIn = computed(() => this._user() !== null);
  readonly demoUsers = DEMO_USERS;

  login(userId: string): boolean {
    const user = DEMO_USERS.find((u) => u.id === userId.trim().toLowerCase());
    if (!user) return false;
    this._user.set(user);
    try {
      sessionStorage.setItem(KEY, user.id);
    } catch {
      /* armazenamento indisponível: a sessão dura até recarregar */
    }
    return true;
  }

  logout(): void {
    this._user.set(null);
    try {
      sessionStorage.removeItem(KEY);
    } catch {
      /* ignorar */
    }
  }

  private restore(): User | null {
    try {
      const id = sessionStorage.getItem(KEY);
      return DEMO_USERS.find((u) => u.id === id) ?? null;
    } catch {
      return null;
    }
  }
}
