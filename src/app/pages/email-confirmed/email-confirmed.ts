import {
  AfterViewInit,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  OnDestroy,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Header } from '../../layout/header/header';
import { createHeroStars } from '../../layout/shared/section-stars';
import { createSectionStarsInteraction } from '../../layout/shared/section-stars-pointer';
import { SectionStarsLayer } from '../../layout/shared/section-stars-layer';
import { PageRevealDirective } from '../../directives/page-reveal';
import { lockAuthPageBody } from '../shared/auth-page-body-lock';
import { AuthService } from '../../services/auth';

type EmailConfirmedStatus = 'success' | 'error' | 'unknown';

const RESEND_COOLDOWN_SECONDS = 20 * 60;

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
  imports: [Header, SectionStarsLayer, PageRevealDirective],
  styleUrl: './email-confirmed.scss',
  template: `
    <app-header
      [links]="[]"
      actionLabel="Back home"
      actionRoute="/"
      navLabel="Email confirmed navigation"
      brandMode="route"
      brandRoute="/"
    />

    <main
      class="email-confirmed"
      (mousemove)="starsInteraction.onPointerMove($event)"
      (mouseleave)="starsInteraction.onPointerLeave()"
    >
      <div class="email-confirmed__bg" aria-hidden="true">
        <app-section-stars-layer
          class="email-confirmed__stars"
          [stars]="stars"
          [nearIds]="starsInteraction.nearStarIds()"
        />
      </div>

      <div class="email-confirmed__content" appPageReveal>
        @if (status() === 'error') {
          <p class="email-confirmed__code email-confirmed__code--error">!</p>
          <h1 class="email-confirmed__title">Email confirmation failed</h1>
          @if (errorMessage(); as message) {
            <p class="email-confirmed__message email-confirmed__message--error">{{ message }}</p>
          }
          @if (email(); as address) {
            <p class="email-confirmed__email">{{ address }}</p>
          }
          <p class="email-confirmed__hint">
            You can resend the confirmation email. For security, it can be sent once every 20 minutes.
          </p>

          <div class="email-confirmed__actions" aria-label="Email confirmation help actions">
            <button
              type="button"
              class="btn btn--primary"
              (click)="resendEmail()"
              [disabled]="!email() || isResending() || resendCooldownLeftSeconds() > 0"
            >
              @if (resendCooldownLeftSeconds() > 0) {
                Resend in {{ formatCooldown(resendCooldownLeftSeconds()) }}
              } @else {
                {{ isResending() ? 'Sending...' : 'Resend email' }}
              }
            </button>
            <a href="mailto:support@starvia.app" class="btn btn--secondary">Contact</a>
          </div>

          @if (resendResult() === 'success') {
            <p class="email-confirmed__note email-confirmed__note--success">
              Confirmation email sent. Please check your inbox.
            </p>
          } @else if (resendResult() === 'error') {
            <p class="email-confirmed__note email-confirmed__note--error">
              Unable to resend the email right now. Please try again later.
            </p>
          }
        } @else {
          <p class="email-confirmed__code">✓</p>
          <h1 class="email-confirmed__title">Email confirmed</h1>
          <p class="email-confirmed__message">
            Your email address is verified. Redirecting to login in
            <span class="email-confirmed__countdown">{{ secondsLeft() }}s</span>.
          </p>
        }
      </div>
    </main>
  `,
})
export class EmailConfirmedPage implements AfterViewInit, OnDestroy {
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly auth = inject(AuthService);

  protected readonly status = signal<EmailConfirmedStatus>('unknown');
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly email = signal<string | null>(null);
  protected readonly secondsLeft = signal(5);
  protected readonly stars = createHeroStars();
  protected readonly starsInteraction = createSectionStarsInteraction(this.stars);

  protected readonly resendCooldownLeftSeconds = signal(0);
  protected readonly isResending = signal(false);
  protected readonly resendResult = signal<'idle' | 'success' | 'error'>('idle');

  constructor() {
    lockAuthPageBody();
    this.readQueryParams();
  }

  private readQueryParams(): void {
    const qp = this.route.snapshot.queryParamMap;
    const status = qp.get('status');
    const message = qp.get('message');
    const email = qp.get('email');

    this.email.set(typeof email === 'string' && email.trim().length ? email.trim() : null);
    this.refreshCooldown();

    if (status === 'success') {
      this.status.set('success');
      this.errorMessage.set(null);
      this.startRedirectCountdown();
      return;
    }

    if (status === 'error') {
      this.status.set('error');
      this.errorMessage.set(typeof message === 'string' && message.trim().length ? message.trim() : null);
      return;
    }

    this.status.set('unknown');
    this.errorMessage.set(null);
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

  ngAfterViewInit(): void {
    const section = this.host.nativeElement.querySelector('.email-confirmed');
    if (section instanceof HTMLElement) {
      this.starsInteraction.attach(section);
    }
  }

  ngOnDestroy(): void {
    this.starsInteraction.destroy();
  }

  private startRedirectCountdown(): void {
    const intervalId = window.setInterval(() => {
      this.secondsLeft.update((value) => Math.max(0, value - 1));
    }, 1000);

    const timeoutId = window.setTimeout(() => {
      void this.router.navigateByUrl('/login');
    }, 5000);

    this.destroyRef.onDestroy(() => {
      window.clearInterval(intervalId);
      window.clearTimeout(timeoutId);
    });
  }
}

