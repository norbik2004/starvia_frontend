import { Component, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { ApplicationError, toApplicationError } from '../../models/application-error';
import { AuthService } from '../../services/auth';
import { PageRevealDirective } from '../../directives/page-reveal';
import { lockAuthPageBody } from '../shared/auth-page-body-lock';
import { grantConfirmEmailAccess } from '../confirm-email/confirm-email-access';

type RegisterForm = FormGroup<{
  email: FormControl<string>;
  password: FormControl<string>;
  repeatPassword: FormControl<string>;
}>;

const passwordsMatchValidator: ValidatorFn = (
  control: AbstractControl
): ValidationErrors | null => {
  const password = control.get('password')?.value;
  const repeatPassword = control.get('repeatPassword')?.value;

  if (!password || !repeatPassword || password === repeatPassword) {
    return null;
  }

  return { passwordMismatch: true };
};

@Component({
  selector: 'app-register-page',
  imports: [ReactiveFormsModule, RouterLink, PageRevealDirective],
  styleUrl: './register.scss',
  template: `
    <div class="auth-shell marketing-surface" appPageReveal>
      <div class="auth-atmosphere" aria-hidden="true">
        <span class="auth-orb auth-orb--a"></span>
        <span class="auth-orb auth-orb--b"></span>
      </div>

      <section class="auth-panel" aria-label="Rejestracja">
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
          <form class="auth-form register-form" [formGroup]="form" (ngSubmit)="submit()" novalidate>
            <p class="auth-form__eyebrow">Dołącz do Starvia</p>
            <h2 class="auth-form__title">Załóż konto</h2>

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
                autocomplete="new-password"
                placeholder="Utwórz hasło"
              />
              <div class="field__message" aria-live="polite">
                @if (password.invalid && (password.touched || password.dirty)) {
                  <p class="field__error">Hasło musi mieć co najmniej 8 znaków.</p>
                }
              </div>
            </div>

            <div class="field">
              <label class="field__label" for="repeat-password">Powtórz hasło</label>
              <input
                id="repeat-password"
                class="field__input"
                type="password"
                formControlName="repeatPassword"
                autocomplete="new-password"
                placeholder="Powtórz hasło"
              />
              <div class="field__message" aria-live="polite">
                @if (repeatPassword.invalid && (repeatPassword.touched || repeatPassword.dirty)) {
                  <p class="field__error">Powtórz hasło.</p>
                } @else if (form.hasError('passwordMismatch') && (repeatPassword.touched || repeatPassword.dirty)) {
                  <p class="field__error">Hasła nie są takie same.</p>
                }
              </div>
            </div>

            <button type="submit" class="btn btn--primary submit-btn" [disabled]="isSubmitting()">
              <span class="material-icons submit-btn__icon" aria-hidden="true">person_add</span>
              @if (isSubmitting()) {
                <span class="submit-btn__label">
                  Tworzenie konta<span class="btn-loading-dots" aria-hidden="true"><span>.</span><span>.</span><span>.</span></span>
                </span>
              } @else {
                Utwórz konto
              }
            </button>

            <div class="form-status-slot" aria-live="polite">
              @if (registerError(); as error) {
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
export class RegisterPage {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly currentYear = new Date().getFullYear();

  constructor() {
    lockAuthPageBody();
  }

  protected readonly form: RegisterForm = new FormGroup(
    {
      email: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.email],
      }),
      password: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.minLength(8)],
      }),
      repeatPassword: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required],
      }),
    },
    { validators: passwordsMatchValidator }
  );

  protected readonly isSubmitting = signal(false);
  protected readonly registerError = signal<ApplicationError | null>(null);

  protected get email(): FormControl<string> {
    return this.form.controls.email;
  }

  protected get password(): FormControl<string> {
    return this.form.controls.password;
  }

  protected get repeatPassword(): FormControl<string> {
    return this.form.controls.repeatPassword;
  }

  protected submit(): void {
    this.registerError.set(null);

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);

    const { email, password } = this.form.getRawValue();

    this.authService
      .register({ email, password })
      .pipe(finalize(() => this.isSubmitting.set(false)))
      .subscribe({
        next: ({ userId }) => {
          grantConfirmEmailAccess({ email, userId });
          void this.router.navigate(['/confirm-email'], {
            state: { email, userId },
          });
        },
        error: (error: unknown) => {
          this.registerError.set(
            toApplicationError(
              error,
              'Nie udało się utworzyć konta. Sprawdź dane i spróbuj ponownie.',
              'Wystąpił nieoczekiwany błąd. Spróbuj ponownie za chwilę.'
            )
          );
        },
      });
  }
}
