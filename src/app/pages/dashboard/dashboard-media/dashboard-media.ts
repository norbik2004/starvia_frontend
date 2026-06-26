import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  HostListener,
  inject,
  NgZone,
  signal,
  viewChild,
} from '@angular/core';
import { MatTooltip } from '@angular/material/tooltip';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { toApplicationError } from '../../../models/application-error';
import {
  isSupportedImageFile,
  SUPPORTED_IMAGE_ACCEPT,
  USER_UPLOADED_FILE_NAME_MAX_LENGTH,
  type PagedUserUploadedFilesResponse,
  type UserUploadedFileItem,
} from '../../../models/user-uploaded-file';
import { UserUploadedFileService } from '../../../services/user-uploaded-file';
import { DisplayDatetimePipe } from '../../../pipes/display-datetime';
import { DashboardPaginationPanel } from '../shared/dashboard-pagination-panel/dashboard-pagination-panel';
import { showingFrom, showingTo, toPaginationPage } from '../shared/pagination';
import { PageLoading } from '../../../components/page-loading/page-loading';
import { PageRevealDirective } from '../../../directives/page-reveal';

const PAGE_SIZE_OPTIONS = [12, 24, 48] as const;

type MediaForm = FormGroup<{
  pageNumber: FormControl<number>;
  pageSize: FormControl<number>;
}>;

