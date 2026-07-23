import { NgClass } from '@angular/common';
import { Component, DestroyRef, HostListener, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize, take } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { toApplicationError } from '../../../models/application-error';
import { DisplayDatetimePipe } from '../../../pipes/display-datetime';
import { PLATFORM_TYPES, POST_SORT_BY_OPTIONS, POST_STATUS_OPTIONS, getPlatformTypeLabel, getPlatformTypeName, getPostStatusLabel, getPostStatusClass, getPostStatusIcon, parseHashtagSegments, type PagedPostsResponse, type PostAttachmentItem, type PostItem, type PlatformType, type PostSortBy } from '../../../models/post';
import { PostService } from '../../../services/post';
import { UserUploadedFileService } from '../../../services/user-uploaded-file';
import { DashboardPaginationPanel } from '../shared/dashboard-pagination-panel/dashboard-pagination-panel';
import { DashboardPlatformLogo } from '../shared/dashboard-platform-logo/dashboard-platform-logo';
import { toPaginationPage } from '../shared/pagination';
import { PageLoading } from '../../../components/page-loading/page-loading';
import { PageRevealDirective } from '../../../directives/page-reveal';
import {
  DEFAULT_POSTS_LIST_QUERY,
  hasActiveFilters,
  parsePostsListQuery,
  postsListQueryToFilterParams,
  postsListQueryToParams,
  type HasPublicationFilter,
  type PlatformFilter,
  type PostsListQuery,
  type SortByFilter,
  type SortOrder,
  type StatusFilter,
} from './posts-list-query';
const PAGE_SIZE_OPTIONS = [10, 20, 50] as const;
const POST_CARD_VISIBLE_ATTACHMENTS = 4;

type FilterMenuId = 'sortBy' | 'status' | 'hasPublication' | 'publishedOn';

const PUBLICATION_OPTIONS = [
  { value: '' as HasPublicationFilter, label: 'Any', icon: 'remove' },
  { value: 'true' as HasPublicationFilter, label: 'Published', icon: 'language' },
  { value: 'false' as HasPublicationFilter, label: 'Not published', icon: 'visibility_off' },
] as const;

type PostsForm = FormGroup<{
  pageNumber: FormControl<number>;
  pageSize: FormControl<number>;
  sortOrder: FormControl<SortOrder>;
  sortBy: FormControl<SortByFilter>;
  status: FormControl<StatusFilter>;
  hasPublication: FormControl<HasPublicationFilter>;
  titleContains: FormControl<string>;
  bodyContains: FormControl<string>;
  publishedOn: FormControl<PlatformFilter>;
  createdAfter: FormControl<string>;
  createdBefore: FormControl<string>;
}>;

