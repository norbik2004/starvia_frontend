import {
  Component,
  DestroyRef,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatTooltip } from '@angular/material/tooltip';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map, switchMap } from 'rxjs';
import { AutoExpandTextarea } from '../../../components/auto-expand-textarea/auto-expand-textarea';
import { PageLoading } from '../../../components/page-loading/page-loading';
import { PageRevealDirective } from '../../../directives/page-reveal';
import { toApplicationError } from '../../../models/application-error';
import { getPlatformBrandClass } from '../../../models/platform';
import {
  getPlatformLabel,
  type UserPlatform,
} from '../../../models/user-platform';
import { UserPlatformService } from '../../../services/user-platform';
import { DashboardAlert } from '../shared/dashboard-alert/dashboard-alert';
import { DashboardPlatformLogo } from '../shared/dashboard-platform-logo/dashboard-platform-logo';
import { DashboardDeleteButton } from '../shared/dashboard-delete-button/dashboard-delete-button';
import { DashboardUserAvatar } from '../shared/dashboard-user-avatar/dashboard-user-avatar';

const ACCOUNT_USERNAME_MAX_LENGTH = 64;
const ACCOUNT_COMMENT_MAX_LENGTH = 500;
const EDIT_CLOSE_MS = 220;
const READ_ENTER_MS = 260;

type UserPlatformForm = FormGroup<{
  accountUsername: FormControl<string>;
  accountComment: FormControl<string>;
}>;

type EditableSocialField = 'accountUsername' | 'accountComment';

