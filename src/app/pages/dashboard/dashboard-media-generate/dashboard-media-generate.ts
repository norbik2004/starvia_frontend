import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { NgClass } from '@angular/common';
import { PageRevealDirective } from '../../../directives/page-reveal';
import { AutoExpandTextarea } from '../../../components/auto-expand-textarea/auto-expand-textarea';
import { DashboardPlatformLogo } from '../shared/dashboard-platform-logo/dashboard-platform-logo';
import { getPlatformBrandClass } from '../../../models/platform';
import {
  formatDimensionsLabel,
  MEDIA_PLATFORM_FORMATS,
  MEDIA_PLATFORMS,
  type MediaFormatSpec,
  type MediaPlatformKey,
} from '../../../models/media-format';

const PROMPT_MAX_LENGTH = 500;

type GenerateMediaForm = FormGroup<{
  prompt: FormControl<string>;
}>;

@Component({
  selector: 'app-dashboard-media-generate',
  imports: [ReactiveFormsModule, PageRevealDirective, DashboardPlatformLogo, NgClass, AutoExpandTextarea],
  styleUrl: './dashboard-media-generate.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="dashboard-content-page dashboard-media-generate" aria-labelledby="dashboard-media-generate-title">
      <div class="dashboard-media-generate__intro" appPageReveal>
        <header class="dashboard-media-generate__header">
          <div class="dashboard-media-generate__header-copy">
            <p class="section-eyebrow dashboard-media-generate__eyebrow">Media</p>
            <h1 id="dashboard-media-generate-title" class="dashboard-media-generate__title">Generate</h1>
          </div>
          <p class="dashboard-media-generate__copy">
            Create platform-ready visuals for LinkedIn, Facebook, and Instagram. Pick a format, describe
            what you need, and Starvia will prepare media sized for your chosen network.
          </p>
        </header>
      </div>

      <div class="dashboard-media-generate__layout" appPageReveal>
        <form class="dashboard-media-generate__panel" [formGroup]="form" (ngSubmit)="submit()">
          <div>
            <h2 class="dashboard-media-generate__section-title">Platform</h2>
            <div class="dashboard-media-generate__platform-grid" role="radiogroup" aria-label="Social platform">
              @for (platform of platforms; track platform.key) {
                <button
                  type="button"
                  class="dashboard-media-generate__platform-btn"
                  [class.is-selected]="selectedPlatform() === platform.key"
                  [ngClass]="platformBrandClass(platform.type)"
                  [attr.aria-pressed]="selectedPlatform() === platform.key"
                  (click)="selectPlatform(platform.key)"
                >
                  <app-dashboard-platform-logo [platformType]="platform.type" size="md" />
                  <span class="dashboard-media-generate__platform-name">{{ platform.label }}</span>
                </button>
              }
            </div>
          </div>

          <div>
            <h2 class="dashboard-media-generate__section-title">Format</h2>
            <ul class="dashboard-media-generate__format-list" role="radiogroup" aria-label="Media format">
              @for (format of availableFormats(); track format.key) {
                <li>
                  <button
                    type="button"
                    class="dashboard-media-generate__format-btn"
                    [class.is-selected]="selectedFormatKey() === format.key"
                    [attr.aria-pressed]="selectedFormatKey() === format.key"
                    (click)="selectFormat(format.key)"
                  >
                    <span class="dashboard-media-generate__format-icon-wrap" aria-hidden="true">
                      <span class="material-icons">{{ format.icon }}</span>
                    </span>
                    <span class="dashboard-media-generate__format-copy">
                      <span class="dashboard-media-generate__format-label">{{ format.label }}</span>
                      <span class="dashboard-media-generate__format-size">{{ formatDimensionsLabel(format) }}</span>
                      <p class="dashboard-media-generate__format-description">{{ format.description }}</p>
                    </span>
                  </button>
                </li>
              }
            </ul>
          </div>

          <div class="dashboard-media-generate__prompt">
            <h2 class="dashboard-media-generate__section-title">Prompt</h2>
            <div class="dashboard-gemini-prompt-composer">
              <div class="dashboard-gemini-prompt-row">
                <app-auto-expand-textarea
                  id="media-generate-prompt"
                  variant="gemini"
                  formControlName="prompt"
                  [maxLength]="promptMaxLength"
                  [enterSubmits]="true"
                  placeholder="Describe what Starvia should generate for your social post…"
                  ariaLabel="Image generation prompt"
                  ariaDescribedBy="media-generate-prompt-hint"
                  (enter)="submit()"
                />
              </div>
              <p
                id="media-generate-prompt-hint"
                class="dashboard-gemini-prompt-meta"
                [class.dashboard-gemini-prompt-meta--limit]="form.controls.prompt.value.length >= promptMaxLength"
                aria-live="polite"
              >
                {{ form.controls.prompt.value.length }}/{{ promptMaxLength }}
              </p>
            </div>
          </div>

          @if (statusMessage()) {
            <p
              class="posts-status"
              [class.posts-status--error]="statusError()"
              role="status"
            >
              {{ statusMessage() }}
            </p>
          }

          <div class="dashboard-media-generate__actions">
            <button
              type="submit"
              class="dashboard-green-pill-btn dashboard-green-pill-btn--full"
              [disabled]="form.invalid || isGenerating()"
            >
              <span class="material-icons" aria-hidden="true">auto_awesome</span>
              {{ isGenerating() ? 'Generating…' : 'Generate image' }}
            </button>
          </div>
        </form>

        <aside class="dashboard-media-generate__preview" aria-label="Selected format preview">
          <h2 class="dashboard-media-generate__section-title">Format preview</h2>

          <div
            class="dashboard-media-generate__preview-frame"
            [style.aspect-ratio]="selectedFormat().aspectRatio"
          >
            <div class="dashboard-media-generate__preview-placeholder">
              <span class="material-icons" aria-hidden="true">auto_awesome</span>
              <p class="dashboard-media-generate__preview-copy">
                Generated media will appear here in the correct aspect ratio for
                {{ selectedPlatformLabel() }}.
              </p>
            </div>
          </div>

          <ul class="dashboard-media-generate__spec-list">
            <li class="dashboard-media-generate__spec-item">
              <span class="dashboard-media-generate__spec-label">Platform</span>
              <span class="dashboard-media-generate__spec-value">{{ selectedPlatformLabel() }}</span>
            </li>
            <li class="dashboard-media-generate__spec-item">
              <span class="dashboard-media-generate__spec-label">Format</span>
              <span class="dashboard-media-generate__spec-value">{{ selectedFormat().label }}</span>
            </li>
            <li class="dashboard-media-generate__spec-item">
              <span class="dashboard-media-generate__spec-label">Dimensions</span>
              <span class="dashboard-media-generate__spec-value">{{ formatDimensionsLabel(selectedFormat()) }}</span>
            </li>
            <li class="dashboard-media-generate__spec-item">
              <span class="dashboard-media-generate__spec-label">Aspect ratio</span>
              <span class="dashboard-media-generate__spec-value">{{ selectedFormat().aspectRatio }}</span>
            </li>
          </ul>
        </aside>
      </div>
    </section>
  `,
})
export class DashboardMediaGenerate {
  protected readonly platforms = MEDIA_PLATFORMS;
  protected readonly promptMaxLength = PROMPT_MAX_LENGTH;
  protected readonly formatDimensionsLabel = formatDimensionsLabel;
  protected readonly platformBrandClass = getPlatformBrandClass;

  protected readonly selectedPlatform = signal<MediaPlatformKey>('linkedin');
  protected readonly selectedFormatKey = signal<string>(MEDIA_PLATFORM_FORMATS.linkedin[0].key);
  protected readonly isGenerating = signal(false);
  protected readonly statusMessage = signal<string | null>(null);
  protected readonly statusError = signal(false);

  protected readonly form: GenerateMediaForm = new FormGroup({
    prompt: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(PROMPT_MAX_LENGTH)],
    }),
  });

  protected readonly availableFormats = computed(
    () => MEDIA_PLATFORM_FORMATS[this.selectedPlatform()] ?? MEDIA_PLATFORM_FORMATS.linkedin
  );

  protected readonly selectedFormat = computed<MediaFormatSpec>(() => {
    const formats = this.availableFormats();
    const selected = formats.find((format) => format.key === this.selectedFormatKey());
    return selected ?? formats[0];
  });

  protected readonly selectedPlatformLabel = computed(() => {
    const platform = this.platforms.find((item) => item.key === this.selectedPlatform());
    return platform?.label ?? 'Platform';
  });

  protected selectPlatform(platform: MediaPlatformKey): void {
    if (this.selectedPlatform() === platform) {
      return;
    }

    this.selectedPlatform.set(platform);
    this.selectedFormatKey.set(MEDIA_PLATFORM_FORMATS[platform][0].key);
    this.clearStatus();
  }

  protected selectFormat(formatKey: string): void {
    this.selectedFormatKey.set(formatKey);
    this.clearStatus();
  }

  protected submit(): void {
    if (this.form.invalid || this.isGenerating()) {
      this.form.markAllAsTouched();
      return;
    }

    this.isGenerating.set(true);
    this.statusError.set(false);
    this.statusMessage.set(null);

    window.setTimeout(() => {
      this.isGenerating.set(false);
      this.statusMessage.set(
        'Image generation is not connected yet. Your platform and format selection are ready for the upcoming API.'
      );
    }, 650);
  }

  private clearStatus(): void {
    this.statusMessage.set(null);
    this.statusError.set(false);
  }
}
