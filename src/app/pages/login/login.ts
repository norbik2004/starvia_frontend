import { Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { Header } from '../../layout/header/header';
import { Hero } from '../../layout/hero/hero';
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
  imports: [ReactiveFormsModule, RouterLink, Header, Hero, PageRevealDirective],
  styleUrl: './login.scss',
  template: `
    <div appPageReveal>
      <app-header
      [links]="[]"
      actionLabel="Back home"
      actionRoute="/"
      navLabel="Login navigation"
      brandMode="route"
      brandRoute="/"
    />

    <app-hero
      eyebrow="Welcome back"
      heading="Log in to your publishing hub"
      description="Jump back into drafts, approvals, and campaigns without losing momentum."
      [showActions]="false"
      [fillViewport]="true"
      [customPanel]="true"
      panelCaption="Login form"
    >
      <div hero-panel class="media-slot login-panel">
        <form class="login-form" [formGroup]="form" (ngSubmit)="submit()" novalidate>
          <div class="login-form__intro">
            <p class="login-form__eyebrow">Account access</p>
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
              autocomplete="current-password"
              placeholder="Enter your password"
            />
            <div class="field__message" aria-live="polite">
              @if (password.invalid && (password.touched || password.dirty)) {
                <p class="field__error">Password must be at least 8 characters long.</p>
              }
            </div>
          </div>

          <div class="auth-actions">
            <button type="submit" class="btn btn--primary submit-btn" [disabled]="isSubmitting()">
              {{ isSubmitting() ? 'Logging in...' : 'Log in' }}
            </button>
          </div>

          <p class="auth-switch">
            <a routerLink="/forgot-password" class="auth-switch__link">Forgot password?</a>
          </p>

          <p class="auth-switch">
            New to Starvia?
            <a routerLink="/register" class="auth-switch__link">Create an account</a>
          </p>
          <div class="form-status-slot" aria-live="polite">
            @if (loginError(); as error) {
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
export class LoginPage {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly session = inject(SessionService);

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
          // Update the shared `/me` result once, then route.
          this.session.refresh().subscribe(() => void this.router.navigateByUrl('/dashboard'));
        },
        error: (error: unknown) => {
          this.loginError.set(
            toApplicationError(error, 'Unable to log in. Check your email and password, then try again.')
          );
        },
      });
  }
}
