import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltip } from '@angular/material/tooltip';
import { Component, DestroyRef, ElementRef, HostListener, inject, signal, viewChild } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { EMPTY, finalize, map, switchMap } from 'rxjs';
import { toApplicationError } from '../../../models/application-error';
import {
  normalizePostTitle,
  normalizePostBody,
  parseHashtagSegments,
  POST_BODY_MAX_LENGTH,
  POST_TITLE_MAX_LENGTH,
  type PostItem,
} from '../../../models/post';
import { GEMINI_DEFAULT_MODEL } from '../../../models/gemini';
import { GeminiService } from '../../../services/gemini';
import { PostService } from '../../../services/post';
import {
  DEFAULT_POSTS_LIST_QUERY,
  postsListQueryToParams,
  readPostsListQueryFromHistory,
} from '../dashboard-posts/posts-list-query';

import { POST_BODY_EMOJIS } from '../shared/post-body-emojis';
import { createTypewriter } from '../shared/typewriter-text';

type EditableField = 'title' | 'body';

const SAVE_MESSAGE_DURATION_MS = 5000;

type PostForm = FormGroup<{
  title: FormControl<string>;
  body: FormControl<string>;
}>;

@Component({
  selector: 'app-dashboard-post-detail',
  imports: [RouterLink, DatePipe, ReactiveFormsModule, MatTooltip, MatButtonModule, NgTemplateOutlet],
  styleUrl: './dashboard-post-detail.scss',
  template: `
    <section class="dashboard-content-page post-detail" aria-labelledby="post-detail-title">
      <header class="post-detail__header">
        <div class="post-detail__top">
          <a
            [routerLink]="['/dashboard/posts']"
            [queryParams]="postsReturnQueryParams()"
            class="section-eyebrow post-detail__eyebrow"
          >
            ← Back to posts
          </a>

          @if (post(); as item) {
            <div class="post-detail__top-end">
              <div class="post-detail__meta-group">
                <span class="post-detail__status-badge">{{ item.status }}</span>
                <p class="post-detail__meta">
                  <time [attr.datetime]="item.createdAt">{{ item.createdAt | date: 'medium' }}</time>
                </p>
              </div>

              <button
                type="button"
                class="post-detail__delete-btn"
                [class.post-detail__delete-btn--active]="deleteConfirmOpen()"
                matTooltip="Delete post"
                matTooltipPosition="below"
                aria-label="Delete post"
                [attr.aria-expanded]="deleteConfirmOpen()"
                aria-controls="post-delete-confirm"
                [disabled]="isActionLocked()"
                (click)="requestDelete()"
              >
                <span class="material-icons" aria-hidden="true">delete</span>
              </button>
            </div>
          }
        </div>

        <p class="post-detail__save-status" aria-live="polite">{{ saveMessage() }}</p>

        @if (post(); as item) {
          @if (editingField() === 'title') {
            <div class="post-detail__edit-panel" [formGroup]="form">
              <textarea
                #titleInput
                id="post-title"
                class="field__input field__input--title"
                formControlName="title"
                rows="2"
                maxlength="{{ titleMaxLength }}"
                autocomplete="off"
                aria-describedby="post-title-hint post-title-error"
                (input)="onTitleInput()"
              ></textarea>
              <div class="post-detail__edit-foot">
                <p id="post-title-hint" class="post-detail__hint">
                  {{ form.controls.title.value.length }}/{{ titleMaxLength }} · Esc to cancel
                </p>
                @if (form.controls.title.touched && form.controls.title.hasError('required')) {
                  <p id="post-title-error" class="field__error" role="alert">Title is required.</p>
                }
                @if (form.controls.title.touched && form.controls.title.hasError('maxlength')) {
                  <p id="post-title-error" class="field__error" role="alert">
                    Title cannot exceed {{ titleMaxLength }} characters.
                  </p>
                }
                <ng-container
                  *ngTemplateOutlet="editActions; context: { $implicit: 'title', control: form.controls.title }"
                />
              </div>
            </div>
          } @else {
            <h1 id="post-detail-title" class="post-detail__title">
              <span class="post-detail__title-text">{{ item.title || 'Untitled' }}</span>
              <ng-container
                *ngTemplateOutlet="editIcon; context: { $implicit: 'title', label: 'Edit title' }"
              />
            </h1>
          }
        } @else {
          <h1 id="post-detail-title" class="post-detail__title">Post</h1>
        }
      </header>

      @if (isLoading()) {
        <p class="posts-status" aria-live="polite">Loading post…</p>
      }

      @if (errorMessage()) {
        <p class="posts-status posts-status--error" role="alert">{{ errorMessage() }}</p>
      }

      @if (post(); as item) {
        <div class="post-detail__sections">
          @if (deleteConfirmOpen()) {
            <section
              #deleteConfirm
              id="post-delete-confirm"
              class="post-detail__delete-confirm"
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="post-delete-title"
              aria-describedby="post-delete-desc"
            >
              <div class="post-detail__delete-confirm-main">
                <div class="post-detail__delete-confirm-badge" aria-hidden="true">
                  <span class="material-icons">delete_outline</span>
                </div>
                <div class="post-detail__delete-confirm-copy">
                  <p class="post-detail__delete-confirm-eyebrow">Confirm deletion</p>
                  <h2 id="post-delete-title" class="post-detail__delete-confirm-title">
                    Delete “{{ item.title || 'Untitled' }}”?
                  </h2>
                  <p id="post-delete-desc" class="post-detail__delete-confirm-desc">
                    This post will be permanently removed from your workspace. This action cannot be undone.
                  </p>
                </div>
              </div>
              <div class="post-detail__delete-confirm-actions">
                <button
                  type="button"
                  class="btn btn--secondary btn--compact"
                  [disabled]="isDeleting()"
                  (click)="cancelDelete()"
                >
                  Keep post
                </button>
                <button
                  type="button"
                  class="btn btn--danger btn--compact"
                  [disabled]="isDeleting()"
                  (click)="confirmDelete()"
                >
                  {{ isDeleting() ? 'Deleting…' : 'Delete post' }}
                </button>
              </div>
            </section>
          }

          @if (item.promptText) {
            <section class="post-detail__card post-detail__card--prompt" aria-labelledby="post-detail-prompt">
              <div class="post-detail__card-head">
                <p id="post-detail-prompt" class="post-detail__card-label">Prompt</p>
                <p class="post-detail__card-hint">Original idea used to generate this post</p>
              </div>
              <div class="post-detail__card-body">
                <p class="post-detail__body-text post-detail__body-text--prompt"><ng-container *ngTemplateOutlet="hashtagText; context: { text: item.promptText }" /></p>
              </div>
            </section>
          }

          <section class="post-detail__card post-detail__card--content" aria-labelledby="post-detail-body">
            <div class="post-detail__card-head post-detail__card-head--row">
              <div>
                <p id="post-detail-body" class="post-detail__card-label">Content</p>
                <p class="post-detail__card-hint">What will be published</p>
              </div>
              <div class="post-detail__card-actions">
                <div class="post-detail__gemini-anchor" #geminiAnchor>
                  <button
                    type="button"
                    class="post-detail__gemini-btn"
                    [class.post-detail__gemini-btn--active]="geminiPopupOpen()"
                    [class.post-detail__gemini-btn--busy]="isGenerating() || isTyping()"
                    matTooltip="Generate with AI"
                    matTooltipPosition="below"
                    aria-label="Generate content with AI"
                    [attr.aria-expanded]="geminiPopupOpen()"
                    aria-controls="post-gemini-popup"
                    [disabled]="!canUseGemini()"
                    (click)="toggleGeminiPopup($event)"
                  >
                    <span class="post-detail__gemini-btn-icon" aria-hidden="true">
                      <span class="material-icons">auto_awesome</span>
                    </span>
                    <span class="post-detail__gemini-btn-label">Generate</span>
                  </button>

                  @if (geminiPopupOpen()) {
                    <div
                      id="post-gemini-popup"
                      class="gemini-popup"
                      role="dialog"
                      aria-label="Generate content with AI"
                      (click)="$event.stopPropagation()"
                    >
                      <div class="gemini-popup__head">
                        <span class="gemini-popup__badge" aria-hidden="true">
                          <span class="material-icons">auto_awesome</span>
                        </span>
                        <div>
                          <p class="gemini-popup__title">AI content</p>
                          <p class="gemini-popup__subtitle">Describe what Gemini should write</p>
                        </div>
                      </div>
                      <label class="field__label" for="post-gemini-prompt">Prompt</label>
                      <textarea
                        #geminiPromptInput
                        id="post-gemini-prompt"
                        class="field__input gemini-popup__prompt"
                        rows="4"
                        placeholder="e.g. Short post about bees and ecology, friendly tone, 2–3 paragraphs with hashtags…"
                        [value]="geminiPrompt()"
                        (input)="onGeminiPromptInput($event)"
                      ></textarea>
                      @if (geminiError()) {
                        <p class="field__error gemini-popup__error" role="alert">{{ geminiError() }}</p>
                      }
                      <button
                        type="button"
                        class="gemini-popup__submit"
                        [disabled]="!geminiPrompt().trim()"
                        (click)="generateWithGemini()"
                      >
                        <span class="material-icons" aria-hidden="true">auto_awesome</span>
                        Generate content
                      </button>
                    </div>
                  }
                </div>
                @if (editingField() !== 'body' && !geminiDraftActive()) {
                  <ng-container
                    *ngTemplateOutlet="editIcon; context: { $implicit: 'body', label: 'Edit content' }"
                  />
                }
              </div>
            </div>

            @if (editingField() === 'body' || geminiDraftActive()) {
              <div
                class="post-detail__edit-panel"
                [class.post-detail__edit-panel--ai-writing]="isGenerating() || isTyping()"
                [formGroup]="form"
              >
                <div class="post-detail__body-editor">
                  @if (isGenerating()) {
                    <div class="post-detail__ai-generating" aria-live="polite">
                      <div class="post-detail__ai-generating-orbit" aria-hidden="true">
                        <span class="post-detail__ai-generating-core">
                          <span class="material-icons">auto_awesome</span>
                        </span>
                        <span class="post-detail__ai-generating-ring"></span>
                      </div>
                      <div class="post-detail__ai-generating-bars" aria-hidden="true">
                        <span></span><span></span><span></span><span></span><span></span>
                      </div>
                      <p class="post-detail__ai-generating-label">Gemini is drafting your post…</p>
                      <span class="sr-only">Generating content</span>
                    </div>
                  }
                  <div
                    #bodyHighlight
                    class="post-detail__body-highlight field__input field__input--body"
                    aria-hidden="true"
                  >
                    <ng-container
                      *ngTemplateOutlet="hashtagText; context: { text: bodyHighlightText() }"
                    />
                    @if (isTyping()) {
                      <span class="post-detail__typing-cursor" aria-hidden="true"></span>
                    }
                  </div>
                  <textarea
                    #bodyInput
                    id="post-body"
                    class="field__input field__input--body field__input--body-overlay"
                    formControlName="body"
                    rows="1"
                    maxlength="{{ bodyMaxLength }}"
                    autocomplete="off"
                    aria-describedby="post-body-hint post-body-error"
                    [readonly]="isGenerating() || isTyping()"
                    (input)="onBodyInput()"
                    (scroll)="syncBodyHighlightScroll()"
                  ></textarea>
                </div>
                <div class="post-detail__edit-foot">
                  <div class="post-detail__edit-meta">
                    <p id="post-body-hint" class="post-detail__hint" aria-live="polite">
                      @if (isTyping()) {
                        AI is writing into content…
                      } @else {
                        {{ form.controls.body.value.length }}/{{ bodyMaxLength }} · Esc to cancel
                      }
                    </p>
                    <div class="post-detail__emoji-anchor" #emojiAnchor>
                      <button
                        mat-icon-button
                        type="button"
                        class="post-detail__emoji-trigger"
                        [class.post-detail__emoji-trigger--open]="emojiPickerOpen()"
                        matTooltip="Insert emoji"
                        aria-label="Insert emoji"
                        [attr.aria-expanded]="emojiPickerOpen()"
                        aria-controls="post-body-emoji-picker"
                        [disabled]="isGenerating() || isTyping()"
                        (click)="toggleEmojiPicker($event)"
                      >
                        <span class="material-icons" aria-hidden="true">sentiment_satisfied_alt</span>
                      </button>
                      @if (emojiPickerOpen()) {
                        <div
                          id="post-body-emoji-picker"
                          class="emoji-picker"
                          role="group"
                          aria-label="Emoji picker"
                        >
                          @for (emoji of contentEmojis; track emoji) {
                            <button
                              type="button"
                              class="emoji-picker__option"
                              [attr.aria-label]="'Insert ' + emoji"
                              (click)="insertBodyEmoji(emoji)"
                            >
                              {{ emoji }}
                            </button>
                          }
                        </div>
                      }
                    </div>
                  </div>
                  @if (form.controls.body.touched && form.controls.body.hasError('maxlength')) {
                    <p id="post-body-error" class="field__error" role="alert">
                      Content cannot exceed {{ bodyMaxLength }} characters.
                    </p>
                  }
                  @if (geminiDraftActive() && geminiError()) {
                    <p class="field__error" role="alert">{{ geminiError() }}</p>
                  }
                  <ng-container
                    *ngTemplateOutlet="editActions; context: { $implicit: 'body', control: form.controls.body }"
                  />
                </div>
              </div>
            } @else {
              <div class="post-detail__card-body">
                @if (item.body) {
                  <p class="post-detail__body-text"><ng-container *ngTemplateOutlet="hashtagText; context: { text: item.body }" /></p>
                } @else {
                  <p class="post-detail__body-text post-detail__body-text--empty">
                    No content yet. Click the edit icon to add your post body.
                  </p>
                }
              </div>
            }
          </section>
        </div>
      }
    </section>

    <ng-template #hashtagText let-text="text">
      @for (segment of hashtagSegments(text); track $index) {
        @if (segment.highlighted) {
          <span class="hashtag">{{ segment.text }}</span>
        } @else {
          <span>{{ segment.text }}</span>
        }
      }
    </ng-template>

    <ng-template #editIcon let-field let-label="label">
      <span
        class="edit-icon"
        role="button"
        tabindex="0"
        [attr.aria-label]="label"
        matTooltip="Edit"
        matTooltipPosition="below"
        [matTooltipDisabled]="isActionLocked()"
        [class.edit-icon--disabled]="isActionLocked()"
        [attr.aria-disabled]="isActionLocked() ? true : null"
        (click)="onEditIconActivate($event, field)"
        (keydown.enter)="onEditIconActivate($event, field)"
        (keydown.space)="onEditIconActivate($event, field)"
      >
        <span class="material-icons edit-icon__glyph" aria-hidden="true">edit</span>
      </span>
    </ng-template>

    <ng-template #editActions let-field let-control="control">
      <div class="post-detail__inline-actions">
        <button
          type="button"
          class="btn btn--primary btn--compact"
          [disabled]="isSaving() || control.invalid || isGenerating() || isTyping()"
          (click)="saveField(field)"
        >
          {{ isSaving() ? 'Saving…' : 'Save' }}
        </button>
        <button
          type="button"
          class="btn btn--secondary btn--compact"
          [disabled]="isSaving() || isGenerating() || isTyping()"
          (click)="cancelEdit()"
        >
          Cancel
        </button>
      </div>
    </ng-template>
  `,
})
export class DashboardPostDetail {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly postService = inject(PostService);
  private readonly geminiService = inject(GeminiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly titleInput = viewChild<ElementRef<HTMLTextAreaElement>>('titleInput');
  private readonly bodyInput = viewChild<ElementRef<HTMLTextAreaElement>>('bodyInput');
  private readonly bodyHighlight = viewChild<ElementRef<HTMLDivElement>>('bodyHighlight');
  private readonly emojiAnchor = viewChild<ElementRef<HTMLElement>>('emojiAnchor');
  private readonly geminiAnchor = viewChild<ElementRef<HTMLElement>>('geminiAnchor');
  private readonly deleteConfirmPanel = viewChild<ElementRef<HTMLElement>>('deleteConfirm');
  private readonly geminiPromptInput = viewChild<ElementRef<HTMLTextAreaElement>>('geminiPromptInput');
  private saveMessageTimeout: ReturnType<typeof setTimeout> | undefined;
  private stopTypewriter: (() => void) | undefined;
  private bodyInputObserver: ResizeObserver | undefined;
  private bodyBeforeGemini = '';
  private wasEditingBodyBeforeGemini = false;

  protected readonly titleMaxLength = POST_TITLE_MAX_LENGTH;
  protected readonly bodyMaxLength = POST_BODY_MAX_LENGTH;
  protected readonly contentEmojis = POST_BODY_EMOJIS;
  protected readonly hashtagSegments = parseHashtagSegments;
  protected readonly form: PostForm = new FormGroup({
    title: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(POST_TITLE_MAX_LENGTH)],
    }),
    body: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(POST_BODY_MAX_LENGTH)],
    }),
  });

  protected readonly post = signal<PostItem | null>(null);
  protected readonly editingField = signal<EditableField | null>(null);
  protected readonly isLoading = signal(true);
  protected readonly isSaving = signal(false);
  protected readonly isDeleting = signal(false);
  protected readonly deleteConfirmOpen = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly saveMessage = signal<string | null>(null);
  protected readonly emojiPickerOpen = signal(false);
  protected readonly geminiPopupOpen = signal(false);
  protected readonly geminiDraftActive = signal(false);
  protected readonly geminiPrompt = signal('');
  protected readonly isGenerating = signal(false);
  protected readonly isTyping = signal(false);
  protected readonly geminiError = signal<string | null>(null);
  protected readonly bodyHighlightText = signal('');
  protected readonly postsReturnQueryParams = signal(
    postsListQueryToParams(readPostsListQueryFromHistory() ?? DEFAULT_POSTS_LIST_QUERY)
  );

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.clearSaveMessage();
      this.stopGeminiTypewriter();
      this.disconnectBodyInputObserver();
    });

    this.route.paramMap
      .pipe(
        map((params) => Number(params.get('id'))),
        switchMap((id) => {
          this.resetView();

          if (!Number.isFinite(id) || id <= 0) {
            this.isLoading.set(false);
            this.errorMessage.set('Invalid post.');
            return EMPTY;
          }

          this.isLoading.set(true);
          this.errorMessage.set(null);

          return this.postService.getPost(id).pipe(finalize(() => this.isLoading.set(false)));
        })
      )
      .subscribe({
        next: (item) => this.setPost(item),
        error: (error) => {
          this.post.set(null);
          this.errorMessage.set(toApplicationError(error, 'Could not load post.').description);
        },
      });
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    if (this.geminiPopupOpen()) {
      this.geminiPopupOpen.set(false);
      return;
    }

    if (this.emojiPickerOpen()) {
      this.emojiPickerOpen.set(false);
      return;
    }

    if (this.deleteConfirmOpen() && !this.isDeleting()) {
      this.cancelDelete();
      return;
    }

    if (this.editingField() !== null && !this.isSaving() && !this.isGenerating() && !this.isTyping()) {
      this.cancelEdit();
    }
  }

  @HostListener('document:click', ['$event'])
  protected onDocumentClick(event: MouseEvent): void {
    const target = event.target as Node;

    if (this.geminiPopupOpen()) {
      const geminiAnchor = this.geminiAnchor()?.nativeElement;
      if (!geminiAnchor?.contains(target)) {
        this.geminiPopupOpen.set(false);
      }
    }

    if (!this.emojiPickerOpen()) {
      return;
    }

    const anchor = this.emojiAnchor()?.nativeElement;
    const bodyInput = this.bodyInput()?.nativeElement;

    if (anchor?.contains(target) || bodyInput?.contains(target)) {
      return;
    }

    this.emojiPickerOpen.set(false);
  }

  protected isActionLocked(): boolean {
    return (
      this.editingField() !== null ||
      this.geminiDraftActive() ||
      this.isSaving() ||
      this.isDeleting() ||
      this.deleteConfirmOpen()
    );
  }

  protected canUseGemini(): boolean {
    return (
      this.post() !== null &&
      !this.geminiDraftActive() &&
      !this.isGenerating() &&
      !this.isTyping() &&
      !this.isSaving() &&
      !this.isDeleting() &&
      !this.deleteConfirmOpen()
    );
  }

  protected toggleGeminiPopup(event: Event): void {
    event.stopPropagation();

    if (!this.canUseGemini()) {
      return;
    }

    if (this.geminiPopupOpen()) {
      this.geminiPopupOpen.set(false);
      return;
    }

    const item = this.post();
    if (!item) {
      return;
    }

    this.emojiPickerOpen.set(false);
    this.clearSaveMessage();
    this.geminiError.set(null);
    this.geminiPrompt.set('');
    this.geminiPopupOpen.set(true);

    queueMicrotask(() => this.geminiPromptInput()?.nativeElement.focus());
  }

  protected onGeminiPromptInput(event: Event): void {
    const value = (event.target as HTMLTextAreaElement).value;
    this.geminiPrompt.set(value);
    this.geminiError.set(null);
  }

  protected generateWithGemini(): void {
    const item = this.post();
    const prompt = this.geminiPrompt().trim();

    if (!item || !prompt || !this.canUseGemini()) {
      return;
    }

    this.geminiPopupOpen.set(false);
    this.geminiError.set(null);
    this.beginGeminiDraft();
    this.isGenerating.set(true);

    this.geminiService
      .generatePost({
        prompt,
        postId: item.id,
        model: GEMINI_DEFAULT_MODEL,
      })
      .pipe(finalize(() => this.isGenerating.set(false)))
      .subscribe({
        next: (text) => {
          this.typeGeminiIntoBody(this.clampBody(text));
        },
        error: (error) => {
          this.geminiError.set(toApplicationError(error, 'Could not generate content.').description);
          this.abortGeminiDraft(true);
        },
      });
  }

  protected requestDelete(): void {
    if (this.isActionLocked()) {
      return;
    }

    this.clearSaveMessage();
    this.errorMessage.set(null);
    this.deleteConfirmOpen.set(true);
    queueMicrotask(() => {
      this.deleteConfirmPanel()?.nativeElement.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    });
  }

  protected cancelDelete(): void {
    if (this.isDeleting()) {
      return;
    }

    this.deleteConfirmOpen.set(false);
  }

  protected confirmDelete(): void {
    const item = this.post();
    if (!item || this.isDeleting()) {
      return;
    }

    this.isDeleting.set(true);
    this.errorMessage.set(null);
    this.clearSaveMessage();

    this.postService
      .deletePost(item.id)
      .pipe(finalize(() => this.isDeleting.set(false)))
      .subscribe({
        next: () => {
          this.router.navigate(['/dashboard/posts'], {
            queryParams: this.postsReturnQueryParams(),
          });
        },
        error: (error) => {
          this.deleteConfirmOpen.set(false);
          this.errorMessage.set(toApplicationError(error, 'Could not delete post.').description);
        },
      });
  }

  protected onEditIconActivate(event: Event, field: EditableField): void {
    if (this.isActionLocked()) {
      return;
    }

    if (event instanceof KeyboardEvent && event.key === ' ') {
      event.preventDefault();
    }

    this.startEdit(field);
  }

  protected onTitleInput(): void {
    this.applyClampedInput(this.form.controls.title, this.clampTitle.bind(this), this.titleInput()?.nativeElement);
  }

  protected insertBodyEmoji(emoji: string): void {
    if (this.editingField() !== 'body') {
      return;
    }

    const control = this.form.controls.body;
    const textarea = this.bodyInput()?.nativeElement;
    if (!textarea) {
      return;
    }

    const start = textarea.selectionStart ?? control.value.length;
    const end = textarea.selectionEnd ?? start;
    const next = this.clampBody(`${control.value.slice(0, start)}${emoji}${control.value.slice(end)}`);

    if (next === control.value) {
      return;
    }

    const nextCursor = Math.min(start + emoji.length, next.length);
    control.setValue(next, { emitEvent: false });
    control.markAsDirty();
    this.syncBodyHighlight(next);

    queueMicrotask(() => {
      textarea.focus();
      textarea.setSelectionRange(nextCursor, nextCursor);
      this.resizeBodyInput();
    });
  }

  protected toggleEmojiPicker(event: Event): void {
    event.stopPropagation();
    this.emojiPickerOpen.update((open) => !open);
  }

  protected onBodyInput(): void {
    this.applyClampedInput(this.form.controls.body, this.clampBody.bind(this), this.bodyInput()?.nativeElement);
    this.syncBodyHighlight();
    this.resizeBodyInput();
  }

  protected syncBodyHighlightScroll(): void {
    const textarea = this.bodyInput()?.nativeElement;
    const highlight = this.bodyHighlight()?.nativeElement;
    if (!textarea || !highlight) {
      return;
    }

    highlight.scrollTop = textarea.scrollTop;
  }

  protected cancelEdit(): void {
    if (this.geminiDraftActive()) {
      this.abortGeminiDraft(false);
      return;
    }

    this.emojiPickerOpen.set(false);
    this.disconnectBodyInputObserver();
    this.editingField.set(null);
    this.clearSaveMessage();
  }

  protected saveField(field: EditableField): void {
    const item = this.post();
    const control = this.form.controls[field];

    if (!item || control.invalid || this.isGenerating() || this.isTyping()) {
      control.markAsTouched();
      return;
    }

    const title =
      field === 'title' ? this.clampTitle(control.value.trim()) : this.clampTitle(item.title);
    const body =
      field === 'body' ? this.clampBody(control.value.trim()) : this.clampBody(item.body);

    this.isSaving.set(true);
    this.errorMessage.set(null);
    this.clearSaveMessage();

    this.postService
      .updatePost(item.id, { title, body })
      .pipe(finalize(() => this.isSaving.set(false)))
      .subscribe({
        next: (updated) => {
          this.disconnectBodyInputObserver();
          this.geminiDraftActive.set(false);
          this.setPost(updated);
          this.editingField.set(null);
          this.showSaveMessage(field === 'title' ? 'Title saved.' : 'Content saved.');
        },
        error: (error) => {
          this.errorMessage.set(toApplicationError(error, 'Could not save post.').description);
        },
      });
  }

  private startEdit(field: EditableField): void {
    const item = this.post();
    if (!item) {
      return;
    }

    this.clearSaveMessage();
    this.errorMessage.set(null);
    this.editingField.set(field);
    this.form.patchValue({
      title: this.clampTitle(item.title),
      body: this.clampBody(item.body),
    });
    this.syncBodyHighlight(this.clampBody(item.body));
    this.form.controls[field].markAsPristine();
    this.form.controls[field].markAsUntouched();
    this.focusField(field);

    if (field === 'body') {
      this.observeBodyInput();
    }
  }

  private resetView(): void {
    this.disconnectBodyInputObserver();
    this.stopGeminiTypewriter();
    this.post.set(null);
    this.editingField.set(null);
    this.deleteConfirmOpen.set(false);
    this.geminiPopupOpen.set(false);
    this.geminiDraftActive.set(false);
    this.isGenerating.set(false);
    this.isTyping.set(false);
    this.geminiError.set(null);
    this.bodyBeforeGemini = '';
    this.wasEditingBodyBeforeGemini = false;
    this.isDeleting.set(false);
    this.clearSaveMessage();
    this.form.reset({ title: '', body: '' });
    this.bodyHighlightText.set('');
  }

  private setPost(item: PostItem): void {
    const title = this.clampTitle(item.title);
    const body = this.clampBody(item.body);
    this.post.set({
      ...item,
      title: title || null,
      body: body || null,
    });
    this.form.reset({ title, body });
    this.syncBodyHighlight(body);
  }

  private focusField(field: EditableField): void {
    queueMicrotask(() => {
      const input =
        field === 'title' ? this.titleInput()?.nativeElement : this.bodyInput()?.nativeElement;
      input?.focus();
      input?.setSelectionRange(input.value.length, input.value.length);

      if (field === 'body') {
        requestAnimationFrame(() => this.resizeBodyInput());
      }
    });
  }

  private observeBodyInput(): void {
    const textarea = this.bodyInput()?.nativeElement;
    if (!textarea) {
      return;
    }

    this.disconnectBodyInputObserver();
    this.bodyInputObserver = new ResizeObserver(() => this.resizeBodyInput());
    this.bodyInputObserver.observe(textarea);
  }

  private disconnectBodyInputObserver(): void {
    this.bodyInputObserver?.disconnect();
    this.bodyInputObserver = undefined;
  }

  private resizeBodyInput(): void {
    const textarea = this.bodyInput()?.nativeElement;
    const highlight = this.bodyHighlight()?.nativeElement;
    if (!textarea) {
      return;
    }

    const styles = getComputedStyle(textarea);
    const lineHeight =
      Number.parseFloat(styles.lineHeight) || Number.parseFloat(styles.fontSize) * 1.65 || 20;
    const paddingTop = Number.parseFloat(styles.paddingTop);
    const paddingBottom = Number.parseFloat(styles.paddingBottom);
    const borderTop = Number.parseFloat(styles.borderTopWidth);
    const borderBottom = Number.parseFloat(styles.borderBottomWidth);
    const verticalChrome = paddingTop + paddingBottom + borderTop + borderBottom;
    const extraLine = Number.isFinite(lineHeight) ? lineHeight : 0;

    textarea.style.height = '0';
    const wrappedContentHeight = textarea.scrollHeight - verticalChrome;
    const wrappedLines = Math.max(1, Math.ceil(wrappedContentHeight / extraLine));
    const nextHeight = `${wrappedLines * extraLine + verticalChrome + extraLine}px`;
    textarea.style.height = nextHeight;

    if (highlight) {
      highlight.style.height = nextHeight;
      highlight.scrollTop = textarea.scrollTop;
    }
  }

  private applyClampedInput(
    control: FormControl<string>,
    clamp: (value: string) => string,
    textarea?: HTMLTextAreaElement
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

  private clampTitle(value: string | null | undefined): string {
    return normalizePostTitle(value).slice(0, POST_TITLE_MAX_LENGTH);
  }

  private clampBody(value: string | null | undefined): string {
    return normalizePostBody(value).slice(0, POST_BODY_MAX_LENGTH);
  }

  private showSaveMessage(message: string): void {
    this.clearSaveMessage();
    this.saveMessage.set(message);
    this.saveMessageTimeout = setTimeout(() => {
      this.saveMessage.set(null);
      this.saveMessageTimeout = undefined;
    }, SAVE_MESSAGE_DURATION_MS);
  }

  private clearSaveMessage(): void {
    if (this.saveMessageTimeout !== undefined) {
      clearTimeout(this.saveMessageTimeout);
      this.saveMessageTimeout = undefined;
    }

    this.saveMessage.set(null);
  }

  private beginGeminiDraft(): void {
    const item = this.post();
    if (!item) {
      return;
    }

    this.wasEditingBodyBeforeGemini = this.editingField() === 'body';
    this.bodyBeforeGemini = this.wasEditingBodyBeforeGemini
      ? this.clampBody(this.form.controls.body.value)
      : this.clampBody(item.body);
    this.geminiDraftActive.set(true);
    this.clearSaveMessage();
    this.errorMessage.set(null);
    this.editingField.set('body');
    this.form.patchValue({
      title: this.clampTitle(item.title),
      body: '',
    });
    this.syncBodyHighlight('');
    this.form.controls.body.markAsDirty();
    this.observeBodyInput();
    requestAnimationFrame(() => this.resizeBodyInput());
  }

  private abortGeminiDraft(reopenPopup: boolean): void {
    this.stopGeminiTypewriter();
    this.isGenerating.set(false);
    this.isTyping.set(false);
    this.geminiDraftActive.set(false);

    const item = this.post();
    if (!item) {
      return;
    }

    this.form.patchValue({
      title: this.clampTitle(item.title),
      body: this.bodyBeforeGemini,
    });
    this.syncBodyHighlight(this.bodyBeforeGemini);

    if (this.wasEditingBodyBeforeGemini) {
      this.form.controls.body.markAsDirty();
      requestAnimationFrame(() => this.resizeBodyInput());
      return;
    }

    this.disconnectBodyInputObserver();
    this.editingField.set(null);

    if (reopenPopup) {
      this.geminiPrompt.set('');
      this.geminiPopupOpen.set(true);
      queueMicrotask(() => this.geminiPromptInput()?.nativeElement.focus());
    }
  }

  private stopGeminiTypewriter(): void {
    this.stopTypewriter?.();
    this.stopTypewriter = undefined;
  }

  private typeGeminiIntoBody(text: string): void {
    this.stopGeminiTypewriter();
    const control = this.form.controls.body;

    const prefersReducedMotion =
      typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) {
      control.setValue(text, { emitEvent: false });
      control.markAsDirty();
      this.syncBodyHighlight(text);
      requestAnimationFrame(() => this.resizeBodyInput());
      return;
    }

    this.isTyping.set(true);
    control.setValue('', { emitEvent: false });
    this.syncBodyHighlight('');

    this.stopTypewriter = createTypewriter(
      text,
      (partial) => {
        control.setValue(partial, { emitEvent: false });
        control.markAsDirty();
        this.syncBodyHighlight(partial);
        this.scrollBodyInputToEnd();
        requestAnimationFrame(() => this.resizeBodyInput());
      },
      () => {
        this.isTyping.set(false);
        this.stopTypewriter = undefined;
        this.scrollBodyInputToEnd();
        requestAnimationFrame(() => this.resizeBodyInput());
      },
      { intervalMs: 42 }
    );
  }

  private syncBodyHighlight(value?: string): void {
    this.bodyHighlightText.set(value ?? this.form.controls.body.value);
  }

  private scrollBodyInputToEnd(): void {
    const textarea = this.bodyInput()?.nativeElement;
    const highlight = this.bodyHighlight()?.nativeElement;
    if (!textarea) {
      return;
    }

    textarea.scrollTop = textarea.scrollHeight;
    const length = textarea.value.length;
    textarea.setSelectionRange(length, length);

    if (highlight) {
      highlight.scrollTop = highlight.scrollHeight;
    }
  }
}
