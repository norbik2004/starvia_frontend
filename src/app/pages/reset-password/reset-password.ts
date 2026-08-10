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
import { ActivatedRoute, ParamMap, Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { ApplicationError, toApplicationError } from '../../models/application-error';
import { AuthService } from '../../services/auth';
import { PageRevealDirective } from '../../directives/page-reveal';
import { lockAuthPageBody } from '../shared/auth-page-body-lock';

type ResetPasswordForm = FormGroup<{
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
  selector: 'app-reset-password-page',
  imports: [ReactiveFormsModule, RouterLink, PageRevealDirective],
  styleUrl: './reset-password.scss',
  template: `
    <div class="auth-shell marketing-surface" appPageReveal>
      <div class="auth-atmosphere" aria-hidden="true">
        <span class="auth-orb auth-orb--a"></span>
        <span class="auth-orb auth-orb--b"></span>
      </div>

      <section class="auth-panel" aria-label="Nowe hasło">
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
          @if (isLinkInvalid()) {
            <div class="auth-form reset-password-form">
              <p class="auth-form__eyebrow">Nieprawidłowy link</p>
              <h2 class="auth-form__title">Link jest niepełny</h2>
              <p class="reset-password-form__lead">
                Ten link do resetu nie zawiera wymaganych danych. Poproś o nowy w ustawieniach konta
                albo użyj ponownie wiadomości email.
              </p>
              <a routerLink="/forgot-password" class="btn btn--primary submit-btn">
                <span class="material-icons submit-btn__icon" aria-hidden="true">mail</span>
                Wyślij nowy link
              </a>
              <p class="auth-switch">
                <a routerLink="/login" class="auth-switch__link">Wróć do logowania</a>
              </p>
            </div>
          } @else {
            <form
              class="auth-form reset-password-form"
              [formGroup]="form"
              (ngSubmit)="submit()"
              novalidate
            >
              <p class="auth-form__eyebrow">Nowe hasło</p>
              <h2 class="auth-form__title">Ustaw hasło</h2>
              <p class="reset-password-form__lead">
                Wybierz nowe hasło do konta Starvia, żeby odzyskać dostęp.
              </p>

              <div class="field">
                <label class="field__label" for="password">Nowe hasło</label>
                <input
                  id="password"
                  class="field__input"
                  type="password"
                  formControlName="password"
                  autocomplete="new-password"
                  placeholder="Utwórz nowe hasło"
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
                  } @else if (
                    form.hasError('passwordMismatch') &&
                    (repeatPassword.touched || repeatPassword.dirty)
                  ) {
                    <p class="field__error">Hasła nie są takie same.</p>
                  }
                </div>
              </div>

              <button type="submit" class="btn btn--primary submit-btn" [disabled]="isSubmitting()">
                <span class="material-icons submit-btn__icon" aria-hidden="true">lock_reset</span>
                @if (isSubmitting()) {
                  <span class="submit-btn__label">
                    Zapisywanie<span class="btn-loading-dots" aria-hidden="true"><span>.</span><span>.</span><span>.</span></span>
                  </span>
                } @else {
                  Zapisz hasło
                }
              </button>

              <div class="form-status-slot" aria-live="polite">
                @if (resetError(); as error) {
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
export class ResetPasswordPage {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly currentYear = new Date().getFullYear();
  protected readonly isLinkInvalid = signal(false);
  protected readonly isSubmitting = signal(false);
  protected readonly resetError = signal<ApplicationError | null>(null);

  private userId: string | null = null;
  private token: string | null = null;

  protected readonly form: ResetPasswordForm = new FormGroup(
    {
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

  constructor() {
    lockAuthPageBody();
    this.route.queryParamMap.subscribe((qp) => this.readQueryParams(qp));
  }

  protected get password(): FormControl<string> {
    return this.form.controls.password;
  }

  protected get repeatPassword(): FormControl<string> {
    return this.form.controls.repeatPassword;
  }

  protected submit(): void {
    this.resetError.set(null);

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    if (!this.userId || !this.token) {
      this.isLinkInvalid.set(true);
      return;
    }

    this.isSubmitting.set(true);

    const { password } = this.form.getRawValue();

    this.authService
      .confirmResetPassword(this.token, this.userId, password)
      .pipe(finalize(() => this.isSubmitting.set(false)))
      .subscribe({
        next: () => void this.router.navigateByUrl('/reset-password-success'),
        error: (error: unknown) => {
          this.resetError.set(
            toApplicationError(
              error,
              'Nie udało się zresetować hasła. Spróbuj ponownie lub skontaktuj się z pomocą.',
              'Wystąpił nieoczekiwany błąd. Spróbuj ponownie za chwilę.'
            )
          );
        },
      });
  }

  private readQueryParams(qp: ParamMap): void {
    const userId = qp.get('userId')?.trim();
    const token = qp.get('token')?.trim();

    this.userId = userId && userId.length > 0 ? userId : null;
    this.token = token && token.length > 0 ? token : null;
    this.isLinkInvalid.set(!this.userId || !this.token);
  }
}
