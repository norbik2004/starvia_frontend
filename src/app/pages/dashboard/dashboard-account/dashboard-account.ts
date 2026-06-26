import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, finalize, of } from 'rxjs';
import { toApplicationError } from '../../../models/application-error';
import type { UserAccount } from '../../../models/user-account';
import { AuthService } from '../../../services/auth';
import { SessionService } from '../../../services/session';
import { PageLoading } from '../../../components/page-loading/page-loading';
import { PageRevealDirective } from '../../../directives/page-reveal';

@Component({
  selector: 'app-dashboard-account',
  imports: [PageLoading, PageRevealDirective],
  styleUrl: './dashboard-account.scss',
  template: `
    <section class="dashboard-account" aria-labelledby="dashboard-account-title">
      <header class="dashboard-account__header" appPageReveal>
        <p class="section-eyebrow dashboard-account__eyebrow">Settings</p>
        <h1 id="dashboard-account-title" class="dashboard-account__title">Account</h1>
      </header>

      @if (isLoading()) {
        <app-page-loading label="Loading account…" />
      }

      @if (errorMessage()) {
        <p class="dashboard-account__status dashboard-account__status--error" role="alert">
          {{ errorMessage() }}
        </p>
      }

      @if (account(); as profile) {
        <div appPageReveal>
        <div class="dashboard-account__card">
          <dl class="dashboard-account__details">
            <div class="dashboard-account__detail">
              <dt>Username</dt>
              <dd>{{ profile.userName }}</dd>
            </div>
            <div class="dashboard-account__detail">
              <dt>Email</dt>
              <dd>{{ profile.email }}</dd>
            </div>
          </dl>
        </div>

      <div class="dashboard-account__actions">
        <button
          type="button"
          class="btn btn--raised-secondary"
          [disabled]="isLoggingOut()"
          (click)="logout()"
        >
          {{ isLoggingOut() ? 'Logging out…' : 'Log out' }}
        </button>
      </div>
        </div>
      }
    </section>
  `,
})
export class DashboardAccount {
  private readonly authService = inject(AuthService);
  private readonly session = inject(SessionService);
  private readonly router = inject(Router);

  protected readonly account = signal<UserAccount | null>(null);
  protected readonly isLoading = signal(true);
  protected readonly isLoggingOut = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  constructor() {
    this.loadAccount();
  }

  protected logout(): void {
    this.isLoggingOut.set(true);
    this.errorMessage.set(null);

    this.authService
      .logout()
      .pipe(
        catchError(() => of(null)),
        finalize(() => this.isLoggingOut.set(false))
      )
      .subscribe(() => {
        this.session.setLoggedOut();
        void this.router.navigateByUrl('/login');
      });
  }

  private loadAccount(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.authService.getAccount().subscribe({
      next: (profile) => {
        this.account.set(profile);
        this.isLoading.set(false);
      },
      error: (error) => {
        this.account.set(null);
        this.isLoading.set(false);
        this.errorMessage.set(toApplicationError(error, 'Could not load account.').description);
      },
    });
  }
}
