import { TestBed } from '@angular/core/testing';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  beforeEach(() => sessionStorage.clear());

  it('logs in a demo user case-insensitively and persists the session', () => {
    const auth = TestBed.inject(AuthService);
    expect(auth.login(' Ana ')).toBe(true);
    expect(auth.user()?.id).toBe('ana');
    expect(sessionStorage.getItem('rtchat.user')).toBe('ana');
  });

  it('rejects unknown users', () => {
    const auth = TestBed.inject(AuthService);
    expect(auth.login('zed')).toBe(false);
    expect(auth.isLoggedIn()).toBe(false);
  });
});
