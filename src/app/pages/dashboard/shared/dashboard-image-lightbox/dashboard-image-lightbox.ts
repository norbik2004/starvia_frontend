import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  HostListener,
  NgZone,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { MatTooltip } from '@angular/material/tooltip';
import {
  displayUserUploadedFileDescription,
  hasUserUploadedFileDescription,
} from '../../../../models/user-uploaded-file';

const LIGHTBOX_CLOSE_MS = 280;

@Component({
  selector: 'app-dashboard-image-lightbox',
  imports: [MatTooltip],
  styleUrl: './dashboard-image-lightbox.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="dashboard-image-lightbox-layer dashboard-image-lightbox-layer--open"
      [class.dashboard-image-lightbox-layer--closing]="closing()"
      role="presentation"
    >
      <button
        type="button"
        class="dashboard-image-lightbox-backdrop"
        aria-label="Close preview"
        (click)="close()"
      ></button>

      <div
        class="dashboard-image-lightbox"
        role="dialog"
        aria-modal="true"
        [attr.aria-label]="title()"
      >
        <header class="dashboard-image-lightbox-toolbar">
          <p class="dashboard-image-lightbox-title dashboard-editable-text">{{ title() }}</p>
          <div class="dashboard-image-lightbox-tools">
            <button
              type="button"
              class="dashboard-image-lightbox-tool"
              aria-label="Zoom out"
              matTooltip="Zoom out"
              matTooltipPosition="below"
              [disabled]="previewZoom() <= 1"
              (click)="zoomOut()"
            >
              <span class="material-icons" aria-hidden="true">zoom_out</span>
            </button>
            <span class="dashboard-image-lightbox-zoom" aria-live="polite">{{ zoomPercent() }}%</span>
            <button
              type="button"
              class="dashboard-image-lightbox-tool"
              aria-label="Zoom in"
              matTooltip="Zoom in"
              matTooltipPosition="below"
              [disabled]="previewZoom() >= maxPreviewZoom"
              (click)="zoomIn()"
            >
              <span class="material-icons" aria-hidden="true">zoom_in</span>
            </button>
            <button
              type="button"
              class="dashboard-image-lightbox-tool"
              aria-label="Reset zoom"
              matTooltip="Reset zoom"
              matTooltipPosition="below"
              [disabled]="previewZoom() === 1 && previewPan().x === 0 && previewPan().y === 0"
              (click)="resetPreviewZoom()"
            >
              <span class="material-icons" aria-hidden="true">fit_screen</span>
            </button>
          </div>
          <ng-content select="[lightboxToolbar]" />
          <button
            type="button"
            class="dashboard-image-lightbox-close"
            aria-label="Close preview"
            matTooltip="Close"
            matTooltipPosition="below"
            (click)="close()"
          >
            <span class="material-icons" aria-hidden="true">close</span>
          </button>
        </header>

        <div
          class="dashboard-image-lightbox-stage"
          [class.dashboard-image-lightbox-stage--panning]="isPreviewPanning()"
          (wheel)="onPreviewWheel($event)"
          (dblclick)="onPreviewDoubleClick($event)"
        >
          @if (previewSrc()) {
            <img
              class="dashboard-image-lightbox-image"
              [class.dashboard-image-lightbox-image--draggable]="previewZoom() > 1"
              [src]="previewSrc()"
              [alt]="title()"
              [style.transform]="previewTransform()"
              (mousedown)="onPreviewPanStart($event)"
            />
          }
        </div>

        <footer
          class="dashboard-image-lightbox-footer"
          [class.dashboard-image-lightbox-footer--hint-only]="!showDescription()"
        >
          @if (showDescription()) {
            <div class="dashboard-image-lightbox-description">
              <p class="dashboard-image-lightbox-description-label">Description</p>
              <p
                class="dashboard-image-lightbox-description-text"
                [class.dashboard-image-lightbox-description-text--empty]="!hasDescription()"
              >
                {{ descriptionText() }}
              </p>
            </div>
          }
          <p class="dashboard-image-lightbox-hint">
            Scroll to zoom · Double-click to toggle · Drag when zoomed in
          </p>
        </footer>
      </div>
    </div>
  `,
})
export class DashboardImageLightbox {
  private readonly destroyRef = inject(DestroyRef);
  private readonly ngZone = inject(NgZone);

  readonly title = input.required<string>();
  readonly previewSrc = input<string | null>(null);
  readonly description = input<string | null>(null);
  readonly showDescription = input(true);

  readonly closed = output<void>();

  protected readonly closing = signal(false);
  protected readonly previewZoom = signal(1);
  protected readonly previewPan = signal({ x: 0, y: 0 });
  protected readonly isPreviewPanning = signal(false);
  protected readonly zoomPercent = computed(() => Math.round(this.previewZoom() * 100));
  protected readonly maxPreviewZoom = 4;
  protected readonly hasDescription = computed(() => hasUserUploadedFileDescription(this.description()));
  protected readonly descriptionText = computed(() =>
    displayUserUploadedFileDescription(this.description())
  );

  private closeTimer: ReturnType<typeof setTimeout> | null = null;
  private panSession: { startX: number; startY: number; panX: number; panY: number } | null = null;
  private panListening = false;

  private readonly onPanMove = (event: MouseEvent): void => {
    if (!this.panSession) {
      return;
    }

    this.ngZone.run(() => {
      this.previewPan.set({
        x: this.panSession!.panX + (event.clientX - this.panSession!.startX),
        y: this.panSession!.panY + (event.clientY - this.panSession!.startY),
      });
    });
  };

  private readonly onPanEnd = (): void => {
    this.detachPanListeners();
    this.ngZone.run(() => {
      this.panSession = null;
      this.isPreviewPanning.set(false);
    });
  };

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.clearCloseTimer();
      this.detachPanListeners();
    });
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    this.close();
  }

  protected close(): void {
    if (this.closing()) {
      return;
    }

    this.closing.set(true);
    this.clearCloseTimer();
    this.closeTimer = setTimeout(() => {
      this.closeTimer = null;
      this.closing.set(false);
      this.resetPreviewZoom();
      this.closed.emit();
    }, LIGHTBOX_CLOSE_MS);
  }

  protected previewTransform(): string {
    const pan = this.previewPan();
    return `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${this.previewZoom()})`;
  }

  protected zoomIn(): void {
    this.setPreviewZoom(this.previewZoom() + 0.25);
  }

  protected zoomOut(): void {
    this.setPreviewZoom(this.previewZoom() - 0.25);
  }

  protected resetPreviewZoom(): void {
    this.previewZoom.set(1);
    this.previewPan.set({ x: 0, y: 0 });
    this.panSession = null;
    this.isPreviewPanning.set(false);
  }

  protected onPreviewWheel(event: WheelEvent): void {
    event.preventDefault();
    this.setPreviewZoom(this.previewZoom() + (event.deltaY < 0 ? 0.12 : -0.12));
  }

  protected onPreviewDoubleClick(event: MouseEvent): void {
    event.preventDefault();
    if (this.previewZoom() > 1.01) {
      this.resetPreviewZoom();
      return;
    }

    this.previewZoom.set(2);
  }

  protected onPreviewPanStart(event: MouseEvent): void {
    if (this.previewZoom() <= 1 || event.button !== 0) {
      return;
    }

    event.preventDefault();
    const pan = this.previewPan();
    this.panSession = {
      startX: event.clientX,
      startY: event.clientY,
      panX: pan.x,
      panY: pan.y,
    };
    this.isPreviewPanning.set(true);
    this.attachPanListeners();
  }

  private attachPanListeners(): void {
    if (this.panListening) {
      return;
    }

    this.panListening = true;
    this.ngZone.runOutsideAngular(() => {
      document.addEventListener('mousemove', this.onPanMove);
      document.addEventListener('mouseup', this.onPanEnd);
    });
  }

  private detachPanListeners(): void {
    if (!this.panListening) {
      return;
    }

    this.panListening = false;
    document.removeEventListener('mousemove', this.onPanMove);
    document.removeEventListener('mouseup', this.onPanEnd);
  }

  private setPreviewZoom(value: number): void {
    const next = Math.min(this.maxPreviewZoom, Math.max(1, value));
    this.previewZoom.set(next);
    if (next === 1) {
      this.previewPan.set({ x: 0, y: 0 });
      this.panSession = null;
      this.isPreviewPanning.set(false);
    }
  }

  private clearCloseTimer(): void {
    if (this.closeTimer !== null) {
      clearTimeout(this.closeTimer);
      this.closeTimer = null;
    }
  }
}
