import {
  Component,
  DestroyRef,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatTooltip } from '@angular/material/tooltip';
import { Router, RouterLink } from '@angular/router';
import { catchError, finalize, of } from 'rxjs';
import { toApplicationError } from '../../../models/application-error';
import type { UserAccount } from '../../../models/user-account';
import {
  getPlatformLabel,
  type UserPlatform,
  userPlatformPhotoKey,
} from '../../../models/user-platform';
import { AuthService } from '../../../services/auth';
import { SessionService } from '../../../services/session';
import { UserPlatformService } from '../../../services/user-platform';
import { PageLoading } from '../../../components/page-loading/page-loading';
import { PageRevealDirective } from '../../../directives/page-reveal';
import { DashboardUserAvatar } from '../shared/dashboard-user-avatar/dashboard-user-avatar';

const USERNAME_MAX_LENGTH = 64;
const EDIT_CLOSE_MS = 220;
const READ_ENTER_MS = 260;

@Component({
  selector: 'app-dashboard-account',
  imports: [
    PageLoading,
    PageRevealDirective,
    DashboardUserAvatar,
    RouterLink,
    ReactiveFormsModule,
    MatTooltip,
  ],
  styleUrl: './dashboard-account.scss',
  template: `
    <section class="dashboard-content-page dashboard-account" aria-labelledby="dashboard-account-title">
      <div appPageReveal>
        <header class="dashboard-account__header">
          <div class="dashboard-account__header-copy">
            <p class="section-eyebrow dashboard-account__eyebrow">Settings</p>
            <h1 id="dashboard-account-title" class="dashboard-account__title">Account</h1>
          </div>
        </header>
      </div>

      @if (isLoading()) {
        <app-page-loading label="Loading account…" />
      }

      @if (errorMessage()) {
        <p class="posts-status posts-status--error" role="alert">{{ errorMessage() }}</p>
      }

      @if (account(); as profile) {
        <div class="dashboard-account__body" appPageReveal>
          <section class="account-section account-section--user" aria-labelledby="account-user-title">
            <header class="account-section__hero">
              <app-dashboard-user-avatar
                size="lg"
                [userName]="profile.userName"
                [profilePictureUrl]="profile.profilePictureUrl"
              />
              <div class="account-section__hero-copy">
                <h2 id="account-user-title" class="account-section__title">Your account</h2>
                <p class="account-section__copy">Profile and security settings for your Starvia workspace.</p>
                <span class="account-section__badge">Active</span>
              </div>
            </header>

            <div class="account-fields">
              <div class="account-field" [class.account-field--editing]="isEditingUsername()">
                <div class="account-field__main">
                  <span class="account-field__label">
                    <span class="material-icons" aria-hidden="true">alternate_email</span>
                    Username
                  </span>

                  @if (isEditingUsername()) {
                    <div
                      class="dashboard-edit-panel"
                      [class.dashboard-edit-panel--closing]="usernameEditClosing()"
                    >
                      <input
                        #usernameInput
                        class="field__input"
                        type="text"
                        [formControl]="usernameControl"
                        [attr.maxlength]="usernameMaxLength"
                        aria-label="Username"
                        autocomplete="username"
                        (keydown.enter)="saveUsername($event)"
                        (keydown.escape)="cancelUsernameEdit($event)"
                      />
                      <div class="dashboard-edit-foot">
                        <p class="dashboard-edit-hint">
                          {{ usernameControl.value.length }}/{{ usernameMaxLength }} · Esc to cancel
                        </p>
                        @if (usernameError()) {
                          <p class="field__error" role="alert">{{ usernameError() }}</p>
                        }
                        <div class="dashboard-inline-actions">
                          <button
                            type="button"
                            class="btn btn--primary btn--compact"
                            [disabled]="isSavingUsername() || usernameControl.invalid"
                            (click)="saveUsername()"
                          >
                            {{ isSavingUsername() ? 'Saving…' : 'Save' }}
                          </button>
                          <button
                            type="button"
                            class="btn btn--secondary btn--compact"
                            [disabled]="isSavingUsername()"
                            (click)="cancelUsernameEdit()"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    </div>
                  } @else {
                    <p
                      class="account-field__value"
                      [class.dashboard-edit-read-in]="usernameReadEnter()"
                    >
                      {{ profile.userName }}
                    </p>
                  }
                </div>

                @if (!isEditingUsername()) {
                  <div class="account-field__actions">
                    <span
                      class="edit-icon"
                      role="button"
                      tabindex="0"
                      matTooltip="Edit username"
                      matTooltipPosition="left"
                      aria-label="Edit username"
                      [class.edit-icon--disabled]="isSavingUsername()"
                      [attr.aria-disabled]="isSavingUsername() ? true : null"
                      (click)="startUsernameEdit(profile.userName, $event)"
                      (keydown.enter)="startUsernameEdit(profile.userName, $event)"
                      (keydown.space)="startUsernameEdit(profile.userName, $event)"
                    >
                      <span class="material-icons edit-icon__glyph" aria-hidden="true">edit</span>
                    </span>
                  </div>
                }
              </div>

              <div class="account-field account-field--readonly">
                <div class="account-field__main">
                  <span class="account-field__label">
                    <span class="material-icons" aria-hidden="true">mail_outline</span>
                    Email
                  </span>
                  <p class="account-field__value">{{ profile.email }}</p>
                </div>
              </div>

              <hr class="account-fields__divider" />

              <div class="account-field account-field--action">
                <div class="account-field__main">
                  <span class="account-field__label">
                    <span class="material-icons" aria-hidden="true">lock_reset</span>
                    Password
                  </span>
                  <p class="account-field__hint">
                    Send a secure reset link to <strong>{{ profile.email }}</strong>.
                  </p>
                  @if (resetPasswordMessage(); as message) {
                    <p
                      class="account-field__status"
                      [class.account-field__status--error]="resetPasswordResult() === 'error'"
                      [class.account-field__status--success]="resetPasswordResult() === 'success'"
                      role="status"
                    >
                      {{ message }}
                    </p>
                  }
                </div>
                <div class="account-field__actions">
                  <button
                    type="button"
                    class="account-panel__btn account-panel__btn--primary"
                    [disabled]="isSendingReset()"
                    (click)="sendPasswordReset(profile.email)"
                  >
                    <span class="material-icons" aria-hidden="true">outgoing_mail</span>
                    {{ isSendingReset() ? 'Sending…' : 'Send reset link' }}
                  </button>
                </div>
              </div>

              <hr class="account-fields__divider" />

              <div class="account-field account-field--action account-field--danger">
                <div class="account-field__main">
                  <span class="account-field__label">
                    <span class="material-icons" aria-hidden="true">logout</span>
                    Session
                  </span>
                  <p class="account-field__hint">Sign out of Starvia on this device.</p>
                </div>
                <div class="account-field__actions">
                  <button
                    type="button"
                    class="account-panel__btn account-session__btn"
                    [disabled]="isLoggingOut()"
                    (click)="logout()"
                  >
                    {{ isLoggingOut() ? 'Logging out…' : 'Log out' }}
                  </button>
                </div>
              </div>
            </div>
          </section>

          <section class="account-section account-section--accounts" aria-labelledby="account-connected-title">
            <header class="account-section__head">
              <span class="account-section__icon" aria-hidden="true">
                <span class="material-icons">hub</span>
              </span>
              <div class="account-section__head-copy">
                <h2 id="account-connected-title" class="account-section__title">Connected social accounts</h2>
                <p class="account-section__copy">
                  Platforms linked to your Starvia workspace.
                </p>
              </div>
            </header>

            @if (platformsLoading()) {
              <app-page-loading label="Loading connected accounts…" />
            }

            @if (platformsError()) {
              <p class="account-panel__status account-panel__status--error" role="alert">
                {{ platformsError() }}
              </p>
            }

            @if (!platformsLoading() && !platformsError()) {
              @if (platforms().length === 0) {
                <p class="account-connected__empty">No social accounts connected yet.</p>
              } @else {
                <ul class="account-connected__list" appPageReveal [appPageRevealList]="true">
                  @for (connection of platforms(); track connection.id) {
                    <li class="account-connected__item">
                      @if (showPlatformPhoto(connection)) {
                        <img
                          class="account-connected__photo"
                          [src]="connection.profilePictureLink"
                          [alt]="connection.accountUsername + ' profile photo'"
                          (error)="onPlatformPhotoError(connection)"
                        />
                      } @else {
                        <app-dashboard-user-avatar
                          [userName]="connection.accountUsername"
                          [profilePictureUrl]="null"
                        />
                      }

                      <div class="account-connected__copy">
                        <p class="account-connected__platform">{{ platformLabel(connection.platformId) }}</p>
                        <p class="account-connected__username">{{ connection.accountUsername }}</p>
                      </div>
                    </li>
                  }
                </ul>
              }

              <div class="account-panel__actions">
                <a routerLink="/dashboard/social-accounts" class="account-panel__btn account-panel__btn--primary">
                  <span class="material-icons" aria-hidden="true">settings</span>
                  Manage social accounts
                </a>
              </div>
            }
          </section>
        </div>
      }
    </section>
  `,
})
export class DashboardAccount {
  private readonly authService = inject(AuthService);
  private readonly session = inject(SessionService);
  private readonly router = inject(Router);
  private readonly userPlatformService = inject(UserPlatformService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly usernameInput = viewChild<ElementRef<HTMLInputElement>>('usernameInput');

  protected readonly platformLabel = getPlatformLabel;
  protected readonly usernameMaxLength = USERNAME_MAX_LENGTH;
  protected readonly usernameControl = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.maxLength(USERNAME_MAX_LENGTH)],
  });

  protected readonly account = signal<UserAccount | null>(null);
  protected readonly isLoading = signal(true);
  protected readonly isLoggingOut = signal(false);
  protected readonly isSendingReset = signal(false);
  protected readonly resetPasswordResult = signal<'idle' | 'success' | 'error'>('idle');
  protected readonly resetPasswordMessage = signal<string | null>(null);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly platforms = signal<UserPlatform[]>([]);
  protected readonly platformsLoading = signal(false);
  protected readonly platformsError = signal<string | null>(null);
  protected readonly platformPhotoErrors = signal<ReadonlySet<string>>(new Set());
  protected readonly isEditingUsername = signal(false);
  protected readonly usernameEditClosing = signal(false);
  protected readonly usernameReadEnter = signal(false);
  protected readonly isSavingUsername = signal(false);
  protected readonly usernameError = signal<string | null>(null);

  private usernameCloseTimer: ReturnType<typeof setTimeout> | null = null;
  private usernameBeforeEdit = '';

  constructor() {
    this.loadAccount();
    this.destroyRef.onDestroy(() => this.clearUsernameCloseTimer());
  }

  protected showPlatformPhoto(connection: UserPlatform): boolean {
    const key = userPlatformPhotoKey(connection);
    return !!connection.profilePictureLink && !this.platformPhotoErrors().has(key);
  }

  protected onPlatformPhotoError(connection: UserPlatform): void {
    const key = userPlatformPhotoKey(connection);
    this.platformPhotoErrors.update((errors) => {
      const next = new Set(errors);
      next.add(key);
      return next;
    });
  }

  protected startUsernameEdit(currentUserName: string, event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();

    if (this.isSavingUsername() || this.isEditingUsername()) {
      return;
    }

    this.usernameBeforeEdit = currentUserName;
    this.usernameEditClosing.set(false);
    this.usernameReadEnter.set(false);
    this.usernameControl.setValue(currentUserName);
    this.usernameControl.markAsPristine();
    this.usernameError.set(null);
    this.isEditingUsername.set(true);

    queueMicrotask(() => {
      const input = this.usernameInput()?.nativeElement;
      if (!input) return;
      input.focus();
      input.select();
    });
  }

  protected cancelUsernameEdit(event?: Event, animated = true): void {
    event?.preventDefault();
    event?.stopPropagation();

    if (!this.isEditingUsername() || this.usernameEditClosing()) {
      return;
    }

    if (!animated) {
      this.finishUsernameEdit();
      return;
    }

    this.usernameEditClosing.set(true);
    this.usernameCloseTimer = setTimeout(() => {
      this.usernameCloseTimer = null;
      this.finishUsernameEdit(true);
    }, EDIT_CLOSE_MS);
  }

  protected saveUsername(event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();

    if (!this.isEditingUsername() || this.isSavingUsername()) {
      return;
    }

    const userName = this.usernameControl.value.trim();
    if (this.usernameControl.invalid || !userName) {
      this.usernameControl.markAsTouched();
      return;
    }

    const current = this.account();
    if (!current || userName === current.userName) {
      this.cancelUsernameEdit();
      return;
    }

    this.isSavingUsername.set(true);
    this.usernameError.set(null);

    this.authService
      .updateUserName(userName)
      .pipe(finalize(() => this.isSavingUsername.set(false)))
      .subscribe({
        next: () => {
          const updated = { ...current, userName };
          this.account.set(updated);
          this.authService.notifyAccountChanged(updated);
          this.cancelUsernameEdit();
        },
        error: (error) => {
          this.usernameError.set(
            toApplicationError(error, 'Could not update username.').description
          );
        },
      });
  }

  protected sendPasswordReset(email: string): void {
    if (this.isSendingReset()) return;

    this.isSendingReset.set(true);
    this.resetPasswordResult.set('idle');
    this.resetPasswordMessage.set(null);

    this.authService
      .sendPasswordResetEmail(email)
      .pipe(finalize(() => this.isSendingReset.set(false)))
      .subscribe({
        next: () => {
          this.resetPasswordResult.set('success');
          this.resetPasswordMessage.set('Reset link sent. Check your inbox.');
        },
        error: (error) => {
          this.resetPasswordResult.set('error');
          this.resetPasswordMessage.set(
            toApplicationError(error, 'Unable to send the reset link right now. Please try again later.')
              .description
          );
        },
      });
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
        this.loadPlatforms();
      },
      error: (error) => {
        this.account.set(null);
        this.isLoading.set(false);
        this.errorMessage.set(toApplicationError(error, 'Could not load account.').description);
      },
    });
  }

  private loadPlatforms(): void {
    this.platformsLoading.set(true);
    this.platformsError.set(null);

    this.userPlatformService
      .getUserPlatforms()
      .pipe(finalize(() => this.platformsLoading.set(false)))
      .subscribe({
        next: (platforms) => {
          this.platforms.set(platforms);
          this.platformPhotoErrors.set(new Set());
        },
        error: (error) => {
          this.platformsError.set(toApplicationError(error, 'Could not load connected accounts.').description);
        },
      });
  }

  private finishUsernameEdit(animateRead = false): void {
    this.clearUsernameCloseTimer();
    this.isEditingUsername.set(false);
    this.usernameEditClosing.set(false);
    this.usernameControl.reset();
    this.usernameError.set(null);

    if (animateRead) {
      this.usernameReadEnter.set(true);
      setTimeout(() => this.usernameReadEnter.set(false), READ_ENTER_MS);
    }

    this.usernameBeforeEdit = '';
  }

  private clearUsernameCloseTimer(): void {
    if (this.usernameCloseTimer !== null) {
      clearTimeout(this.usernameCloseTimer);
      this.usernameCloseTimer = null;
    }
  }
}
