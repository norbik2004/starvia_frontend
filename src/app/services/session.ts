import { Injectable, signal } from '@angular/core';
import { Observable, of } from 'rxjs';
import type { AuthSession, AuthenticatedUser } from '../models/auth-session';

const TOKEN_EXPIRY_SKEW_MS = 30_000;
const MAX_TIMEOUT_MS = 2_147_483_647;
const SESSION_STORAGE_KEY = 'starvia:auth-session';
const SESSION_STORAGE_VERSION = 1;

@Injectable({ providedIn: 'root' })
export class SessionService {
  private authSession: AuthSession | null = null;
  private expiryTimer: ReturnType<typeof setTimeout> | null = null;

  readonly loggedIn = signal(false);
  readonly checked = signal(true);
  readonly user = signal<AuthenticatedUser | null>(null);

  constructor() {
    this.restoreStoredSession();
  }

  /**
   * sessionStorage keeps the session across reloads, but limits it to the
   * current browser tab instead of persisting it indefinitely.
   */
  establish(authSession: AuthSession): void {
    this.clearExpiryTimer();
    this.authSession = authSession;
    this.storeSession(authSession);
    this.user.set(authSession.user);
    this.loggedIn.set(true);
    this.checked.set(true);
    this.scheduleExpiry();
  }

  getAccessToken(): string | null {
    if (!this.hasValidSession()) {
      return null;
    }

    return this.authSession?.accessToken ?? null;
  }

  checkOnce(): Observable<boolean> {
    return of(this.hasValidSession());
  }

  refresh(): Observable<boolean> {
    return of(this.hasValidSession());
  }

  setLoggedOut(): void {
    this.authSession = null;
    this.clearExpiryTimer();
    this.clearStoredSession();
    this.user.set(null);
    this.loggedIn.set(false);
    this.checked.set(true);
  }

  private hasValidSession(): boolean {
    if (!this.authSession || this.authSession.expiresAtMs <= Date.now() + TOKEN_EXPIRY_SKEW_MS) {
      this.setLoggedOut();
      return false;
    }

    return true;
  }

  private scheduleExpiry(): void {
    if (!this.authSession) {
      return;
    }

    const delay = this.authSession.expiresAtMs - Date.now() - TOKEN_EXPIRY_SKEW_MS;
    if (delay <= 0) {
      this.setLoggedOut();
      return;
    }

    this.expiryTimer = setTimeout(
      () => {
        this.expiryTimer = null;
        if (this.hasValidSession()) {
          this.scheduleExpiry();
        }
      },
      Math.min(delay, MAX_TIMEOUT_MS),
    );
  }

  private clearExpiryTimer(): void {
    if (this.expiryTimer !== null) {
      clearTimeout(this.expiryTimer);
      this.expiryTimer = null;
    }
  }

  private restoreStoredSession(): void {
    const authSession = this.readStoredSession();
    if (!authSession) {
      this.clearStoredSession();
      return;
    }

    this.authSession = authSession;
    if (!this.hasValidSession()) {
      return;
    }

    this.user.set(authSession.user);
    this.loggedIn.set(true);
    this.scheduleExpiry();
  }

  private storeSession(authSession: AuthSession): void {
    try {
      sessionStorage.setItem(
        SESSION_STORAGE_KEY,
        JSON.stringify({
          version: SESSION_STORAGE_VERSION,
          ...authSession,
        }),
      );
    } catch {
      // Storage may be unavailable in restricted browser contexts.
    }
  }

  private readStoredSession(): AuthSession | null {
    try {
      const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
      if (!raw) {
        return null;
      }

      const value: unknown = JSON.parse(raw);
      if (
        !isRecord(value) ||
        value['version'] !== SESSION_STORAGE_VERSION ||
        typeof value['accessToken'] !== 'string' ||
        !value['accessToken'].trim() ||
        typeof value['expiresAtMs'] !== 'number' ||
        !Number.isFinite(value['expiresAtMs']) ||
        !isRecord(value['user'])
      ) {
        return null;
      }

      const user = value['user'];
      const userId = user['userId'];
      const email = user['email'];
      const roles = user['roles'];
      if (
        typeof userId !== 'string' ||
        !userId.trim() ||
        typeof email !== 'string' ||
        !email.trim() ||
        !Array.isArray(roles) ||
        roles.some((role) => typeof role !== 'string')
      ) {
        return null;
      }

      return {
        accessToken: value['accessToken'].trim(),
        expiresAtMs: value['expiresAtMs'],
        user: {
          userId: userId.trim(),
          email: email.trim(),
          roles: roles.map((role) => role.trim()).filter(Boolean),
        },
      };
    } catch {
      return null;
    }
  }

  private clearStoredSession(): void {
    try {
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
    } catch {
      // Storage may be unavailable in restricted browser contexts.
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
