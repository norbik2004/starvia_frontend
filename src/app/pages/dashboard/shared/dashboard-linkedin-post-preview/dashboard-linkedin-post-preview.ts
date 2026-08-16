import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  signal,
} from '@angular/core';
import { parseHashtagSegments } from '../../../../models/post';
import { DashboardUserAvatar } from '../dashboard-user-avatar/dashboard-user-avatar';

const LINKEDIN_BODY_CLAMP_LINES = 3;
const LINKEDIN_PREVIEW_LIKE_COUNT = 248;
const LINKEDIN_PREVIEW_COMMENT_COUNT = 36;
const LINKEDIN_PREVIEW_REPOST_COUNT = 12;

@Component({
  selector: 'app-dashboard-linkedin-post-preview',
  imports: [DashboardUserAvatar],
  styleUrl: './dashboard-linkedin-post-preview.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="li-feed" aria-label="LinkedIn post preview">
      <article class="li-post">
        <header class="li-post__header">
          <app-dashboard-user-avatar
            class="li-post__avatar"
            [userName]="authorName()"
            [profilePictureUrl]="authorAvatarUrl()"
            size="md"
          />

          <div class="li-post__header-main">
            <div class="li-post__author-row">
              <span class="li-post__author">{{ authorName() }}</span>
              @if (showVerifiedBadge()) {
                <span class="li-post__linkedin-badge" aria-label="LinkedIn Premium" title="LinkedIn Premium">
                  <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">
                    <path
                      fill="#C28800"
                      d="M20.5 2h-17A1.5 1.5 0 0 0 2 3.5v17A1.5 1.5 0 0 0 3.5 22h17a1.5 1.5 0 0 0 1.5-1.5v-17A1.5 1.5 0 0 0 20.5 2Z"
                    />
                    <path
                      fill="#fff"
                      d="M8 19H5v-9h3ZM6.5 8.25A1.75 1.75 0 1 1 8.3 6.5a1.78 1.78 0 0 1-1.8 1.75ZM19 19h-3v-4.74c0-1.42-.6-1.93-1.38-1.93A1.74 1.74 0 0 0 13 14.19a.66.66 0 0 0 0 .14V19h-3v-9h2.9v1.3a3.11 3.11 0 0 1 2.7-1.4c1.55 0 3.36.86 3.36 3.66Z"
                    />
                  </svg>
                </span>
              }
              <span class="li-post__degree" aria-hidden="true">• 1st</span>
            </div>
            <p class="li-post__headline">{{ authorHeadline() }}</p>
            <p class="li-post__meta">
              <span>{{ postedLabel() }}</span>
              <span class="li-post__meta-sep" aria-hidden="true">•</span>
              <span class="li-post__visibility" aria-label="Public">
                <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
                  <path
                    fill="currentColor"
                    d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1ZM0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8Zm8 3.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"
                  />
                </svg>
              </span>
            </p>
          </div>

          <div class="li-post__header-actions" aria-hidden="true">
            <button type="button" class="li-post__follow" tabindex="-1">
              <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
                <path fill="currentColor" d="M8 3.25a.75.75 0 0 1 .75.75v3.25H12a.75.75 0 0 1 0 1.5H8.75V12a.75.75 0 0 1-1.5 0V8.75H4a.75.75 0 0 1 0-1.5h3.25V4A.75.75 0 0 1 8 3.25Z" />
              </svg>
              Follow
            </button>
            <button type="button" class="li-post__icon-btn" aria-label="More options" tabindex="-1">
              <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false">
                <path
                  fill="currentColor"
                  d="M14 12a2 2 0 1 1-2-2 2 2 0 0 1 2 2Zm-6 0a2 2 0 1 1-2-2 2 2 0 0 1 2 2Zm12 0a2 2 0 1 1-2-2 2 2 0 0 1 2 2Z"
                />
              </svg>
            </button>
            <button type="button" class="li-post__icon-btn" aria-label="Dismiss post" tabindex="-1">
              <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false">
                <path
                  fill="currentColor"
                  d="M13.42 12 20 5.42 18.58 4 12 10.58 5.42 4 4 5.42 10.58 12 4 18.58 5.42 20 12 13.42 18.58 20 20 18.58 13.42 12Z"
                />
              </svg>
            </button>
          </div>
        </header>

        <div class="li-post__body-wrap">
          @if (hasBody()) {
            <div
              class="li-post__body"
              [class.li-post__body--clamped]="!bodyExpanded() && shouldClampBody()"
              [style.--li-body-clamp-lines]="bodyClampLines"
            >
              @for (segment of bodySegments(); track $index) {
                @if (segment.highlighted) {
                  <span class="li-post__hashtag">{{ segment.text }}</span>
                } @else {
                  <span>{{ segment.text }}</span>
                }
              }
            </div>
            @if (shouldClampBody()) {
              <button
                type="button"
                class="li-post__see-more"
                [attr.aria-expanded]="bodyExpanded()"
                (click)="toggleBodyExpanded()"
              >
                {{ bodyExpanded() ? '…less' : '…more' }}
              </button>
            }
          } @else {
            <p class="li-post__body li-post__body--empty">Your post content will appear here.</p>
          }
        </div>

        @if (attachmentSrcs().length > 0) {
          <div
            class="li-post__media"
            [class.li-post__media--carousel]="attachmentSrcs().length > 1"
          >
            @if (attachmentSrcs().length === 1) {
              <figure
                class="li-post__media-figure"
                [style.aspect-ratio]="mediaAspectRatio(attachmentSrcs()[0])"
              >
                <img
                  class="li-post__media-image"
                  [src]="attachmentSrcs()[0]"
                  alt=""
                  (load)="onMediaImageLoad($event, attachmentSrcs()[0])"
                />
              </figure>
            } @else {
              <div
                class="li-post__carousel"
                role="region"
                aria-roledescription="carousel"
                aria-label="Post attachments"
                tabindex="0"
                (keydown)="onCarouselKeydown($event)"
              >
                <figure
                  class="li-post__media-figure"
                  [style.aspect-ratio]="mediaAspectRatio(attachmentSrcs()[activeImageIndex()])"
                >
                  <img
                    class="li-post__media-image"
                    [src]="attachmentSrcs()[activeImageIndex()]"
                    [alt]="'Post attachment ' + (activeImageIndex() + 1) + ' of ' + attachmentSrcs().length"
                    (load)="onMediaImageLoad($event, attachmentSrcs()[activeImageIndex()])"
                  />
                </figure>
                <button
                  type="button"
                  class="li-post__carousel-nav li-post__carousel-nav--prev"
                  aria-label="Previous image"
                  [attr.aria-disabled]="activeImageIndex() === 0"
                  (click)="showPreviousImage()"
                >
                  <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                    <path fill="currentColor" d="M14.5 18 8.5 12l6-6 1.06 1.06L10.62 12l4.94 4.94L14.5 18Z" />
                  </svg>
                </button>
                <button
                  type="button"
                  class="li-post__carousel-nav li-post__carousel-nav--next"
                  aria-label="Next image"
                  [attr.aria-disabled]="activeImageIndex() >= attachmentSrcs().length - 1"
                  (click)="showNextImage()"
                >
                  <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                    <path fill="currentColor" d="m9.5 18 6-6-6-6-1.06 1.06L13.38 12l-4.94 4.94L9.5 18Z" />
                  </svg>
                </button>
                <div class="li-post__carousel-dots" aria-hidden="true">
                  @for (src of attachmentSrcs(); track src; let index = $index) {
                    <span
                      class="li-post__carousel-dot"
                      [class.li-post__carousel-dot--active]="index === activeImageIndex()"
                    ></span>
                  }
                </div>
                <p class="li-post__carousel-status" aria-live="polite" aria-atomic="true">
                  Image {{ activeImageIndex() + 1 }} of {{ attachmentSrcs().length }}
                </p>
              </div>
            }
          </div>
        }

        <footer class="li-post__footer" aria-hidden="true">
          <div class="li-post__footer-main">
            <div class="li-post__footer-actor">
              <app-dashboard-user-avatar
                class="li-post__footer-avatar"
                [userName]="authorName()"
                [profilePictureUrl]="authorAvatarUrl()"
                size="sm"
              />
              <span class="li-post__footer-caret">
                <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
                  <path fill="currentColor" d="M8 11 3 6h10L8 11z" />
                </svg>
              </span>
            </div>

            <span class="li-post__footer-stat">
              <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
                <path
                  fill="currentColor"
                  d="m12.91 7-2.25-2.57a8.2 8.2 0 0 1-1.5-2.55L9 1.37A2.08 2.08 0 0 0 7 0a2.08 2.08 0 0 0-2.06 2.08v1.17a5.8 5.8 0 0 0 .31 1.89l.28.86H2.38A1.47 1.47 0 0 0 1 7.47a1.45 1.45 0 0 0 .64 1.21 1.48 1.48 0 0 0-.37 2.06 1.54 1.54 0 0 0 .62.51h.05a1.6 1.6 0 0 0-.19.71A1.47 1.47 0 0 0 3 13.42v.1A1.46 1.46 0 0 0 4.4 15h4.83a5.6 5.6 0 0 0 2.48-.58l1-.42H14V7zM12 12.11l-1.19.52a3.6 3.6 0 0 1-1.58.37H5.1a.55.55 0 0 1-.53-.4l-.14-.48-.49-.21a.56.56 0 0 1-.34-.6l.09-.56-.42-.42a.56.56 0 0 1-.09-.68L3.55 9l-.4-.61A.28.28 0 0 1 3.3 8h5L7.14 4.51a4.2 4.2 0 0 1-.2-1.26V2.08A.09.09 0 0 1 7 2a.1.1 0 0 1 .08 0l.18.51a10 10 0 0 0 1.9 3.24l2.84 3z"
                />
              </svg>
              <span class="li-post__footer-stat-count">{{ previewLikeCount }}</span>
            </span>

            <span class="li-post__footer-stat">
              <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
                <path
                  fill="currentColor"
                  d="M5 8h5v1H5zm11-.5v.08a6 6 0 0 1-2.75 5L8 16v-3H5.5A5.51 5.51 0 0 1 0 7.5 5.62 5.62 0 0 1 5.74 2h4.76A5.5 5.5 0 0 1 16 7.5m-2 0A3.5 3.5 0 0 0 10.5 4H5.74A3.62 3.62 0 0 0 2 7.5 3.53 3.53 0 0 0 5.5 11H10v1.33l2.17-1.39A4 4 0 0 0 14 7.58zM5 7h6V6H5z"
                />
              </svg>
              <span class="li-post__footer-stat-count">{{ previewCommentCount }}</span>
            </span>

            <span class="li-post__footer-stat">
              <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
                <path
                  fill="currentColor"
                  d="M4 10H2V5c0-1.66 1.34-3 3-3h3.85L7.42 0h2.44L12 3 9.86 6H7.42l1.43-2H5c-.55 0-1 .45-1 1zm8-4v5c0 .55-.45 1-1 1H7.15l1.43-2H6.14L4 13l2.14 3h2.44l-1.43-2H11c1.66 0 3-1.34 3-3V6z"
                />
              </svg>
              <span class="li-post__footer-stat-count">{{ previewRepostCount }}</span>
            </span>

            <span class="li-post__footer-stat li-post__footer-stat--icon-only">
              <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
                <path fill="currentColor" d="M14 2 0 6.67l5 2.64 5.67-3.98L6.7 11l2.63 5z" />
              </svg>
            </span>
          </div>

          <ul class="li-post__reaction-list" role="presentation">
            <li class="li-post__reaction-item">
              <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
                <circle cx="8" cy="8" r="7.5" fill="#378fe9" />
                <path fill="#fff" d="M8 1a7 7 0 1 1-7 7 7 7 0 0 1 7-7m0-1a8 8 0 1 0 5.66 2.34A8 8 0 0 0 8 0" />
                <path
                  fill="#d0e8ff"
                  fill-rule="evenodd"
                  d="M11.93 7.25h-.55c-.05 0-.15-.19-.4-.46-.37-.4-.78-.91-1.07-1.19a7.1 7.1 0 0 1-1.73-2.24c-.24-.51-.26-.74-.75-.74a.78.78 0 0 0-.67.81c0 .14.07.63.1.8a7.5 7.5 0 0 0 1 2.2H4.12a.88.88 0 0 0-.65.28.84.84 0 0 0-.23.66.91.91 0 0 0 .93.85h.16a.82.82 0 0 0-.55.24.77.77 0 0 0-.21.54.81.81 0 0 0 .74.8.8.8 0 0 0 .33 1.42.76.76 0 0 0-.09.55.87.87 0 0 0 .85.63h2.29a3.8 3.8 0 0 0 .89-.11l1.42-.4h1.9c1.02-.04 1.29-4.64.03-4.64"
                />
                <path fill="none" d="M7.3 3.72a6.4 6.4 0 0 0 1.15 2.71M5.94 11.9h2.18a16 16 0 0 0 1.9-.54h1.36" />
                <path
                  fill="none"
                  stroke="#004182"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M7.43 6.43H4.11a.88.88 0 0 0-.88 1 .92.92 0 0 0 .93.84h.16a.82.82 0 0 0-.55.24.77.77 0 0 0-.21.56.83.83 0 0 0 .74.81.81.81 0 0 0-.31.63.81.81 0 0 0 .65.8.78.78 0 0 0-.09.56.86.86 0 0 0 .85.62h2.29a3.8 3.8 0 0 0 .89-.11l1.42-.47h1.9c1 0 1.27-4.64 0-4.64a5 5 0 0 1-.55 0s-.15-.19-.4-.46h0c-.37-.4-.78-.91-1.07-1.19a7.1 7.1 0 0 1-1.7-2.25 2.1 2.1 0 0 0-.32-.52.83.83 0 0 0-1.16.09 1.4 1.4 0 0 0-.25.38 1.7 1.7 0 0 0-.09.3 2.4 2.4 0 0 0 .07.84 4 4 0 0 0 .27.84 6.7 6.7 0 0 0 .66 1 .2.2 0 0 1 .07.08"
                />
              </svg>
            </li>
            <li class="li-post__reaction-item li-post__reaction-item--overlap">
              <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
                <circle cx="8" cy="8" r="7.5" fill="#f5bb5c" />
                <path fill="#fff" d="M8 1a7 7 0 1 1-7 7 7 7 0 0 1 7-7m0-1a8 8 0 1 0 5.66 2.34A8 8 0 0 0 8 0" />
                <path
                  fill="#ffe1b2"
                  fill-rule="evenodd"
                  d="M8.82 13.4h-1.6a.54.54 0 0 1-.54-.54v-1.33h2.68v1.33a.54.54 0 0 1-.54.54"
                />
                <path
                  fill="#fcf0de"
                  fill-rule="evenodd"
                  d="M6.69 11.79v-.26a3.1 3.1 0 0 0-.16-1A3.5 3.5 0 0 0 6 9.75a3.24 3.24 0 0 1-1.19-2.49 3.21 3.21 0 0 1 6.42 0A3.38 3.38 0 0 1 10 9.8c.07-.05-.08.06-.18.2a1.7 1.7 0 0 0-.23.47 3.4 3.4 0 0 0-.15 1v.26"
                />
                <path
                  fill="none"
                  stroke="#fff"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M7.46 4.78a2.2 2.2 0 0 0-1.22.65 2.43 2.43 0 0 0-.68 1.22"
                />
                <path
                  fill="none"
                  stroke="#5d3b01"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M8.82 13.4h-1.6a.54.54 0 0 1-.54-.54v-1.33h2.68v1.33a.54.54 0 0 1-.54.54"
                />
                <path
                  fill="none"
                  stroke="#5d3b01"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M6.68 11.79v-.26a3.4 3.4 0 0 0-.15-1 2 2 0 0 0-.26-.47 2.5 2.5 0 0 0-.37-.43 3.4 3.4 0 0 1-.37-.39 3.16 3.16 0 0 1-.72-2h0a3.21 3.21 0 0 1 6.42 0 3.25 3.25 0 0 1-.73 2 4 4 0 0 1-.57.57l-.2.21a1.7 1.7 0 0 0-.22.47 3.4 3.4 0 0 0-.15 1v.26M4.6 2.64l.61.79m6.21-.8-.61.8M8 1.5v1.26"
                />
              </svg>
            </li>
          </ul>
        </footer>
      </article>
    </div>
  `,
})
export class DashboardLinkedinPostPreview {
  readonly authorName = input.required<string>();
  readonly authorHeadline = input('');
  readonly authorAvatarUrl = input<string | null>(null);
  readonly body = input<string | null>(null);
  readonly attachmentSrcs = input<readonly string[]>([]);
  readonly postedLabel = input('Just now');
  readonly showVerifiedBadge = input(true);

  protected readonly bodyClampLines = LINKEDIN_BODY_CLAMP_LINES;
  protected readonly previewLikeCount = LINKEDIN_PREVIEW_LIKE_COUNT;
  protected readonly previewCommentCount = LINKEDIN_PREVIEW_COMMENT_COUNT;
  protected readonly previewRepostCount = LINKEDIN_PREVIEW_REPOST_COUNT;
  protected readonly bodyExpanded = signal(false);
  protected readonly activeImageIndex = signal(0);
  private readonly mediaAspectRatios = signal<Record<string, string>>({});

  protected readonly bodySegments = computed(() => parseHashtagSegments(this.body()));
  protected readonly hasBody = computed(() => !!this.body()?.trim());
  protected readonly shouldClampBody = computed(() => {
    const text = this.body()?.trim() ?? '';
    const lineCount = text.split('\n').length;
    return text.length > 210 || lineCount > LINKEDIN_BODY_CLAMP_LINES;
  });

  constructor() {
    effect(() => {
      const lastIndex = Math.max(0, this.attachmentSrcs().length - 1);
      if (this.activeImageIndex() > lastIndex) {
        this.activeImageIndex.set(lastIndex);
      }
    });
  }

  protected toggleBodyExpanded(): void {
    this.bodyExpanded.update((expanded) => !expanded);
  }

  protected showPreviousImage(): void {
    this.activeImageIndex.update((index) => Math.max(0, index - 1));
  }

  protected showNextImage(): void {
    const lastIndex = this.attachmentSrcs().length - 1;
    this.activeImageIndex.update((index) => Math.min(lastIndex, index + 1));
  }

  protected onCarouselKeydown(event: KeyboardEvent): void {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      this.showPreviousImage();
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      this.showNextImage();
    } else if (event.key === 'Home') {
      event.preventDefault();
      this.activeImageIndex.set(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      this.activeImageIndex.set(Math.max(0, this.attachmentSrcs().length - 1));
    }
  }

  protected mediaAspectRatio(src: string): string {
    return this.mediaAspectRatios()[src] ?? '1 / 1';
  }

  protected onMediaImageLoad(event: Event, src: string): void {
    const image = event.target;
    if (!(image instanceof HTMLImageElement) || !image.naturalWidth || !image.naturalHeight) {
      return;
    }

    const ratio = `${image.naturalWidth} / ${image.naturalHeight}`;
    if (this.mediaAspectRatios()[src] === ratio) {
      return;
    }

    this.mediaAspectRatios.update((current) => ({ ...current, [src]: ratio }));
  }
}
