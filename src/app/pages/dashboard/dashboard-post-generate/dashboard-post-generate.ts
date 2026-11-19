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
import { finalize } from 'rxjs';
import { DrawerMotionDirective } from '../../../layout/shared/drawer-motion';
import {
  GENERATE_POST_PROMPT_MAX_LENGTH,
  type GeneratePostSubmit,
} from '../../../models/gemini';
import {
  displayBrandProfileName,
  type BrandProfileSummary,
} from '../../../models/brand-profile';
import { BrandProfileService } from '../../../services/brand-profile';
import { DashboardAlert } from '../shared/dashboard-alert/dashboard-alert';

type GeneratePostForm = FormGroup<{
  prompt: FormControl<string>;
  brandProfileId: FormControl<string>;
}>;

@Component({
  selector: 'app-dashboard-post-generate',
  imports: [ReactiveFormsModule, DrawerMotionDirective, DashboardAlert],
  styleUrl: './dashboard-post-generate.scss',
  template: `
    <button
      type="button"
      class="post-generate-drawer__backdrop"
      appDrawerMotion="backdrop"
      [drawerMotionState]="open() ? 'open' : closing() ? 'closing' : 'closed'"
      [attr.aria-hidden]="!open()"
      aria-label="Zamknij panel generowania"
      (click)="cancel()"
    ></button>

    <aside
      #drawer
      class="post-generate-drawer"
      appDrawerMotion="panel"
      [drawerMotionState]="open() ? 'open' : closing() ? 'closing' : 'closed'"
      [attr.aria-hidden]="!open()"
      role="dialog"
      aria-modal="true"
      aria-labelledby="post-generate-title"
      aria-describedby="post-generate-description"
    >
      <header class="post-generate-drawer__head">
        <div>
          <p class="post-generate-drawer__eyebrow">Starvia AI</p>
          <h1 id="post-generate-title" class="post-generate-drawer__title">Wygeneruj treść</h1>
        </div>
        <button
          type="button"
          class="post-generate-drawer__close"
          aria-label="Zamknij panel generowania"
          [disabled]="busy()"
          (click)="cancel()"
        >
          <span class="post-generate-drawer__close-icon" aria-hidden="true"></span>
        </button>
      </header>

      <form class="post-generate-drawer__form" [formGroup]="form" (ngSubmit)="submit()">
        <div class="post-generate-drawer__body">
          <p id="post-generate-description" class="post-generate-drawer__description">
            Opisz, o czym ma być post. AI przygotuje draft treści, który możesz potem edytować i zapisać.
          </p>

          <app-dashboard-alert [compact]="true" [message]="errorMessage()" />

          <div class="field">
            <label class="field__label" for="generate-post-prompt">Prompt</label>
            <textarea
              #promptInput
              id="generate-post-prompt"
              class="field__input"
              formControlName="prompt"
              rows="5"
              maxlength="{{ promptMaxLength }}"
              autocomplete="off"
              placeholder="np. Przyjazny post o wiosennej promocji…"
              aria-describedby="generate-post-prompt-hint generate-post-prompt-error"
              (input)="onPromptInput()"
            ></textarea>
            <div class="field__meta">
              <div aria-live="polite">
                @if (form.controls.prompt.touched && form.controls.prompt.hasError('required')) {
                  <p id="generate-post-prompt-error" class="field__error" role="alert">Prompt jest wymagany.</p>
                } @else if (form.controls.prompt.touched && form.controls.prompt.hasError('maxlength')) {
                  <p id="generate-post-prompt-error" class="field__error" role="alert">
                    Prompt może mieć maksymalnie {{ promptMaxLength }} znaków.
                  </p>
                }
              </div>
              <span id="generate-post-prompt-hint" class="field__counter">
                {{ form.controls.prompt.value.length }}/{{ promptMaxLength }}
              </span>
            </div>
          </div>

          <div class="field post-generate-drawer__brand">
            <label class="field__label" for="generate-post-brand-profile">Profil marki</label>
            <select
              id="generate-post-brand-profile"
              class="field__input field__input--select"
              formControlName="brandProfileId"
              aria-describedby="generate-post-brand-hint"
            >
              <option value="">Bez profilu marki</option>
              @for (profile of brandProfiles(); track profile.id) {
                <option [value]="profile.id">{{ displayName(profile) }}</option>
              }
            </select>
            <p id="generate-post-brand-hint" class="post-generate-drawer__hint">
              @if (brandProfilesLoading()) {
                Wczytywanie profili…
              } @else if (brandProfilesError()) {
                {{ brandProfilesError() }}
              } @else if (brandProfiles().length === 0) {
                Nie masz jeszcze profili marek — wygenerujemy bez kontekstu marki.
              } @else {
                Opcjonalnie: AI użyje briefu i domyślnych ustawień wybranego profilu.
              }
            </p>
          </div>

          @if (hasExistingBody()) {
            <div class="post-generate-drawer__notice" role="note">
              <span class="material-icons" aria-hidden="true">info</span>
              <p>
                Obecna treść posta zostanie
                <strong>zastąpiona</strong>
                wygenerowanym draftem. Możesz ją przejrzeć i anulować przed zapisaniem.
              </p>
            </div>
          }
        </div>

        <footer class="post-generate-drawer__actions">
          <button type="button" class="btn btn--secondary" [disabled]="busy()" (click)="cancel()">
            Anuluj
          </button>
          <button type="submit" class="btn btn--primary" [disabled]="busy() || form.invalid">
            <span class="material-icons" aria-hidden="true">auto_awesome</span>
            @if (hasExistingBody()) {
              Zastąp i generuj
            } @else {
              Generuj
            }
          </button>
        </footer>
      </form>
    </aside>
  `,
})
export class DashboardPostGenerate {
  private readonly brandProfileService = inject(BrandProfileService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly promptInput = viewChild<ElementRef<HTMLTextAreaElement>>('promptInput');
  private readonly drawer = viewChild<ElementRef<HTMLElement>>('drawer');

  readonly closed = output<void>();
  readonly submitted = output<GeneratePostSubmit>();
  readonly open = input(false);
  readonly closing = input(false);
  readonly busy = input(false);
  readonly hasExistingBody = input(false);
  readonly errorMessage = input<string | null>(null);
  readonly initialPrompt = input('');

  protected readonly promptMaxLength = GENERATE_POST_PROMPT_MAX_LENGTH;
  protected readonly brandProfiles = signal<BrandProfileSummary[]>([]);
  protected readonly brandProfilesLoading = signal(false);
  protected readonly brandProfilesError = signal<string | null>(null);

  protected readonly form: GeneratePostForm = new FormGroup({
    prompt: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(GENERATE_POST_PROMPT_MAX_LENGTH)],
    }),
    brandProfileId: new FormControl('', { nonNullable: true }),
  });

  private brandProfilesLoaded = false;

  private readonly syncWhenOpened = effect((onCleanup) => {
    if (!this.open()) {
      return;
    }

    this.form.reset({
      prompt: this.clampPrompt(this.initialPrompt()),
      brandProfileId: this.form.controls.brandProfileId.value,
    });
    this.ensureBrandProfilesLoaded();
    const frame = requestAnimationFrame(() => this.promptInput()?.nativeElement.focus());
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

  protected displayName(profile: BrandProfileSummary): string {
    return displayBrandProfileName(profile.name);
  }

  protected onPromptInput(): void {
    const control = this.form.controls.prompt;
    const next = this.clampPrompt(control.value);
    if (next === control.value) {
      return;
    }

    const textarea = this.promptInput()?.nativeElement;
    const cursor = textarea?.selectionStart ?? next.length;
    control.setValue(next, { emitEvent: false });

    queueMicrotask(() => {
      if (!textarea) {
        return;
      }

      textarea.setSelectionRange(Math.min(cursor, next.length), Math.min(cursor, next.length));
    });
  }

  protected submit(): void {
    if (this.form.invalid || this.busy()) {
      this.form.markAllAsTouched();
      return;
    }

    const prompt = this.clampPrompt(this.form.controls.prompt.value).trim();
    if (!prompt) {
      this.form.controls.prompt.markAsTouched();
      return;
    }

    const brandProfileId = this.form.controls.brandProfileId.value.trim() || null;
    this.submitted.emit({ prompt, brandProfileId });
  }

  protected cancel(): void {
    if (this.open() && !this.busy() && !this.closing()) {
      this.closed.emit();
    }
  }

  private ensureBrandProfilesLoaded(): void {
    if (this.brandProfilesLoaded || this.brandProfilesLoading()) {
      return;
    }

    this.brandProfilesLoading.set(true);
    this.brandProfilesError.set(null);

    this.brandProfileService
      .browse(1, 100)
      .pipe(
        finalize(() => this.brandProfilesLoading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (result) => {
          this.brandProfilesLoaded = true;
          this.brandProfiles.set(result.items);
        },
        error: () => {
          this.brandProfilesError.set('Nie udało się wczytać profili marek.');
          this.brandProfiles.set([]);
        },
      });
  }

  private clampPrompt(value: string): string {
    return value.slice(0, GENERATE_POST_PROMPT_MAX_LENGTH);
  }

  private keepFocusInDrawer(event: KeyboardEvent): void {
    const focusable = Array.from(
      this.drawer()?.nativeElement.querySelectorAll<HTMLElement>(
        'button:not(:disabled), textarea:not(:disabled), select:not(:disabled), input:not(:disabled), [href], [tabindex]:not([tabindex="-1"])',
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
