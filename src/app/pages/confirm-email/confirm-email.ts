import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { PageRevealDirective } from '../../directives/page-reveal';
import { lockAuthPageBody } from '../shared/auth-page-body-lock';
import {
  clearConfirmEmailAccess,
  grantConfirmEmailAccess,
  readConfirmEmailAccess,
  readConfirmEmailFromHistoryState,
} from './confirm-email-access';

@Component({
  selector: 'app-confirm-email-page',
  imports: [RouterLink, PageRevealDirective],
  styleUrl: './confirm-email.scss',
  template: `
    <div class="auth-shell marketing-surface" appPageReveal>
      <div class="auth-atmosphere" aria-hidden="true">
        <span class="auth-orb auth-orb--a"></span>
        <span class="auth-orb auth-orb--b"></span>
      </div>

      <section class="auth-panel" aria-label="Potwierdź email">
        <header class="auth-panel__top">
          <a routerLink="/" class="brand" aria-label="Starvia — strona główna" (click)="clearAccess()">
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
          <a routerLink="/login" class="auth-panel__switch" (click)="clearAccess()">Zaloguj się</a>
        </header>

        <div class="auth-panel__body">
          <div class="confirm-card">
            <p class="confirm-card__eyebrow">Sprawdź skrzynkę</p>
            <h1 class="confirm-card__title">Potwierdź swój email</h1>
            <p class="confirm-card__message">
              Wysłaliśmy link aktywacyjny. Otwórz wiadomość i potwierdź konto, żeby przejść dalej.
            </p>

            @if (email(); as address) {
              <p class="confirm-card__email">{{ address }}</p>
            }

            <p class="confirm-card__hint">
              Nie widzisz maila? Zerknij do spamu lub folderu Oferty i odczekaj chwilę przed kolejną
              próbą.
            </p>

            <a routerLink="/login" class="btn btn--primary confirm-card__cta" (click)="clearAccess()">
              Przejdź do logowania
            </a>
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
export class ConfirmEmailPage {
  private readonly router = inject(Router);

  protected readonly currentYear = new Date().getFullYear();
  protected readonly email = signal<string | null>(null);

  constructor() {
    lockAuthPageBody();
    this.hydrateAccess();
  }

  protected clearAccess(): void {
    clearConfirmEmailAccess();
  }

  private hydrateAccess(): void {
    const access = readConfirmEmailAccess();
    if (access) {
      this.email.set(access.email);
      return;
    }

    const fromNav = readConfirmEmailFromHistoryState(
      this.router.getCurrentNavigation()?.extras.state ?? history.state
    );
    if (fromNav) {
      grantConfirmEmailAccess(fromNav);
      this.email.set(fromNav.email);
      return;
    }

    void this.router.navigateByUrl('/register');
  }
}
