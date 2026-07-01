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
  normalizePostTitle,
  normalizePostBody,
  parseHashtagSegments,
  POST_BODY_MAX_LENGTH,
  POST_STATUS_OPTIONS,
  POST_TITLE_MAX_LENGTH,
  PLATFORM_TYPES,
  arePostTagsEqual,
  getPlatformTypeLabel,
  getPlatformTypeName,
  getPostStatusClass,
  getPostStatusLabel,
  hasPostTag,
  normalizePostTags,
  normalizeUpdatePostBody,
  type PlatformType,
  type PostAttachmentItem,
  type PostItem,
  type PostStatus,
  type UpdatePostPayload,
} from '../../../models/post';
import { GeminiService } from '../../../services/gemini';
import { AuthService } from '../../../services/auth';
import { getUserInitials, type UserAccount } from '../../../models/user-account';
import { parseChatMessageBlocks, mapConversationToChatMessages, GEMINI_PROMPT_MAX_LENGTH, GEMINI_CHAT_PROMPT_MAX_LENGTH, type GeminiChatMessage } from '../../../models/gemini';
import { PostService } from '../../../services/post';
import { PostAttachmentService } from '../../../services/post-attachment';
import { UserUploadedFileService } from '../../../services/user-uploaded-file';
import { UserPlatformService } from '../../../services/user-platform';
import { LINKEDIN_PLATFORM_ID, type UserPlatform } from '../../../models/user-platform';
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
import { DashboardDeleteButton } from '../shared/dashboard-delete-button/dashboard-delete-button';
import { DashboardPlatformLogo, type PlatformLogoSize } from '../shared/dashboard-platform-logo/dashboard-platform-logo';
import { DashboardImageLightbox } from '../shared/dashboard-image-lightbox/dashboard-image-lightbox';
import { DashboardLinkedinPostPreview } from '../shared/dashboard-linkedin-post-preview/dashboard-linkedin-post-preview';
import { AutoExpandTextarea } from '../../../components/auto-expand-textarea/auto-expand-textarea';
import { DashboardDeleteConfirmService } from '../shared/dashboard-delete-confirm-sheet/dashboard-delete-confirm.service';
import {
  postMetaChipAnimation,
  postMetaFadeSlideAnimation,
  postMetaPanelAnimation,
} from '../shared/post-meta.animations';

type EditableField = 'title' | 'body';

type AttachmentLightboxPreview = {
  title: string;
  src: string | null;
};

const SAVE_MESSAGE_DURATION_MS = 5000;
const GEMINI_CHAT_CLOSE_MS = 200;
const GEMINI_POPUP_CLOSE_MS = GEMINI_CHAT_CLOSE_MS;
const EDIT_CLOSE_MS = 220;
const STATUS_PULSE_MS = 320;
const ATTACHMENTS_PICKER_CLOSE_MS = 280;

type PostForm = FormGroup<{
  title: FormControl<string>;
  body: FormControl<string>;
}>;

