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
import { Header } from '../../layout/header/header';
import { Hero } from '../../layout/hero/hero';
import { ApplicationError, toApplicationError } from '../../models/application-error';
import { AuthService } from '../../services/auth';
import { PageRevealDirective } from '../../directives/page-reveal';
import { lockAuthPageBody } from '../shared/auth-page-body-lock';

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
  imports: [ReactiveFormsModule, RouterLink, Header, Hero, PageRevealDirective],
  styleUrl: './register.scss',
  template: `
    <div appPageReveal>
      <app-header
      [links]="[]"
      actionLabel="Back home"
      actionRoute="/"
      navLabel="Register navigation"
      brandMode="route"
      brandRoute="/"
    />

    <app-hero
      eyebrow="Start creating"
      heading="Create your Starvia account"
      description="Set up your workspace and start planning, drafting, and publishing in one calm flow."
      [showActions]="false"
      [fillViewport]="true"
      [customPanel]="true"
      panelCaption="Register form"
    >
      <div hero-panel class="media-slot register-panel">
        <form class="register-form" [formGroup]="form" (ngSubmit)="submit()" novalidate>
          <div class="register-form__intro">
            <p class="register-form__eyebrow">Account setup</p>
          </div>

          <div class="field">
            <label class="field__label" for="email">Email</label>
            <input
              id="email"
              class="field__input"
              type="email"
              formControlName="email"
              autocomplete="email"
              placeholder="you@company.com"
            />
            <div class="field__message" aria-live="polite">
              @if (email.invalid && (email.touched || email.dirty)) {
                <p class="field__error">Enter a valid email address.</p>
              }
            </div>
          </div>

          <div class="field">
            <label class="field__label" for="password">Password</label>
            <input
              id="password"
              class="field__input"
              type="password"
              formControlName="password"
              autocomplete="new-password"
              placeholder="Create a password"
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
              placeholder="Repeat your password"
            />
            <div class="field__message" aria-live="polite">
              @if (repeatPassword.invalid && (repeatPassword.touched || repeatPassword.dirty)) {
                <p class="field__error">Please repeat your password.</p>
              } @else if (form.hasError('passwordMismatch') && (repeatPassword.touched || repeatPassword.dirty)) {
                <p class="field__error">Passwords do not match.</p>
              }
            </div>
          </div>

          <button type="submit" class="btn btn--raised-primary submit-btn" [disabled]="isSubmitting()">
            {{ isSubmitting() ? 'Creating account...' : 'Create account' }}
          </button>

          <p class="auth-switch">
            Already have an account?
            <a routerLink="/login" class="auth-switch__link">Log in</a>
          </p>

          <div class="form-status-slot" aria-live="polite">
            @if (registerError(); as error) {
              <p class="form-status form-status--error" role="alert">
                {{ error.description }}
              </p>
            }
          </div>
        </form>
      </div>
    </app-hero>
    </div>
  `,
})
export class RegisterPage {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

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
        next: () =>
          void this.router.navigate(['/confirm-email'], {
            state: { email },
          }),
        error: (error: unknown) => {
          this.registerError.set(
            toApplicationError(
              error,
              'Unable to create your account. Check your details, then try again.'
            )
          );
        },
      });
  }
}
