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
import { Header } from '../../layout/header/header';
import { Hero } from '../../layout/hero/hero';
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
  imports: [ReactiveFormsModule, RouterLink, Header, Hero, PageRevealDirective],
  styleUrl: './reset-password.scss',
  template: `
    <div appPageReveal>
      <app-header
        [links]="[]"
        actionLabel="Back home"
        actionRoute="/"
        navLabel="Reset password navigation"
        brandMode="route"
        brandRoute="/"
      />

      <app-hero
        eyebrow="Account security"
        heading="Choose a new password"
        description="Set a new password for your Starvia account to regain access."
        [showActions]="false"
        [fillViewport]="true"
        [customPanel]="true"
        panelCaption="Reset password form"
      >
        <div hero-panel class="media-slot reset-password-panel">
          @if (isLinkInvalid()) {
            <div class="reset-password-form">
              <p class="reset-password-form__eyebrow">Invalid link</p>
              <p class="form-status form-status--error" role="alert">
                This reset link is missing required details. Request a new one from your account
                settings or try again from the email.
              </p>
              <p class="auth-switch">
                <a routerLink="/login" class="auth-switch__link">Back to login</a>
              </p>
            </div>
          } @else {
            <form class="reset-password-form" [formGroup]="form" (ngSubmit)="submit()" novalidate>
              <div class="reset-password-form__intro">
                <p class="reset-password-form__eyebrow">Password reset</p>
                <p class="reset-password-form__email">Enter a new password for your account.</p>
              </div>

              <div class="field">
                <label class="field__label" for="password">New password</label>
                <input
                  id="password"
                  class="field__input"
                  type="password"
                  formControlName="password"
                  autocomplete="new-password"
                  placeholder="Create a new password"
                />
                <div class="field__message" aria-live="polite">
                  @if (password.invalid && (password.touched || password.dirty)) {
                    <p class="field__error">Password must be at least 8 characters long.</p>
                  }
                </div>
              </div>

              <div class="field">
                <label class="field__label" for="repeat-password">Repeat password</label>
                <input
                  id="repeat-password"
                  class="field__input"
                  type="password"
                  formControlName="repeatPassword"
                  autocomplete="new-password"
                  placeholder="Repeat your new password"
                />
                <div class="field__message" aria-live="polite">
                  @if (repeatPassword.invalid && (repeatPassword.touched || repeatPassword.dirty)) {
                    <p class="field__error">Please repeat your password.</p>
                  } @else if (
                    form.hasError('passwordMismatch') && (repeatPassword.touched || repeatPassword.dirty)
                  ) {
                    <p class="field__error">Passwords do not match.</p>
                  }
                </div>
              </div>

              <button type="submit" class="btn btn--primary submit-btn" [disabled]="isSubmitting()">
                {{ isSubmitting() ? 'Updating password...' : 'Update password' }}
              </button>

              <p class="auth-switch">
                Remembered it?
                <a routerLink="/login" class="auth-switch__link">Log in</a>
              </p>

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
      </app-hero>
    </div>
  `,
})
export class ResetPasswordPage {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

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
            toApplicationError(error, 'Error while resetting password, contact support')
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