@Component({
  selector: 'app-dashboard-social-account-detail',
  imports: [
    RouterLink,
    ReactiveFormsModule,
    MatTooltip,
    PageLoading,
    DashboardAlert,
    PageRevealDirective,
    DashboardUserAvatar,
    DashboardPlatformLogo,
    DashboardDeleteButton,
    AutoExpandTextarea,
  ],
  styleUrl: './dashboard-social-account-detail.scss',
  template: `
    <section
      class="dashboard-content-page dashboard-social-account-detail"
      aria-labelledby="social-account-detail-title"
    >
      <header class="dashboard-social-account-detail__header" appPageReveal>
        <a routerLink="/dashboard/social-accounts" class="section-eyebrow dashboard-social-account-detail__back">
          <span class="material-icons" aria-hidden="true">arrow_back</span>
          Back to social accounts
        </a>
        <span class="dashboard-social-account-detail__header-note" aria-hidden="true">Fine-tune the details.</span>
      </header>

      @if (isLoading()) {
        <app-page-loading label="Loading connected account…" />
      }

      <app-dashboard-alert [message]="errorMessage()" />

      @if (connection(); as item) {
        <div class="dashboard-social-account-detail__body">
          <section
            class="social-account-detail-card"
            [class]="platformBrandClass(item.platformType)"
            aria-labelledby="social-account-detail-title"
            appPageReveal
          >
            <div class="social-account-detail-card__hero">
              <div class="social-account-detail-card__avatar-wrap">
                @if (showPlatformPhoto(item)) {
                  <img
                    class="social-account-detail-card__photo"
                    [src]="item.profilePictureLink"
                    [alt]="(item.accountUsername ?? 'Konto') + ' profile photo'"
                    (error)="onPlatformPhotoError()"
                  />
                } @else {
                  <app-dashboard-user-avatar
                    size="xl"
                    [userName]="item.accountUsername ?? 'Konto'"
                    [profilePictureUrl]="null"
                  />
                }

                <span class="social-account-detail-card__platform-badge" aria-hidden="true">
                  <app-dashboard-platform-logo
                    [platformType]="platformLabel(item.platformType)"
                    size="sm"
                  />
                </span>
              </div>

              <div class="social-account-detail-card__hero-copy">
                <p class="social-account-detail-card__eyebrow">Connected channel</p>
                <div class="social-account-detail-card__headline">
                  <h1 id="social-account-detail-title" class="social-account-detail-card__title">
                    {{ platformLabel(item.platformType) }}
                  </h1>
                  <span class="social-account-detail-card__badge">Connected</span>
                </div>
                <p class="social-account-detail-card__username">{{ item.accountUsername ?? 'Konto' }}</p>
                <p class="social-account-detail-card__hint">
                  Customize how this account appears across Starvia.
                </p>
              </div>
            </div>

            <app-dashboard-alert
              [compact]="true"
              [tone]="saveResult() === 'error' ? 'error' : 'success'"
              [message]="saveMessage()"
              [dismissible]="true"
              (dismissed)="saveMessage.set(null)"
            />

            <div
              class="social-account-detail-card__fields"
              [formGroup]="form"
              appPageReveal
              [appPageRevealList]="true"
            >
              <div
                class="social-account-detail-field"
                [class.social-account-detail-field--editing]="editingField() === 'accountUsername'"
              >
                <div class="social-account-detail-field__main">
                  <span class="social-account-detail-field__label">
                    <span class="material-icons" aria-hidden="true">alternate_email</span>
                    Account username
                  </span>

                  @if (editingField() === 'accountUsername') {
                    <div
                      class="dashboard-edit-panel"
                      [class.dashboard-edit-panel--closing]="editClosing()"
                    >
                      <input
                        #usernameInput
                        class="field__input"
                        type="text"
                        formControlName="accountUsername"
                        [attr.maxlength]="accountUsernameMaxLength"
                        aria-label="Account username"
                        (keydown.enter)="saveField('accountUsername', $event)"
                        (keydown.escape)="cancelEdit($event)"
                      />
                      <div class="dashboard-edit-foot">
                        <p class="dashboard-edit-hint">
                          {{ form.controls.accountUsername.value.length }}/{{ accountUsernameMaxLength }} · Esc to cancel
                        </p>
                        @if (
                          form.controls.accountUsername.touched && form.controls.accountUsername.hasError('required')
                        ) {
                          <p class="field__error" role="alert">Nazwa konta jest wymagana.</p>
                        }
                        <div class="dashboard-inline-actions">
                          <button
                            type="button"
                            class="btn btn--primary btn--compact"
                            [disabled]="isSaving() || form.controls.accountUsername.invalid"
                            (click)="saveField('accountUsername')"
                          >
                            {{ isSaving() ? 'Saving…' : 'Save' }}
                          </button>
                          <button
                            type="button"
                            class="btn btn--secondary btn--compact"
                            [disabled]="isSaving()"
                            (click)="cancelEdit()"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    </div>
                  } @else {
                    <p
                      class="social-account-detail-field__value"
                      [class.dashboard-edit-read-in]="readEnterField() === 'accountUsername'"
                    >
                      {{ item.accountUsername ?? 'Konto' }}
                    </p>
                  }
                </div>

                @if (editingField() !== 'accountUsername') {
                  <span
                    class="edit-icon social-account-detail-field__edit"
                    role="button"
                    tabindex="0"
                    matTooltip="Edit account username"
                    matTooltipPosition="below"
                    aria-label="Edit account username"
                    [class.edit-icon--disabled]="isSaving() || editingField() !== null"
                    [attr.aria-disabled]="isSaving() || editingField() !== null ? true : null"
                    (click)="startEdit('accountUsername', $event)"
                    (keydown.enter)="startEdit('accountUsername', $event)"
                    (keydown.space)="startEdit('accountUsername', $event)"
                  >
                    <span class="material-icons edit-icon__glyph" aria-hidden="true">edit</span>
                  </span>
                }
              </div>

              <div
                class="social-account-detail-field"
                [class.social-account-detail-field--editing]="editingField() === 'accountComment'"
              >
                <div class="social-account-detail-field__main">
                  <span class="social-account-detail-field__label">
                    <span class="material-icons" aria-hidden="true">notes</span>
                    Account comment
                  </span>

                  @if (editingField() === 'accountComment') {
                    <div
                      class="dashboard-edit-panel"
                      [class.dashboard-edit-panel--closing]="editClosing()"
                    >
                      <app-auto-expand-textarea
                        #commentInput
                        variant="field"
                        id="social-account-comment"
                        formControlName="accountComment"
                        [maxLength]="accountCommentMaxLength"
                        ariaLabel="Account comment"
                        placeholder="Add a short note for this connected account…"
                        [escapeCancels]="true"
                        (escaped)="cancelEdit()"
                      />
                      <div class="dashboard-edit-foot">
                        <p class="dashboard-edit-hint">
                          {{ form.controls.accountComment.value.length }}/{{ accountCommentMaxLength }} · Esc to cancel
                        </p>
                        <div class="dashboard-inline-actions">
                          <button
                            type="button"
                            class="btn btn--primary btn--compact"
                            [disabled]="isSaving() || form.controls.accountComment.invalid"
                            (click)="saveField('accountComment')"
                          >
                            {{ isSaving() ? 'Saving…' : 'Save' }}
                          </button>
                          <button
                            type="button"
                            class="btn btn--secondary btn--compact"
                            [disabled]="isSaving()"
                            (click)="cancelEdit()"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    </div>
                  } @else {
                    <p
                      class="social-account-detail-field__value social-account-detail-field__value--comment"
                      [class.social-account-detail-field__value--empty]="!item.accountComment"
                      [class.dashboard-edit-read-in]="readEnterField() === 'accountComment'"
                    >
                      {{ item.accountComment || 'No comment yet' }}
                    </p>
                  }
                </div>

                @if (editingField() !== 'accountComment') {
                  <span
                    class="edit-icon social-account-detail-field__edit"
                    role="button"
                    tabindex="0"
                    matTooltip="Edit account comment"
                    matTooltipPosition="below"
                    aria-label="Edit account comment"
                    [class.edit-icon--disabled]="isSaving() || editingField() !== null"
                    [attr.aria-disabled]="isSaving() || editingField() !== null ? true : null"
                    (click)="startEdit('accountComment', $event)"
                    (keydown.enter)="startEdit('accountComment', $event)"
                    (keydown.space)="startEdit('accountComment', $event)"
                  >
                    <span class="material-icons edit-icon__glyph" aria-hidden="true">edit</span>
                  </span>
                }
              </div>
            </div>

            <div class="social-account-detail-card__danger">
              <div class="social-account-detail-card__danger-copy">
                <span class="social-account-detail-field__label">
                  <span class="material-icons" aria-hidden="true">link_off</span>
                  Disconnect account
                </span>
                <p class="social-account-detail-card__hint">
                  Remove this connection from Starvia. You can reconnect the platform later.
                </p>
              </div>

              <app-dashboard-delete-button
                ariaLabel="Disconnect account"
                tooltip="Disconnect account"
                [active]="deleteConfirmOpen()"
                [disabled]="isSaving() || isDeleting() || editingField() !== null"
                [ariaExpanded]="deleteConfirmOpen()"
                ariaControls="dashboard-delete-sheet-title"
                (clicked)="requestDelete()"
              />
            </div>
          </section>
        </div>
      }
    </section>
  `,
})
export class DashboardSocialAccountDetail {
  private readonly route = inject(ActivatedRoute);
  private readonly userPlatformService = inject(UserPlatformService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly usernameInput = viewChild<ElementRef<HTMLInputElement>>('usernameInput');
  private readonly commentInput = viewChild<AutoExpandTextarea>('commentInput');

  protected readonly accountUsernameMaxLength = ACCOUNT_USERNAME_MAX_LENGTH;
  protected readonly accountCommentMaxLength = ACCOUNT_COMMENT_MAX_LENGTH;

  protected platformLabel(platformType: number): string {
    return getPlatformLabel(platformType);
  }

  protected platformBrandClass(platformType: number): string {
    return getPlatformBrandClass(this.platformLabel(platformType));
  }

  protected readonly form: UserPlatformForm = new FormGroup({
    accountUsername: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(ACCOUNT_USERNAME_MAX_LENGTH)],
    }),
    accountComment: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(ACCOUNT_COMMENT_MAX_LENGTH)],
    }),
  });

  protected readonly connection = signal<UserPlatform | null>(null);
  protected readonly isLoading = signal(true);
  protected readonly isSaving = signal(false);
  protected readonly isDeleting = signal(false);
  protected readonly deleteConfirmOpen = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly saveResult = signal<'idle' | 'success' | 'error'>('idle');
  protected readonly saveMessage = signal<string | null>(null);
  protected readonly platformPhotoError = signal(false);
  protected readonly editingField = signal<EditableSocialField | null>(null);
  protected readonly editClosing = signal(false);
  protected readonly readEnterField = signal<EditableSocialField | null>(null);

  private editCloseTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.route.paramMap
      .pipe(
        map((params) => params.get('id')?.trim() ?? ''),
        switchMap((id) => {
          if (!id) {
            throw new Error('Invalid connected account id.');
          }

          this.isLoading.set(true);
          this.errorMessage.set(null);
          this.connection.set(null);

          return this.userPlatformService.getById(id);
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (connection) => {
          this.connection.set(connection);
          this.platformPhotoError.set(false);
          this.resetForm(connection);
          this.isLoading.set(false);
        },
        error: (error) => {
          this.connection.set(null);
          this.isLoading.set(false);
          this.errorMessage.set(toApplicationError(error, 'Nie udało się wczytać połączonego konta.').description);
        },
      });

    this.destroyRef.onDestroy(() => this.clearEditCloseTimer());
  }

  protected showPlatformPhoto(connection: UserPlatform): boolean {
    return !!connection.profilePictureLink && !this.platformPhotoError();
  }

  protected onPlatformPhotoError(): void {
    this.platformPhotoError.set(true);
  }

  protected startEdit(field: EditableSocialField, event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();

    const current = this.connection();
    if (!current || this.isSaving() || this.editingField() !== null) {
      return;
    }

    this.resetForm(current);
    this.editClosing.set(false);
    this.readEnterField.set(null);
    this.saveResult.set('idle');
    this.saveMessage.set(null);
    this.editingField.set(field);

    queueMicrotask(() => {
      requestAnimationFrame(() => {
        if (field === 'accountUsername') {
          const input = this.usernameInput()?.nativeElement;
          if (!input) return;
          input.focus({ preventScroll: true });
          input.select();
          return;
        }

        this.commentInput()?.focus();
      });
    });
  }

  protected cancelEdit(event?: Event, animated = true): void {
    event?.preventDefault();
    event?.stopPropagation();

    if (this.editingField() === null || this.editClosing()) {
      return;
    }

    const current = this.connection();
    if (current) {
      this.resetForm(current);
    }

    if (!animated) {
      this.finishEdit();
      return;
    }

    this.editClosing.set(true);
    this.editCloseTimer = setTimeout(() => {
      this.editCloseTimer = null;
      this.finishEdit(true);
    }, EDIT_CLOSE_MS);
  }

  protected saveField(field: EditableSocialField, event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();

    if (this.editingField() !== field || this.isSaving()) {
      return;
    }

    const control = this.form.controls[field];
    if (control.invalid) {
      control.markAsTouched();
      return;
    }

    const current = this.connection();
    if (!current) {
      return;
    }

    const accountUsername = this.form.controls.accountUsername.value.trim();
    const accountComment = this.form.controls.accountComment.value.trim();

    if (!accountUsername) {
      this.form.controls.accountUsername.markAsTouched();
      return;
    }

    if (
      accountUsername === current.accountUsername &&
      accountComment === (current.accountComment ?? '')
    ) {
      this.cancelEdit();
      return;
    }

    // v1 UserPlatforms has no update endpoint yet.
    this.isSaving.set(false);
    this.saveResult.set('error');
    this.saveMessage.set('Aktualizacja połączonego konta nie jest jeszcze dostępna w API.');
    this.cancelEdit(undefined, false);
  }

  protected requestDelete(): void {
    const current = this.connection();
    if (!current || this.isSaving() || this.isDeleting() || this.editingField() !== null) {
      return;
    }

    // v1 UserPlatforms has no delete endpoint yet.
    this.saveResult.set('error');
    this.saveMessage.set('Odłączanie konta nie jest jeszcze dostępne w API.');
    this.errorMessage.set(null);
  }

  protected confirmDelete(): void {
    // Kept for template/delete-sheet wiring; disconnect is not available on v1 yet.
  }

  private resetForm(connection: UserPlatform): void {
    this.form.setValue({
      accountUsername: connection.accountUsername ?? '',
      accountComment: connection.accountComment ?? '',
    });
    this.form.markAsPristine();
  }

  private finishEdit(animateRead = false): void {
    const field = this.editingField();
    this.clearEditCloseTimer();
    this.editingField.set(null);
    this.editClosing.set(false);

    if (animateRead && field) {
      this.readEnterField.set(field);
      setTimeout(() => {
        if (this.readEnterField() === field) {
          this.readEnterField.set(null);
        }
      }, READ_ENTER_MS);
    }
  }

  private clearEditCloseTimer(): void {
    if (this.editCloseTimer !== null) {
      clearTimeout(this.editCloseTimer);
      this.editCloseTimer = null;
    }
  }
}