@Component({
  selector: 'app-dashboard-media',
  imports: [DisplayDatetimePipe, DashboardPaginationPanel, ReactiveFormsModule, MatTooltip, PageLoading, PageRevealDirective],
  styleUrl: './dashboard-media.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="dashboard-content-page dashboard-media" aria-labelledby="dashboard-media-title">
      <div appPageReveal>
      <div class="dashboard-media__intro">
        <header class="dashboard-media__header">
          <div class="dashboard-media__header-row">
            <div class="dashboard-media__header-copy">
              <p class="section-eyebrow dashboard-media__eyebrow">Library</p>
              <h1 id="dashboard-media-title" class="dashboard-media__title">Media</h1>
            </div>
          </div>
        </header>

        <label
          class="dashboard-media__upload"
          [class.dashboard-media__upload--active]="dragActive()"
          [class.dashboard-media__upload--busy]="isUploading()"
          (dragenter)="onDragEnter($event)"
          (dragover)="onDragOver($event)"
          (dragleave)="onDragLeave($event)"
          (drop)="onDrop($event)"
        >
          <input
            #fileInput
            class="dashboard-media__upload-input"
            type="file"
            accept="{{ supportedImageAccept }}"
            multiple
            [disabled]="isUploading()"
            (change)="onFileInputChange($event)"
          />
          <span class="dashboard-media__upload-icon" aria-hidden="true">
            <span class="material-icons">{{ isUploading() ? 'hourglass_top' : 'cloud_upload' }}</span>
          </span>
          <p class="dashboard-media__upload-title">
            {{ isUploading() ? 'Uploading images…' : 'Upload images' }}
          </p>
          <p class="dashboard-media__upload-hint">
            Drag and drop images here, or click to browse.
            <span class="dashboard-media__upload-formats">
              Supports JPG, PNG, GIF, WebP, BMP, TIFF, ICO, HEIC, HEIF, and AVIF.
            </span>
          </p>
        </label>
      </div>

      @if (uploadMessage()) {
        <p class="posts-status" [class.posts-status--error]="uploadError()" role="status">
          {{ uploadMessage() }}
        </p>
      }
      </div>

      @if (isLoading() && !result()) {
        <app-page-loading label="Loading media…" />
      }

      @if (errorMessage()) {
        <p class="posts-status posts-status--error" role="alert">{{ errorMessage() }}</p>
      }

      @if (result(); as page) {
        <div appPageReveal>
        @if (page.items.length === 0) {
          <p class="posts-status">No images uploaded yet.</p>
        } @else {
          <div class="dashboard-list-board" [class.dashboard-list-board--loading]="isLoading()">
            <div class="dashboard-list-board__head">
              <p class="dashboard-list-board__summary" aria-live="polite">
                Showing
                <strong>{{ listShowingFrom(page) }}–{{ listShowingTo(page) }}</strong>
                @if (page.totalPages > 0) {
                  · Page <strong>{{ page.pageIndex }}</strong> of <strong>{{ page.totalPages }}</strong>
                }
              </p>
            </div>

            <ul class="dashboard-media__grid" appPageReveal [appPageRevealList]="true">
              @for (file of page.items; track file.id) {
                <li>
                  <article class="media-card">
                    <button
                      type="button"
                      class="media-card__preview-btn"
                      [attr.aria-label]="'Preview ' + (file.fileName || 'image')"
                      (click)="openPreview(file)"
                    >
                      <div class="media-card__frame">
                        @if (previewUrl(file.id); as src) {
                          <img
                            class="media-card__preview"
                            [src]="src"
                            [alt]="file.fileName || 'Uploaded image'"
                            loading="lazy"
                          />
                        } @else {
                          <span class="media-card__preview-placeholder" aria-hidden="true">
                            <span class="material-icons">image</span>
                          </span>
                        }
                      </div>
                    </button>

                    <div class="media-card__foot">
                      <div class="media-card__meta">
                        @if (isRenaming(file.id)) {
                          <div class="media-card__rename">
                            <input
                              #renameInput
                              class="field__input field__input--inline-title"
                              type="text"
                              [formControl]="renameControl"
                              [attr.maxlength]="fileNameMaxLength"
                              aria-label="File name"
                              (mousedown)="$event.stopPropagation()"
                              (keydown.enter)="saveRename($event)"
                              (keydown.escape)="cancelRename($event)"
                            />
                            <p class="dashboard-edit-hint media-card__rename-hint">
                              {{ renameControl.value.length }}/{{ fileNameMaxLength }} · Esc to cancel
                            </p>
                            @if (renameError()) {
                              <p class="field__error media-card__rename-error" role="alert">{{ renameError() }}</p>
                            }
                          </div>
                        } @else {
                          <p class="dashboard-editable-text media-card__name" [title]="file.fileName || 'Untitled'">
                            {{ file.fileName || 'Untitled' }}
                          </p>
                          <p class="media-card__date">
                            <time [attr.datetime]="file.createdAt">{{ file.createdAt | displayDatetime }}</time>
                          </p>
                        }
                      </div>

                      <div class="media-card__actions">
                        @if (isRenaming(file.id)) {
                          <button
                            type="button"
                            class="media-card__icon-btn media-card__icon-btn--confirm"
                            aria-label="Save file name"
                            matTooltip="Save"
                            matTooltipPosition="below"
                            [disabled]="isSavingRename() || renameControl.invalid"
                            (click)="saveRename($event)"
                          >
                            <span class="material-icons" aria-hidden="true">check</span>
                          </button>
                          <button
                            type="button"
                            class="media-card__icon-btn"
                            aria-label="Cancel rename"
                            matTooltip="Cancel"
                            matTooltipPosition="below"
                            [disabled]="isSavingRename()"
                            (click)="cancelRename($event)"
                          >
                            <span class="material-icons" aria-hidden="true">close</span>
                          </button>
                        } @else {
                          <span
                            class="edit-icon media-card__edit-icon"
                            role="button"
                            tabindex="0"
                            matTooltip="Rename"
                            matTooltipPosition="below"
                            [attr.aria-label]="'Rename ' + (file.fileName || 'image')"
                            (click)="startRename(file, $event)"
                            (keydown.enter)="startRename(file, $event)"
                            (keydown.space)="startRename(file, $event)"
                          >
                            <span class="material-icons edit-icon__glyph" aria-hidden="true">edit</span>
                          </span>
                          <span
                            class="media-card__open-hint"
                            matTooltip="Preview"
                            matTooltipPosition="below"
                            aria-hidden="true"
                          >
                            <span class="material-icons">zoom_in</span>
                          </span>
                        }
                      </div>
                    </div>
                  </article>
                </li>
              }
            </ul>
          </div>
        }

        @if (page.items.length > 0 || page.totalPages > 1) {
          <app-dashboard-pagination-panel
            [page]="toPaginationPage(page)"
            [pageSize]="form.controls.pageSize.value"
            [pageSizeOptions]="pageSizeOptions"
            [disabled]="isLoading()"
            ariaLabel="Media pagination"
            pageSizeLabel="Rows"
            pageSizeSelectId="media-page-size"
            (pageChange)="goToPage($event)"
            (pageSizeChange)="onPageSizeChange($event)"
            (previous)="goToPrevious()"
            (next)="goToNext()"
          />
        }
        </div>
      }

      @if (lightboxFile(); as file) {
        <div class="dashboard-media__lightbox-layer" role="presentation">
          <button
            type="button"
            class="dashboard-media__lightbox-backdrop"
            aria-label="Close preview"
            (click)="closePreview()"
          ></button>

          <div
            class="dashboard-media__lightbox"
            role="dialog"
            aria-modal="true"
            [attr.aria-label]="file.fileName || 'Image preview'"
          >
            <header class="dashboard-media__lightbox-toolbar">
              <p class="dashboard-media__lightbox-title dashboard-editable-text">
                {{ file.fileName || 'Untitled' }}
              </p>
              <div class="dashboard-media__lightbox-tools">
                <button
                  type="button"
                  class="dashboard-media__lightbox-tool"
                  aria-label="Zoom out"
                  matTooltip="Zoom out"
                  matTooltipPosition="below"
                  [disabled]="previewZoom() <= 1"
                  (click)="zoomOut()"
                >
                  <span class="material-icons" aria-hidden="true">zoom_out</span>
                </button>
                <span class="dashboard-media__lightbox-zoom" aria-live="polite">{{ zoomPercent() }}%</span>
                <button
                  type="button"
                  class="dashboard-media__lightbox-tool"
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
                  class="dashboard-media__lightbox-tool"
                  aria-label="Reset zoom"
                  matTooltip="Reset zoom"
                  matTooltipPosition="below"
                  [disabled]="previewZoom() === 1 && previewPan().x === 0 && previewPan().y === 0"
                  (click)="resetPreviewZoom()"
                >
                  <span class="material-icons" aria-hidden="true">fit_screen</span>
                </button>
              </div>
              <button
                type="button"
                class="dashboard-media__lightbox-close"
                aria-label="Close preview"
                matTooltip="Close"
                matTooltipPosition="below"
                (click)="closePreview()"
              >
                <span class="material-icons" aria-hidden="true">close</span>
              </button>
            </header>

            <div
              class="dashboard-media__lightbox-stage"
              [class.dashboard-media__lightbox-stage--panning]="isPreviewPanning()"
              (wheel)="onPreviewWheel($event)"
              (dblclick)="onPreviewDoubleClick($event)"
            >
              @if (previewUrl(file.id); as src) {
                <img
                  class="dashboard-media__lightbox-image"
                  [class.dashboard-media__lightbox-image--draggable]="previewZoom() > 1"
                  [src]="src"
                  [alt]="file.fileName || 'Uploaded image'"
                  [style.transform]="previewTransform()"
                  (mousedown)="onPreviewPanStart($event)"
                />
              }
            </div>

            <p class="dashboard-media__lightbox-hint">Scroll to zoom · Double-click to toggle · Drag when zoomed in</p>
          </div>
        </div>
      }
    </section>
  `,
})
export class DashboardMedia {
  private readonly fileService = inject(UserUploadedFileService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly ngZone = inject(NgZone);
  private readonly fileInput = viewChild<ElementRef<HTMLInputElement>>('fileInput');
  private readonly renameInput = viewChild<ElementRef<HTMLInputElement>>('renameInput');

  protected readonly pageSizeOptions = PAGE_SIZE_OPTIONS;
  protected readonly supportedImageAccept = SUPPORTED_IMAGE_ACCEPT;
  protected readonly fileNameMaxLength = USER_UPLOADED_FILE_NAME_MAX_LENGTH;
  protected readonly toPaginationPage = toPaginationPage;
  protected readonly renameControl = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.maxLength(USER_UPLOADED_FILE_NAME_MAX_LENGTH)],
  });
  protected readonly form: MediaForm = new FormGroup({
    pageNumber: new FormControl(1, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(1)],
    }),
    pageSize: new FormControl(24, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(1), Validators.max(100)],
    }),
  });

  protected readonly isLoading = signal(false);
  protected readonly isUploading = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly uploadMessage = signal<string | null>(null);
  protected readonly uploadError = signal(false);
  protected readonly result = signal<PagedUserUploadedFilesResponse | null>(null);
  protected readonly dragActive = signal(false);
  protected readonly lightboxFile = signal<UserUploadedFileItem | null>(null);
  protected readonly previewUrls = signal<Record<string, string>>({});
  protected readonly previewZoom = signal(1);
  protected readonly previewPan = signal({ x: 0, y: 0 });
  protected readonly isPreviewPanning = signal(false);
  protected readonly renamingFileId = signal<string | null>(null);
  protected readonly isSavingRename = signal(false);
  protected readonly renameError = signal<string | null>(null);
  protected readonly zoomPercent = computed(() => Math.round(this.previewZoom() * 100));
  protected readonly maxPreviewZoom = 4;

  private dragDepth = 0;
  private readonly previewObjectUrls = new Set<string>();
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
    this.loadFiles();

    this.destroyRef.onDestroy(() => {
      this.detachPanListeners();
      this.revokePreviewUrls();
    });
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    if (this.renamingFileId()) {
      this.cancelRename();
      return;
    }

    this.closePreview();
  }

  protected previewUrl(fileId: string): string | null {
    return this.previewUrls()[fileId] ?? null;
  }

  protected isRenaming(fileId: string): boolean {
    return this.renamingFileId() === fileId;
  }

  protected startRename(file: UserUploadedFileItem, event?: Event): void {
    event?.stopPropagation();
    event?.preventDefault();
    this.renamingFileId.set(file.id);
    this.renameControl.setValue(file.fileName ?? '');
    this.renameControl.markAsPristine();
    this.renameError.set(null);

    queueMicrotask(() => {
      const input = this.renameInput()?.nativeElement;
      input?.focus();
      input?.select();
    });
  }

  protected cancelRename(event?: Event): void {
    event?.stopPropagation();
    event?.preventDefault();
    this.renamingFileId.set(null);
    this.renameControl.reset();
    this.renameError.set(null);
    this.isSavingRename.set(false);
  }

  protected saveRename(event?: Event): void {
    event?.stopPropagation();
    event?.preventDefault();

    const fileId = this.renamingFileId();
    const fileName = this.renameControl.value.trim();
    if (!fileId || this.renameControl.invalid || this.isSavingRename()) {
      return;
    }

    const current = this.result()?.items.find((item) => item.id === fileId);
    if (current?.fileName === fileName) {
      this.cancelRename();
      return;
    }

    this.isSavingRename.set(true);
    this.renameError.set(null);

    this.fileService
      .updateFile({ id: fileId, fileName })
      .pipe(finalize(() => this.isSavingRename.set(false)))
      .subscribe({
        next: (updated) => {
          this.applyRenamedFile(updated);
          this.cancelRename();
        },
        error: (error) => {
          this.renameError.set(toApplicationError(error, 'Could not rename file.').description);
        },
      });
  }

  protected onFileInputChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = input.files ? Array.from(input.files) : [];
    input.value = '';
    this.uploadSelectedFiles(files);
  }

  protected onDragEnter(event: DragEvent): void {
    event.preventDefault();
    this.dragDepth += 1;
    this.dragActive.set(true);
  }

  protected onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.dragActive.set(true);
  }

  protected onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.dragDepth = Math.max(0, this.dragDepth - 1);
    if (this.dragDepth === 0) {
      this.dragActive.set(false);
    }
  }

  protected onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragDepth = 0;
    this.dragActive.set(false);

    const files = event.dataTransfer?.files ? Array.from(event.dataTransfer.files) : [];
    this.uploadSelectedFiles(files);
  }

  protected openPreview(file: UserUploadedFileItem): void {
    this.resetPreviewZoom();
    this.ensurePreview(file);
    this.lightboxFile.set(file);
  }

  protected closePreview(): void {
    this.cancelRename();
    this.lightboxFile.set(null);
    this.resetPreviewZoom();
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

  protected onPageSizeChange(pageSize = this.form.controls.pageSize.value): void {
    this.form.patchValue({ pageNumber: 1, pageSize });
    this.loadFiles();
  }

  protected listShowingFrom(page: PagedUserUploadedFilesResponse): number {
    return showingFrom(toPaginationPage(page), this.form.controls.pageSize.value);
  }

  protected listShowingTo(page: PagedUserUploadedFilesResponse): number {
    return showingTo(toPaginationPage(page), this.form.controls.pageSize.value);
  }

  protected goToPrevious(): void {
    const page = this.result();
    if (!page?.hasPreviousPage) {
      return;
    }
    this.goToPage(page.pageIndex - 1);
  }

  protected goToNext(): void {
    const page = this.result();
    if (!page?.hasNextPage) {
      return;
    }
    this.goToPage(page.pageIndex + 1);
  }

  protected goToPage(pageNumber: number): void {
    const page = this.result();
    if (!page || pageNumber === page.pageIndex || pageNumber < 1 || pageNumber > page.totalPages) {
      return;
    }

    this.form.patchValue({ pageNumber });
    this.loadFiles();
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

  private uploadSelectedFiles(files: File[]): void {
    const images = files.filter((file) => isSupportedImageFile(file));
    if (images.length === 0) {
      this.uploadError.set(true);
      this.uploadMessage.set('Choose at least one image file to upload.');
      return;
    }

    if (images.length < files.length) {
      this.uploadError.set(true);
      this.uploadMessage.set('Some files were skipped because only images are supported.');
    } else {
      this.uploadError.set(false);
      this.uploadMessage.set(null);
    }

    this.isUploading.set(true);

    this.fileService
      .uploadFiles(images)
      .pipe(finalize(() => this.isUploading.set(false)))
      .subscribe({
        next: (uploaded) => {
          this.uploadError.set(false);
          this.uploadMessage.set(
            uploaded.length === 1 ? 'Image uploaded successfully.' : `${uploaded.length} images uploaded successfully.`
          );
          this.form.patchValue({ pageNumber: 1 });
          this.loadFiles();
        },
        error: (error) => {
          this.uploadError.set(true);
          this.uploadMessage.set(toApplicationError(error, 'Could not upload images.').description);
        },
      });
  }

  private loadFiles(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const pageNumber = this.form.controls.pageNumber.value;
    const pageSize = this.form.controls.pageSize.value;

    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.fileService
      .getFiles(pageNumber, pageSize, { sortBy: 'CreatedAt', isAscending: false })
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe({
        next: (response) => {
          this.result.set(response);
          this.form.patchValue({ pageNumber: response.pageIndex }, { emitEvent: false });
          this.syncPreviews(response.items);
        },
        error: (error) => {
          this.result.set(null);
          this.errorMessage.set(toApplicationError(error, 'Could not load media.').description);
        },
      });
  }

  private syncPreviews(items: UserUploadedFileItem[]): void {
    const nextIds = new Set(items.map((item) => item.id));
    const current = { ...this.previewUrls() };

    for (const [fileId, objectUrl] of Object.entries(current)) {
      if (!nextIds.has(fileId)) {
        URL.revokeObjectURL(objectUrl);
        this.previewObjectUrls.delete(objectUrl);
        delete current[fileId];
      }
    }

    this.previewUrls.set(current);

    for (const item of items) {
      this.ensurePreview(item);
    }
  }

  private ensurePreview(file: UserUploadedFileItem): void {
    if (this.previewUrls()[file.id]) {
      return;
    }

    this.fileService
      .downloadFile(file.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (blob) => {
          const objectUrl = URL.createObjectURL(blob);
          this.previewObjectUrls.add(objectUrl);
          this.previewUrls.update((current) => ({ ...current, [file.id]: objectUrl }));
        },
        error: () => {
          // Preview stays as placeholder when download fails.
        },
      });
  }

  private applyRenamedFile(updated: UserUploadedFileItem): void {
    this.result.update((page) => {
      if (!page) {
        return page;
      }

      return {
        ...page,
        items: page.items.map((item) => (item.id === updated.id ? updated : item)),
      };
    });

    const lightbox = this.lightboxFile();
    if (lightbox?.id === updated.id) {
      this.lightboxFile.set(updated);
    }
  }

  private revokePreviewUrls(): void {
    for (const objectUrl of this.previewObjectUrls) {
      URL.revokeObjectURL(objectUrl);
    }
    this.previewObjectUrls.clear();
    this.previewUrls.set({});
  }
}
