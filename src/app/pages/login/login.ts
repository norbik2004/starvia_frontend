import { Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { ApplicationError, toApplicationError } from '../../models/application-error';
import { AuthService } from '../../services/auth';
import { SessionService } from '../../services/session';
import { PageRevealDirective } from '../../directives/page-reveal';
import { lockAuthPageBody } from '../shared/auth-page-body-lock';

type LoginForm = FormGroup<{
  email: FormControl<string>;
  password: FormControl<string>;
}>;

@Component({
  selector: 'app-login-page',
  imports: [ReactiveFormsModule, RouterLink, PageRevealDirective],
  styleUrl: './login.scss',
  template: `
    <div class="auth-shell" appPageReveal>
      <section class="auth-panel" aria-label="Logowanie">
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
          <a routerLink="/register" class="auth-panel__switch">
            <svg class="auth-panel__switch-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none">
              <circle cx="12" cy="8" r="3.25" stroke="currentColor" stroke-width="1.75" />
              <path
                d="M5.5 19.25c1.6-3.1 3.9-4.5 6.5-4.5s4.9 1.4 6.5 4.5"
                stroke="currentColor"
                stroke-width="1.75"
                stroke-linecap="round"
              />
            </svg>
            Zarejestruj się
          </a>
        </header>

        <div class="auth-panel__body">
          <form class="auth-form login-form" [formGroup]="form" (ngSubmit)="submit()" novalidate>
            <h2 class="auth-form__title">Zaloguj się</h2>

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

            <div class="field">
              <label class="field__label" for="password">Hasło</label>
              <input
                id="password"
                class="field__input"
                type="password"
                formControlName="password"
                autocomplete="current-password"
                placeholder="Wpisz hasło"
              />
              <div class="field__message" aria-live="polite">
                @if (password.invalid && (password.touched || password.dirty)) {
                  <p class="field__error">Hasło musi mieć co najmniej 8 znaków.</p>
                }
              </div>
            </div>

            <p class="auth-form__forgot">
              <a routerLink="/forgot-password" class="auth-form__forgot-link">Nie pamiętasz hasła?</a>
            </p>

            <button type="submit" class="btn btn--primary submit-btn" [disabled]="isSubmitting()">
              <span class="material-icons submit-btn__icon" aria-hidden="true">login</span>
              {{ isSubmitting() ? 'Logowanie...' : 'Zaloguj się' }}
            </button>

            <div class="form-status-slot" aria-live="polite">
              @if (loginError(); as error) {
                <p class="form-status form-status--error" role="alert">
                  {{ error.description }}
                </p>
              }
            </div>
          </form>
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
export class LoginPage {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly session = inject(SessionService);

  protected readonly currentYear = new Date().getFullYear();

  constructor() {
    lockAuthPageBody();
  }

  protected readonly form: LoginForm = new FormGroup({
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
    password: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(8)],
    }),
  });

  protected readonly isSubmitting = signal(false);
  protected readonly loginError = signal<ApplicationError | null>(null);

  protected get email(): FormControl<string> {
    return this.form.controls.email;
  }

  protected get password(): FormControl<string> {
    return this.form.controls.password;
  }

  protected submit(): void {
    this.loginError.set(null);

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);

    const { email, password } = this.form.getRawValue();

    this.authService
      .login({ email, password })
      .pipe(finalize(() => this.isSubmitting.set(false)))
      .subscribe({
        next: () => {
          this.session.refresh().subscribe(() => void this.router.navigateByUrl('/dashboard'));
        },
        error: (error: unknown) => {
          this.loginError.set(
            toApplicationError(error, 'Nie udało się zalogować. Sprawdź email i hasło, potem spróbuj ponownie.')
          );
        },
      });
  }
}
