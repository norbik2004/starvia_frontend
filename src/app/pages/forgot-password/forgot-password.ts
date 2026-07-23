import { Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { Header } from '../../layout/header/header';
import { Hero } from '../../layout/hero/hero';
import { ApplicationError, toApplicationError } from '../../models/application-error';
import { AuthService } from '../../services/auth';
import { PageRevealDirective } from '../../directives/page-reveal';
import { lockAuthPageBody } from '../shared/auth-page-body-lock';

type ForgotPasswordForm = FormGroup<{
  email: FormControl<string>;
}>;

@Component({
  selector: 'app-forgot-password-page',
  imports: [ReactiveFormsModule, RouterLink, Header, Hero, PageRevealDirective],
  styleUrl: './forgot-password.scss',
  template: `
    <div appPageReveal>
      <app-header
        [links]="[]"
        actionLabel="Back home"
        actionRoute="/"
        navLabel="Forgot password navigation"
        brandMode="route"
        brandRoute="/"
      />

      <app-hero
        eyebrow="Account recovery"
        heading="Reset your password"
        description="Enter your email address and we will send you a link to choose a new password."
        [showActions]="false"
        [fillViewport]="true"
        [customPanel]="true"
        panelCaption="Forgot password form"
      >
        <div hero-panel class="media-slot forgot-password-panel">
          @if (emailSent()) {
            <div class="forgot-password-form">
              <p class="forgot-password-form__eyebrow">Check your inbox</p>
              <p class="forgot-password-form__message">
                If an account exists for <strong>{{ submittedEmail() }}</strong>, you will receive a
                password reset link shortly.
              </p>
              <p class="forgot-password-form__hint">
                If you don't see it, check spam or promotions and wait a minute before trying again.
              </p>
              <a routerLink="/login" class="btn btn--primary submit-btn">Back to login</a>
            </div>
          } @else {
            <form class="forgot-password-form" [formGroup]="form" (ngSubmit)="submit()" novalidate>
              <div class="forgot-password-form__intro">
                <p class="forgot-password-form__eyebrow">Password reset</p>
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

              <button type="submit" class="btn btn--primary submit-btn" [disabled]="isSubmitting()">
                {{ isSubmitting() ? 'Sending...' : 'Send email' }}
              </button>

              <p class="auth-switch">
                Remembered your password?
                <a routerLink="/login" class="auth-switch__link">Log in</a>
              </p>

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
      </app-hero>
    </div>
  `,
})
export class ForgotPasswordPage {
  private readonly authService = inject(AuthService);

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
            toApplicationError(error, 'Unable to send the reset email right now. Please try again later.')
          );
        },
      });
  }
}