@Component({
  selector: 'app-dashboard-post-detail',
  imports: [RouterLink, DatePipe, DisplayDatetimePipe, NgClass, ReactiveFormsModule, MatTooltip, MatButtonModule, NgTemplateOutlet, PageLoading, PageRevealDirective, DashboardDeleteButton, DashboardPlatformLogo, DashboardImageLightbox, DashboardLinkedinPostPreview, AutoExpandTextarea],
  animations: [postMetaChipAnimation, postMetaFadeSlideAnimation, postMetaPanelAnimation],
  styleUrl: './dashboard-post-detail.scss',
  template: `
    <section class="dashboard-content-page post-detail" aria-labelledby="post-detail-title">
      <header class="post-detail__header">
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
                <div class="post-detail__platforms-anchor" #platformsAnchor>
                  <button
                    type="button"
                    class="post-detail__platforms-trigger"
                    [class.post-detail__platforms-trigger--open]="platformMenuOpen()"
                    [class.post-detail__platforms-trigger--empty]="item.tags.length === 0"
                    [class.post-detail__platforms-trigger--has-tags]="item.tags.length > 0"
                    matTooltip="Edit platforms"
                    matTooltipPosition="below"
                    [matTooltipDisabled]="tooltipsDisabled()"
                    aria-label="Edit platforms"
                    [attr.aria-expanded]="platformMenuOpen()"
                    aria-controls="post-detail-platforms-menu"
                    [disabled]="isMetaSaving() || isActionLocked()"
                    (click)="togglePlatformMenu($event)"
                  >
                    <span class="post-detail__platforms-trigger-content">
                      @if (item.tags.length === 0) {
                        <span class="post-detail__platforms-empty" @postMetaFadeSlide>
                          <span class="material-icons post-detail__platforms-trigger-icon" aria-hidden="true">hub</span>
                          <span class="post-detail__platforms-trigger-label">Platforms</span>
                        </span>
                      } @else {
                        <span class="post-detail__platforms-trigger-logos" @postMetaFadeSlide aria-hidden="true">
                          @for (tag of item.tags; track tag) {
                            <span class="post-detail__platforms-trigger-logo" @postMetaChip>
                              <app-dashboard-platform-logo
                                [platformType]="platformTypeName(tag)"
                                [size]="headerPlatformLogoSize()"
                                [compact]="headerPlatformLogosCompact()"
                              />
                            </span>
                          }
                        </span>
                      }
                      <span class="material-icons post-detail__platforms-trigger-chevron" aria-hidden="true">expand_more</span>
                    </span>
                  </button>

                  @if (platformMenuOpen()) {
                    <div
                      id="post-detail-platforms-menu"
                      class="post-detail__platforms-menu"
                      @postMetaPanel
                      role="menu"
                      aria-label="Platforms"
                      (click)="$event.stopPropagation()"
                    >
                      @for (platform of platformTypes; track platform.value) {
                        <button
                          type="button"
                          class="post-detail__platforms-menu-item"
                          role="menuitemcheckbox"
                          [class.post-detail__platforms-menu-item--active]="hasPostTag(item.tags, platform.value)"
                          [attr.aria-checked]="hasPostTag(item.tags, platform.value)"
                          [disabled]="isMetaSaving() || isActionLocked()"
                          (click)="onTagToggle(platform.value)"
                        >
                          <app-dashboard-platform-logo [platformType]="platform.type" size="sm" />
                          <span class="post-detail__platforms-menu-label">{{ platform.label }}</span>
                          @if (hasPostTag(item.tags, platform.value)) {
                            <span
                              class="material-icons post-detail__platforms-menu-check"
                              @postMetaChip
                              aria-hidden="true"
                            >check</span>
                          }
                        </button>
                      }
                    </div>
                  }
                </div>

                <span class="post-detail__header-meta-sep" aria-hidden="true">·</span>

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
                <p id="post-title-hint" class="dashboard-edit-hint">
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
        } @else {
          <h1 id="post-detail-title" class="post-detail__title">Post</h1>
        }
      </header>

      @if (isLoading()) {
        <app-page-loading label="Loading post…" />
      }

      @if (errorMessage()) {
        <p class="posts-status posts-status--error" role="alert">{{ errorMessage() }}</p>
      }

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
                <div class="post-detail__gemini-anchor" #geminiAnchor>
                  <button
                    type="button"
                    class="post-detail__gemini-btn"
                    [class.post-detail__gemini-btn--active]="geminiPopupOpen() || geminiPopupClosing()"
                    [class.post-detail__gemini-btn--busy]="isGenerating() || isTyping()"
                    matTooltip="Generate with AI"
                    matTooltipPosition="below"
                    [matTooltipDisabled]="tooltipsDisabled()"
                    aria-label="Generate content with AI"
                    [attr.aria-expanded]="geminiPopupOpen() || geminiPopupClosing()"
                    aria-controls="post-gemini-popup"
                    [disabled]="!canUseGemini()"
                    (click)="toggleGeminiPopup($event)"
                  >
                    <span class="post-detail__gemini-btn-icon" aria-hidden="true">
                      <span class="material-icons">auto_awesome</span>
                    </span>
                    <span class="post-detail__gemini-btn-label">Generate</span>
                  </button>

                  @if (geminiPopupOpen() || geminiPopupClosing()) {
                    <button
                      type="button"
                      class="gemini-popup-backdrop"
                      [class.gemini-popup-backdrop--closing]="geminiPopupClosing()"
                      aria-label="Close AI panel"
                      (click)="closeGeminiPopup()"
                    ></button>
                    <div
                      id="post-gemini-popup"
                      class="gemini-popup"
                      [class.gemini-popup--closing]="geminiPopupClosing()"
                      role="dialog"
                      aria-label="Generate content with Starvia AI"
                      (click)="$event.stopPropagation()"
                    >
                      <header class="gemini-popup__head">
                        <div class="gemini-popup__head-copy">
                          <span class="gemini-popup__badge" aria-hidden="true">
                            <span class="material-icons">auto_awesome</span>
                          </span>
                          <p class="gemini-popup__title">Starvia AI</p>
                        </div>
                        <button
                          type="button"
                          class="gemini-popup__close"
                          aria-label="Close generate panel"
                          (click)="closeGeminiPopup()"
                        >
                          <span class="material-icons" aria-hidden="true">close</span>
                        </button>
                      </header>

                      @if (geminiError()) {
                        <p class="field__error gemini-popup__error" role="alert">{{ geminiError() }}</p>
                      }
                      @if (hasExistingBodyContent()) {
                        <div class="gemini-popup__replace-notice" role="note">
                          <span class="material-icons" aria-hidden="true">info</span>
                          <p>
                            Your current post content will be
                            <strong>replaced</strong>
                            by the generated draft.
                          </p>
                        </div>
                      }

                      <div class="gemini-popup__composer">
                        @if (hasPostContentToAttach()) {
                          <div class="gemini-chatbot__composer-toolbar gemini-popup__composer-toolbar">
                            <label
                              class="gemini-chatbot__attach"
                              matTooltip="Includes post content so Starvia AI can refine the existing draft."
                              matTooltipPosition="above"
                              [matTooltipDisabled]="tooltipsDisabled()"
                            >
                              <input
                                type="checkbox"
                                class="gemini-chatbot__attach-input"
                                [checked]="includePostTextInGenerate()"
                                [disabled]="!canUseGemini()"
                                (change)="onIncludePostTextInGenerateChange($event)"
                              />
                              <span class="gemini-chatbot__attach-chip">
                                <span class="material-icons" aria-hidden="true">description</span>
                                Include content
                              </span>
                            </label>
                          </div>
                        }
                        <div class="gemini-prompt-input-row">
                          <app-auto-expand-textarea
                            #geminiPromptInput
                            id="post-gemini-prompt"
                            variant="gemini"
                            [value]="geminiPrompt()"
                            [maxLength]="geminiPromptMaxLength"
                            [enterSubmits]="true"
                            placeholder="Describe what Starvia AI should write…"
                            [disabled]="!canUseGemini()"
                            (valueChange)="onGeminiPromptValueChange($event)"
                            (enter)="generateWithGemini()"
                          />
                          @if (!hasExistingBodyContent()) {
                            <button
                              type="button"
                              class="gemini-prompt-send"
                              aria-label="Generate with AI"
                              [disabled]="!canSendGeminiGenerate()"
                              (click)="generateWithGemini()"
                            >
                              <span class="material-icons" aria-hidden="true">auto_awesome</span>
                            </button>
                          }
                        </div>
                        <p
                          class="gemini-prompt-meta"
                          [class.gemini-prompt-meta--limit]="geminiPrompt().length >= geminiPromptMaxLength"
                          aria-live="polite"
                        >
                          {{ geminiPrompt().length }}/{{ geminiPromptMaxLength }}
                        </p>
                        @if (hasExistingBodyContent()) {
                          <button
                            type="button"
                            class="gemini-popup__replace-btn"
                            [disabled]="!canSendGeminiGenerate()"
                            (click)="generateWithGemini()"
                          >
                            <span class="material-icons" aria-hidden="true">auto_awesome</span>
                            Replace &amp; generate
                          </button>
                        }
                      </div>
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
                class="dashboard-edit-panel"
                [class.dashboard-edit-panel--closing]="editClosing()"
                [class.dashboard-edit-panel--ai-writing]="isGenerating() || isTyping()"
                [class.dashboard-edit-panel--typing]="isTyping()"
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
                      <p class="post-detail__ai-generating-label">Ai is drafting your post…</p>
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
                  @if (form.controls.body.touched && form.controls.body.hasError('maxlength')) {
                    <p id="post-body-error" class="field__error" role="alert">
                      Content cannot exceed {{ bodyMaxLength }} characters.
                    </p>
                  }
                  @if (geminiDraftActive() && geminiError()) {
                    <p class="field__error gemini-field-error" role="alert">{{ geminiError() }}</p>
                  }
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
                <p id="post-detail-attachments" class="post-detail__card-label">Attachments</p>
                <p class="post-detail__card-hint">Select images from your Media library</p>
              </div>
              <div class="post-detail__card-actions">
                <button
                  #attachmentsTriggerEl
                  type="button"
                  class="btn btn--raised-secondary btn--compact"
                  [disabled]="isLoading() || isSaving() || isMetaSaving() || isDeleting() || isActionLocked()"
                  (click)="openAttachmentsPicker($event)"
                >
                  Add images
                </button>
              </div>
            </div>

            <div class="post-detail__card-body post-detail__attachments-body">
              @if (item.attachments.length === 0) {
                <p class="post-detail__attachments-empty">No images attached yet.</p>
              } @else {
                <div class="post-detail__attachments-grid" role="list" aria-label="Attached images">
                  @for (att of item.attachments; track att.userUploadedFileId) {
                    <div class="post-detail__attachment" role="listitem">
                      <button
                        type="button"
                        class="post-detail__attachment-preview-btn"
                        [attr.aria-label]="'Preview attachment ' + att.order"
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
                      <span class="post-detail__attachment-order" aria-label="Attachment order">{{ att.order }}</span>
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
                  <div class="post-attachments-picker__head-copy">
                    <span class="post-attachments-picker__badge" aria-hidden="true">
                      <span class="material-icons">photo_library</span>
                    </span>
                    <div class="post-attachments-picker__head-text">
                      <p class="post-attachments-picker__title">Media</p>
                      <p class="post-attachments-picker__hint">
                        Select images to attach
                        @if (selectedAttachmentIds().size > 0) {
                          <span class="post-attachments-picker__selected">
                            · <strong>{{ selectedAttachmentIds().size }}</strong> selected
                          </span>
                        }
                      </p>
                    </div>
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

                @if (attachmentsPickerError()) {
                  <p class="field__error post-attachments-picker__error" role="alert">{{ attachmentsPickerError() }}</p>
                }

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
                        class="btn btn--raised-secondary btn--compact post-attachments-picker__nav"
                        [disabled]="attachmentsPickerLoading() || !attachmentsPickerCanPrev()"
                        aria-label="Previous media images"
                        (click)="attachmentsPickerPrev()"
                      >
                        <span class="material-icons" aria-hidden="true">chevron_left</span>
                        Prev
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
                        class="btn btn--raised-secondary btn--compact post-attachments-picker__nav"
                        [disabled]="attachmentsPickerLoading() || !attachmentsPickerCanNext()"
                        aria-label="Next media images"
                        (click)="attachmentsPickerNext()"
                      >
                        Next
                        <span class="material-icons" aria-hidden="true">chevron_right</span>
                      </button>
                    </div>
                  }

                  <footer class="post-attachments-picker__foot">
                    <div class="post-attachments-picker__actions">
                      <button
                        type="button"
                        class="btn btn--raised-primary btn--compact"
                        [disabled]="isAttaching() || attachmentsPickerLoading() || selectedAttachmentIds().size === 0"
                        (click)="attachSelectedMedia()"
                      >
                        {{ isAttaching() ? 'Attaching…' : 'Attach selected' }}
                      </button>
                      <button
                        type="button"
                        class="btn btn--raised-secondary btn--compact"
                        [disabled]="isAttaching()"
                        (click)="closeAttachmentsPicker()"
                      >
                        Cancel
                      </button>
                    </div>
                  </footer>
                }
              </div>
            }
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

    @if (post()) {
      <div class="gemini-chatbot" [class.gemini-chatbot--open]="geminiChatOpen() || geminiChatClosing()">
        @if (geminiChatOpen() || geminiChatClosing()) {
          <section
            id="post-gemini-chatbot"
            class="gemini-chatbot__panel"
            [class.gemini-chatbot__panel--closing]="geminiChatClosing()"
            role="dialog"
            aria-label="Starvia AI chat"
            aria-labelledby="post-detail-chat"
          >
            <header class="gemini-chatbot__head">
              <div class="gemini-chatbot__head-copy">
                <span class="gemini-chatbot__badge" aria-hidden="true">
                  <span class="material-icons">auto_awesome</span>
                </span>
                <p id="post-detail-chat" class="gemini-chatbot__title">Starvia AI</p>
              </div>
              <button
                type="button"
                class="gemini-chatbot__close"
                aria-label="Close chat"
                (click)="closeGeminiChat()"
              >
                <span class="material-icons" aria-hidden="true">close</span>
              </button>
            </header>

            <div
              #geminiChatMessagesEl
              class="gemini-chatbot__messages"
              aria-live="polite"
              (scroll)="onGeminiChatScroll($event)"
            >
              @if (geminiChatMessages().length === 0 && !isAskGeminiLoading() && !isAskGeminiHistoryLoading()) {
                <p class="gemini-chatbot__empty">
                  Ask Starvia AI about tone, structure, hashtags, or how to improve this post.
                </p>
              }

              @for (message of geminiChatMessages(); track message.id) {
                <article
                  class="gemini-chatbot__message"
                  [class.gemini-chatbot__message--user]="message.role === 'user'"
                  [class.gemini-chatbot__message--assistant]="message.role === 'assistant'"
                  [attr.aria-label]="message.role === 'user' ? 'Your message' : 'Starvia response'"
                >
                  @if (message.role === 'assistant') {
                    <span class="gemini-chatbot__avatar gemini-chatbot__avatar--starvia" aria-hidden="true">
                      <img
                        class="gemini-chatbot__avatar-logo"
                        src="/starvia-logo.png"
                        alt=""
                        width="22"
                        height="22"
                        decoding="async"
                      />
                    </span>
                  }

                  <div class="gemini-chatbot__message-body">
                    @if (message.attachedPostText) {
                      <span class="gemini-chatbot__attachment">
                        <span class="material-icons" aria-hidden="true">description</span>
                        Content attached
                      </span>
                    }
                    <div class="gemini-chatbot__message-content">
                      @if (chatMessageBlocks(message.text).length === 0 && message.isTyping) {
                        <p class="gemini-chatbot__message-text">
                          <span class="post-detail__typing-cursor" aria-hidden="true"></span>
                        </p>
                      }
                      @for (block of chatMessageBlocks(message.text); track $index; let isLastBlock = $last) {
                        @switch (block.type) {
                          @case ('heading') {
                            <h4 class="gemini-chatbot__heading">
                              @for (segment of block.segments; track $index) {
                                @if (segment.bold) {
                                  <strong>{{ segment.text }}</strong>
                                } @else {
                                  <span>{{ segment.text }}</span>
                                }
                              }
                              @if (isLastBlock && message.isTyping) {
                                <span class="post-detail__typing-cursor" aria-hidden="true"></span>
                              }
                            </h4>
                          }
                          @case ('list') {
                            <ul class="gemini-chatbot__list">
                              @for (item of block.items; track $index; let isLastItem = $last) {
                                <li class="gemini-chatbot__list-item">
                                  @for (segment of item; track $index) {
                                    @if (segment.bold) {
                                      <strong>{{ segment.text }}</strong>
                                    } @else {
                                      <span>{{ segment.text }}</span>
                                    }
                                  }
                                  @if (isLastBlock && isLastItem && message.isTyping) {
                                    <span class="post-detail__typing-cursor" aria-hidden="true"></span>
                                  }
                                </li>
                              }
                            </ul>
                          }
                          @case ('ordered-list') {
                            <ol class="gemini-chatbot__olist">
                              @for (item of block.items; track $index; let itemIndex = $index; let isLastItem = $last) {
                                <li class="gemini-chatbot__olist-item">
                                  <span class="gemini-chatbot__olist-num" aria-hidden="true">{{
                                    itemIndex + 1
                                  }}</span>
                                  <p class="gemini-chatbot__olist-title">
                                    @for (segment of item.title; track $index) {
                                      @if (segment.bold) {
                                        <strong>{{ segment.text }}</strong>
                                      } @else {
                                        <span>{{ segment.text }}</span>
                                      }
                                    }
                                    @if (
                                      isLastBlock &&
                                      isLastItem &&
                                      message.isTyping &&
                                      !item.body.length &&
                                      !item.bullets.length
                                    ) {
                                      <span class="post-detail__typing-cursor" aria-hidden="true"></span>
                                    }
                                  </p>
                                  @if (item.body.length) {
                                    <p class="gemini-chatbot__olist-body">
                                      @for (segment of item.body; track $index) {
                                        @if (segment.bold) {
                                          <strong>{{ segment.text }}</strong>
                                        } @else {
                                          <span>{{ segment.text }}</span>
                                        }
                                      }
                                      @if (
                                        isLastBlock &&
                                        isLastItem &&
                                        message.isTyping &&
                                        !item.bullets.length
                                      ) {
                                        <span class="post-detail__typing-cursor" aria-hidden="true"></span>
                                      }
                                    </p>
                                  }
                                  @if (item.bullets.length) {
                                    <ul class="gemini-chatbot__list gemini-chatbot__list--nested">
                                      @for (bullet of item.bullets; track $index; let isLastBullet = $last) {
                                        <li class="gemini-chatbot__list-item">
                                          @for (segment of bullet; track $index) {
                                            @if (segment.bold) {
                                              <strong>{{ segment.text }}</strong>
                                            } @else {
                                              <span>{{ segment.text }}</span>
                                            }
                                          }
                                          @if (isLastBlock && isLastItem && isLastBullet && message.isTyping) {
                                            <span class="post-detail__typing-cursor" aria-hidden="true"></span>
                                          }
                                        </li>
                                      }
                                    </ul>
                                  }
                                </li>
                              }
                            </ol>
                          }
                          @default {
                            <p class="gemini-chatbot__message-text">
                              @for (segment of block.segments; track $index) {
                                @if (segment.bold) {
                                  <strong>{{ segment.text }}</strong>
                                } @else {
                                  <span>{{ segment.text }}</span>
                                }
                              }
                              @if (isLastBlock && message.isTyping) {
                                <span class="post-detail__typing-cursor" aria-hidden="true"></span>
                              }
                            </p>
                          }
                        }
                      }
                    </div>
                  </div>

                  @if (message.role === 'user') {
                    <span class="gemini-chatbot__avatar gemini-chatbot__avatar--user" aria-hidden="true">
                      {{ userInitials() }}
                    </span>
                  }
                </article>
              }

              @if (isAskGeminiLoading() || isAskGeminiHistoryLoading()) {
                <div class="gemini-chatbot__thinking" aria-live="polite">
                  <span class="gemini-chatbot__avatar gemini-chatbot__avatar--starvia" aria-hidden="true">
                    <img
                      class="gemini-chatbot__avatar-logo"
                      src="/starvia-logo.png"
                      alt=""
                      width="22"
                      height="22"
                      decoding="async"
                    />
                  </span>
                  <div class="gemini-chatbot__thinking-body">
                    <div class="gemini-chatbot__thinking-dots" aria-hidden="true">
                      <span></span>
                      <span></span>
                      <span></span>
                    </div>
                    <p class="gemini-chatbot__thinking-label">Starvia AI is thinking…</p>
                    <span class="sr-only">Waiting for response</span>
                  </div>
                </div>
              }

              <div #geminiChatScrollAnchor class="gemini-chatbot__scroll-anchor" aria-hidden="true"></div>
            </div>

            @if (geminiChatError()) {
              <p class="field__error gemini-chatbot__error" role="alert">{{ geminiChatError() }}</p>
            }

            <div class="gemini-chatbot__composer">
              <div class="gemini-chatbot__composer-toolbar">
                <label
                  class="gemini-chatbot__attach"
                  matTooltip="Includes post content so Starvia AI can give more relevant answers."
                  matTooltipPosition="above"
                  [matTooltipDisabled]="tooltipsDisabled() || !hasPostContentToAttach()"
                >
                  <input
                    type="checkbox"
                    class="gemini-chatbot__attach-input"
                    [checked]="includePostTextInChat()"
                    [disabled]="!canUseGeminiChat() || !hasPostContentToAttach()"
                    (change)="onIncludePostTextInChatChange($event)"
                  />
                  <span class="gemini-chatbot__attach-chip">
                    <span class="material-icons" aria-hidden="true">description</span>
                    Include content
                  </span>
                </label>
                <p
                  class="gemini-prompt-meta gemini-prompt-meta--inline"
                  [class.gemini-prompt-meta--limit]="geminiChatPrompt().length >= geminiChatPromptMaxLength"
                  aria-live="polite"
                >
                  {{ geminiChatPrompt().length }}/{{ geminiChatPromptMaxLength }}
                </p>
              </div>

              <div class="gemini-prompt-input-row">
                <app-auto-expand-textarea
                  #geminiChatPromptInput
                  id="post-gemini-chat-prompt"
                  variant="gemini-chat"
                  [value]="geminiChatPrompt()"
                  [maxLength]="geminiChatPromptMaxLength"
                  [enterSubmits]="true"
                  placeholder="Ask anything about this post…"
                  [disabled]="!canUseGeminiChat()"
                  (valueChange)="onGeminiChatPromptValueChange($event)"
                  (enter)="sendGeminiChatMessage()"
                />
                <button
                  type="button"
                  class="gemini-prompt-send gemini-prompt-send--chat"
                  aria-label="Send message to Gemini"
                  [disabled]="!canSendGeminiChat()"
                  (click)="sendGeminiChatMessage()"
                >
                  <span class="material-icons" aria-hidden="true">arrow_upward</span>
                </button>
              </div>
            </div>
          </section>
        }

        @if (!geminiChatOpen() && !geminiChatClosing()) {
          <button
            type="button"
            class="gemini-chatbot__launcher"
            [attr.aria-expanded]="false"
            aria-controls="post-gemini-chatbot"
            aria-label="Open Ask AI chat"
            [disabled]="!post()"
            (click)="toggleGeminiChat()"
          >
            <img
              class="gemini-chatbot__launcher-logo"
              src="/starvia-logo.png"
              alt=""
              aria-hidden="true"
              width="22"
              height="22"
            />
            <span class="gemini-chatbot__launcher-label">Ask AI</span>
          </button>
        }
      </div>
    }

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
          class="btn btn--raised-primary btn--compact"
          [disabled]="isSaving() || control.invalid || isGenerating() || isTyping()"
          (click)="saveField(field)"
        >
          {{ isSaving() ? 'Saving…' : 'Save' }}
        </button>
        <button
          type="button"
          class="btn btn--raised-secondary btn--compact"
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
  private readonly deleteConfirm = inject(DashboardDeleteConfirmService);
  private readonly geminiService = inject(GeminiService);
  private readonly authService = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly titleInput = viewChild<ElementRef<HTMLTextAreaElement>>('titleInput');
  private readonly bodyInput = viewChild<ElementRef<HTMLTextAreaElement>>('bodyInput');
  private readonly bodyHighlight = viewChild<ElementRef<HTMLDivElement>>('bodyHighlight');
  private readonly emojiAnchor = viewChild<ElementRef<HTMLElement>>('emojiAnchor');
  private readonly geminiAnchor = viewChild<ElementRef<HTMLElement>>('geminiAnchor');
  private readonly platformsAnchor = viewChild<ElementRef<HTMLElement>>('platformsAnchor');
  private readonly statusAnchor = viewChild<ElementRef<HTMLElement>>('statusAnchor');
  private readonly geminiPromptInput = viewChild<AutoExpandTextarea>('geminiPromptInput');
  private readonly geminiChatPromptInput = viewChild<AutoExpandTextarea>('geminiChatPromptInput');
  private readonly geminiChatMessagesEl = viewChild<ElementRef<HTMLElement>>('geminiChatMessagesEl');
  private readonly geminiChatScrollAnchor = viewChild<ElementRef<HTMLElement>>('geminiChatScrollAnchor');
  private readonly attachmentsTriggerEl = viewChild<ElementRef<HTMLElement>>('attachmentsTriggerEl');
  private readonly attachmentsPickerEl = viewChild<ElementRef<HTMLElement>>('attachmentsPickerEl');
  private readonly attachmentsPickerCarouselEl = viewChild<ElementRef<HTMLElement>>('attachmentsPickerCarouselEl');
  private saveMessageTimeout: ReturnType<typeof setTimeout> | undefined;
  private stopTypewriter: (() => void) | undefined;
  private bodyInputObserver: ResizeObserver | undefined;
  private bodyBeforeGemini = '';
  private wasEditingBodyBeforeGemini = false;
  private geminiChatMessageId = 0;
  private cancelChatTypewriter: (() => void) | undefined;
  private geminiChatStickToBottom = true;
  private geminiChatScrollRaf: number | null = null;
  private geminiChatCloseTimeout: ReturnType<typeof setTimeout> | undefined;
  private geminiPopupCloseTimeout: ReturnType<typeof setTimeout> | undefined;
  private attachmentsPickerCloseTimeout: ReturnType<typeof setTimeout> | undefined;
  private editCloseTimeout: ReturnType<typeof setTimeout> | undefined;
  private statusPulseTimeout: ReturnType<typeof setTimeout> | undefined;
  private geminiChatHistoryLoaded = false;

  protected readonly titleMaxLength = POST_TITLE_MAX_LENGTH;
  protected readonly bodyMaxLength = POST_BODY_MAX_LENGTH;
  protected readonly contentEmojis = POST_BODY_EMOJIS;
  protected readonly hashtagSegments = parseHashtagSegments;
  protected readonly geminiPromptMaxLength = GEMINI_PROMPT_MAX_LENGTH;
  protected readonly geminiChatPromptMaxLength = GEMINI_CHAT_PROMPT_MAX_LENGTH;
  protected readonly chatMessageBlocks = parseChatMessageBlocks;
  protected readonly postStatusOptions = POST_STATUS_OPTIONS;
  protected readonly postStatusClass = getPostStatusClass;
  protected readonly postStatusLabel = getPostStatusLabel;
  protected readonly platformTypes = PLATFORM_TYPES;
  protected readonly platformTypeLabel = getPlatformTypeLabel;
  protected readonly platformTypeName = getPlatformTypeName;
  protected readonly hasPostTag = hasPostTag;
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
  protected readonly account = signal<UserAccount | null>(null);
  protected readonly linkedInAccount = signal<UserPlatform | null>(null);
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
  protected readonly platformMenuOpen = signal(false);
  protected readonly statusMenuOpen = signal(false);
  protected readonly statusPulse = signal(false);
  protected readonly headerPlatformLogoSize = signal<PlatformLogoSize>('sm');
  protected readonly headerPlatformLogosCompact = signal(false);
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
  protected readonly geminiPopupOpen = signal(false);
  protected readonly geminiPopupClosing = signal(false);
  protected readonly geminiDraftActive = signal(false);
  protected readonly geminiPrompt = signal('');
  protected readonly isGenerating = signal(false);
  protected readonly isTyping = signal(false);
  protected readonly geminiError = signal<string | null>(null);
  protected readonly geminiChatOpen = signal(false);
  protected readonly geminiChatClosing = signal(false);
  protected readonly geminiChatMessages = signal<GeminiChatMessage[]>([]);
  protected readonly geminiChatPrompt = signal('');
  protected readonly geminiChatError = signal<string | null>(null);
  protected readonly isAskGeminiLoading = signal(false);
  protected readonly isAskGeminiHistoryLoading = signal(false);
  protected readonly isAskGeminiTyping = signal(false);
  protected readonly includePostTextInChat = signal(false);
  protected readonly includePostTextInGenerate = signal(false);
  protected readonly bodyHighlightText = signal('');
  protected readonly bodyHasSelection = signal(false);
  protected readonly tooltipsDisabled = signal(this.isMobileViewport());
  protected readonly postsReturnQueryParams = signal(
    postsListQueryToParams(readPostsListQueryFromHistory() ?? DEFAULT_POSTS_LIST_QUERY)
  );

  // Attachments (select from Media)
  protected readonly attachmentsPickerOpen = signal(false);
  protected readonly attachmentsPickerClosing = signal(false);
  protected readonly attachmentsPickerLoading = signal(false);
  protected readonly attachmentsPickerError = signal<string | null>(null);
  protected readonly isAttaching = signal(false);
  protected readonly attachmentsMediaPage = signal<PagedUserUploadedFilesResponse | null>(null);
  protected readonly selectedAttachmentIds = signal<Set<string>>(new Set());
  protected readonly attachmentPreviewUrls = signal<Record<string, string>>({});
  private readonly attachmentPreviewObjectUrls = new Set<string>();

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
    const item = this.post();
    if (!item) {
      return [];
    }

    return item.attachments
      .map((attachment) => this.attachmentPreviewUrls()[attachment.userUploadedFileId] ?? null)
      .filter((src): src is string => !!src);
  });

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.clearSaveMessage();
      this.stopGeminiTypewriter();
      this.stopChatTypewriter();
      this.clearGeminiChatCloseTimeout();
      this.clearGeminiPopupCloseTimeout();
      this.clearAttachmentsPickerCloseTimeout();
      this.clearEditCloseTimeout();
      this.clearStatusPulseTimeout();
      this.disconnectBodyInputObserver();
      document.body.classList.remove('post-gemini-popup-open');
      this.revokeAttachmentPreviewUrls();
    });

    if (typeof window !== 'undefined') {
      const mobileQuery = window.matchMedia('(max-width: 48rem)');
      const syncTooltips = (): void => {
        const isMobile = mobileQuery.matches;
        this.tooltipsDisabled.set(isMobile);
        this.headerPlatformLogoSize.set(isMobile ? 'xs' : 'sm');
        this.headerPlatformLogosCompact.set(isMobile);
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
          platforms.find((platform) => platform.platformId === LINKEDIN_PLATFORM_ID) ?? null;
        this.linkedInAccount.set(linkedIn);
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
    if (this.geminiPopupOpen() && !this.geminiPopupClosing()) {
      this.closeGeminiPopup();
      return;
    }

    if (this.geminiChatOpen()) {
      this.closeGeminiChat();
      return;
    }

    if (this.emojiPickerOpen()) {
      this.emojiPickerOpen.set(false);
      return;
    }

    if (this.platformMenuOpen() || this.statusMenuOpen()) {
      this.platformMenuOpen.set(false);
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

    if (this.geminiPopupOpen() && !this.geminiPopupClosing()) {
      const geminiAnchor = this.geminiAnchor()?.nativeElement;
      if (!geminiAnchor?.contains(target)) {
        this.closeGeminiPopup();
      }
    }

    if (this.platformMenuOpen()) {
      const platformsAnchor = this.platformsAnchor()?.nativeElement;
      if (!platformsAnchor?.contains(target)) {
        this.platformMenuOpen.set(false);
      }
    }

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
      !this.isMetaSaving() &&
      !this.isDeleting() &&
      !this.deleteConfirmOpen()
    );
  }

  protected canUseGeminiChat(): boolean {
    return (
      this.canUseGemini() &&
      !this.isAskGeminiLoading() &&
      !this.isAskGeminiHistoryLoading() &&
      !this.isAskGeminiTyping()
    );
  }

  protected canSendGeminiChat(): boolean {
    return this.canUseGeminiChat() && this.geminiChatPrompt().trim().length > 0;
  }

  protected canSendGeminiGenerate(): boolean {
    return this.canUseGemini() && this.geminiPrompt().trim().length > 0;
  }

  protected hasPostContentToAttach(): boolean {
    return this.currentPostBodyForContext().trim().length > 0;
  }

  protected togglePlatformMenu(event: Event): void {
    event.stopPropagation();

    if (this.isMetaSaving() || this.isActionLocked()) {
      return;
    }

    this.statusMenuOpen.set(false);
    this.platformMenuOpen.update((open) => !open);
  }

  protected toggleStatusMenu(event: Event): void {
    event.stopPropagation();

    if (this.isMetaSaving() || this.isActionLocked()) {
      return;
    }

    this.platformMenuOpen.set(false);
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

  protected toggleGeminiPopup(event: Event): void {
    event.stopPropagation();

    if (!this.canUseGemini()) {
      return;
    }

    if (this.geminiPopupOpen()) {
      this.closeGeminiPopup();
      return;
    }

    const item = this.post();
    if (!item) {
      return;
    }

    this.emojiPickerOpen.set(false);
    this.platformMenuOpen.set(false);
    this.statusMenuOpen.set(false);
    this.clearSaveMessage();
    this.geminiError.set(null);
    this.setGeminiPopupOpen(true);

    queueMicrotask(() => {
      this.geminiPromptInput()?.focus({ preventScroll: true });
    });
  }

  protected closeGeminiPopup(): void {
    if (!this.geminiPopupOpen() || this.geminiPopupClosing()) {
      return;
    }

    this.geminiPopupClosing.set(true);
    this.clearGeminiPopupCloseTimeout();
    this.geminiPopupCloseTimeout = setTimeout(() => {
      this.setGeminiPopupOpen(false);
      this.geminiPopupClosing.set(false);
      this.geminiPopupCloseTimeout = undefined;
    }, GEMINI_POPUP_CLOSE_MS);
  }

  protected onGeminiPromptValueChange(value: string): void {
    this.geminiPrompt.set(value);
    this.geminiError.set(null);
  }

  protected hasExistingBodyContent(): boolean {
    const item = this.post();
    return !!item && this.clampBody(item.body).trim().length > 0;
  }

  protected generateWithGemini(): void {
    const item = this.post();
    const prompt = this.geminiPrompt().trim();

    if (!item || !prompt || !this.canUseGemini()) {
      return;
    }

    const includePostText = this.includePostTextInGenerate() && this.hasPostContentToAttach();

    this.closeGeminiPopup();
    this.geminiError.set(null);
    this.beginGeminiDraft();
    this.isGenerating.set(true);

    this.geminiService
      .generatePost({
        prompt,
        postId: item.id,
        includePostText,
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

  protected userInitials(): string {
    const userName = this.account()?.userName;
    return userName ? getUserInitials(userName) : '?';
  }

  protected toggleGeminiChat(): void {
    if (this.geminiChatOpen() || this.geminiChatClosing()) {
      this.closeGeminiChat();
      return;
    }

    this.geminiChatClosing.set(false);
    this.geminiChatOpen.set(true);
    this.geminiChatStickToBottom = true;
    this.loadGeminiChatHistory();
    this.scheduleGeminiChatPromptLayout({ focus: true });
    queueMicrotask(() => this.scrollGeminiChatToBottom(true));
  }

  protected closeGeminiChat(): void {
    if (!this.geminiChatOpen() || this.geminiChatClosing()) {
      return;
    }

    this.geminiChatClosing.set(true);
    this.clearGeminiChatCloseTimeout();
    this.geminiChatCloseTimeout = setTimeout(() => {
      this.geminiChatOpen.set(false);
      this.geminiChatClosing.set(false);
      this.geminiChatCloseTimeout = undefined;
      this.resetGeminiChatSession();
    }, GEMINI_CHAT_CLOSE_MS);
  }

  private loadGeminiChatHistory(): void {
    const item = this.post();
    if (!item || this.geminiChatHistoryLoaded) {
      return;
    }

    this.geminiChatHistoryLoaded = true;
    this.isAskGeminiHistoryLoading.set(true);
    this.geminiChatError.set(null);

    this.geminiService
      .getConversation(item.id)
      .pipe(finalize(() => this.isAskGeminiHistoryLoading.set(false)))
      .subscribe({
        next: (items) => {
          if (!this.geminiChatOpen()) {
            return;
          }

          const messages = mapConversationToChatMessages(items);
          this.geminiChatMessages.set(messages);
          this.geminiChatMessageId =
            messages.length > 0 ? Math.max(...messages.map((message) => message.id)) : 0;
          queueMicrotask(() => this.scrollGeminiChatToBottom(true));
        },
        error: (error) => {
          if (!this.geminiChatOpen()) {
            return;
          }

          this.geminiChatError.set(
            toApplicationError(error, 'Could not load conversation history.').description
          );
        },
      });
  }

  private resetGeminiChatSession(): void {
    this.geminiChatHistoryLoaded = false;
    this.isAskGeminiHistoryLoading.set(false);
    this.geminiChatMessages.set([]);
    this.geminiChatMessageId = 0;
    this.geminiChatPrompt.set('');
    this.geminiChatError.set(null);
    this.isAskGeminiLoading.set(false);
    this.isAskGeminiTyping.set(false);
    this.stopChatTypewriter();
  }

  protected onGeminiChatPromptValueChange(value: string): void {
    this.geminiChatPrompt.set(value);
    this.geminiChatError.set(null);
  }

  protected onIncludePostTextInChatChange(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.includePostTextInChat.set(checked && this.hasPostContentToAttach());
  }

  protected onIncludePostTextInGenerateChange(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.includePostTextInGenerate.set(checked && this.hasPostContentToAttach());
  }

  protected onGeminiChatScroll(event: Event): void {
    const container = event.target as HTMLElement;
    const threshold = 64;
    this.geminiChatStickToBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight <= threshold;
  }

  protected sendGeminiChatMessage(): void {
    const item = this.post();
    const prompt = this.geminiChatPrompt().trim();
    const includePostText = this.includePostTextInChat() && this.hasPostContentToAttach();

    if (!item || !prompt || !this.canSendGeminiChat()) {
      return;
    }

    this.geminiChatError.set(null);
    this.geminiChatPrompt.set('');
    this.geminiChatStickToBottom = true;
    this.scheduleGeminiChatPromptLayout();
    this.geminiChatMessages.update((messages) => [
      ...messages,
      {
        id: ++this.geminiChatMessageId,
        role: 'user',
        text: prompt,
        attachedPostText: includePostText,
      },
    ]);
    this.scrollGeminiChatToBottom(true);
    this.isAskGeminiLoading.set(true);
    this.scrollGeminiChatToBottom(true);

    this.geminiService
      .askGemini({
        prompt,
        postId: item.id,
        includePostText: includePostText || undefined,
      })
      .pipe(finalize(() => this.isAskGeminiLoading.set(false)))
      .subscribe({
        next: (text) => {
          const messageId = ++this.geminiChatMessageId;
          this.geminiChatMessages.update((messages) => [
            ...messages,
            {
              id: messageId,
              role: 'assistant',
              text: '',
              isTyping: true,
            },
          ]);
          this.scrollGeminiChatToBottom(true);
          this.typeGeminiChatResponse(messageId, text);
        },
        error: (error) => {
          this.geminiChatError.set(toApplicationError(error, 'Could not get a response from Gemini.').description);
          this.scrollGeminiChatToBottom(true);
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

  protected onTagToggle(tag: PlatformType): void {
    const item = this.post();

    if (!item || this.isActionLocked() || this.isMetaSaving()) {
      return;
    }

    const nextTags = hasPostTag(item.tags, tag)
      ? item.tags.filter((value) => value !== tag)
      : normalizePostTags([...item.tags, tag]);

    if (arePostTagsEqual(nextTags, item.tags)) {
      return;
    }

    const previousTags = [...item.tags];
    this.post.set({ ...item, tags: nextTags });
    this.savePostMetadata(
      { tags: nextTags.length > 0 ? nextTags : null },
      { tags: previousTags }
    );
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
          this.errorMessage.set(toApplicationError(error, 'Could not save post.').description);
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

  private setGeminiPopupOpen(open: boolean): void {
    if (open) {
      this.geminiPopupClosing.set(false);
      this.clearGeminiPopupCloseTimeout();
    }

    this.geminiPopupOpen.set(open);
    if (open) {
      this.scheduleGeminiPromptLayout();
    }
    this.syncGeminiPopupBodyLock();
  }

  private syncGeminiPopupBodyLock(): void {
    if (typeof window === 'undefined') {
      return;
    }

    document.body.classList.toggle(
      'post-gemini-popup-open',
      (this.geminiPopupOpen() || this.geminiPopupClosing()) &&
        window.matchMedia('(max-width: 48rem)').matches
    );
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
    this.setGeminiPopupOpen(false);
    this.geminiDraftActive.set(false);
    this.isGenerating.set(false);
    this.isTyping.set(false);
    this.geminiError.set(null);
    this.geminiChatMessages.set([]);
    this.geminiChatPrompt.set('');
    this.geminiPrompt.set('');
    this.geminiChatError.set(null);
    this.isAskGeminiLoading.set(false);
    this.isAskGeminiHistoryLoading.set(false);
    this.isAskGeminiTyping.set(false);
    this.includePostTextInChat.set(false);
    this.includePostTextInGenerate.set(false);
    this.isMetaSaving.set(false);
    this.platformMenuOpen.set(false);
    this.statusMenuOpen.set(false);
    this.clearGeminiChatCloseTimeout();
    this.clearGeminiPopupCloseTimeout();
    this.geminiChatOpen.set(false);
    this.geminiChatClosing.set(false);
    this.geminiPopupClosing.set(false);
    this.geminiChatHistoryLoaded = false;
    this.geminiChatMessageId = 0;
    this.geminiChatStickToBottom = true;
    this.stopChatTypewriter();
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
      tags: normalizePostTags(item.tags),
      status: item.status,
    });
    this.form.reset({ title, body });
    this.syncBodyHighlight(body);
    this.syncAttachmentPreviews(item.attachments ?? []);
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

    const existingMaxOrder = (item.attachments ?? []).reduce(
      (max, attachment) => Math.max(max, attachment.order),
      0
    );
    const payload = {
      postId: item.id,
      attachemnts: selected.map((uploadedFileId, index) => ({
        uploadedFileId,
        order: existingMaxOrder + index + 1,
      })),
    };

    this.postAttachmentService
      .create(payload)
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
              this.attachmentsPickerError.set(toApplicationError(error, 'Could not refresh post.').description);
            },
          });
        },
        error: (error) => {
          this.attachmentsPickerError.set(toApplicationError(error, 'Could not attach images.').description);
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
          this.attachmentsPickerError.set(toApplicationError(error, 'Could not load media.').description);
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
        .downloadFile(id)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (blob) => {
            const objectUrl = URL.createObjectURL(blob);
            this.attachmentPreviewObjectUrls.add(objectUrl);
            this.attachmentPreviewUrls.update((current) => ({ ...current, [id]: objectUrl }));
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
      .downloadFile(file.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (blob) => {
          const objectUrl = URL.createObjectURL(blob);
          this.attachmentPreviewObjectUrls.add(objectUrl);
          this.attachmentPreviewUrls.update((current) => ({ ...current, [file.id]: objectUrl }));
        },
        error: () => {
          // placeholder stays
        },
      });
  }

  private revokeAttachmentPreviewUrls(): void {
    for (const objectUrl of this.attachmentPreviewObjectUrls) {
      URL.revokeObjectURL(objectUrl);
    }
    this.attachmentPreviewObjectUrls.clear();
    this.attachmentPreviewUrls.set({});
  }

  private buildUpdatePayload(
    overrides: Partial<Pick<UpdatePostPayload, 'title' | 'body' | 'status' | 'tags'>> = {}
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
    const tags =
      overrides.tags !== undefined
        ? overrides.tags
        : item.tags.length > 0
          ? normalizePostTags(item.tags)
          : null;

    return {
      title,
      body: normalizeUpdatePostBody(this.clampBody(bodyValue)),
      status: overrides.status ?? item.status,
      tags,
    };
  }

  private savePostMetadata(
    overrides: Partial<Pick<UpdatePostPayload, 'status' | 'tags'>>,
    snapshot?: { status?: PostStatus; tags?: PlatformType[] }
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
                    tags: snapshot.tags ?? current.tags,
                  }
                : current
            );
          }

          this.errorMessage.set(toApplicationError(error, 'Could not save post details.').description);
        },
      });
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

  private currentPostBodyForContext(): string {
    const item = this.post();
    if (!item) {
      return '';
    }

    if (this.editingField() === 'body' || this.geminiDraftActive()) {
      return this.clampBody(this.form.controls.body.value);
    }

    return this.clampBody(item.body);
  }

  private clearGeminiChatCloseTimeout(): void {
    if (this.geminiChatCloseTimeout === undefined) {
      return;
    }

    clearTimeout(this.geminiChatCloseTimeout);
    this.geminiChatCloseTimeout = undefined;
  }

  private clearGeminiPopupCloseTimeout(): void {
    if (this.geminiPopupCloseTimeout === undefined) {
      return;
    }

    clearTimeout(this.geminiPopupCloseTimeout);
    this.geminiPopupCloseTimeout = undefined;
  }

  private scheduleGeminiPromptLayout(options: { focus?: boolean } = {}): void {
    this.geminiPromptInput()?.scheduleLayout(options);
  }

  private scheduleGeminiChatPromptLayout(options: { focus?: boolean } = {}): void {
    this.geminiChatPromptInput()?.scheduleLayout(options);
  }

  private scrollGeminiChatToBottom(force = false): void {
    if (!force && !this.geminiChatStickToBottom) {
      return;
    }

    if (this.geminiChatScrollRaf !== null) {
      return;
    }

    this.geminiChatScrollRaf = requestAnimationFrame(() => {
      this.geminiChatScrollRaf = requestAnimationFrame(() => {
        this.geminiChatScrollRaf = null;

        const container = this.geminiChatMessagesEl()?.nativeElement;
        const anchor = this.geminiChatScrollAnchor()?.nativeElement;

        if (!container) {
          return;
        }

        if (anchor) {
          const targetTop = anchor.offsetTop + anchor.offsetHeight - container.clientHeight;
          container.scrollTop = Math.max(0, targetTop);
          return;
        }

        container.scrollTop = container.scrollHeight;
      });
    });
  }

  private stopChatTypewriter(): void {
    this.cancelChatTypewriter?.();
    this.cancelChatTypewriter = undefined;
    this.isAskGeminiTyping.set(false);
  }

  private updateGeminiChatMessage(messageId: number, text: string, isTyping: boolean): void {
    this.geminiChatMessages.update((messages) =>
      messages.map((message) =>
        message.id === messageId ? { ...message, text, isTyping } : message
      )
    );
  }

  private typeGeminiChatResponse(messageId: number, fullText: string): void {
    this.stopChatTypewriter();

    const prefersReducedMotion =
      typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) {
      this.updateGeminiChatMessage(messageId, fullText, false);
      this.scrollGeminiChatToBottom();
      return;
    }

    this.isAskGeminiTyping.set(true);
    this.geminiChatStickToBottom = true;

    let scrollEvery = 0;

    this.cancelChatTypewriter = createTypewriter(
      fullText,
      (partial) => {
        this.updateGeminiChatMessage(messageId, partial, true);
        scrollEvery += 1;
        if (scrollEvery % 2 === 0 || partial.length >= fullText.length) {
          this.scrollGeminiChatToBottom();
        }
      },
      () => {
        this.updateGeminiChatMessage(messageId, fullText, false);
        this.isAskGeminiTyping.set(false);
        this.cancelChatTypewriter = undefined;
        this.scrollGeminiChatToBottom();
      },
      { intervalMs: 42 }
    );
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

    this.closeEdit(true, () => {
      if (reopenPopup) {
        this.setGeminiPopupOpen(true);
        queueMicrotask(() => this.geminiPromptInput()?.focus({ preventScroll: true }));
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
