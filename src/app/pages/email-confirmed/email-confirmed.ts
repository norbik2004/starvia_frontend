import { Component, DestroyRef, inject, signal } from '@angular/core';
import { Location } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { LoadingSpinner } from '../../components/loading-spinner/loading-spinner';
import { PageRevealDirective } from '../../directives/page-reveal';
import { toApplicationError } from '../../models/application-error';
import { AuthService } from '../../services/auth';
import { lockAuthPageBody } from '../shared/auth-page-body-lock';
import { readEmailConfirmationCallback } from './email-confirmed-access';

type EmailConfirmedStatus = 'loading' | 'success' | 'error';

const REDIRECT_SECONDS = 5;

@Component({
  selector: 'app-email-confirmed-page',
  imports: [RouterLink, LoadingSpinner, PageRevealDirective],
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
          <a routerLink="/login" class="auth-panel__switch">Zaloguj się</a>
        </header>

        <div class="auth-panel__body">
          <div class="confirm-card">
            @if (status() === 'loading') {
              <p class="confirm-card__eyebrow">Weryfikacja</p>
              <h1 class="confirm-card__title">Potwierdzamy Twój email</h1>
              <div class="confirm-card__loading" aria-live="polite">
                <app-loading-spinner label="Weryfikowanie adresu email" />
                <p class="confirm-card__message">
                  Sprawdzamy link aktywacyjny. Poczekaj na wynik weryfikacji.
                </p>
              </div>
            } @else if (status() === 'error') {
              <p class="confirm-card__eyebrow confirm-card__eyebrow--error">Coś poszło nie tak</p>
              <h1 class="confirm-card__title">Nie udało się potwierdzić emaila</h1>

              @if (errorMessage(); as message) {
                <p class="confirm-card__message confirm-card__message--error" role="alert">
                  {{ message }}
                </p>
              }

              <p class="confirm-card__hint">
                Upewnij się, że otwierasz pełny link z najnowszej wiadomości aktywacyjnej.
              </p>

              <div class="confirm-card__actions">
                <a routerLink="/login" class="btn btn--primary"> Przejdź do logowania </a>
                <a routerLink="/" class="btn btn--secondary">Wróć na stronę główną</a>
              </div>
            } @else {
              <p class="confirm-card__eyebrow">Gotowe</p>
              <h1 class="confirm-card__title">Email potwierdzony</h1>
              <p class="confirm-card__message">
                Adres jest zweryfikowany. Za chwilę przeniesiemy Cię do logowania —
                <span class="confirm-card__countdown">{{ secondsLeft() }}s</span>
              </p>
              <a routerLink="/login" class="btn btn--primary confirm-card__cta">
                Zaloguj się teraz
              </a>
            }
          </div>
        </div>

        <footer class="auth-panel__foot">
          <p class="auth-panel__foot-copy">© {{ currentYear }} Starvia</p>
          <div class="auth-panel__foot-links">
            <a routerLink="/" class="auth-panel__foot-link">Wróć na stronę główną</a>
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
  protected readonly status = signal<EmailConfirmedStatus>('loading');
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly secondsLeft = signal(REDIRECT_SECONDS);

  constructor() {
    lockAuthPageBody();
    this.verifyEmail();
  }

  private verifyEmail(): void {
    const request = readEmailConfirmationCallback(this.route.snapshot.queryParamMap);
    if (!request) {
      void this.router.navigateByUrl('/login');
      return;
    }

    // Do not leave a reusable confirmation code in browser history or the address bar.
    this.location.replaceState('/email-confirmed');

    this.auth
      .confirmEmail(request)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.status.set('success');
          this.startRedirectCountdown();
        },
        error: (error: unknown) => {
          const applicationError = toApplicationError(
            error,
            'Link potwierdzający jest nieprawidłowy, wygasł lub został już użyty.',
            'Nie udało się połączyć z serwerem. Otwórz link ponownie za chwilę.',
          );
          this.errorMessage.set(applicationError.description);
          this.status.set('error');
        },
      });
  }

  private startRedirectCountdown(): void {
    this.secondsLeft.set(REDIRECT_SECONDS);

    const intervalId = window.setInterval(() => {
      this.secondsLeft.update((value) => Math.max(0, value - 1));
    }, 1000);

    const timeoutId = window.setTimeout(() => {
      void this.router.navigateByUrl('/login');
    }, REDIRECT_SECONDS * 1000);

    this.destroyRef.onDestroy(() => {
      window.clearInterval(intervalId);
      window.clearTimeout(timeoutId);
    });
  }
}
