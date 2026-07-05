import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  inject,
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
  USER_UPLOADED_FILE_DESCRIPTION_MAX_LENGTH,
  USER_UPLOADED_FILE_NAME_MAX_LENGTH,
  normalizeUserUploadedFileDescription,
  displayUserUploadedFileDescription,
  hasUserUploadedFileDescription,
  toUserUploadedFileUpdateRequest,
  type PagedUserUploadedFilesResponse,
  type UserUploadedFileItem,
} from '../../../models/user-uploaded-file';
import { UserUploadedFileService } from '../../../services/user-uploaded-file';
import { DisplayDatetimePipe } from '../../../pipes/display-datetime';
import { DashboardPaginationPanel } from '../shared/dashboard-pagination-panel/dashboard-pagination-panel';
import { showingFrom, showingTo, toPaginationPage } from '../shared/pagination';
import { PageLoading } from '../../../components/page-loading/page-loading';
import { PageRevealDirective } from '../../../directives/page-reveal';
import { DashboardDeleteButton } from '../shared/dashboard-delete-button/dashboard-delete-button';
import { DashboardDeleteConfirmService } from '../shared/dashboard-delete-confirm-sheet/dashboard-delete-confirm.service';
import { AutoExpandTextarea } from '../../../components/auto-expand-textarea/auto-expand-textarea';
import { DashboardImageLightbox } from '../shared/dashboard-image-lightbox/dashboard-image-lightbox';

const PAGE_SIZE_OPTIONS = [12, 24, 48] as const;
const EDIT_CLOSE_MS = 220;

type MediaForm = FormGroup<{
  pageNumber: FormControl<number>;
  pageSize: FormControl<number>;
}>;

