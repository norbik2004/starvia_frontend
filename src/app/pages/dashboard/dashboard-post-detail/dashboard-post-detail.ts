import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { DatePipe, NgClass, NgTemplateOutlet } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltip } from '@angular/material/tooltip';
import { Component, DestroyRef, ElementRef, HostListener, computed, inject, signal, viewChild } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { EMPTY, finalize, map, switchMap, catchError, of } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { toApplicationError } from '../../../models/application-error';
import { DisplayDatetimePipe } from '../../../pipes/display-datetime';
import {
  DEFAULT_POST_PLATFORMS,
  normalizePostTitle,
  normalizePostBody,
  parseHashtagSegments,
  POST_BODY_MAX_LENGTH,
  POST_STATUS_OPTIONS,
  POST_TITLE_MAX_LENGTH,
  POST_TITLE_MIN_LENGTH,
  getPostStatusClass,
  getPostStatusIcon,
  getPostStatusLabel,
  normalizeUpdatePostBody,
  type PostAttachmentItem,
  type PostItem,
  type PostStatus,
  type UpdatePostPayload,
} from '../../../models/post';
import { GeminiService } from '../../../services/gemini';
import { AuthService } from '../../../services/auth';
import { type UserAccount } from '../../../models/user-account';
import { PostService } from '../../../services/post';
import { PostAttachmentService } from '../../../services/post-attachment';
import { UserUploadedFileService } from '../../../services/user-uploaded-file';
import { UserPlatformService } from '../../../services/user-platform';
import { LinkedInService } from '../../../services/linkedin';
import { PostPublicationService } from '../../../services/post-publication';
import { LINKEDIN_PLATFORM_TYPE, type UserPlatform } from '../../../models/user-platform';
import {
  postPublicationStatusLabel,
  type PostPublication,
} from '../../../models/post-publication';
import type { PagedUserUploadedFilesResponse, UserUploadedFileItem } from '../../../models/user-uploaded-file';
import {
  DEFAULT_POSTS_LIST_QUERY,
  postsListQueryToParams,
  readPostsListQueryFromHistory,
} from '../dashboard-posts/posts-list-query';

import { toggleLinkedInBoldSelection } from '../../../models/linkedin-text-format';
import { POST_BODY_EMOJIS } from '../shared/post-body-emojis';
import { createTypewriter } from '../shared/typewriter-text';
import { PageLoading } from '../../../components/page-loading/page-loading';
import { PageRevealDirective } from '../../../directives/page-reveal';
import { drawerMotionDelay } from '../../../layout/shared/drawer-motion';
import { DashboardAlert } from '../shared/dashboard-alert/dashboard-alert';
import { DashboardDeleteButton } from '../shared/dashboard-delete-button/dashboard-delete-button';
import { DashboardPlatformLogo } from '../shared/dashboard-platform-logo/dashboard-platform-logo';
import { DashboardImageLightbox } from '../shared/dashboard-image-lightbox/dashboard-image-lightbox';
import { DashboardLinkedinPostPreview } from '../shared/dashboard-linkedin-post-preview/dashboard-linkedin-post-preview';
import { DashboardPostGenerate } from '../dashboard-post-generate/dashboard-post-generate';
import { DashboardDeleteConfirmService } from '../shared/dashboard-delete-confirm-sheet/dashboard-delete-confirm.service';
import {
  postMetaChipAnimation,
  postMetaPanelAnimation,
} from '../shared/post-meta.animations';

type EditableField = 'title' | 'body';

type AttachmentLightboxPreview = {
  title: string;
  src: string | null;
};

const SAVE_MESSAGE_DURATION_MS = 5000;
const EDIT_CLOSE_MS = 220;
const STATUS_PULSE_MS = 320;
const ATTACHMENTS_PICKER_CLOSE_MS = 280;

type PostForm = FormGroup<{
  title: FormControl<string>;
  body: FormControl<string>;
}>;