@Component({
  selector: 'app-dashboard-posts',
  imports: [NgClass, ReactiveFormsModule, DisplayDatetimePipe, RouterLink, DashboardPaginationPanel, DashboardPlatformLogo, PageLoading, PageRevealDirective],
  styleUrl: './dashboard-posts.scss',
  template: `
    <section class="dashboard-content-page dashboard-posts" aria-labelledby="dashboard-posts-title">
      <div appPageReveal>
      <div class="dashboard-posts__intro">
        <header class="dashboard-posts__header">
          <div class="dashboard-posts__header-row">
            <div class="dashboard-posts__header-copy">
              <p class="section-eyebrow dashboard-posts__eyebrow">Content</p>
              <h1 id="dashboard-posts-title" class="dashboard-posts__title">Posts</h1>
            </div>
            <a
              class="dashboard-posts__add-btn"
              [routerLink]="['/dashboard/posts/new']"
              [state]="postsReturnState()"
            >
              <span class="material-icons dashboard-posts__add-icon" aria-hidden="true">add</span>
              Add post
            </a>
          </div>
        </header>

        <div class="posts-filters__toolbar">
          <button
            type="button"
            class="posts-filters__toggle"
            [class.is-active]="filtersOpen()"
            [attr.aria-expanded]="filtersOpen()"
            aria-controls="posts-filters-panel"
            (click)="toggleFilters()"
          >
            <span class="material-icons posts-filters__toggle-icon" aria-hidden="true">tune</span>
            Filters
            @if (filtersActive()) {
              <span class="posts-filters__active-badge" aria-label="Filters active">Active</span>
            }
          </button>
        </div>

        @if (filtersOpen()) {
          <button
            type="button"
            class="posts-filters__backdrop"
            aria-label="Close filters"
            (click)="closeFilters()"
          ></button>
        }

        <form
          id="posts-filters-panel"
          class="posts-filters"
          [class.is-open]="filtersOpen()"
          [formGroup]="form"
          (ngSubmit)="applyFilters()"
          aria-label="Filter posts"
        >
          <div class="posts-filters__drawer-head">
            <h2 class="posts-filters__drawer-title">Filters</h2>
            <button type="button" class="posts-filters__close" aria-label="Close filters" (click)="closeFilters()">
              <span class="close-icon" aria-hidden="true"></span>
            </button>
          </div>

          <div class="posts-filters__grid">
            <div class="posts-filters__row posts-filters__row--meta">
            <div class="field field--compact">
              <span class="field__label" id="filter-sort-by-label">Sort</span>
              <div class="posts-filter-menu" [class.is-open]="openFilterMenu() === 'sortBy'">
                <button
                  type="button"
                  id="filter-sort-by"
                  class="posts-filter-menu__trigger field__input"
                  [attr.aria-expanded]="openFilterMenu() === 'sortBy'"
                  aria-haspopup="listbox"
                  aria-controls="filter-sort-by-menu"
                  aria-labelledby="filter-sort-by-label"
                  (click)="toggleFilterMenu('sortBy', $event)"
                >
                  <span class="material-icons posts-filter-menu__icon" aria-hidden="true">{{ sortByTriggerIcon() }}</span>
                  <span class="posts-filter-menu__label">{{ sortByTriggerLabel() }}</span>
                  <span class="material-icons posts-filter-menu__chevron" aria-hidden="true">expand_more</span>
                </button>
                @if (openFilterMenu() === 'sortBy') {
                  <div
                    id="filter-sort-by-menu"
                    class="posts-filter-menu__panel"
                    role="listbox"
                    aria-labelledby="filter-sort-by-label"
                    (click)="$event.stopPropagation()"
                  >
                    <button
                      type="button"
                      class="posts-filter-menu__option"
                      role="option"
                      [class.is-active]="!form.controls.sortBy.value"
                      [attr.aria-selected]="!form.controls.sortBy.value"
                      (click)="selectSortBy('')"
                    >
                      <span class="material-icons posts-filter-menu__icon" aria-hidden="true">swap_vert</span>
                      <span>Default</span>
                    </button>
                    @for (option of sortByOptions; track option.value) {
                      <button
                        type="button"
                        class="posts-filter-menu__option"
                        role="option"
                        [class.is-active]="form.controls.sortBy.value === option.value"
                        [attr.aria-selected]="form.controls.sortBy.value === option.value"
                        (click)="selectSortBy(option.value)"
                      >
                        <span class="material-icons posts-filter-menu__icon" aria-hidden="true">{{ option.icon }}</span>
                        <span>{{ option.label }}</span>
                      </button>
                    }
                  </div>
                }
              </div>
            </div>

            <div class="field field--compact field--sort-order">
              <span class="field__label" id="filter-sort-order-label">Order</span>
              <div class="posts-sort-order" role="group" aria-labelledby="filter-sort-order-label">
                <button
                  type="button"
                  class="posts-sort-order__btn"
                  [class.is-active]="form.controls.sortOrder.value === 'newest'"
                  [disabled]="!form.controls.sortBy.value || isLoading()"
                  aria-label="Descending"
                  (click)="setSortOrder('newest')"
                >
                  <span class="material-icons" aria-hidden="true">arrow_downward</span>
                </button>
                <button
                  type="button"
                  class="posts-sort-order__btn"
                  [class.is-active]="form.controls.sortOrder.value === 'oldest'"
                  [disabled]="!form.controls.sortBy.value || isLoading()"
                  aria-label="Ascending"
                  (click)="setSortOrder('oldest')"
                >
                  <span class="material-icons" aria-hidden="true">arrow_upward</span>
                </button>
              </div>
            </div>

            <div class="field field--compact">
              <span class="field__label" id="filter-status-label">Status</span>
              <div class="posts-filter-menu" [class.is-open]="openFilterMenu() === 'status'">
                <button
                  type="button"
                  id="filter-status"
                  class="posts-filter-menu__trigger field__input"
                  [attr.aria-expanded]="openFilterMenu() === 'status'"
                  aria-haspopup="listbox"
                  aria-controls="filter-status-menu"
                  aria-labelledby="filter-status-label"
                  (click)="toggleFilterMenu('status', $event)"
                >
                  <span class="material-icons posts-filter-menu__icon" aria-hidden="true">{{ statusTriggerIcon() }}</span>
                  <span class="posts-filter-menu__label">{{ statusTriggerLabel() }}</span>
                  <span class="material-icons posts-filter-menu__chevron" aria-hidden="true">expand_more</span>
                </button>
                @if (openFilterMenu() === 'status') {
                  <div
                    id="filter-status-menu"
                    class="posts-filter-menu__panel"
                    role="listbox"
                    aria-labelledby="filter-status-label"
                    (click)="$event.stopPropagation()"
                  >
                    <button
                      type="button"
                      class="posts-filter-menu__option"
                      role="option"
                      [class.is-active]="!form.controls.status.value"
                      [attr.aria-selected]="!form.controls.status.value"
                      (click)="selectStatus('')"
                    >
                      <span class="material-icons posts-filter-menu__icon" aria-hidden="true">list</span>
                      <span>Any status</span>
                    </button>
                    @for (status of postStatusOptions; track status.value) {
                      <button
                        type="button"
                        class="posts-filter-menu__option"
                        role="option"
                        [class.is-active]="form.controls.status.value === status.value"
                        [attr.aria-selected]="form.controls.status.value === status.value"
                        (click)="selectStatus(status.value)"
                      >
                        <span class="material-icons posts-filter-menu__icon" aria-hidden="true">{{ status.icon }}</span>
                        <span>{{ status.label }}</span>
                      </button>
                    }
                  </div>
                }
              </div>
            </div>

            <div class="field field--compact">
              <span class="field__label" id="filter-has-publication-label">Publication</span>
              <div class="posts-filter-menu" [class.is-open]="openFilterMenu() === 'hasPublication'">
                <button
                  type="button"
                  id="filter-has-publication"
                  class="posts-filter-menu__trigger field__input"
                  [attr.aria-expanded]="openFilterMenu() === 'hasPublication'"
                  aria-haspopup="listbox"
                  aria-controls="filter-has-publication-menu"
                  aria-labelledby="filter-has-publication-label"
                  (click)="toggleFilterMenu('hasPublication', $event)"
                >
                  <span class="material-icons posts-filter-menu__icon" aria-hidden="true">{{ publicationTriggerIcon() }}</span>
                  <span class="posts-filter-menu__label">{{ publicationTriggerLabel() }}</span>
                  <span class="material-icons posts-filter-menu__chevron" aria-hidden="true">expand_more</span>
                </button>
                @if (openFilterMenu() === 'hasPublication') {
                  <div
                    id="filter-has-publication-menu"
                    class="posts-filter-menu__panel"
                    role="listbox"
                    aria-labelledby="filter-has-publication-label"
                    (click)="$event.stopPropagation()"
                  >
                    @for (option of publicationOptions; track option.value) {
                      <button
                        type="button"
                        class="posts-filter-menu__option"
                        role="option"
                        [class.is-active]="form.controls.hasPublication.value === option.value"
                        [attr.aria-selected]="form.controls.hasPublication.value === option.value"
                        (click)="selectPublication(option.value)"
                      >
                        <span class="material-icons posts-filter-menu__icon" aria-hidden="true">{{ option.icon }}</span>
                        <span>{{ option.label }}</span>
                      </button>
                    }
                  </div>
                }
              </div>
            </div>

            <div class="field field--compact">
              <span class="field__label" id="filter-platform-label">Platform</span>
              <div class="posts-filter-menu" [class.is-open]="openFilterMenu() === 'publishedOn'">
                <button
                  type="button"
                  id="filter-platform"
                  class="posts-filter-menu__trigger field__input"
                  [attr.aria-expanded]="openFilterMenu() === 'publishedOn'"
                  aria-haspopup="listbox"
                  aria-controls="filter-platform-menu"
                  aria-labelledby="filter-platform-label"
                  (click)="toggleFilterMenu('publishedOn', $event)"
                >
                  @if (platformTriggerType(); as platformType) {
                    <app-dashboard-platform-logo
                      class="posts-filter-menu__platform-logo"
                      [platformType]="platformType"
                      size="xs"
                      [compact]="true"
                    />
                  } @else {
                    <span class="material-icons posts-filter-menu__icon" aria-hidden="true">apps</span>
                  }
                  <span class="posts-filter-menu__label">{{ platformTriggerLabel() }}</span>
                  <span class="material-icons posts-filter-menu__chevron" aria-hidden="true">expand_more</span>
                </button>
                @if (openFilterMenu() === 'publishedOn') {
                  <div
                    id="filter-platform-menu"
                    class="posts-filter-menu__panel"
                    role="listbox"
                    aria-labelledby="filter-platform-label"
                    (click)="$event.stopPropagation()"
                  >
                    <button
                      type="button"
                      class="posts-filter-menu__option"
                      role="option"
                      [class.is-active]="form.controls.publishedOn.value === ''"
                      [attr.aria-selected]="form.controls.publishedOn.value === ''"
                      (click)="selectPlatform('')"
                    >
                      <span class="material-icons posts-filter-menu__icon" aria-hidden="true">apps</span>
                      <span>Any platform</span>
                    </button>
                    @for (platform of platformTypes; track platform.value) {
                      <button
                        type="button"
                        class="posts-filter-menu__option"
                        role="option"
                        [class.is-active]="form.controls.publishedOn.value === platformFilterValue(platform.value)"
                        [attr.aria-selected]="form.controls.publishedOn.value === platformFilterValue(platform.value)"
                        (click)="selectPlatform(platformFilterValue(platform.value))"
                      >
                        <app-dashboard-platform-logo
                          class="posts-filter-menu__platform-logo"
                          [platformType]="platform.type"
                          size="xs"
                          [compact]="true"
                        />
                        <span>{{ platform.label }}</span>
                      </button>
                    }
                  </div>
                }
              </div>
            </div>
          </div>

          <div class="posts-filters__row posts-filters__row--search">
            <div class="field field--grow">
              <label class="field__label" for="filter-title">Title contains</label>
              <input
                id="filter-title"
                class="field__input"
                type="text"
                formControlName="titleContains"
                autocomplete="off"
                placeholder="Search title…"
              />
            </div>

            <div class="field field--grow">
              <label class="field__label" for="filter-body">Body contains</label>
              <input
                id="filter-body"
                class="field__input"
                type="text"
                formControlName="bodyContains"
                autocomplete="off"
                placeholder="Search content…"
              />
            </div>

            <div class="field field--compact field--date">
              <label class="field__label" for="filter-created-after">Created after</label>
              <input
                id="filter-created-after"
                class="field__input"
                type="date"
                formControlName="createdAfter"
              />
            </div>

            <div class="field field--compact field--date">
              <label class="field__label" for="filter-created-before">Created before</label>
              <input
                id="filter-created-before"
                class="field__input"
                type="date"
                formControlName="createdBefore"
              />
            </div>
          </div>
          </div>

          <div class="posts-filters__actions">
            <button type="submit" class="btn btn--primary" [disabled]="isLoading()">
              <span class="material-icons" aria-hidden="true">check</span>
              Apply filters
            </button>
            <button
              type="button"
              class="btn btn--secondary"
              [disabled]="isLoading() || !filtersActive()"
              (click)="clearFilters()"
            >
              <span class="material-icons" aria-hidden="true">close</span>
              Clear filters
            </button>
          </div>
        </form>
      </div>

      @if (errorMessage()) {
        <p class="posts-status posts-status--error" role="alert">{{ errorMessage() }}</p>
      }
      </div>

      @if (isLoading() && !result()) {
        <app-page-loading label="Loading posts…" />
      }

      @if (result(); as page) {
        <div appPageReveal>
        @if (page.items.length === 0) {
          <div class="posts-empty">
            <p class="posts-status">
              {{ filtersActive() ? 'No posts match your filters.' : 'No posts yet.' }}
            </p>
            @if (!filtersActive()) {
              <a
                class="dashboard-posts__add-btn dashboard-posts__add-btn--empty"
                [routerLink]="['/dashboard/posts/new']"
                [state]="postsReturnState()"
              >
                <span class="material-icons dashboard-posts__add-icon" aria-hidden="true">add</span>
                Create your first post
              </a>
            }
          </div>
        } @else {
          <div class="dashboard-list-board" [class.dashboard-list-board--loading]="isLoading()">
            <div class="dashboard-list-board__head">
              <p class="dashboard-list-board__summary" aria-live="polite">
                Showing
                <strong>{{ showingFrom(page) }}–{{ showingTo(page) }}</strong>
                @if (page.totalPages > 0) {
                  · Page <strong>{{ page.pageIndex }}</strong> of <strong>{{ page.totalPages }}</strong>
                }
              </p>
            </div>
            <ul class="posts-list" appPageReveal [appPageRevealList]="true">
            @for (post of page.items; track post.id) {
              <li>
                <a
                  class="post-card"
                  [class.post-card--has-attachments]="post.attachments.length > 0"
                  [class.post-card--minimal]="!post.body && post.attachments.length === 0 && !post.promptText"
                  [routerLink]="['/dashboard/posts', post.id]"
                  [state]="postsReturnState()"
                >
                  <div class="post-card__head">
                    <h2 class="post-card__title">{{ post.title || 'Untitled' }}</h2>
                    <div class="post-card__badges">
                      @if (post.tags.length > 0) {
                        <div class="post-card__platforms" aria-label="Platforms">
                          @for (tag of post.tags; track tag) {
                            <span class="post-card__platform-logo" [attr.aria-label]="platformTypeLabel(tag)">
                              <app-dashboard-platform-logo
                                [platformType]="platformTypeName(tag)"
                                size="xs"
                                [compact]="true"
                              />
                            </span>
                          }
                        </div>
                      }
                      <span class="post-card__status" [ngClass]="postStatusClass(post.status)">
                        <span class="material-icons post-card__status-icon" aria-hidden="true">{{ postStatusIcon(post.status) }}</span>
                        {{ postStatusLabel(post.status) }}
                      </span>
                    </div>
                  </div>
                  <div
                    class="post-card__content"
                    [class.post-card__content--no-attachments]="post.attachments.length === 0"
                  >
                  @if (post.body) {
                    <p class="post-card__body">
                      <span class="post-card__body-text">
                        @for (segment of hashtagSegments(post.body); track $index) {
                          @if (segment.highlighted) {
                            <span class="hashtag">{{ segment.text }}</span>
                          } @else {
                            {{ segment.text }}
                          }
                        }
                      </span>
                    </p>
                  }
                  @else {
                    <p class="post-card__body post-card__body--empty">No content yet.</p>
                  }
                  @if (post.attachments.length > 0) {
                    <div class="post-card__attachments" aria-label="Attached images">
                      @for (att of visibleAttachments(post.attachments); track att.userUploadedFileId) {
                        <span class="post-card__attachment-thumb" aria-hidden="true">
                          @if (attachmentPreviewUrl(att.userUploadedFileId); as src) {
                            <img class="post-card__attachment-img" [src]="src" alt="" loading="lazy" />
                          } @else {
                            <span class="post-card__attachment-placeholder">
                              <span class="material-icons" aria-hidden="true">image</span>
                            </span>
                          }
                        </span>
                      }
                      @if (hiddenAttachmentCount(post.attachments) > 0) {
                        <span class="post-card__attachment-more">+{{ hiddenAttachmentCount(post.attachments) }}</span>
                      }
                    </div>
                  }
                  </div>
                  @if (post.promptText) {
                    <p class="post-card__prompt">
                      <span class="post-card__label">Prompt</span>
                      {{ post.promptText }}
                    </p>
                  }
                  <div class="post-card__foot">
                    <p class="post-card__meta">
                      <time [attr.datetime]="post.createdAt">{{ post.createdAt | displayDatetime }}</time>
                    </p>
                    <span class="post-card__open-hint" aria-hidden="true">
                      <span class="material-icons">arrow_forward</span>
                    </span>
                  </div>
                </a>
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
            ariaLabel="Posts pagination"
            pageSizeLabel="Rows"
            pageSizeSelectId="posts-page-size"
            (pageChange)="goToPage($event)"
            (pageSizeChange)="onPageSizeChange($event)"
            (previous)="goToPrevious()"
            (next)="goToNext()"
          />
        }
        </div>
      }
    </section>
  `,
})
export class DashboardPosts {
  private readonly postService = inject(PostService);
  private readonly fileService = inject(UserUploadedFileService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly pageSizeOptions = PAGE_SIZE_OPTIONS;
  protected readonly postStatusOptions = POST_STATUS_OPTIONS;
  protected readonly postStatusLabel = getPostStatusLabel;
  protected readonly postStatusClass = getPostStatusClass;
  protected readonly postStatusIcon = getPostStatusIcon;
  protected readonly platformTypeLabel = getPlatformTypeLabel;
  protected readonly platformTypeName = getPlatformTypeName;
  protected readonly platformTypes = PLATFORM_TYPES;
  protected readonly sortByOptions = POST_SORT_BY_OPTIONS;
  protected readonly publicationOptions = PUBLICATION_OPTIONS;
  protected readonly hashtagSegments = parseHashtagSegments;
  protected readonly toPaginationPage = toPaginationPage;

  protected readonly form: PostsForm = new FormGroup({
    pageNumber: new FormControl(1, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(1)],
    }),
    pageSize: new FormControl(10, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(1), Validators.max(100)],
    }),
    sortOrder: new FormControl<SortOrder>('newest', { nonNullable: true }),
    sortBy: new FormControl<SortByFilter>('', { nonNullable: true }),
    status: new FormControl<StatusFilter>('', { nonNullable: true }),
    hasPublication: new FormControl<HasPublicationFilter>('', { nonNullable: true }),
    titleContains: new FormControl('', { nonNullable: true }),
    bodyContains: new FormControl('', { nonNullable: true }),
    publishedOn: new FormControl<PlatformFilter>('', { nonNullable: true }),
    createdAfter: new FormControl('', { nonNullable: true }),
    createdBefore: new FormControl('', { nonNullable: true }),
  });

  protected readonly isLoading = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly result = signal<PagedPostsResponse | null>(null);
  protected readonly filtersOpen = signal(false);
  protected readonly openFilterMenu = signal<FilterMenuId | null>(null);
  private readonly attachmentPreviewUrls = signal<Record<string, string>>({});
  private readonly attachmentPreviewObjectUrls = new Set<string>();

  constructor() {
    this.route.queryParamMap.pipe(take(1)).subscribe((params) => {
      const query = parsePostsListQuery(params);
      this.applyListQuery(query);
      this.loadPosts();
    });

    this.destroyRef.onDestroy(() => {
      document.body.classList.remove('posts-filters-open');
      this.revokeAttachmentPreviewUrls();
    });
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    if (this.openFilterMenu()) {
      this.closeFilterMenu();
      return;
    }
    this.closeFilters();
  }

  @HostListener('document:click')
  protected onDocumentClick(): void {
    this.closeFilterMenu();
  }

  protected toggleFilterMenu(menu: FilterMenuId, event: MouseEvent): void {
    event.stopPropagation();
    this.openFilterMenu.update((current) => (current === menu ? null : menu));
  }

  protected closeFilterMenu(): void {
    this.openFilterMenu.set(null);
  }

  protected sortByTriggerLabel(): string {
    const value = this.form.controls.sortBy.value;
    return POST_SORT_BY_OPTIONS.find((option) => option.value === value)?.label ?? 'Default';
  }

  protected sortByTriggerIcon(): string {
    const value = this.form.controls.sortBy.value;
    return POST_SORT_BY_OPTIONS.find((option) => option.value === value)?.icon ?? 'swap_vert';
  }

  protected statusTriggerLabel(): string {
    const value = this.form.controls.status.value;
    return value ? getPostStatusLabel(value) : 'Any status';
  }

  protected statusTriggerIcon(): string {
    const value = this.form.controls.status.value;
    return value ? getPostStatusIcon(value) : 'list';
  }

  protected publicationTriggerLabel(): string {
    const value = this.form.controls.hasPublication.value;
    return PUBLICATION_OPTIONS.find((option) => option.value === value)?.label ?? 'Any';
  }

  protected publicationTriggerIcon(): string {
    const value = this.form.controls.hasPublication.value;
    return PUBLICATION_OPTIONS.find((option) => option.value === value)?.icon ?? 'remove';
  }

  protected platformTriggerLabel(): string {
    const value = this.form.controls.publishedOn.value;
    return value === '' ? 'Any platform' : getPlatformTypeLabel(Number(value) as PlatformType);
  }

  protected platformTriggerType(): string | null {
    const value = this.form.controls.publishedOn.value;
    return value === '' ? null : getPlatformTypeName(Number(value) as PlatformType);
  }

  protected platformFilterValue(value: PlatformType): PlatformFilter {
    return String(value) as PlatformFilter;
  }

  protected selectSortBy(value: SortByFilter | PostSortBy | ''): void {
    this.form.patchValue({ sortBy: value as SortByFilter });
    this.closeFilterMenu();
  }

  protected selectStatus(value: StatusFilter | ''): void {
    this.form.patchValue({ status: value as StatusFilter });
    this.closeFilterMenu();
  }

  protected selectPublication(value: HasPublicationFilter): void {
    this.form.patchValue({ hasPublication: value });
    this.closeFilterMenu();
  }

  protected selectPlatform(value: PlatformFilter): void {
    this.form.patchValue({ publishedOn: value });
    this.closeFilterMenu();
  }

  protected toggleFilters(): void {
    this.closeFilterMenu();
    this.setFiltersOpen(!this.filtersOpen());
  }

  protected closeFilters(): void {
    this.closeFilterMenu();
    this.setFiltersOpen(false);
  }

  protected postsReturnState(): { postsReturn: PostsListQuery } {
    return { postsReturn: this.currentListQuery() };
  }

  protected filtersActive(): boolean {
    return hasActiveFilters(this.currentListQuery());
  }

  protected applyFilters(): void {
    this.form.patchValue({ pageNumber: 1 });
    this.loadPosts();
    this.closeFilters();
  }

  protected setSortOrder(order: SortOrder): void {
    this.form.patchValue({ sortOrder: order });
  }

  protected clearFilters(): void {
    this.form.patchValue({
      pageNumber: 1,
      sortBy: DEFAULT_POSTS_LIST_QUERY.sortBy,
      sortOrder: DEFAULT_POSTS_LIST_QUERY.sort,
      status: DEFAULT_POSTS_LIST_QUERY.status,
      hasPublication: DEFAULT_POSTS_LIST_QUERY.hasPublication,
      titleContains: DEFAULT_POSTS_LIST_QUERY.titleContains,
      bodyContains: DEFAULT_POSTS_LIST_QUERY.bodyContains,
      publishedOn: DEFAULT_POSTS_LIST_QUERY.publishedOn,
      createdAfter: DEFAULT_POSTS_LIST_QUERY.createdAfter,
      createdBefore: DEFAULT_POSTS_LIST_QUERY.createdBefore,
    });
    this.loadPosts();
    this.closeFilters();
  }

  protected onPageSizeChange(pageSize = this.form.controls.pageSize.value): void {
    this.form.patchValue({ pageNumber: 1, pageSize });
    this.loadPosts();
  }

  protected loadPosts(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const query = this.currentListQuery();
    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.postService
      .getMyPosts(query.page, query.pageSize, postsListQueryToFilterParams(query))
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe({
        next: (response) => {
          this.result.set(response);
          this.syncAttachmentPreviews(response.items);
          this.form.patchValue({ pageNumber: response.pageIndex }, { emitEvent: false });
          this.syncQueryParams();
        },
        error: (error) => {
          this.result.set(null);
          this.errorMessage.set(toApplicationError(error, 'Could not load posts.').description);
        },
      });
  }

  protected showingFrom(page: PagedPostsResponse): number {
    if (page.items.length === 0) {
      return 0;
    }
    return (page.pageIndex - 1) * this.form.controls.pageSize.value + 1;
  }

  protected showingTo(page: PagedPostsResponse): number {
    return this.showingFrom(page) + page.items.length - 1;
  }

  protected goToPage(pageNumber: number): void {
    const page = this.result();
    if (!page || pageNumber === page.pageIndex || pageNumber < 1 || pageNumber > page.totalPages) {
      return;
    }
    this.form.patchValue({ pageNumber });
    this.loadPosts();
  }

  protected goToPrevious(): void {
    const page = this.result();
    if (!page?.hasPreviousPage) {
      return;
    }
    this.goToPage(Math.max(1, page.pageIndex - 1));
  }

  protected goToNext(): void {
    const page = this.result();
    if (!page?.hasNextPage) {
      return;
    }
    this.goToPage(page.pageIndex + 1);
  }

  protected visibleAttachments(attachments: readonly PostAttachmentItem[]): PostAttachmentItem[] {
    return attachments.slice(0, POST_CARD_VISIBLE_ATTACHMENTS);
  }

  protected hiddenAttachmentCount(attachments: readonly PostAttachmentItem[]): number {
    return Math.max(0, attachments.length - POST_CARD_VISIBLE_ATTACHMENTS);
  }

  protected attachmentPreviewUrl(fileId: string): string | null {
    return this.attachmentPreviewUrls()[fileId] ?? null;
  }

  private syncAttachmentPreviews(posts: readonly PostItem[]): void {
    const ids = [...new Set(posts.flatMap((post) => post.attachments.map((attachment) => attachment.userUploadedFileId)))];

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
            // placeholder stays
          },
        });
    }
  }

  private revokeAttachmentPreviewUrls(): void {
    for (const objectUrl of this.attachmentPreviewObjectUrls) {
      URL.revokeObjectURL(objectUrl);
    }
    this.attachmentPreviewObjectUrls.clear();
    this.attachmentPreviewUrls.set({});
  }

  private currentListQuery(): PostsListQuery {
    const {
      pageNumber,
      pageSize,
      sortOrder,
      sortBy,
      status,
      hasPublication,
      titleContains,
      bodyContains,
      publishedOn,
      createdAfter,
      createdBefore,
    } = this.form.getRawValue();

    return {
      page: pageNumber,
      pageSize,
      sort: sortOrder,
      sortBy,
      status,
      hasPublication,
      titleContains,
      bodyContains,
      publishedOn,
      createdAfter,
      createdBefore,
    };
  }

  private applyListQuery(query: PostsListQuery): void {
    this.form.patchValue(
      {
        pageNumber: query.page,
        pageSize: query.pageSize,
        sortOrder: query.sort,
        sortBy: query.sortBy,
        status: query.status,
        hasPublication: query.hasPublication,
        titleContains: query.titleContains,
        bodyContains: query.bodyContains,
        publishedOn: query.publishedOn,
        createdAfter: query.createdAfter,
        createdBefore: query.createdBefore,
      },
      { emitEvent: false }
    );
  }

  private syncQueryParams(): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: postsListQueryToParams(this.currentListQuery()),
      replaceUrl: true,
    });
  }

  private setFiltersOpen(open: boolean): void {
    this.filtersOpen.set(open);
    const lockScroll = open && window.matchMedia('(max-width: 48rem)').matches;
    document.body.classList.toggle('posts-filters-open', lockScroll);
  }
}
