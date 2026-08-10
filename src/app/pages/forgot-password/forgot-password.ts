import { Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { ApplicationError, toApplicationError } from '../../models/application-error';
import { AuthService } from '../../services/auth';
import { PageRevealDirective } from '../../directives/page-reveal';
import { lockAuthPageBody } from '../shared/auth-page-body-lock';

type ForgotPasswordForm = FormGroup<{
  email: FormControl<string>;
}>;

@Component({
  selector: 'app-forgot-password-page',
  imports: [ReactiveFormsModule, RouterLink, PageRevealDirective],
  styleUrl: './forgot-password.scss',
  template: `
    <div class="auth-shell marketing-surface" appPageReveal>
      <div class="auth-atmosphere" aria-hidden="true">
        <span class="auth-orb auth-orb--a"></span>
        <span class="auth-orb auth-orb--b"></span>
      </div>

      <section class="auth-panel" aria-label="Reset hasła">
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
          <a routerLink="/login" class="auth-panel__switch">
            <svg class="auth-panel__switch-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none">
              <circle cx="12" cy="8" r="3.25" stroke="currentColor" stroke-width="1.75" />
              <path
                d="M5.5 19.25c1.6-3.1 3.9-4.5 6.5-4.5s4.9 1.4 6.5 4.5"
                stroke="currentColor"
                stroke-width="1.75"
                stroke-linecap="round"
              />
            </svg>
            Zaloguj się
          </a>
        </header>

        <div class="auth-panel__body">
          @if (emailSent()) {
            <div class="auth-form forgot-password-form">
              <p class="auth-form__eyebrow">Sprawdź skrzynkę</p>
              <h2 class="auth-form__title">Link wysłany</h2>
              <p class="forgot-password-form__message">
                Jeśli konto dla adresu <strong>{{ submittedEmail() }}</strong> istnieje, wkrótce
                dostaniesz link do ustawienia nowego hasła.
              </p>
              <p class="forgot-password-form__hint">
                Nie widzisz wiadomości? Sprawdź spam lub folder Oferty i odczekaj chwilę przed
                kolejną próbą.
              </p>
              <a routerLink="/login" class="btn btn--primary submit-btn">
                <span class="material-icons submit-btn__icon" aria-hidden="true">login</span>
                Wróć do logowania
              </a>
            </div>
          } @else {
            <form
              class="auth-form forgot-password-form"
              [formGroup]="form"
              (ngSubmit)="submit()"
              novalidate
            >
              <p class="auth-form__eyebrow">Odzyskiwanie dostępu</p>
              <h2 class="auth-form__title">Zresetuj hasło</h2>
              <p class="forgot-password-form__lead">
                Podaj adres email — wyślemy link do wyboru nowego hasła.
              </p>

              <div class="field">
                <label class="field__label" for="email">Email</label>
                <input
                  id="email"
                  class="field__input"
                  type="email"
                  formControlName="email"
                  autocomplete="email"
                  placeholder="jan@firma.pl"
                />
                <div class="field__message" aria-live="polite">
                  @if (email.invalid && (email.touched || email.dirty)) {
                    <p class="field__error">Podaj poprawny adres email.</p>
                  }
                </div>
              </div>

              <button type="submit" class="btn btn--primary submit-btn" [disabled]="isSubmitting()">
                <span class="material-icons submit-btn__icon" aria-hidden="true">mail</span>
                @if (isSubmitting()) {
                  <span class="submit-btn__label">
                    Wysyłanie<span class="btn-loading-dots" aria-hidden="true"><span>.</span><span>.</span><span>.</span></span>
                  </span>
                } @else {
                  Wyślij link
                }
              </button>

              <div class="form-status-slot" aria-live="polite">
                @if (submitError(); as error) {
                  <p class="form-status form-status--error" role="alert">
                    {{ error.description }}
                  </p>
                }
              </div>
            </form>
          }
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
export class ForgotPasswordPage {
  private readonly authService = inject(AuthService);

  protected readonly currentYear = new Date().getFullYear();

  protected readonly form: ForgotPasswordForm = new FormGroup({
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
  });

  protected readonly isSubmitting = signal(false);
  protected readonly emailSent = signal(false);
  protected readonly submittedEmail = signal<string | null>(null);
  protected readonly submitError = signal<ApplicationError | null>(null);

  constructor() {
    lockAuthPageBody();
  }

  protected get email(): FormControl<string> {
    return this.form.controls.email;
  }

  protected submit(): void {
    this.submitError.set(null);

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { email } = this.form.getRawValue();
    this.isSubmitting.set(true);

    this.authService
      .sendPasswordResetEmail(email)
      .pipe(finalize(() => this.isSubmitting.set(false)))
      .subscribe({
        next: () => {
          this.submittedEmail.set(email);
          this.emailSent.set(true);
        },
        error: (error: unknown) => {
          this.submitError.set(
            toApplicationError(
              error,
              'Nie udało się wysłać wiadomości. Spróbuj ponownie za chwilę.',
              'Wystąpił nieoczekiwany błąd. Spróbuj ponownie za chwilę.'
            )
          );
        },
      });
  }
}
