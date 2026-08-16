import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
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
        #dialog
        class="dashboard-image-lightbox"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dashboard-image-lightbox-title"
        aria-describedby="dashboard-image-lightbox-hint"
        tabindex="-1"
      >
        <header class="dashboard-image-lightbox-toolbar">
          <p
            id="dashboard-image-lightbox-title"
            class="dashboard-image-lightbox-title dashboard-editable-text"
          >
            {{ title() }}
          </p>
          <div class="dashboard-image-lightbox-tools">
            <button
              type="button"
              class="dashboard-image-lightbox-tool"
              aria-label="Zoom out"
              matTooltip="Zoom out"
              matTooltipPosition="below"
              [disabled]="!canInteractWithImage() || previewZoom() <= 1"
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
              [disabled]="!canInteractWithImage() || previewZoom() >= maxPreviewZoom"
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
              [disabled]="
                !canInteractWithImage() ||
                (previewZoom() === 1 && previewPan().x === 0 && previewPan().y === 0)
              "
              (click)="resetPreviewZoom()"
            >
              <span class="material-icons" aria-hidden="true">fit_screen</span>
            </button>
          </div>
          <ng-content select="[lightboxToolbar]" />
          <button
            #closeButton
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
          [attr.aria-busy]="imageLoading()"
          (wheel)="onPreviewWheel($event)"
          (dblclick)="onPreviewDoubleClick($event)"
        >
          @if (imageLoading()) {
            <div class="dashboard-image-lightbox-state" role="status">
              <span class="dashboard-image-lightbox-spinner" aria-hidden="true"></span>
              Loading image…
            </div>
          }
          @if (imageError()) {
            <div class="dashboard-image-lightbox-state dashboard-image-lightbox-state--error" role="alert">
              <span class="material-icons" aria-hidden="true">broken_image</span>
              The image preview could not be loaded.
            </div>
          }
          @if (previewSrc() && !imageError()) {
            <img
              class="dashboard-image-lightbox-image"
              [class.dashboard-image-lightbox-image--loading]="imageLoading()"
              [class.dashboard-image-lightbox-image--draggable]="previewZoom() > 1"
              [src]="previewSrc()"
              [alt]="title()"
              [style.transform]="previewTransform()"
              (load)="onPreviewLoad()"
              (error)="onPreviewError()"
              (pointerdown)="onPreviewPointerDown($event)"
              (pointermove)="onPreviewPointerMove($event)"
              (pointerup)="onPreviewPointerEnd($event)"
              (pointercancel)="onPreviewPointerEnd($event)"
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
          <p id="dashboard-image-lightbox-hint" class="dashboard-image-lightbox-hint">
            Scroll or pinch to zoom · Double-click to toggle · Drag or use arrow keys when zoomed
          </p>
        </footer>
      </div>
    </div>
  `,
})
export class DashboardImageLightbox implements AfterViewInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly dialog = viewChild.required<ElementRef<HTMLDivElement>>('dialog');
  private readonly closeButton = viewChild.required<ElementRef<HTMLButtonElement>>('closeButton');
  private readonly focusOrigin =
    typeof document !== 'undefined' && document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;

  readonly title = input.required<string>();
  readonly previewSrc = input<string | null>(null);
  readonly description = input<string | null>(null);
  readonly showDescription = input(true);

  readonly closed = output<void>();

  protected readonly closing = signal(false);
  protected readonly previewZoom = signal(1);
  protected readonly previewPan = signal({ x: 0, y: 0 });
  protected readonly isPreviewPanning = signal(false);
  protected readonly imageLoading = signal(false);
  protected readonly imageError = signal(false);
  protected readonly zoomPercent = computed(() => Math.round(this.previewZoom() * 100));
  protected readonly canInteractWithImage = computed(
    () => !!this.previewSrc() && !this.imageLoading() && !this.imageError()
  );
  protected readonly maxPreviewZoom = 4;
  protected readonly hasDescription = computed(() => hasUserUploadedFileDescription(this.description()));
  protected readonly descriptionText = computed(() =>
    displayUserUploadedFileDescription(this.description())
  );

  private closeTimer: ReturnType<typeof setTimeout> | null = null;
  private panSession: {
    pointerId: number;
    startX: number;
    startY: number;
    panX: number;
    panY: number;
  } | null = null;
  private pinchSession: { startDistance: number; startZoom: number } | null = null;
  private readonly activePointers = new Map<number, { x: number; y: number }>();

  constructor() {
    effect(() => {
      const src = this.previewSrc();
      this.imageLoading.set(!!src);
      this.imageError.set(!src);
      this.resetPreviewZoom();
    });

    this.destroyRef.onDestroy(() => {
      this.clearCloseTimer();
      this.activePointers.clear();
    });
  }

  ngAfterViewInit(): void {
    queueMicrotask(() => {
      if (!this.closing()) {
        this.closeButton().nativeElement.focus();
      }
    });
  }

  @HostListener('document:keydown', ['$event'])
  protected onDocumentKeydown(event: KeyboardEvent): void {
    const dialog = this.dialog().nativeElement;
    if (!dialog.contains(document.activeElement)) {
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      this.close();
      return;
    }

    if (event.key === 'Tab') {
      this.trapFocus(event);
      return;
    }

    if (this.isTypingTarget(event.target)) {
      return;
    }

    if (!this.canInteractWithImage()) {
      return;
    }

    if (event.key === '+' || event.key === '=') {
      event.preventDefault();
      this.zoomIn();
    } else if (event.key === '-' || event.key === '_') {
      event.preventDefault();
      this.zoomOut();
    } else if (event.key === '0') {
      event.preventDefault();
      this.resetPreviewZoom();
    } else if (event.key.startsWith('Arrow') && this.previewZoom() > 1) {
      event.preventDefault();
      this.panWithKeyboard(event.key);
    }
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
      queueMicrotask(() => this.restoreFocus());
    }, this.prefersReducedMotion() ? 0 : LIGHTBOX_CLOSE_MS);
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
    this.pinchSession = null;
    this.activePointers.clear();
    this.isPreviewPanning.set(false);
  }

  protected onPreviewWheel(event: WheelEvent): void {
    if (!this.canInteractWithImage()) {
      return;
    }

    event.preventDefault();
    this.setPreviewZoom(this.previewZoom() + (event.deltaY < 0 ? 0.12 : -0.12));
  }

  protected onPreviewDoubleClick(event: MouseEvent): void {
    if (!this.canInteractWithImage()) {
      return;
    }

    event.preventDefault();
    if (this.previewZoom() > 1.01) {
      this.resetPreviewZoom();
      return;
    }

    this.previewZoom.set(2);
  }

  protected onPreviewLoad(): void {
    this.imageLoading.set(false);
    this.imageError.set(false);
  }

  protected onPreviewError(): void {
    this.imageLoading.set(false);
    this.imageError.set(true);
    this.resetPreviewZoom();
  }

  protected onPreviewPointerDown(event: PointerEvent): void {
    if (!this.canInteractWithImage()) {
      return;
    }

    if (event.pointerType === 'mouse' && (event.button !== 0 || this.previewZoom() <= 1)) {
      return;
    }

    event.preventDefault();
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    this.activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (this.activePointers.size >= 2) {
      this.beginPinch();
      return;
    }

    if (this.previewZoom() > 1) {
      this.beginPan(event.pointerId, event.clientX, event.clientY);
    }
  }

  protected onPreviewPointerMove(event: PointerEvent): void {
    if (!this.activePointers.has(event.pointerId)) {
      return;
    }

    event.preventDefault();
    this.activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (this.activePointers.size >= 2) {
      if (!this.pinchSession) {
        this.beginPinch();
      }
      const distance = this.pointerDistance();
      if (this.pinchSession && distance > 0) {
        this.setPreviewZoom(
          this.pinchSession.startZoom * (distance / this.pinchSession.startDistance)
        );
      }
      return;
    }

    if (this.panSession?.pointerId === event.pointerId) {
      this.previewPan.set({
        x: this.panSession.panX + (event.clientX - this.panSession.startX),
        y: this.panSession.panY + (event.clientY - this.panSession.startY),
      });
    }
  }

  protected onPreviewPointerEnd(event: PointerEvent): void {
    const target = event.currentTarget as HTMLElement;
    if (target.hasPointerCapture(event.pointerId)) {
      target.releasePointerCapture(event.pointerId);
    }

    this.activePointers.delete(event.pointerId);
    this.pinchSession = null;
    this.panSession = null;

    const remaining = this.activePointers.entries().next().value as
      | [number, { x: number; y: number }]
      | undefined;
    if (remaining && this.previewZoom() > 1) {
      this.beginPan(remaining[0], remaining[1].x, remaining[1].y);
    } else {
      this.isPreviewPanning.set(false);
    }
  }

  private setPreviewZoom(value: number): void {
    const next = Math.min(this.maxPreviewZoom, Math.max(1, value));
    this.previewZoom.set(next);
    if (next === 1) {
      this.previewPan.set({ x: 0, y: 0 });
      this.panSession = null;
      this.pinchSession = null;
      this.isPreviewPanning.set(false);
    }
  }

  private beginPan(pointerId: number, startX: number, startY: number): void {
    const pan = this.previewPan();
    this.panSession = {
      pointerId,
      startX,
      startY,
      panX: pan.x,
      panY: pan.y,
    };
    this.isPreviewPanning.set(true);
  }

  private beginPinch(): void {
    const distance = this.pointerDistance();
    if (distance <= 0) {
      return;
    }

    this.panSession = null;
    this.pinchSession = { startDistance: distance, startZoom: this.previewZoom() };
    this.isPreviewPanning.set(true);
  }

  private pointerDistance(): number {
    const [first, second] = [...this.activePointers.values()];
    if (!first || !second) {
      return 0;
    }

    return Math.hypot(second.x - first.x, second.y - first.y);
  }

  private panWithKeyboard(key: string): void {
    const distance = 32;
    const pan = this.previewPan();
    this.previewPan.set({
      x: pan.x + (key === 'ArrowLeft' ? distance : key === 'ArrowRight' ? -distance : 0),
      y: pan.y + (key === 'ArrowUp' ? distance : key === 'ArrowDown' ? -distance : 0),
    });
  }

  private trapFocus(event: KeyboardEvent): void {
    const focusable = Array.from(
      this.dialog().nativeElement.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), ' +
          'textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
    ).filter((element) => !element.hasAttribute('hidden'));

    if (focusable.length === 0) {
      event.preventDefault();
      this.dialog().nativeElement.focus();
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

  private isTypingTarget(target: EventTarget | null): boolean {
    return (
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement ||
      (target instanceof HTMLElement && target.isContentEditable)
    );
  }

  private restoreFocus(): void {
    if (this.focusOrigin?.isConnected) {
      this.focusOrigin.focus();
    }
  }

  private prefersReducedMotion(): boolean {
    return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
  }

  private clearCloseTimer(): void {
    if (this.closeTimer !== null) {
      clearTimeout(this.closeTimer);
      this.closeTimer = null;
    }
  }
}
