import { Component, DestroyRef, inject, signal } from '@angular/core';
import { Location } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { PageRevealDirective } from '../../directives/page-reveal';
import { AuthService } from '../../services/auth';
import { lockAuthPageBody } from '../shared/auth-page-body-lock';
import {
  clearEmailConfirmedAccess,
  grantEmailConfirmedAccess,
  readEmailConfirmedAccess,
  tryClaimEmailConfirmedCallback,
} from './email-confirmed-access';

type EmailConfirmedStatus = 'success' | 'error';

const RESEND_COOLDOWN_SECONDS = 20 * 60;
const REDIRECT_SECONDS = 5;

function readResendCooldownLeftSeconds(email: string): number {
  const key = `auth:resend-confirmation:${email.toLowerCase()}`;
  const raw = sessionStorage.getItem(key);
  if (!raw) return 0;

  const timestampMs = Number(raw);
  if (!Number.isFinite(timestampMs) || timestampMs <= 0) return 0;

  const elapsedSeconds = Math.floor((Date.now() - timestampMs) / 1000);
  return Math.max(0, RESEND_COOLDOWN_SECONDS - elapsedSeconds);
}

function writeResendCooldown(email: string): void {
  const key = `auth:resend-confirmation:${email.toLowerCase()}`;
  sessionStorage.setItem(key, String(Date.now()));
}

@Component({
  selector: 'app-email-confirmed-page',
  imports: [RouterLink, PageRevealDirective],
  styleUrl: './email-confirmed.scss',
  template: `
    <div class="auth-shell marketing-surface" appPageReveal>
      <div class="auth-atmosphere" aria-hidden="true">
        <span class="auth-orb auth-orb--a"></span>
        <span class="auth-orb auth-orb--b"></span>
      </div>

      <section class="auth-panel" aria-label="Potwierdzenie email">
        <header class="auth-panel__top">
          <a routerLink="/" class="brand" aria-label="Starvia — strona główna">
            <span class="brand__icon-wrap">
              <img
                class="brand__icon"
                src="/starvia-logo.png"
                alt=""
                width="44"
                height="44"
                decoding="async"
              />
            </span>
            <span class="brand__name" aria-hidden="true">Starvia</span>
          </a>
          <a routerLink="/login" class="auth-panel__switch" (click)="leaveToLogin()">Zaloguj się</a>
        </header>

        <div class="auth-panel__body">
          <div class="confirm-card">
            @if (status() === 'error') {
              <p class="confirm-card__eyebrow confirm-card__eyebrow--error">Coś poszło nie tak</p>
              <h1 class="confirm-card__title">Nie udało się potwierdzić emaila</h1>

              @if (errorMessage(); as message) {
                <p class="confirm-card__message confirm-card__message--error">{{ message }}</p>
              }

              @if (email(); as address) {
                <p class="confirm-card__email">{{ address }}</p>
              }

              <p class="confirm-card__hint">
                Możesz wysłać wiadomość ponownie. Ze względów bezpieczeństwa — raz na 20 minut.
              </p>

              <div class="confirm-card__actions">
                <button
                  type="button"
                  class="btn btn--primary"
                  (click)="resendEmail()"
                  [disabled]="!email() || isResending() || resendCooldownLeftSeconds() > 0"
                >
                  @if (resendCooldownLeftSeconds() > 0) {
                    Ponów za {{ formatCooldown(resendCooldownLeftSeconds()) }}
                  } @else {
                    {{ isResending() ? 'Wysyłanie...' : 'Wyślij ponownie' }}
                  }
                </button>
                <a routerLink="/login" class="btn btn--secondary" (click)="leaveToLogin()">
                  Przejdź do logowania
                </a>
              </div>

              @if (resendResult() === 'success') {
                <p class="confirm-card__note confirm-card__note--success">
                  Wiadomość wysłana. Sprawdź skrzynkę.
                </p>
              } @else if (resendResult() === 'error') {
                <p class="confirm-card__note confirm-card__note--error">
                  Nie udało się wysłać wiadomości. Spróbuj później.
                </p>
              }
            } @else {
              <p class="confirm-card__eyebrow">Gotowe</p>
              <h1 class="confirm-card__title">Email potwierdzony</h1>
              <p class="confirm-card__message">
                Adres jest zweryfikowany. Za chwilę przeniesiemy Cię do logowania —
                <span class="confirm-card__countdown">{{ secondsLeft() }}s</span>
              </p>
              <a
                routerLink="/login"
                class="btn btn--primary confirm-card__cta"
                (click)="leaveToLogin()"
              >
                Zaloguj się teraz
              </a>
            }
          </div>
        </div>

        <footer class="auth-panel__foot">
          <p class="auth-panel__foot-copy">© {{ currentYear }} Starvia</p>
          <div class="auth-panel__foot-links">
            <a routerLink="/" class="auth-panel__foot-link" (click)="clearAccess()">
              Wróć na stronę główną
            </a>
          </div>
        </footer>
      </section>
    </div>
  `,
})
export class EmailConfirmedPage {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly location = inject(Location);
  private readonly destroyRef = inject(DestroyRef);
  private readonly auth = inject(AuthService);