@Component({
  selector: 'app-dashboard-media',
  imports: [
    DisplayDatetimePipe,
    DashboardPaginationPanel,
    ReactiveFormsModule,
    MatTooltip,
    PageLoading,
    PageRevealDirective,
    DashboardDeleteButton,
    AutoExpandTextarea,
    DashboardImageLightbox,
  ],
  styleUrl: './dashboard-media.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="dashboard-content-page dashboard-media" aria-labelledby="dashboard-media-title">
      <div appPageReveal>
      <div class="dashboard-media__intro">
        <header class="dashboard-media__header">
          <div class="dashboard-media__header-row">
            <div class="dashboard-media__header-copy">
              <p class="section-eyebrow dashboard-media__eyebrow">Media</p>
              <h1 id="dashboard-media-title" class="dashboard-media__title">Library</h1>
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
                    <div class="media-card__preview-wrap">
                      <div class="media-card__delete-overlay">
                        <app-dashboard-delete-button
                          size="sm"
                          tone="dark"
                          ariaLabel="Delete image"
                          tooltip="Delete image"
                          [active]="deleteConfirmFileId() === file.id"
                          [disabled]="isMediaBusy()"
                          [ariaExpanded]="deleteConfirmFileId() === file.id"
                          ariaControls="dashboard-delete-sheet-title"
                          (clicked)="requestDelete(file, $event)"
                        />
                      </div>
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
                    </div>

                    <div class="media-card__foot">
                      <div class="media-card__meta">
                        @if (isRenaming(file.id)) {
                          <div class="media-card__edit" [class.media-card__edit--closing]="renameClosing()">
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
                          <div class="media-card__description media-card__description--edit">
                            <app-auto-expand-textarea
                              #descriptionInput
                              variant="field"
                              [id]="'media-description-' + file.id"
                              [formControl]="descriptionControl"
                              [maxLength]="descriptionMaxLength"
                              ariaLabel="Image description"
                              placeholder="Add a short description for this image…"
                              [escapeCancels]="true"
                              (escaped)="cancelRename()"
                            />
                            <p class="dashboard-edit-hint media-card__description-hint">
                              {{ descriptionControl.value.length }}/{{ descriptionMaxLength }} · Esc to cancel
                            </p>
                            @if (descriptionError()) {
                              <p class="field__error media-card__description-error" role="alert">
                                {{ descriptionError() }}
                              </p>
                            }
                          </div>
                          </div>
                        } @else {
                          <div
                            class="media-card__read"
                            [class.dashboard-edit-read-in]="renameReadEnterFileId() === file.id"
                          >
                          <div class="media-card__meta-head">
                            <p class="dashboard-editable-text media-card__name" [title]="file.fileName || 'Untitled'">
                              {{ file.fileName || 'Untitled' }}
                            </p>
                            <p class="media-card__date">
                              <time [attr.datetime]="file.createdAt">{{ file.createdAt | displayDatetime }}</time>
                            </p>
                          </div>
                          <p
                            class="media-card__description-text"
                            [class.media-card__description-text--empty]="!hasUserUploadedFileDescription(file.description)"
                          >
                            {{ displayUserUploadedFileDescription(file.description) }}
                          </p>
                          </div>
                        }
                      </div>

                      <div
                        class="media-card__actions"
                        [class.media-card__actions--edit]="isRenaming(file.id)"
                        [class.media-card__actions--edit--closing]="renameClosing() && isRenaming(file.id)"
                      >
                        @if (isRenaming(file.id)) {
                          <button
                            type="button"
                            class="media-card__icon-btn media-card__icon-btn--confirm"
                            aria-label="Save name and description"
                            matTooltip="Save"
                            matTooltipPosition="left"
                            [disabled]="isSavingRename() || renameControl.invalid || descriptionControl.invalid"
                            (click)="saveRename($event)"
                          >
                            <span class="material-icons" aria-hidden="true">check</span>
                          </button>
                          <button
                            type="button"
                            class="media-card__icon-btn"
                            aria-label="Cancel edit"
                            matTooltip="Cancel"
                            matTooltipPosition="left"
                            [disabled]="isSavingRename()"
                            (click)="cancelRename($event)"
                          >
                            <span class="material-icons" aria-hidden="true">close</span>
                          </button>
                        } @else {
                          <span
                            class="edit-icon"
                            role="button"
                            tabindex="0"
                            matTooltip="Edit name and description"
                            matTooltipPosition="below"
                            [attr.aria-label]="'Edit name and description for ' + (file.fileName || 'image')"
                            (click)="startRename(file, $event)"
                            (keydown.enter)="startRename(file, $event)"
                            (keydown.space)="startRename(file, $event)"
                          >
                            <span class="material-icons edit-icon__glyph" aria-hidden="true">edit</span>
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
        <app-dashboard-image-lightbox
          [title]="file.fileName || 'Untitled'"
          [previewSrc]="previewUrl(file.id)"
          [description]="file.description"
          (closed)="onLightboxClosed()"
        >
          <app-dashboard-delete-button
            lightboxToolbar
            size="sm"
            tone="dark"
            ariaLabel="Delete image"
            tooltip="Delete image"
            [active]="deleteConfirmFileId() === file.id"
            [disabled]="isMediaBusy()"
            [ariaExpanded]="deleteConfirmFileId() === file.id"
            ariaControls="dashboard-delete-sheet-title"
            (clicked)="requestDelete(file, $event)"
          />
        </app-dashboard-image-lightbox>
      }

    </section>
  `,
})
export class DashboardMedia {
  private readonly fileService = inject(UserUploadedFileService);
  private readonly deleteConfirm = inject(DashboardDeleteConfirmService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fileInput = viewChild<ElementRef<HTMLInputElement>>('fileInput');
  private readonly renameInput = viewChild<ElementRef<HTMLInputElement>>('renameInput');
  private readonly descriptionInput = viewChild<AutoExpandTextarea>('descriptionInput');

  protected readonly pageSizeOptions = PAGE_SIZE_OPTIONS;
  protected readonly supportedImageAccept = SUPPORTED_IMAGE_ACCEPT;
  protected readonly fileNameMaxLength = USER_UPLOADED_FILE_NAME_MAX_LENGTH;
  protected readonly descriptionMaxLength = USER_UPLOADED_FILE_DESCRIPTION_MAX_LENGTH;
  protected readonly toPaginationPage = toPaginationPage;
  protected readonly displayUserUploadedFileDescription = displayUserUploadedFileDescription;
  protected readonly hasUserUploadedFileDescription = hasUserUploadedFileDescription;
  protected readonly descriptionControl = new FormControl('', {
    nonNullable: true,
    validators: [Validators.maxLength(USER_UPLOADED_FILE_DESCRIPTION_MAX_LENGTH)],
  });
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
  protected readonly renamingFileId = signal<string | null>(null);
  protected readonly renameClosing = signal(false);
  protected readonly renameReadEnterFileId = signal<string | null>(null);
  protected readonly isSavingRename = signal(false);
  protected readonly renameError = signal<string | null>(null);
  protected readonly descriptionError = signal<string | null>(null);
  protected readonly deleteConfirmFileId = signal<string | null>(null);
  protected readonly isDeleting = signal(false);

  private dragDepth = 0;
  private renameCloseTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly previewObjectUrls = new Set<string>();

  constructor() {
    this.loadFiles();

    this.destroyRef.onDestroy(() => {
      this.clearRenameCloseTimer();
      this.revokePreviewUrls();
    });
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    if (this.renamingFileId() && !this.renameClosing()) {
      this.cancelRename();
      return;
    }

    if (this.lightboxFile()) {
      return;
    }
  }

  protected isMediaBusy(): boolean {
    return (
      this.isSavingRename() ||
      this.isDeleting() ||
      this.isUploading() ||
      this.renameClosing()
    );
  }

  protected previewUrl(fileId: string): string | null {
    return this.previewUrls()[fileId] ?? null;
  }

  protected requestDelete(file: UserUploadedFileItem, event?: Event): void {
    event?.stopPropagation();
    event?.preventDefault();

    if (this.isMediaBusy()) {
      return;
    }

    this.cancelRename(undefined, false);
    this.errorMessage.set(null);
    this.deleteConfirmFileId.set(file.id);

    this.deleteConfirm
      .open({
        title: `Delete “${file.fileName || 'Untitled'}”?`,
        description:
          'This image will be permanently removed from your library. This action cannot be undone.',
        keepLabel: 'Keep image',
        deleteLabel: 'Delete image',
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((confirmed) => {
        this.deleteConfirmFileId.set(null);
        if (confirmed) {
          this.performDelete(file.id);
        }
      });
  }

  private performDelete(fileId: string): void {
    if (this.isDeleting()) {
      return;
    }

    this.isDeleting.set(true);
    this.errorMessage.set(null);

    this.fileService
      .deleteFile(fileId)
      .pipe(finalize(() => this.isDeleting.set(false)))
      .subscribe({
        next: () => {
          this.removeDeletedFile(fileId);
        },
        error: (error) => {
          this.errorMessage.set(toApplicationError(error, 'Could not delete image.').description);
        },
      });
  }

  protected isRenaming(fileId: string): boolean {
    return this.renamingFileId() === fileId;
  }

  protected startRename(file: UserUploadedFileItem, event?: Event): void {
    event?.stopPropagation();
    event?.preventDefault();

    if (this.isMediaBusy()) {
      return;
    }

    this.clearRenameCloseTimer();
    this.renameClosing.set(false);
    this.renamingFileId.set(file.id);
    this.renameControl.setValue(file.fileName ?? '');
    this.renameControl.markAsPristine();
    this.descriptionControl.setValue((file.description ?? '').trim());
    this.descriptionControl.markAsPristine();
    this.renameError.set(null);
    this.descriptionError.set(null);

    queueMicrotask(() => {
      const input = this.renameInput()?.nativeElement;
      input?.focus();
      input?.select();
      this.descriptionInput()?.scheduleLayout();
    });
  }

  protected cancelRename(event?: Event, animated = true): void {
    event?.stopPropagation();
    event?.preventDefault();

    if (!this.renamingFileId() || this.renameClosing()) {
      return;
    }

    if (!animated) {
      this.finishRenameEdit();
      return;
    }

    this.renameClosing.set(true);
    this.clearRenameCloseTimer();
    this.renameCloseTimer = setTimeout(() => {
      this.renameCloseTimer = null;
      this.finishRenameEdit(true);
    }, EDIT_CLOSE_MS);
  }

  private finishRenameEdit(animateRead = false): void {
    const fileId = this.renamingFileId();
    this.renameClosing.set(false);
    this.renamingFileId.set(null);
    this.renameControl.reset();
    this.descriptionControl.reset();
    this.renameError.set(null);
    this.descriptionError.set(null);
    this.isSavingRename.set(false);

    if (animateRead && fileId) {
      this.renameReadEnterFileId.set(fileId);
      setTimeout(() => {
        if (this.renameReadEnterFileId() === fileId) {
          this.renameReadEnterFileId.set(null);
        }
      }, EDIT_CLOSE_MS);
    }
  }

  private clearRenameCloseTimer(): void {
    if (this.renameCloseTimer !== null) {
      clearTimeout(this.renameCloseTimer);
      this.renameCloseTimer = null;
    }
  }

  protected saveRename(event?: Event): void {
    event?.stopPropagation();
    event?.preventDefault();

    const fileId = this.renamingFileId();
    const fileName = this.renameControl.value.trim();
    const normalizedDescription = normalizeUserUploadedFileDescription(this.descriptionControl.value);
    if (
      !fileId ||
      this.renameControl.invalid ||
      this.descriptionControl.invalid ||
      this.isSavingRename()
    ) {
      return;
    }

    const current = this.result()?.items.find((item) => item.id === fileId);
    if (!current) {
      return;
    }

    if (current.fileName === fileName && (current.description ?? null) === normalizedDescription) {
      this.cancelRename();
      return;
    }

    this.isSavingRename.set(true);
    this.renameError.set(null);
    this.descriptionError.set(null);

    this.fileService
      .updateFile(
        toUserUploadedFileUpdateRequest(current, {
          fileName,
          description: normalizedDescription,
        }),
      )
      .pipe(finalize(() => this.isSavingRename.set(false)))
      .subscribe({
        next: (updated) => {
          this.applyUpdatedFile(updated);
          this.cancelRename();
        },
        error: (error) => {
          this.renameError.set(toApplicationError(error, 'Could not save changes.').description);
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
    if (this.isMediaBusy()) {
      return;
    }

    this.cancelRename(undefined, false);
    this.ensurePreview(file);
    this.lightboxFile.set(file);
  }

  protected onLightboxClosed(): void {
    this.cancelRename(undefined, false);
    if (!this.isDeleting()) {
      this.deleteConfirmFileId.set(null);
    }
    this.lightboxFile.set(null);
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

  private applyUpdatedFile(updated: UserUploadedFileItem): void {
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

  private removeDeletedFile(fileId: string): void {
    const currentUrl = this.previewUrls()[fileId];
    if (currentUrl) {
      URL.revokeObjectURL(currentUrl);
      this.previewObjectUrls.delete(currentUrl);
      this.previewUrls.update((urls) => {
        const next = { ...urls };
        delete next[fileId];
        return next;
      });
    }

    if (this.lightboxFile()?.id === fileId) {
      this.lightboxFile.set(null);
    }

    const page = this.result();
    if (!page) {
      return;
    }

    const items = page.items.filter((item) => item.id !== fileId);
    if (items.length === page.items.length) {
      return;
    }

    if (items.length === 0) {
      if (page.pageIndex > 1) {
        this.form.patchValue({ pageNumber: page.pageIndex - 1 });
      }
      this.loadFiles();
      return;
    }

    this.result.set({
      ...page,
      items,
    });
  }

  private revokePreviewUrls(): void {
    for (const objectUrl of this.previewObjectUrls) {
      URL.revokeObjectURL(objectUrl);
    }
    this.previewObjectUrls.clear();
    this.previewUrls.set({});
  }
}
