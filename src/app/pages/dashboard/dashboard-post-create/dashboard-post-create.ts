import {
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';
import { toApplicationError } from '../../../models/application-error';
import {
  normalizePostPlatforms,
  normalizePostTitle,
  POST_TITLE_MAX_LENGTH,
  POST_TITLE_MIN_LENGTH,
  type PlatformType as PostPlatformType,
} from '../../../models/post';
import { type Platform } from '../../../models/platform';
import { PlatformService } from '../../../services/platform';
import { PostService } from '../../../services/post';
import { DrawerMotionDirective } from '../../../layout/shared/drawer-motion';
import { DashboardAlert } from '../shared/dashboard-alert/dashboard-alert';
import { DashboardPlatformLogo } from '../shared/dashboard-platform-logo/dashboard-platform-logo';

type CreatePostForm = FormGroup<{
  title: FormControl<string>;
}>;

@Component({
  selector: 'app-dashboard-post-create',
  imports: [ReactiveFormsModule, DrawerMotionDirective, DashboardAlert, DashboardPlatformLogo],
  styleUrl: './dashboard-post-create.scss',
  template: `
    <button
      type="button"
      class="post-create-drawer__backdrop"
      appDrawerMotion="backdrop"
      [drawerMotionState]="open() ? 'open' : closing() ? 'closing' : 'closed'"
      [attr.aria-hidden]="!open()"
      aria-label="Zamknij panel nowego posta"
      (click)="cancel()"
    ></button>

    <aside
      #drawer
      class="post-create-drawer"
      appDrawerMotion="panel"
      [drawerMotionState]="open() ? 'open' : closing() ? 'closing' : 'closed'"
      [attr.aria-hidden]="!open()"
      role="dialog"
      aria-modal="true"
      aria-labelledby="post-create-title"
      aria-describedby="post-create-description"
    >
      <header class="post-create-drawer__head">
        <div>
          <p class="post-create-drawer__eyebrow">Nowa treść</p>
          <h1 id="post-create-title" class="post-create-drawer__title">Utwórz post</h1>
        </div>
        <button
          type="button"
          class="post-create-drawer__close"
          aria-label="Zamknij panel nowego posta"
          [disabled]="isCreating()"
          (click)="cancel()"
        >
          <span class="post-create-drawer__close-icon" aria-hidden="true"></span>
        </button>
      </header>

      <form class="post-create-drawer__form" [formGroup]="form" (ngSubmit)="submit()">
        <div class="post-create-drawer__body">
          <p id="post-create-description" class="post-create-drawer__description">
            Zacznij od jasnego tytułu i wybierz platformy docelowe. Treść oraz media dodasz w następnym kroku.
          </p>

          <app-dashboard-alert [compact]="true" [message]="errorMessage()" />

          <div class="field">
            <label class="field__label" for="create-post-title">Tytuł posta</label>
            <textarea
              #titleInput
              id="create-post-title"
              class="field__input"
              formControlName="title"
              rows="5"
              maxlength="{{ titleMaxLength }}"
              autocomplete="off"
              placeholder="O czym chcesz napisać?"
              aria-describedby="create-post-title-hint create-post-title-error"
              (input)="onTitleInput()"
            ></textarea>
            <div class="field__meta">
              <div aria-live="polite">
                @if (form.controls.title.touched && form.controls.title.hasError('required')) {
                  <p id="create-post-title-error" class="field__error" role="alert">Tytuł jest wymagany.</p>
                } @else if (form.controls.title.touched && form.controls.title.hasError('minlength')) {
                  <p id="create-post-title-error" class="field__error" role="alert">
                    Tytuł musi mieć co najmniej {{ titleMinLength }} znaków.
                  </p>
                } @else if (form.controls.title.touched && form.controls.title.hasError('maxlength')) {
                  <p id="create-post-title-error" class="field__error" role="alert">
                    Tytuł może mieć maksymalnie {{ titleMaxLength }} znaków.
                  </p>
                }
              </div>
              <span id="create-post-title-hint" class="field__counter">
                {{ form.controls.title.value.length }}/{{ titleMaxLength }}
              </span>
            </div>
          </div>

          <div class="field post-create-drawer__platforms" role="group" aria-labelledby="create-post-platforms-label">
            <span id="create-post-platforms-label" class="field__label">Platformy</span>

            @if (platformsLoading()) {
              <p class="post-create-drawer__platforms-hint">Wczytywanie platform…</p>
            } @else if (availablePlatforms().length === 0) {
              <p class="post-create-drawer__platforms-hint" role="alert">
                {{ platformsError() ?? 'Brak platform w katalogu.' }}
              </p>
            } @else {
              <div class="post-create-drawer__platform-list">
                @for (platform of availablePlatforms(); track platform.platformType) {
                  <button
                    type="button"
                    class="post-create-drawer__platform-chip"
                    [class.is-selected]="isPlatformSelected(platform.platformType)"
                    [attr.aria-pressed]="isPlatformSelected(platform.platformType)"
                    [disabled]="isCreating()"
                    (click)="togglePlatform(platform.platformType)"
                  >
                    <app-dashboard-platform-logo
                      [platformType]="platform.type"
                      size="sm"
                      [compact]="true"
                    />
                    <span>{{ platform.type }}</span>
                  </button>
                }
              </div>
              @if (platformsTouched() && selectedPlatforms().length === 0) {
                <p class="field__error" role="alert">Wybierz co najmniej jedną platformę.</p>
              } @else {
                <p class="post-create-drawer__platforms-hint">
                  Wybierz jedną lub więcej platform, na które trafi ten post.
                </p>
              }
            }
          </div>
        </div>

        <footer class="post-create-drawer__actions">
          <button
            type="button"
            class="btn btn--secondary"
            [disabled]="isCreating()"
            (click)="cancel()"
          >
            Anuluj
          </button>
          <button
            type="submit"
            class="btn btn--primary"
            [disabled]="isCreating() || form.invalid || !canSubmitPlatforms()"
          >
            <span class="material-icons" aria-hidden="true">add</span>
            {{ isCreating() ? 'Tworzenie…' : 'Utwórz post' }}
          </button>
        </footer>
      </form>
    </aside>
  `,
})
export class DashboardPostCreate {
  private readonly postService = inject(PostService);
  private readonly platformService = inject(PlatformService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly titleInput = viewChild<ElementRef<HTMLTextAreaElement>>('titleInput');
  private readonly drawer = viewChild<ElementRef<HTMLElement>>('drawer');

  readonly closed = output<void>();
  readonly open = input(false);
  readonly closing = input(false);

  protected readonly titleMaxLength = POST_TITLE_MAX_LENGTH;
  protected readonly titleMinLength = POST_TITLE_MIN_LENGTH;

  protected readonly form: CreatePostForm = new FormGroup({
    title: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.minLength(POST_TITLE_MIN_LENGTH),
        Validators.maxLength(POST_TITLE_MAX_LENGTH),
      ],
    }),
  });

  protected readonly isCreating = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly availablePlatforms = signal<Platform[]>([]);
  protected readonly selectedPlatforms = signal<PostPlatformType[]>([]);
  protected readonly platformsLoading = signal(false);
  protected readonly platformsError = signal<string | null>(null);
  protected readonly platformsTouched = signal(false);

  private platformsLoaded = false;

  private readonly focusWhenOpened = effect((onCleanup) => {
    if (!this.open()) {
      return;
    }

    this.form.reset({ title: '' });
    this.errorMessage.set(null);
    this.platformsTouched.set(false);
    this.ensurePlatformsLoaded();
    this.resetSelectedPlatforms();
    const frame = requestAnimationFrame(() => this.titleInput()?.nativeElement.focus());
    onCleanup(() => cancelAnimationFrame(frame));
  });

  @HostListener('document:keydown', ['$event'])
  protected onDocumentKeydown(event: KeyboardEvent): void {
    if (!this.open()) {
      return;
    }

    if (event.key === 'Escape') {
      this.cancel();
      return;
    }

    if (event.key === 'Tab') {
      this.keepFocusInDrawer(event);
    }
  }

  protected onTitleInput(): void {
    this.applyClampedInput(this.form.controls.title, this.clampTitle.bind(this), this.titleInput()?.nativeElement);
  }

  protected isPlatformSelected(platformType: number): boolean {
    return this.selectedPlatforms().includes(platformType as PostPlatformType);
  }

  protected togglePlatform(platformType: number): void {
    this.platformsTouched.set(true);
    const typed = platformType as PostPlatformType;
    this.selectedPlatforms.update((current) => {
      if (current.includes(typed)) {
        return current.filter((item) => item !== typed);
      }
      return normalizePostPlatforms([...current, typed]);
    });
  }

  protected canSubmitPlatforms(): boolean {
    return !this.platformsLoading() && this.selectedPlatforms().length > 0;
  }

  protected submit(): void {
    this.platformsTouched.set(true);

    if (this.form.invalid || !this.canSubmitPlatforms()) {
      this.form.markAllAsTouched();
      return;
    }

    const title = this.clampTitle(this.form.controls.title.value.trim());
    const platforms = normalizePostPlatforms(this.selectedPlatforms());

    this.isCreating.set(true);
    this.errorMessage.set(null);

    this.postService
      .createPost({ title, platforms })
      .pipe(finalize(() => this.isCreating.set(false)))
      .subscribe({
        next: (created) => {
          void this.router.navigate(['/dashboard/posts', created.id]);
        },
        error: (error) => {
          this.errorMessage.set(toApplicationError(error, 'Nie udało się utworzyć posta.').description);
        },
      });
  }

  protected cancel(): void {
    if (this.open() && !this.isCreating() && !this.closing()) {
      this.closed.emit();
    }
  }

  private ensurePlatformsLoaded(): void {
    if (this.platformsLoaded || this.platformsLoading()) {
      return;
    }

    this.platformsLoading.set(true);
    this.platformsError.set(null);

    // Catalogue from DB — do not filter by online/offline.
    this.platformService
      .getPlatforms()
      .pipe(
        finalize(() => this.platformsLoading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (platforms) => {
          this.platformsLoaded = true;
          this.availablePlatforms.set(this.uniqueByType(platforms));
          this.resetSelectedPlatforms();
        },
        error: (error) => {
          this.platformsError.set(
            toApplicationError(error, 'Nie udało się wczytać platform.').description,
          );
          this.availablePlatforms.set([]);
          this.selectedPlatforms.set([]);
        },
      });
  }

  private resetSelectedPlatforms(): void {
    const available = this.availablePlatforms();
    if (available.length === 0) {
      this.selectedPlatforms.set([]);
      return;
    }

    // Prefer LinkedIn when present; otherwise first catalogue entry.
    const linkedIn = available.find((platform) => platform.platformType === 0);
    this.selectedPlatforms.set([(linkedIn ?? available[0]).platformType as PostPlatformType]);
  }

  private uniqueByType(platforms: readonly Platform[]): Platform[] {
    const seen = new Set<number>();
    const unique: Platform[] = [];

    for (const platform of platforms) {
      if (seen.has(platform.platformType)) {
        continue;
      }
      seen.add(platform.platformType);
      unique.push(platform);
    }

    return unique.sort((left, right) => left.platformType - right.platformType);
  }

  private applyClampedInput(
    control: FormControl<string>,
    clamp: (value: string) => string,
    textarea?: HTMLTextAreaElement,
  ): void {
    const next = clamp(control.value);
    if (next === control.value) {
      return;
    }

    const cursor = textarea?.selectionStart ?? next.length;
    control.setValue(next, { emitEvent: false });

    queueMicrotask(() => {
      if (!textarea) {
        return;
      }

      textarea.setSelectionRange(Math.min(cursor, next.length), Math.min(cursor, next.length));
    });
  }

  private clampTitle(value: string): string {
    return normalizePostTitle(value).slice(0, POST_TITLE_MAX_LENGTH);
  }

  private keepFocusInDrawer(event: KeyboardEvent): void {
    const focusable = Array.from(
      this.drawer()?.nativeElement.querySelectorAll<HTMLElement>(
        'button:not(:disabled), textarea:not(:disabled), input:not(:disabled), [href], [tabindex]:not([tabindex="-1"])',
      ) ?? [],
    );

    if (focusable.length === 0) {
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;

    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }
}