  protected readonly currentYear = new Date().getFullYear();
  protected readonly status = signal<EmailConfirmedStatus>('success');
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly email = signal<string | null>(null);
  protected readonly secondsLeft = signal(REDIRECT_SECONDS);

  protected readonly resendCooldownLeftSeconds = signal(0);
  protected readonly isResending = signal(false);
  protected readonly resendResult = signal<'idle' | 'success' | 'error'>('idle');

  constructor() {
    lockAuthPageBody();
    this.hydrateAccess();
  }

  protected clearAccess(): void {
    clearEmailConfirmedAccess();
  }

  protected leaveToLogin(): void {
    clearEmailConfirmedAccess();
  }

  private hydrateAccess(): void {
    const claimed = tryClaimEmailConfirmedCallback(this.route.snapshot.queryParamMap);
    if (claimed) {
      grantEmailConfirmedAccess(claimed);
      // Strip query so the callback URL cannot be replayed from history / share.
      this.location.replaceState('/email-confirmed');
      this.applyAccess(claimed.status, claimed.email, claimed.message);
      return;
    }

    const access = readEmailConfirmedAccess();
    if (!access) {
      void this.router.navigateByUrl('/login');
      return;
    }

    this.applyAccess(access.status, access.email, access.message);
  }

  private applyAccess(
    status: EmailConfirmedStatus,
    email: string | null,
    message: string | null
  ): void {
    this.status.set(status);
    this.email.set(email);
    this.errorMessage.set(message);
    this.refreshCooldown();

    if (status === 'success') {
      this.startRedirectCountdown();
    }
  }

  protected resendEmail(): void {
    const email = this.email();
    if (!email) return;
    if (this.isResending() || this.resendCooldownLeftSeconds() > 0) return;

    this.isResending.set(true);
    this.resendResult.set('idle');

    this.auth.resendConfirmationEmail(email).subscribe({
      next: () => {
        writeResendCooldown(email);
        this.refreshCooldown(true);
        this.resendResult.set('success');
        this.isResending.set(false);
      },
      error: () => {
        this.resendResult.set('error');
        this.isResending.set(false);
      },
    });
  }

  protected formatCooldown(totalSeconds: number): string {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
  }

  private refreshCooldown(startTicker = false): void {
    const email = this.email();
    if (!email) {
      this.resendCooldownLeftSeconds.set(0);
      return;
    }

    const update = (): void => {
      this.resendCooldownLeftSeconds.set(readResendCooldownLeftSeconds(email));
    };

    update();

    if (!startTicker) return;

    const intervalId = window.setInterval(() => {
      update();
      if (this.resendCooldownLeftSeconds() <= 0) {
        window.clearInterval(intervalId);
      }
    }, 1000);

    this.destroyRef.onDestroy(() => window.clearInterval(intervalId));
  }

  private startRedirectCountdown(): void {
    this.secondsLeft.set(REDIRECT_SECONDS);

    const intervalId = window.setInterval(() => {
      this.secondsLeft.update((value) => Math.max(0, value - 1));
    }, 1000);

    const timeoutId = window.setTimeout(() => {
      clearEmailConfirmedAccess();
      void this.router.navigateByUrl('/login');
    }, REDIRECT_SECONDS * 1000);

    this.destroyRef.onDestroy(() => {
      window.clearInterval(intervalId);
      window.clearTimeout(timeoutId);
    });
  }
}