@Component({
  selector: 'app-dashboard-post-detail',
  imports: [RouterLink, DatePipe, DisplayDatetimePipe, NgClass, ReactiveFormsModule, MatTooltip, MatButtonModule, NgTemplateOutlet, DragDropModule, PageLoading, PageRevealDirective, DashboardAlert, DashboardDeleteButton, DashboardPlatformLogo, DashboardImageLightbox, DashboardLinkedinPostPreview, DashboardPostGenerate],
  animations: [postMetaChipAnimation, postMetaPanelAnimation],
  styleUrl: './dashboard-post-detail.scss',
  template: `
    <section class="dashboard-content-page post-detail" aria-labelledby="post-detail-title">
      <header
        class="post-detail__header"
        [class.post-detail__header--menu-open]="statusMenuOpen()"
        appPageReveal
      >
        <div class="post-detail__header-row">
          <a
            [routerLink]="['/dashboard/posts']"
            [queryParams]="postsReturnQueryParams()"
            class="section-eyebrow post-detail__eyebrow"
          >
            ← Back to posts
          </a>

          @if (post(); as item) {
            <div class="post-detail__header-tools">
              <div class="post-detail__header-meta">
                <div class="post-detail__status-anchor" #statusAnchor>
                  <button
                    type="button"
                    id="post-detail-status"
                    class="post-detail__status-trigger"
                    [class.post-detail__status-trigger--open]="statusMenuOpen()"
                    [class.post-detail__status-trigger--pulse]="statusPulse()"
                    [ngClass]="postStatusClass(item.status)"
                    matTooltip="Edit status"
                    matTooltipPosition="below"
                    [matTooltipDisabled]="tooltipsDisabled()"
                    aria-label="Edit status"
                    [attr.aria-expanded]="statusMenuOpen()"
                    aria-controls="post-detail-status-menu"
                    [disabled]="isMetaSaving() || isActionLocked()"
                    (click)="toggleStatusMenu($event)"
                  >
                    <span class="post-detail__status-trigger-content">
                      <span class="material-icons post-detail__status-trigger-icon" aria-hidden="true">{{ postStatusIcon(item.status) }}</span>
                      <span class="post-detail__status-trigger-label">{{ postStatusLabel(item.status) }}</span>
                      <span class="material-icons post-detail__status-trigger-chevron" aria-hidden="true">expand_more</span>
                    </span>
                  </button>

                  @if (statusMenuOpen()) {
                    <div
                      id="post-detail-status-menu"
                      class="post-detail__status-menu"
                      @postMetaPanel
                      role="menu"
                      aria-label="Status"
                      (click)="$event.stopPropagation()"
                    >
                      @for (status of postStatusOptions; track status.value) {
                        <button
                          type="button"
                          class="post-detail__status-menu-item"
                          role="menuitemradio"
                          [class.post-detail__status-menu-item--active]="item.status === status.value"
                          [ngClass]="postStatusClass(status.value)"
                          [attr.aria-checked]="item.status === status.value"
                          [disabled]="isMetaSaving() || isActionLocked()"
                          (click)="onStatusSelect(status.value)"
                        >
                          <span class="material-icons post-detail__status-menu-icon" aria-hidden="true">{{ status.icon }}</span>
                          <span class="post-detail__status-menu-label">{{ status.label }}</span>
                          @if (item.status === status.value) {
                            <span
                              class="material-icons post-detail__status-menu-check"
                              @postMetaChip
                              aria-hidden="true"
                            >check</span>
                          }
                        </button>
                      }
                    </div>
                  }
                </div>
              </div>

              <span class="post-detail__header-meta-sep post-detail__header-date-sep" aria-hidden="true">·</span>

              <p class="post-detail__meta post-detail__top-date">
                <time [attr.datetime]="item.createdAt" class="post-detail__meta-date post-detail__meta-date--full">
                  {{ item.createdAt | displayDatetime }}
                </time>
                <time [attr.datetime]="item.createdAt" class="post-detail__meta-date post-detail__meta-date--short">
                  {{ item.createdAt | date: 'mediumDate' }}
                </time>
              </p>

              <app-dashboard-delete-button
                class="post-detail__header-delete"
                ariaLabel="Delete post"
                tooltip="Delete post"
                [active]="deleteConfirmOpen()"
                [disabled]="isActionLocked()"
                [ariaExpanded]="deleteConfirmOpen()"
                ariaControls="dashboard-delete-sheet-title"
                (clicked)="requestDelete()"
              />
            </div>
          }
        </div>

        <p class="post-detail__save-status" aria-live="polite">{{ saveMessage() }}</p>

        @if (post(); as item) {
          @if (editingField() === 'title') {
            <div
              class="dashboard-edit-panel"
              [class.dashboard-edit-panel--closing]="editClosing()"
              [formGroup]="form"
            >
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
              <div class="dashboard-edit-foot">
                <div class="dashboard-edit-meta">
                  <p id="post-title-hint" class="dashboard-edit-hint">
                    {{ form.controls.title.value.length }}/{{ titleMaxLength }} · Esc to cancel
                  </p>
                  <div class="dashboard-edit-meta__error" aria-live="polite">
                    @if (form.controls.title.touched && form.controls.title.hasError('required')) {
                      <p id="post-title-error" class="field__error" role="alert">Tytuł jest wymagany.</p>
                    } @else if (form.controls.title.touched && form.controls.title.hasError('minlength')) {
                      <p id="post-title-error" class="field__error" role="alert">
                        Tytuł musi mieć co najmniej {{ titleMinLength }} znaków.
                      </p>
                    } @else if (form.controls.title.touched && form.controls.title.hasError('maxlength')) {
                      <p id="post-title-error" class="field__error" role="alert">
                        Tytuł może mieć maksymalnie {{ titleMaxLength }} znaków.
                      </p>
                    }
                  </div>
                </div>
                <ng-container
                  *ngTemplateOutlet="editActions; context: { $implicit: 'title', control: form.controls.title }"
                />
              </div>
            </div>
          } @else {
            <h1
              id="post-detail-title"
              class="post-detail__title"
              [class.dashboard-edit-read-in]="editReadEnterField() === 'title'"
            >
              <span class="dashboard-editable-text post-detail__title-text">{{ item.title || 'Untitled' }}</span>
              <ng-container
                *ngTemplateOutlet="editIcon; context: { $implicit: 'title', label: 'Edit title' }"
              />
            </h1>
          }
        } @else if (isLoading()) {
          <h1 id="post-detail-title" class="sr-only">Loading post</h1>
        } @else {
          <h1 id="post-detail-title" class="post-detail__title">Post</h1>
        }
      </header>

      @if (isLoading()) {
        <app-page-loading label="Loading post…" />
      }

      <app-dashboard-alert
        [message]="errorMessage()"
        [dismissible]="!!post()"
        (dismissed)="errorMessage.set(null)"
      />

      @if (post(); as item) {
        <div class="post-detail__sections" appPageReveal>
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
              <div class="post-detail__card-head-copy">
                <p id="post-detail-body" class="post-detail__card-label">Content</p>
                <p class="post-detail__card-hint">What will be published</p>
              </div>
              <div class="post-detail__card-actions">
                <div class="post-detail__gemini-anchor">
                  <button
                    type="button"
                    class="post-detail__gemini-btn"
                    [class.post-detail__gemini-btn--active]="generateDrawerOpen() || generateDrawerClosing()"
                    [class.post-detail__gemini-btn--busy]="isGenerating() || isTyping()"
                    matTooltip="Generate with AI"
                    matTooltipPosition="below"
                    [matTooltipDisabled]="tooltipsDisabled()"
                    aria-label="Generate content with AI"
                    [attr.aria-expanded]="generateDrawerOpen() || generateDrawerClosing()"
                    [attr.aria-busy]="isGenerating() || isTyping()"
                    aria-controls="post-generate-title"
                    [disabled]="!canUseGemini()"
                    (click)="toggleGenerateDrawer($event)"
                  >
                    <span class="post-detail__gemini-btn-icon" aria-hidden="true">
                      <span class="material-icons">auto_awesome</span>
                    </span>
                    <span class="post-detail__gemini-btn-label">Generate</span>
                  </button>
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
                class="dashboard-edit-panel"
                [class.dashboard-edit-panel--closing]="editClosing()"
                [class.dashboard-edit-panel--ai-writing]="isGenerating() || isTyping()"
                [formGroup]="form"
              >
                <div class="post-detail__body-editor">
                  @if (isGenerating()) {
                    <div class="post-detail__ai-generating" role="status" aria-live="polite">
                      <span class="material-icons" aria-hidden="true">auto_awesome</span>
                      <span>Writing your post</span>
                      <span class="post-detail__ai-writing-hint__dots" aria-hidden="true">
                        <span></span><span></span><span></span>
                      </span>
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
                    (keydown)="onBodyKeydown($event)"
                    (select)="onBodySelectionChange()"
                    (mouseup)="onBodySelectionChange()"
                    (keyup)="onBodySelectionChange()"
                    (scroll)="syncBodyHighlightScroll()"
                  ></textarea>
                </div>
                <div class="dashboard-edit-foot">
                  <div class="dashboard-edit-meta">
                    <p
                      id="post-body-hint"
                      class="dashboard-edit-hint"
                      [class.dashboard-edit-hint--ai-writing]="isTyping()"
                      aria-live="polite"
                    >
                      @if (isTyping()) {
                        <span class="post-detail__ai-writing-hint">
                          <span class="post-detail__ai-writing-hint__text">AI is writing into content</span>
                          <span class="post-detail__ai-writing-hint__dots" aria-hidden="true">
                            <span></span><span></span><span></span>
                          </span>
                        </span>
                      } @else {
                        {{ form.controls.body.value.length }}/{{ bodyMaxLength }} · Esc to cancel
                      }
                    </p>
                    <div class="dashboard-edit-meta__error" aria-live="polite">
                      @if (form.controls.body.touched && form.controls.body.hasError('maxlength')) {
                        <p id="post-body-error" class="field__error" role="alert">
                          Treść może mieć maksymalnie {{ bodyMaxLength }} znaków.
                        </p>
                      } @else if (geminiDraftActive() && geminiError()) {
                        <p class="field__error gemini-field-error" role="alert">{{ geminiError() }}</p>
                      }
                    </div>
                    <div class="post-detail__body-format-actions">
                      <button
                        mat-icon-button
                        type="button"
                        class="post-detail__format-trigger"
                        matTooltip="Bold selection (LinkedIn)"
                        [matTooltipDisabled]="tooltipsDisabled()"
                        aria-label="Bold selection for LinkedIn"
                        [disabled]="isGenerating() || isTyping() || !bodyHasSelection()"
                        (click)="toggleBodyBold()"
                      >
                        <span class="material-icons" aria-hidden="true">format_bold</span>
                      </button>
                      <div class="post-detail__emoji-anchor" #emojiAnchor>
                      <button
                        mat-icon-button
                        type="button"
                        class="post-detail__emoji-trigger"
                        [class.post-detail__emoji-trigger--open]="emojiPickerOpen()"
                        matTooltip="Insert emoji"
                        [matTooltipDisabled]="tooltipsDisabled()"
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
                          (click)="$event.stopPropagation()"
                        >
                          <button
                            type="button"
                            class="emoji-picker__nav"
                            aria-label="Previous emojis"
                            [disabled]="!hasPreviousEmojiPage()"
                            (click)="goToPreviousEmojiPage($event)"
                          >
                            <span class="material-icons" aria-hidden="true">chevron_left</span>
                          </button>
                          <div class="emoji-picker__grid" role="list">
                            @for (emoji of visibleEmojis(); track emoji) {
                              <button
                                type="button"
                                class="emoji-picker__option"
                                role="listitem"
                                [attr.aria-label]="'Insert ' + emoji"
                                (click)="insertBodyEmoji(emoji)"
                              >
                                {{ emoji }}
                              </button>
                            }
                          </div>
                          <button
                            type="button"
                            class="emoji-picker__nav"
                            aria-label="Next emojis"
                            [disabled]="!hasNextEmojiPage()"
                            (click)="goToNextEmojiPage($event)"
                          >
                            <span class="material-icons" aria-hidden="true">chevron_right</span>
                          </button>
                        </div>
                      }
                      </div>
                    </div>
                  </div>
                  <ng-container
                    *ngTemplateOutlet="editActions; context: { $implicit: 'body', control: form.controls.body }"
                  />
                </div>
              </div>
            } @else {
              <div
                class="post-detail__card-body"
                [class.dashboard-edit-read-in]="editReadEnterField() === 'body'"
              >
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

          <section class="post-detail__card post-detail__card--attachments" aria-labelledby="post-detail-attachments">
            <div class="post-detail__card-head post-detail__card-head--row">
              <div class="post-detail__card-head-copy">
                <p id="post-detail-attachments" class="post-detail__card-label">
                  Attachments
                  @if (attachmentOrderDraft().length > 0) {
                    <span class="post-detail__attachments-count">{{ attachmentOrderDraft().length }}</span>
                  }
                </p>
                <p class="post-detail__card-hint">
                  @if (attachmentOrderDraft().length > 1) {
                    Drag images to change their order.
                  } @else {
                    Images from your Media library.
                  }
                </p>
              </div>
              <div class="post-detail__card-actions">
                <button
                  #attachmentsTriggerEl
                  type="button"
                  class="post-detail__attachments-add-btn"
                  [disabled]="isLoading() || isSaving() || isMetaSaving() || isDeleting() || isActionLocked()"
                  (click)="openAttachmentsPicker($event)"
                >
                  <span class="material-icons" aria-hidden="true">add</span>
                  <span class="post-detail__attachments-add-btn-label">Add images</span>
                </button>
              </div>
            </div>

            <div class="post-detail__attachments-body">
              @if (attachmentOrderDraft().length === 0) {
                <button
                  type="button"
                  class="post-detail__attachments-empty"
                  [disabled]="isLoading() || isSaving() || isMetaSaving() || isDeleting() || isActionLocked()"
                  (click)="openAttachmentsPicker($event)"
                >
                  <span class="post-detail__attachments-empty-icon" aria-hidden="true">
                    <span class="material-icons">add_photo_alternate</span>
                  </span>
                  <span class="post-detail__attachments-empty-title">No images yet</span>
                  <span class="post-detail__attachments-empty-text">Choose images from Media to add them here</span>
                </button>
              } @else {
                <div
                  class="post-detail__attachments-grid"
                  cdkDropList
                  cdkDropListOrientation="mixed"
                  role="list"
                  aria-label="Attached images"
                  (cdkDropListDropped)="dropAttachment($event)"
                >
                  @for (att of attachmentOrderDraft(); track att.id ?? att.userUploadedFileId; let index = $index) {
                    <div
                      class="post-detail__attachment"
                      cdkDrag
                      [cdkDragDisabled]="isAttachmentBusy() || isActionLocked() || attachmentOrderDraft().length < 2 || isSavingAttachmentOrder()"
                      role="listitem"
                    >
                      <button
                        type="button"
                        class="post-detail__attachment-preview-btn"
                        [attr.aria-label]="'Preview attachment ' + (index + 1)"
                        (click)="openAttachmentPreview(att)"
                      >
                        @if (attachmentPreviewUrl(att.userUploadedFileId); as src) {
                          <img class="post-detail__attachment-img" [src]="src" alt="" loading="lazy" />
                        } @else {
                          <span class="post-detail__attachment-placeholder" aria-hidden="true">
                            <span class="material-icons">image</span>
                          </span>
                        }
                      </button>
                      <span class="post-detail__attachment-order" aria-hidden="true">{{ index + 1 }}</span>
                      <div class="post-detail__attachment-tools">
                        <button
                          type="button"
                          class="post-detail__attachment-tool post-detail__attachment-drag-handle"
                          cdkDragHandle
                          [disabled]="isAttachmentBusy() || isActionLocked() || attachmentOrderDraft().length < 2 || isSavingAttachmentOrder()"
                          [attr.aria-label]="'Drag attachment ' + (index + 1)"
                        >
                          <span class="material-icons" aria-hidden="true">drag_indicator</span>
                        </button>
                        @if (att.id !== null) {
                          <app-dashboard-delete-button
                            size="sm"
                            tone="dark"
                            ariaLabel="Remove attachment"
                            tooltip="Remove attachment"
                            [active]="deleteConfirmAttachmentId() === att.id"
                            [disabled]="isAttachmentBusy() || isActionLocked()"
                            [ariaExpanded]="deleteConfirmAttachmentId() === att.id"
                            ariaControls="dashboard-delete-sheet-title"
                            (clicked)="requestDeleteAttachment(att, $event)"
                          />
                        }
                      </div>
                    </div>
                  }
                </div>
              }
            </div>

            @if (attachmentsPickerOpen()) {
              <div
                #attachmentsPickerEl
                class="post-attachments-picker"
                [class.post-attachments-picker--closing]="attachmentsPickerClosing()"
                role="region"
                aria-label="Attach images from Media"
                (click)="$event.stopPropagation()"
              >
                <header class="post-attachments-picker__head">
                  <div class="post-attachments-picker__head-text">
                    <p class="post-attachments-picker__title">Choose from Media</p>
                    <p class="post-attachments-picker__hint">
                      @if (selectedAttachmentIds().size > 0) {
                        <strong>{{ selectedAttachmentIds().size }}</strong> selected
                      } @else {
                        Tap images to select them
                      }
                    </p>
                  </div>
                  <button
                    type="button"
                    class="post-attachments-picker__close"
                    aria-label="Close picker"
                    (click)="closeAttachmentsPicker()"
                  >
                    <span class="material-icons" aria-hidden="true">close</span>
                  </button>
                </header>

                <app-dashboard-alert [compact]="true" [message]="attachmentsPickerError()" />

                @if (attachmentsPickerLoading() && !attachmentsMediaPage()) {
                  <p class="post-attachments-picker__status">Loading media…</p>
                }

                @if (attachmentsMediaPage(); as page) {
                  @if (page.items.length === 0) {
                    <p class="post-attachments-picker__status">No images in Media yet.</p>
                  } @else {
                    <div class="post-attachments-picker__slider" aria-label="Media picker slider">
                      <button
                        type="button"
                        class="post-attachments-picker__nav post-attachments-picker__nav--prev"
                        [disabled]="attachmentsPickerLoading() || !attachmentsPickerCanPrev()"
                        aria-label="Previous media images"
                        (click)="attachmentsPickerPrev()"
                      >
                        <span class="material-icons" aria-hidden="true">chevron_left</span>
                      </button>

                      <div
                        #attachmentsPickerCarouselEl
                        class="post-attachments-picker__viewport"
                        role="list"
                        aria-label="Media images"
                        (scroll)="onAttachmentsPickerCarouselScroll()"
                      >
                        <div class="post-attachments-picker__track">
                          @for (file of page.items; track file.id) {
                            <button
                              type="button"
                              class="post-attachments-picker__item"
                              role="listitem"
                              [class.post-attachments-picker__item--selected]="isAttachmentSelected(file.id)"
                              [attr.aria-pressed]="isAttachmentSelected(file.id)"
                              [title]="file.fileName || 'Image'"
                              (click)="toggleAttachmentSelection(file, $event)"
                            >
                              @if (attachmentPreviewUrl(file.id); as src) {
                                <img
                                  class="post-attachments-picker__img"
                                  [src]="src"
                                  [alt]="file.fileName || 'Image'"
                                  loading="lazy"
                                />
                              } @else {
                                <span class="post-attachments-picker__placeholder" aria-hidden="true">
                                  <span class="material-icons">image</span>
                                </span>
                              }
                              <span class="post-attachments-picker__check" aria-hidden="true">
                                <span class="material-icons">check</span>
                              </span>
                            </button>
                          }
                        </div>
                      </div>

                      <button
                        type="button"
                        class="post-attachments-picker__nav post-attachments-picker__nav--next"
                        [disabled]="attachmentsPickerLoading() || !attachmentsPickerCanNext()"
                        aria-label="Next media images"
                        (click)="attachmentsPickerNext()"
                      >
                        <span class="material-icons" aria-hidden="true">chevron_right</span>
                      </button>
                    </div>
                  }

                  <footer class="post-attachments-picker__foot">
                    <div class="post-attachments-picker__actions">
                      <button
                        type="button"
                        class="post-attachments-picker__btn post-attachments-picker__btn--ghost"
                        [disabled]="isAttaching()"
                        (click)="closeAttachmentsPicker()"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        class="post-attachments-picker__btn post-attachments-picker__btn--primary"
                        [disabled]="isAttaching() || attachmentsPickerLoading() || selectedAttachmentIds().size === 0"
                        (click)="attachSelectedMedia()"
                      >
                        @if (isAttaching()) {
                          Attaching…
                        } @else if (selectedAttachmentIds().size > 0) {
                          Attach {{ selectedAttachmentIds().size }} {{ selectedAttachmentIds().size === 1 ? 'image' : 'images' }}
                        } @else {
                          Attach
                        }
                      </button>
                    </div>
                  </footer>
                }
              </div>
            }
          </section>

          <section class="post-detail__card post-detail__card--linkedin-publish" aria-labelledby="post-detail-linkedin-publish">
            <div class="post-detail__card-head post-detail__card-head--row">
              <div class="post-detail__card-head-copy">
                <p id="post-detail-linkedin-publish" class="post-detail__card-label">LinkedIn</p>
                <p class="post-detail__card-hint">Opublikuj treść na połączonym koncie LinkedIn</p>
              </div>

              @if (linkedInAccount(); as linkedIn) {
                <button
                  type="button"
                  class="btn btn--primary btn--raised-primary btn--compact"
                  [disabled]="isPublishingToLinkedIn() || !canPublishToLinkedIn()"
                  (click)="publishToLinkedIn()"
                >
                  <span class="material-icons" aria-hidden="true">send</span>
                  {{ isPublishingToLinkedIn() ? 'Publikowanie…' : 'Opublikuj na LinkedIn' }}
                </button>
              } @else {
                <a routerLink="/dashboard/social-accounts" class="btn btn--secondary btn--compact">
                  <span class="material-icons" aria-hidden="true">add_link</span>
                  Połącz LinkedIn
                </a>
              }
            </div>

            <div class="post-detail__card-body">
              <app-dashboard-alert
                [compact]="true"
                [tone]="linkedinPublishTone()"
                [message]="linkedinPublishMessage()"
                [dismissible]="true"
                (dismissed)="linkedinPublishMessage.set(null)"
              />

              @if (linkedInAccount(); as linkedIn) {
                <p class="post-detail__linkedin-account">
                  Konto:
                  <strong>{{ linkedIn.accountUsername ?? 'LinkedIn' }}</strong>
                </p>
              }

              @if (!canPublishToLinkedIn() && linkedInAccount() && !isPublishingToLinkedIn()) {
                <p class="post-detail__linkedin-hint">Dodaj treść posta, zanim opublikujesz na LinkedIn.</p>
              }

              @if (linkedinPublications().length > 0) {
                <ul class="post-detail__publications" aria-label="Publikacje LinkedIn">
                  @for (publication of linkedinPublications(); track publication.id) {
                    <li class="post-detail__publication">
                      <span
                        class="post-detail__publication-status"
                        [attr.data-status]="publication.status"
                      >
                        {{ publicationStatusLabel(publication.status) }}
                      </span>
                      <span class="post-detail__publication-meta">
                        @if (publication.publishedAt) {
                          {{ publication.publishedAt | displayDatetime }}
                        } @else if (publication.createdAt) {
                          {{ publication.createdAt | displayDatetime }}
                        }
                        @if (publication.externalPostId) {
                          · ID: {{ publication.externalPostId }}
                        }
                      </span>
                    </li>
                  }
                </ul>
              }
            </div>
          </section>

          <section class="post-detail__card post-detail__card--previews" aria-labelledby="post-detail-previews">
            <div class="post-detail__card-head">
              <p id="post-detail-previews" class="post-detail__card-label">Platform preview</p>
              <p class="post-detail__card-hint">See how your post will look when published</p>
            </div>

            <div class="post-detail__card-body post-detail__previews-body">
              <div class="post-detail__preview-platform" aria-hidden="true">
                <app-dashboard-platform-logo platformType="linkedin" size="sm" />
                <span class="post-detail__preview-platform-label">LinkedIn</span>
              </div>

              <app-dashboard-linkedin-post-preview
                [authorName]="linkedInPreviewAuthorName()"
                [authorHeadline]="linkedInPreviewHeadline()"
                [authorAvatarUrl]="linkedInPreviewAvatarUrl()"
                [body]="platformPreviewBody()"
                [attachmentSrcs]="platformPreviewAttachmentSrcs()"
              />
            </div>
          </section>
        </div>
      }
    </section>

    @if (attachmentLightbox(); as preview) {
      <app-dashboard-image-lightbox
        [title]="preview.title"
        [previewSrc]="preview.src"
        [showDescription]="false"
        (closed)="attachmentLightbox.set(null)"
      />
    }

    <app-dashboard-post-generate
      [open]="generateDrawerOpen()"
      [closing]="generateDrawerClosing()"
      [busy]="isGenerating()"
      [hasExistingBody]="hasExistingBodyContent()"
      [errorMessage]="geminiError()"
      [initialPrompt]="geminiPrompt()"
      (closed)="closeGenerateDrawer()"
      (submitted)="generateWithGemini($event)"
    />

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
        [matTooltipDisabled]="tooltipsDisabled() || isActionLocked()"
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
      <div class="dashboard-inline-actions">
        <button
          type="button"
          class="btn btn--primary btn--raised-primary btn--compact"
          [disabled]="isSaving() || control.invalid || isGenerating() || isTyping()"
          (click)="saveField(field)"
        >
          {{ isSaving() ? 'Saving…' : 'Save' }}
        </button>
        <button
          type="button"
          class="btn btn--secondary btn--raised-secondary btn--compact"
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
  private readonly postAttachmentService = inject(PostAttachmentService);
  private readonly fileService = inject(UserUploadedFileService);
  private readonly userPlatformService = inject(UserPlatformService);
  private readonly linkedInService = inject(LinkedInService);
  private readonly postPublicationService = inject(PostPublicationService);
  private readonly deleteConfirm = inject(DashboardDeleteConfirmService);
  private readonly geminiService = inject(GeminiService);
  private readonly authService = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly titleInput = viewChild<ElementRef<HTMLTextAreaElement>>('titleInput');
  private readonly bodyInput = viewChild<ElementRef<HTMLTextAreaElement>>('bodyInput');
  private readonly bodyHighlight = viewChild<ElementRef<HTMLDivElement>>('bodyHighlight');
  private readonly emojiAnchor = viewChild<ElementRef<HTMLElement>>('emojiAnchor');
  private readonly statusAnchor = viewChild<ElementRef<HTMLElement>>('statusAnchor');
  private readonly attachmentsTriggerEl = viewChild<ElementRef<HTMLElement>>('attachmentsTriggerEl');
  private readonly attachmentsPickerEl = viewChild<ElementRef<HTMLElement>>('attachmentsPickerEl');
  private readonly attachmentsPickerCarouselEl = viewChild<ElementRef<HTMLElement>>('attachmentsPickerCarouselEl');
  private saveMessageTimeout: ReturnType<typeof setTimeout> | undefined;
  private stopTypewriter: (() => void) | undefined;
  private bodyInputObserver: ResizeObserver | undefined;
  private bodyBeforeGemini = '';
  private wasEditingBodyBeforeGemini = false;
  private generateDrawerCloseTimeout: ReturnType<typeof setTimeout> | undefined;
  private attachmentsPickerCloseTimeout: ReturnType<typeof setTimeout> | undefined;
  private editCloseTimeout: ReturnType<typeof setTimeout> | undefined;
  private statusPulseTimeout: ReturnType<typeof setTimeout> | undefined;

  protected readonly titleMaxLength = POST_TITLE_MAX_LENGTH;
  protected readonly titleMinLength = POST_TITLE_MIN_LENGTH;
  protected readonly bodyMaxLength = POST_BODY_MAX_LENGTH;
  protected readonly contentEmojis = POST_BODY_EMOJIS;
  protected readonly hashtagSegments = parseHashtagSegments;
  protected readonly postStatusOptions = POST_STATUS_OPTIONS;
  protected readonly postStatusClass = getPostStatusClass;
  protected readonly postStatusIcon = getPostStatusIcon;
  protected readonly postStatusLabel = getPostStatusLabel;
  protected readonly form: PostForm = new FormGroup({
    title: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.minLength(POST_TITLE_MIN_LENGTH),
        Validators.maxLength(POST_TITLE_MAX_LENGTH),
      ],
    }),
    body: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(POST_BODY_MAX_LENGTH)],
    }),
  });
  protected readonly post = signal<PostItem | null>(null);
  protected readonly account = signal<UserAccount | null>(null);
  protected readonly linkedInAccount = signal<UserPlatform | null>(null);
  protected readonly linkedinPublications = signal<PostPublication[]>([]);
  protected readonly isPublishingToLinkedIn = signal(false);
  protected readonly linkedinPublishMessage = signal<string | null>(null);
  protected readonly linkedinPublishTone = signal<'success' | 'error'>('success');
  protected readonly publicationStatusLabel = postPublicationStatusLabel;
  protected readonly editingField = signal<EditableField | null>(null);
  protected readonly editClosing = signal(false);
  protected readonly editReadEnterField = signal<EditableField | null>(null);
  protected readonly isLoading = signal(true);
  protected readonly isSaving = signal(false);
  protected readonly isMetaSaving = signal(false);
  protected readonly isDeleting = signal(false);
  protected readonly deleteConfirmOpen = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly saveMessage = signal<string | null>(null);
  protected readonly emojiPickerOpen = signal(false);
  protected readonly statusMenuOpen = signal(false);
  protected readonly statusPulse = signal(false);
  protected readonly emojiPage = signal(0);
  private readonly emojiColumns = 8;
  private readonly emojiRows = 2;
  private readonly emojiPageSize = this.emojiColumns * this.emojiRows;
  protected readonly visibleEmojis = computed(() => {
    const start = this.emojiPage() * this.emojiPageSize;
    return this.contentEmojis.slice(start, start + this.emojiPageSize);
  });
  protected readonly hasPreviousEmojiPage = computed(() => this.emojiPage() > 0);
  protected readonly hasNextEmojiPage = computed(
    () => (this.emojiPage() + 1) * this.emojiPageSize < this.contentEmojis.length
  );
  protected readonly generateDrawerOpen = signal(false);
  protected readonly generateDrawerClosing = signal(false);
  protected readonly geminiDraftActive = signal(false);
  protected readonly geminiPrompt = signal('');
  protected readonly isGenerating = signal(false);
  protected readonly isTyping = signal(false);
  protected readonly geminiError = signal<string | null>(null);
  protected readonly bodyHighlightText = signal('');
  protected readonly bodyHasSelection = signal(false);
  protected readonly tooltipsDisabled = signal(this.isMobileViewport());
  protected readonly postsReturnQueryParams = signal(
    postsListQueryToParams(readPostsListQueryFromHistory() ?? DEFAULT_POSTS_LIST_QUERY)
  );

  // Attachments (select from Media)
  protected readonly isDeletingAttachment = signal(false);
  protected readonly deleteConfirmAttachmentId = signal<string | null>(null);
  protected readonly attachmentsPickerOpen = signal(false);
  protected readonly attachmentsPickerClosing = signal(false);
  protected readonly attachmentsPickerLoading = signal(false);
  protected readonly attachmentsPickerError = signal<string | null>(null);
  protected readonly isAttaching = signal(false);
  protected readonly isSavingAttachmentOrder = signal(false);
  protected readonly attachmentOrderDraft = signal<PostAttachmentItem[]>([]);
  protected readonly attachmentsMediaPage = signal<PagedUserUploadedFilesResponse | null>(null);
  protected readonly selectedAttachmentIds = signal<Set<string>>(new Set());
  protected readonly attachmentPreviewUrls = signal<Record<string, string>>({});
  protected readonly attachmentsPickerCanPrev = signal(false);
  protected readonly attachmentsPickerCanNext = signal(false);
  protected readonly attachmentLightbox = signal<AttachmentLightboxPreview | null>(null);

  protected readonly linkedInPreviewAuthorName = computed(() => {
    const linkedIn = this.linkedInAccount();
    if (linkedIn?.accountUsername?.trim()) {
      return linkedIn.accountUsername.trim();
    }

    return this.account()?.userName ?? 'Your name';
  });

  protected readonly linkedInPreviewHeadline = computed(() => {
    const linkedIn = this.linkedInAccount();
    if (linkedIn?.accountComment?.trim()) {
      return linkedIn.accountComment.trim();
    }

    return 'Your professional headline';
  });

  protected readonly linkedInPreviewAvatarUrl = computed(() => {
    const linkedIn = this.linkedInAccount();
    if (linkedIn?.profilePictureLink) {
      return linkedIn.profilePictureLink;
    }

    return this.account()?.profilePictureUrl ?? null;
  });

  protected readonly platformPreviewBody = computed(() => {
    const item = this.post();
    if (!item) {
      return null;
    }

    if (this.editingField() === 'body' || this.geminiDraftActive()) {
      const draft = this.form.controls.body.value.trim();
      return draft || null;
    }

    return item.body;
  });

  protected readonly platformPreviewAttachmentSrcs = computed(() => {
    return this.attachmentOrderDraft()
      .map((attachment) => this.attachmentPreviewUrls()[attachment.userUploadedFileId] ?? null)
      .filter((src): src is string => !!src);
  });

  protected readonly canPublishToLinkedIn = computed(() => {
    const item = this.post();
    const linkedIn = this.linkedInAccount();
    if (!item || !linkedIn || this.isPublishingToLinkedIn()) {
      return false;
    }

    const body = this.platformPreviewBody()?.trim() ?? '';
    return body.length > 0;
  });

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.clearSaveMessage();
      this.stopGeminiTypewriter();
      this.clearGenerateDrawerCloseTimeout();
      this.clearAttachmentsPickerCloseTimeout();
      this.clearEditCloseTimeout();
      this.clearStatusPulseTimeout();
      this.disconnectBodyInputObserver();
      document.body.classList.remove('post-create-open');
      this.revokeAttachmentPreviewUrls();
    });

    if (typeof window !== 'undefined') {
      const mobileQuery = window.matchMedia('(max-width: 48rem)');
      const syncTooltips = (): void => {
        const isMobile = mobileQuery.matches;
        this.tooltipsDisabled.set(isMobile);
      };
      syncTooltips();
      mobileQuery.addEventListener('change', syncTooltips);
      this.destroyRef.onDestroy(() => mobileQuery.removeEventListener('change', syncTooltips));
    }

    this.authService
      .getAccount()
      .pipe(catchError(() => of(null)), takeUntilDestroyed())
      .subscribe((account) => this.account.set(account));

    this.userPlatformService
      .getUserPlatforms()
      .pipe(catchError(() => of([])), takeUntilDestroyed())
      .subscribe((platforms) => {
        const linkedIn =
          platforms.find((platform) => platform.platformType === LINKEDIN_PLATFORM_TYPE) ?? null;
        this.linkedInAccount.set(linkedIn);
      });

    this.route.paramMap
      .pipe(
        map((params) => params.get('id')?.trim() ?? ''),
        switchMap((id) => {
          this.resetView();

          if (!id) {
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
        next: (item) => {
          this.setPost(item);
          this.loadLinkedInPublications(item.id);
        },
        error: (error) => {
          this.post.set(null);
          this.errorMessage.set(toApplicationError(error, 'Nie udało się wczytać posta.').description);
        },
      });
  }

  protected publishToLinkedIn(): void {
    const item = this.post();
    const linkedIn = this.linkedInAccount();
    if (!item || !linkedIn || !this.canPublishToLinkedIn()) {
      return;
    }

    this.isPublishingToLinkedIn.set(true);
    this.linkedinPublishMessage.set(null);

    this.linkedInService
      .publishPost({ postId: item.id, userPlatformId: linkedIn.id })
      .pipe(finalize(() => this.isPublishingToLinkedIn.set(false)))
      .subscribe({
        next: () => {
          this.linkedinPublishTone.set('success');
          this.linkedinPublishMessage.set('Post został opublikowany na LinkedIn.');
          this.loadLinkedInPublications(item.id);
        },
        error: (error) => {
          this.linkedinPublishTone.set('error');
          this.linkedinPublishMessage.set(
            toApplicationError(error, 'Nie udało się opublikować posta na LinkedIn.').description,
          );
        },
      });
  }

  private loadLinkedInPublications(postId: string): void {
    this.postPublicationService
      .browse({ postId })
      .pipe(catchError(() => of([])))
      .subscribe((publications) => {
        this.linkedinPublications.set(
          publications
            .slice()
            .sort((a, b) => String(b.publishedAt ?? b.createdAt).localeCompare(String(a.publishedAt ?? a.createdAt))),
        );
      });
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    if (this.generateDrawerOpen() && !this.generateDrawerClosing()) {
      this.closeGenerateDrawer();
      return;
    }

    if (this.emojiPickerOpen()) {
      this.emojiPickerOpen.set(false);
      return;
    }

    if (this.statusMenuOpen()) {
      this.statusMenuOpen.set(false);
      return;
    }

    if (this.attachmentsPickerOpen()) {
      this.closeAttachmentsPicker();
      return;
    }

    if (this.attachmentLightbox()) {
      return;
    }

    if (
      this.editingField() !== null &&
      !this.editClosing() &&
      !this.isSaving() &&
      !this.isGenerating() &&
      !this.isTyping()
    ) {
      this.cancelEdit();
    }
  }

  @HostListener('document:click', ['$event'])
  protected onDocumentClick(event: MouseEvent): void {
    const target = event.target as Node;

    if (this.statusMenuOpen()) {
      const statusAnchor = this.statusAnchor()?.nativeElement;
      if (!statusAnchor?.contains(target)) {
        this.statusMenuOpen.set(false);
      }
    }

    if (this.attachmentsPickerOpen()) {
      const picker = this.attachmentsPickerEl()?.nativeElement;
      const trigger = this.attachmentsTriggerEl()?.nativeElement;
      if (!picker?.contains(target) && !trigger?.contains(target)) {
        this.closeAttachmentsPicker();
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
      this.isMetaSaving() ||
      this.isDeleting() ||
      this.isDeletingAttachment() ||
      this.deleteConfirmOpen() ||
      this.deleteConfirmAttachmentId() !== null
    );
  }

  protected isAttachmentBusy(): boolean {
    return this.isAttaching() || this.isDeletingAttachment() || this.isSavingAttachmentOrder();
  }

  protected canUseGemini(): boolean {
    return (
      this.post() !== null &&
      !this.geminiDraftActive() &&
      !this.isGenerating() &&
      !this.isTyping() &&
      !this.isSaving() &&
      !this.isMetaSaving() &&
      !this.isDeleting() &&
      !this.deleteConfirmOpen()
    );
  }

  protected toggleStatusMenu(event: Event): void {
    event.stopPropagation();

    if (this.isMetaSaving() || this.isActionLocked()) {
      return;
    }

    this.statusMenuOpen.update((open) => !open);
  }

  protected onStatusSelect(status: PostStatus): void {
    const item = this.post();

    if (!item || status === item.status || this.isActionLocked() || this.isMetaSaving()) {
      return;
    }

    this.statusMenuOpen.set(false);

    const previousStatus = item.status;
    this.triggerStatusPulse();
    this.post.set({ ...item, status });
    this.savePostMetadata({ status }, { status: previousStatus });
  }

  protected toggleGenerateDrawer(event: Event): void {
    event.stopPropagation();

    if (!this.canUseGemini()) {
      return;
    }

    if (this.generateDrawerOpen() || this.generateDrawerClosing()) {
      this.closeGenerateDrawer();
      return;
    }

    if (!this.post()) {
      return;
    }

    this.emojiPickerOpen.set(false);
    this.statusMenuOpen.set(false);
    this.clearSaveMessage();
    this.geminiError.set(null);
    this.setGenerateDrawerOpen(true);
  }

  protected closeGenerateDrawer(): void {
    this.startGenerateDrawerClose();
  }

  protected hasExistingBodyContent(): boolean {
    const item = this.post();
    return !!item && this.clampBody(item.body).trim().length > 0;
  }

  protected generateWithGemini(payload: { prompt: string; brandProfileId: string | null }): void {
    const item = this.post();
    const prompt = payload.prompt.trim();

    if (!item || !prompt || !this.canUseGemini()) {
      return;
    }

    this.geminiPrompt.set(prompt);
    this.startGenerateDrawerClose();
    this.geminiError.set(null);
    this.beginGeminiDraft();
    this.isGenerating.set(true);

    this.geminiService
      .generatePost({
        prompt,
        postId: item.id,
        brandProfileId: payload.brandProfileId,
      })
      .pipe(finalize(() => this.isGenerating.set(false)))
      .subscribe({
        next: (generated) => {
          this.geminiPrompt.set('');
          this.typeGeminiIntoBody(this.clampBody(generated.body));
        },
        error: (error) => {
          this.geminiError.set(toApplicationError(error, 'Nie udało się wygenerować treści.').description);
          this.abortGeminiDraft(true);
        },
      });
  }

  protected requestDelete(): void {
    const item = this.post();
    if (!item || this.isActionLocked()) {
      return;
    }

    this.clearSaveMessage();
    this.errorMessage.set(null);
    this.deleteConfirmOpen.set(true);

    this.deleteConfirm
      .open({
        title: `Delete “${item.title || 'Untitled'}”?`,
        description:
          'This post will be permanently removed from your workspace. This action cannot be undone.',
        keepLabel: 'Keep post',
        deleteLabel: 'Delete post',
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((confirmed) => {
        this.deleteConfirmOpen.set(false);
        if (confirmed) {
          this.confirmDelete();
        }
      });
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
          this.errorMessage.set(toApplicationError(error, 'Nie udało się usunąć posta.').description);
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

  protected onBodySelectionChange(): void {
    const textarea = this.bodyInput()?.nativeElement;
    if (!textarea) {
      this.bodyHasSelection.set(false);
      return;
    }

    this.bodyHasSelection.set(textarea.selectionStart !== textarea.selectionEnd);
  }

  protected onBodyKeydown(event: KeyboardEvent): void {
    if (event.key.toLowerCase() !== 'b' || !(event.ctrlKey || event.metaKey)) {
      return;
    }

    if (this.editingField() !== 'body' && !this.geminiDraftActive()) {
      return;
    }

    if (this.isGenerating() || this.isTyping()) {
      return;
    }

    event.preventDefault();
    this.toggleBodyBold();
  }

  protected toggleBodyBold(): void {
    if (this.editingField() !== 'body' && !this.geminiDraftActive()) {
      return;
    }

    const control = this.form.controls.body;
    const textarea = this.bodyInput()?.nativeElement;
    if (!textarea) {
      return;
    }

    const start = textarea.selectionStart ?? 0;
    const end = textarea.selectionEnd ?? start;
    if (start === end) {
      return;
    }

    const toggled = toggleLinkedInBoldSelection(control.value, start, end);
    const next = this.clampBody(toggled.text);
    if (next === control.value) {
      return;
    }

    const selectionEnd = Math.min(toggled.selectionEnd, next.length);
    control.setValue(next, { emitEvent: false });
    control.markAsDirty();
    this.syncBodyHighlight(next);

    queueMicrotask(() => {
      textarea.focus();
      textarea.setSelectionRange(toggled.selectionStart, selectionEnd);
      this.onBodySelectionChange();
      this.resizeBodyInput();
    });
  }

  protected toggleEmojiPicker(event: Event): void {
    event.stopPropagation();
    this.emojiPickerOpen.update((open) => {
      const next = !open;
      if (next) {
        this.emojiPage.set(0);
      }
      return next;
    });
  }

  protected goToPreviousEmojiPage(event: Event): void {
    event.stopPropagation();
    if (this.hasPreviousEmojiPage()) {
      this.emojiPage.update((page) => page - 1);
    }
  }

  protected goToNextEmojiPage(event: Event): void {
    event.stopPropagation();
    if (this.hasNextEmojiPage()) {
      this.emojiPage.update((page) => page + 1);
    }
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

    this.closeEdit(true);
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
      .updatePost(item.id, this.buildUpdatePayload({ title, body }))
      .pipe(finalize(() => this.isSaving.set(false)))
      .subscribe({
        next: (updated) => {
          this.geminiDraftActive.set(false);
          this.setPost(updated);
          this.closeEdit(true, () => {
            this.showSaveMessage(field === 'title' ? 'Title saved.' : 'Content saved.');
          });
        },
        error: (error) => {
          this.errorMessage.set(toApplicationError(error, 'Nie udało się zapisać posta.').description);
        },
      });
  }

  private startEdit(field: EditableField): void {
    const item = this.post();
    if (!item || this.editClosing()) {
      return;
    }

    this.clearEditCloseTimeout();
    this.editClosing.set(false);
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

  private isMobileViewport(): boolean {
    return typeof window !== 'undefined' && window.matchMedia('(max-width: 48rem)').matches;
  }

  private setGenerateDrawerOpen(open: boolean): void {
    if (open) {
      this.clearGenerateDrawerCloseTimeout();
      this.generateDrawerClosing.set(false);
    }

    this.generateDrawerOpen.set(open);
    document.body.classList.toggle('post-create-open', open);
  }

  private startGenerateDrawerClose(): void {
    if (!this.generateDrawerOpen() || this.generateDrawerClosing()) {
      return;
    }

    this.generateDrawerOpen.set(false);
    this.generateDrawerClosing.set(true);
    this.clearGenerateDrawerCloseTimeout();
    this.generateDrawerCloseTimeout = setTimeout(() => {
      this.generateDrawerClosing.set(false);
      document.body.classList.remove('post-create-open');
      this.generateDrawerCloseTimeout = undefined;
    }, drawerMotionDelay());
  }

  private clearGenerateDrawerCloseTimeout(): void {
    if (this.generateDrawerCloseTimeout === undefined) {
      return;
    }

    clearTimeout(this.generateDrawerCloseTimeout);
    this.generateDrawerCloseTimeout = undefined;
  }

  private resetView(): void {
    this.clearEditCloseTimeout();
    this.editClosing.set(false);
    this.editReadEnterField.set(null);
    this.disconnectBodyInputObserver();
    this.stopGeminiTypewriter();
    this.post.set(null);
    this.editingField.set(null);
    this.deleteConfirmOpen.set(false);
    this.clearGenerateDrawerCloseTimeout();
    this.generateDrawerOpen.set(false);
    this.generateDrawerClosing.set(false);
    document.body.classList.remove('post-create-open');
    this.geminiDraftActive.set(false);
    this.isGenerating.set(false);
    this.isTyping.set(false);
    this.geminiError.set(null);
    this.geminiPrompt.set('');
    this.isMetaSaving.set(false);
    this.statusMenuOpen.set(false);
    this.bodyBeforeGemini = '';
    this.wasEditingBodyBeforeGemini = false;
    this.isDeleting.set(false);
    this.isSavingAttachmentOrder.set(false);
    this.attachmentOrderDraft.set([]);
    this.linkedinPublications.set([]);
    this.isPublishingToLinkedIn.set(false);
    this.linkedinPublishMessage.set(null);
    this.linkedinPublishTone.set('success');
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
      status: item.status,
    });
    this.form.reset({ title, body });
    this.syncBodyHighlight(body);
    this.syncAttachmentPreviews(item.attachments ?? []);
    this.attachmentOrderDraft.set([...(item.attachments ?? [])]);
  }

  protected dropAttachment(event: CdkDragDrop<PostAttachmentItem[]>): void {
    if (event.previousIndex === event.currentIndex) {
      return;
    }

    const item = this.post();
    if (!item || this.isSavingAttachmentOrder()) {
      return;
    }

    const previousOrder = [...this.attachmentOrderDraft()];
    const moved = previousOrder[event.previousIndex];
    const target = previousOrder[event.currentIndex];
    if (!moved || moved.id === null || !target) {
      return;
    }

    const draft = [...previousOrder];
    moveItemInArray(draft, event.previousIndex, event.currentIndex);
    this.attachmentOrderDraft.set(draft);
    // The API moves a single attachment to the `order` of the slot it is dropped on.
    this.persistAttachmentOrder(item.id, moved.id, target.order, previousOrder);
  }

  private persistAttachmentOrder(
    postId: string,
    postAttachmentId: string,
    order: number,
    revertOnError: readonly PostAttachmentItem[]
  ): void {
    this.isSavingAttachmentOrder.set(true);
    this.errorMessage.set(null);

    this.postAttachmentService
      .updateOrder({ postId, postAttachmentId, order })
      .pipe(finalize(() => this.isSavingAttachmentOrder.set(false)))
      .subscribe({
        next: () => {
          this.postService.getPost(postId).subscribe({
            next: (updated) => {
              this.setPost(updated);
            },
            error: (error) => {
              this.attachmentOrderDraft.set([...revertOnError]);
              this.errorMessage.set(toApplicationError(error, 'Nie udało się odświeżyć posta.').description);
            },
          });
        },
        error: (error) => {
          this.attachmentOrderDraft.set([...revertOnError]);
          this.errorMessage.set(toApplicationError(error, 'Nie udało się zapisać kolejności załączników.').description);
        },
      });
  }

  @HostListener('window:resize')
  protected onWindowResize(): void {
    this.updateAttachmentsPickerScrollState();
  }

  protected onAttachmentsPickerCarouselScroll(): void {
    this.updateAttachmentsPickerScrollState();
  }

  protected attachmentsPickerPrev(): void {
    this.scrollAttachmentsPickerBy(-1);
  }

  protected attachmentsPickerNext(): void {
    this.scrollAttachmentsPickerBy(1);
  }

  private scrollAttachmentsPickerBy(direction: -1 | 1): void {
    const viewport = this.attachmentsPickerCarouselEl()?.nativeElement;
    if (!viewport) {
      return;
    }

    const amount = Math.max(1, Math.floor(viewport.clientWidth * 0.95));
    viewport.scrollBy({ left: direction * amount, behavior: 'smooth' });
    setTimeout(() => this.updateAttachmentsPickerScrollState(), 220);
  }

  private updateAttachmentsPickerScrollState(): void {
    const viewport = this.attachmentsPickerCarouselEl()?.nativeElement;
    if (!viewport) {
      this.attachmentsPickerCanPrev.set(false);
      this.attachmentsPickerCanNext.set(false);
      return;
    }

    const maxScrollLeft = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
    const left = viewport.scrollLeft;
    const epsilon = 2;
    this.attachmentsPickerCanPrev.set(left > epsilon);
    this.attachmentsPickerCanNext.set(left < maxScrollLeft - epsilon);
  }

  private scheduleAttachmentsPickerScrollSync(): void {
    // Wait for Angular to render + layout to settle (fonts, images, etc.)
    queueMicrotask(() => {
      this.updateAttachmentsPickerScrollState();
      requestAnimationFrame(() => this.updateAttachmentsPickerScrollState());
      setTimeout(() => this.updateAttachmentsPickerScrollState(), 120);
    });
  }

  protected openAttachmentsPicker(event?: Event): void {
    event?.stopPropagation();
    event?.preventDefault();

    if (this.isActionLocked()) {
      return;
    }

    this.attachmentsPickerError.set(null);
    this.attachmentsPickerOpen.set(true);
    this.selectedAttachmentIds.set(new Set());
    this.loadMediaForAttachments(1);
    this.scheduleAttachmentsPickerScrollSync();
  }

  protected closeAttachmentsPicker(): void {
    if (!this.attachmentsPickerOpen() || this.attachmentsPickerClosing()) {
      return;
    }

    this.clearAttachmentsPickerCloseTimeout();
    this.attachmentsPickerClosing.set(true);

    this.attachmentsPickerCloseTimeout = setTimeout(() => {
      this.attachmentsPickerOpen.set(false);
      this.attachmentsPickerClosing.set(false);
      this.attachmentsPickerError.set(null);
      this.attachmentsMediaPage.set(null);
      this.selectedAttachmentIds.set(new Set());
      this.attachmentsPickerCanPrev.set(false);
      this.attachmentsPickerCanNext.set(false);
    }, ATTACHMENTS_PICKER_CLOSE_MS);
  }

  private clearAttachmentsPickerCloseTimeout(): void {
    if (this.attachmentsPickerCloseTimeout) {
      clearTimeout(this.attachmentsPickerCloseTimeout);
      this.attachmentsPickerCloseTimeout = undefined;
    }
  }

  protected toggleAttachmentSelection(file: UserUploadedFileItem, event?: Event): void {
    event?.stopPropagation();
    event?.preventDefault();

    const next = new Set(this.selectedAttachmentIds());
    if (next.has(file.id)) {
      next.delete(file.id);
    } else {
      next.add(file.id);
    }
    this.selectedAttachmentIds.set(next);
    this.ensureAttachmentPreview(file);
  }

  protected isAttachmentSelected(fileId: string): boolean {
    return this.selectedAttachmentIds().has(fileId);
  }

  protected attachmentPreviewUrl(fileId: string): string | null {
    return this.attachmentPreviewUrls()[fileId] ?? null;
  }

  protected openAttachmentPreview(attachment: PostAttachmentItem): void {
    if (this.isActionLocked()) {
      return;
    }

    this.attachmentLightbox.set({
      title: `Attachment ${attachment.order}`,
      src: this.attachmentPreviewUrl(attachment.userUploadedFileId),
    });
  }

  protected requestDeleteAttachment(attachment: PostAttachmentItem, event?: Event): void {
    event?.stopPropagation();
    event?.preventDefault();

    if (attachment.id === null || this.isAttachmentBusy() || this.isActionLocked()) {
      return;
    }

    this.clearSaveMessage();
    this.errorMessage.set(null);
    this.deleteConfirmAttachmentId.set(attachment.id);

    this.deleteConfirm
      .open({
        title: `Remove attachment ${attachment.order}?`,
        description:
          'This image will be removed from the post. The file will remain in your Media library.',
        keepLabel: 'Keep attachment',
        deleteLabel: 'Remove attachment',
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((confirmed) => {
        this.deleteConfirmAttachmentId.set(null);
        if (confirmed) {
          this.performDeleteAttachment(attachment.id!);
        }
      });
  }

  private performDeleteAttachment(postAttachmentId: string): void {
    const item = this.post();
    if (!item || this.isDeletingAttachment()) {
      return;
    }

    this.isDeletingAttachment.set(true);
    this.errorMessage.set(null);
    this.clearSaveMessage();

    this.postAttachmentService
      .delete({ postId: item.id, postAttachmentId })
      .pipe(finalize(() => this.isDeletingAttachment.set(false)))
      .subscribe({
        next: () => {
          this.postService.getPost(item.id).subscribe({
            next: (updated) => {
              this.setPost(updated);
              this.showSaveMessage('Attachment removed.');
            },
            error: (error) => {
              this.errorMessage.set(toApplicationError(error, 'Nie udało się odświeżyć posta.').description);
            },
          });
        },
        error: (error) => {
          this.errorMessage.set(toApplicationError(error, 'Nie udało się usunąć załącznika.').description);
        },
      });
  }

  protected attachSelectedMedia(): void {
    const item = this.post();
    if (!item) {
      return;
    }

    const selected = [...this.selectedAttachmentIds()];
    if (selected.length === 0) {
      this.closeAttachmentsPicker();
      return;
    }

    if (this.isAttaching()) {
      return;
    }

    this.isAttaching.set(true);
    this.attachmentsPickerError.set(null);

    this.postAttachmentService
      .create({ postId: item.id, fileIds: selected })
      .pipe(finalize(() => this.isAttaching.set(false)))
      .subscribe({
        next: () => {
          this.postService.getPost(item.id).subscribe({
            next: (updated) => {
              this.setPost(updated);
              this.showSaveMessage('Attachments saved.');
              this.closeAttachmentsPicker();
            },
            error: (error) => {
              this.attachmentsPickerError.set(toApplicationError(error, 'Nie udało się odświeżyć posta.').description);
            },
          });
        },
        error: (error) => {
          this.attachmentsPickerError.set(toApplicationError(error, 'Nie udało się dodać obrazów do posta.').description);
        },
      });
  }

  private loadMediaForAttachments(pageNumber: number): void {
    this.attachmentsPickerLoading.set(true);
    this.attachmentsPickerError.set(null);
    this.scheduleAttachmentsPickerScrollSync();

    this.fileService
      .getFiles(pageNumber, 60, { sortBy: 'CreatedAt', isAscending: false })
      .pipe(finalize(() => this.attachmentsPickerLoading.set(false)))
      .subscribe({
        next: (page) => {
          this.attachmentsMediaPage.set(page);
          this.syncAttachmentPickerPreviews(page.items);
          this.scheduleAttachmentsPickerScrollSync();
        },
        error: (error) => {
          this.attachmentsMediaPage.set(null);
          this.attachmentsPickerError.set(toApplicationError(error, 'Nie udało się wczytać mediów.').description);
        },
      });
  }

  private syncAttachmentPreviews(attachments: readonly { userUploadedFileId: string }[]): void {
    const ids = [...new Set(attachments.map((a) => a.userUploadedFileId))];
    for (const id of ids) {
      if (this.attachmentPreviewUrls()[id]) {
        continue;
      }

      this.fileService
        .getPreviewUrl(id)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (url) => {
            this.attachmentPreviewUrls.update((current) => ({ ...current, [id]: url }));
          },
          error: () => {
            // ignore
          },
        });
    }
  }

  private syncAttachmentPickerPreviews(files: UserUploadedFileItem[]): void {
    for (const file of files) {
      this.ensureAttachmentPreview(file);
    }
    this.scheduleAttachmentsPickerScrollSync();
  }

  private ensureAttachmentPreview(file: UserUploadedFileItem): void {
    if (this.attachmentPreviewUrls()[file.id]) {
      return;
    }

    this.fileService
      .getPreviewUrl(file.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (url) => {
          this.attachmentPreviewUrls.update((current) => ({ ...current, [file.id]: url }));
        },
        error: () => {
          // placeholder stays
        },
      });
  }

  private revokeAttachmentPreviewUrls(): void {
    this.attachmentPreviewUrls.set({});
  }

  private buildUpdatePayload(
    overrides: Partial<Pick<UpdatePostPayload, 'title' | 'body' | 'status' | 'platforms'>> = {},
  ): UpdatePostPayload {
    const item = this.post();
    if (!item) {
      throw new Error('Post is not loaded.');
    }

    const title =
      overrides.title !== undefined
        ? this.clampTitle(overrides.title)
        : this.editingField() === 'title'
          ? this.clampTitle(this.form.controls.title.value.trim())
          : this.clampTitle(item.title);
    const bodyValue =
      overrides.body !== undefined
        ? overrides.body
        : this.editingField() === 'body' || this.geminiDraftActive()
          ? this.form.controls.body.value.trim()
          : item.body;

    const platforms =
      overrides.platforms !== undefined
        ? overrides.platforms
        : item.platforms.length > 0
          ? item.platforms
          : [...DEFAULT_POST_PLATFORMS];

    return {
      title,
      body: normalizeUpdatePostBody(this.clampBody(bodyValue)),
      status: overrides.status ?? item.status,
      platforms: [...platforms],
    };
  }

  private savePostMetadata(
    overrides: Partial<Pick<UpdatePostPayload, 'status'>>,
    snapshot?: { status?: PostStatus }
  ): void {
    const item = this.post();
    if (!item) {
      return;
    }

    this.isMetaSaving.set(true);
    this.errorMessage.set(null);
    this.clearSaveMessage();

    this.postService
      .updatePost(item.id, this.buildUpdatePayload(overrides))
      .pipe(finalize(() => this.isMetaSaving.set(false)))
      .subscribe({
        next: (updated) => {
          this.setPost(updated);
          this.showSaveMessage('Publishing details saved.');
        },
        error: (error) => {
          if (snapshot) {
            this.post.update((current) =>
              current
                ? {
                    ...current,
                    status: snapshot.status ?? current.status,
                  }
                : current
            );
          }

          this.errorMessage.set(toApplicationError(error, 'Nie udało się zapisać szczegółów posta.').description);
        },
      });
  }

  private focusField(field: EditableField): void {
    queueMicrotask(() => {
      requestAnimationFrame(() => {
        const input =
          field === 'title' ? this.titleInput()?.nativeElement : this.bodyInput()?.nativeElement;
        input?.focus({ preventScroll: true });
        input?.setSelectionRange(input.value.length, input.value.length);

        if (field === 'body') {
          this.resizeBodyInput();
        }
      });
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

  private abortGeminiDraft(reopenDrawer: boolean): void {
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
      if (reopenDrawer) {
        this.setGenerateDrawerOpen(true);
      }
      return;
    }

    this.closeEdit(true, () => {
      if (reopenDrawer) {
        this.setGenerateDrawerOpen(true);
      }
    });
  }

  private closeEdit(animated = true, onComplete?: () => void): void {
    if (this.editingField() === null) {
      onComplete?.();
      return;
    }

    if (this.editClosing()) {
      return;
    }

    if (!animated) {
      this.finishEdit();
      onComplete?.();
      return;
    }

    this.emojiPickerOpen.set(false);
    this.editClosing.set(true);
    this.clearEditCloseTimeout();
    this.editCloseTimeout = setTimeout(() => {
      this.editCloseTimeout = undefined;
      this.finishEdit(true);
      onComplete?.();
    }, EDIT_CLOSE_MS);
  }

  private finishEdit(animateRead = false): void {
    const field = this.editingField();
    this.editClosing.set(false);
    this.emojiPickerOpen.set(false);
    this.disconnectBodyInputObserver();
    this.editingField.set(null);
    this.clearSaveMessage();

    if (animateRead && field) {
      this.editReadEnterField.set(field);
      setTimeout(() => {
        if (this.editReadEnterField() === field) {
          this.editReadEnterField.set(null);
        }
      }, EDIT_CLOSE_MS);
    }
  }

  private clearEditCloseTimeout(): void {
    if (this.editCloseTimeout !== undefined) {
      clearTimeout(this.editCloseTimeout);
      this.editCloseTimeout = undefined;
    }
  }

  private triggerStatusPulse(): void {
    if (
      typeof globalThis !== 'undefined' &&
      globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
    ) {
      return;
    }

    this.clearStatusPulseTimeout();
    this.statusPulse.set(false);
    queueMicrotask(() => {
      this.statusPulse.set(true);
      this.statusPulseTimeout = setTimeout(() => {
        this.statusPulse.set(false);
        this.statusPulseTimeout = undefined;
      }, STATUS_PULSE_MS);
    });
  }

  private clearStatusPulseTimeout(): void {
    if (this.statusPulseTimeout !== undefined) {
      clearTimeout(this.statusPulseTimeout);
      this.statusPulseTimeout = undefined;
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
