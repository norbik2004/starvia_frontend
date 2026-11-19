import { NgClass } from '@angular/common';
import { Component, DestroyRef, ElementRef, HostListener, inject, signal, viewChild } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { debounceTime, filter, finalize, map, take, type Subscription } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { toApplicationError } from '../../../models/application-error';
import { DisplayDatetimePipe } from '../../../pipes/display-datetime';
import {
  PLATFORM_TYPES,
  POST_SORT_BY_OPTIONS,
  POST_STATUS_OPTIONS,
  getPlatformTypeLabel,
  getPlatformTypeName,
  getPostStatusLabel,
  getPostStatusClass,
  getPostStatusIcon,
  normalizePostPlatforms,
  parseHashtagSegments,
  type PagedPostsResponse,
  type PlatformType,
  type PostAttachmentItem,
  type PostItem,
} from '../../../models/post';
import { PostService } from '../../../services/post';
import { UserUploadedFileService } from '../../../services/user-uploaded-file';
import { DashboardAlert } from '../shared/dashboard-alert/dashboard-alert';
import { DashboardPageHeader } from '../shared/dashboard-page-header/dashboard-page-header';
import { DashboardPaginationPanel } from '../shared/dashboard-pagination-panel/dashboard-pagination-panel';
import { DashboardPlatformLogo } from '../shared/dashboard-platform-logo/dashboard-platform-logo';
import { toPaginationPage } from '../shared/pagination';
import { PageLoading } from '../../../components/page-loading/page-loading';
import { PageRevealDirective } from '../../../directives/page-reveal';
import { DashboardPostCreate } from '../dashboard-post-create/dashboard-post-create';
import { drawerMotionDelay } from '../../../layout/shared/drawer-motion';
import {
  DEFAULT_POSTS_LIST_QUERY,
  POSTS_SEARCH_MAX_LENGTH,
  arePlatformTypeFiltersEqual,
  hasActiveFilters,
  parsePostsListQuery,
  postsListQueryToFilterParams,
  postsListQueryToParams,
  type PostsListQuery,
  type SortByFilter,
  type SortDirection,
  type StatusFilter,
} from './posts-list-query';
const PAGE_SIZE_OPTIONS = [10, 20, 50] as const;
const POST_CARD_VISIBLE_ATTACHMENTS = 4;
const SEARCH_DEBOUNCE_MS = 350;

type PostsForm = FormGroup<{
  pageNumber: FormControl<number>;
  pageSize: FormControl<number>;
  search: FormControl<string>;
  status: FormControl<StatusFilter>;
  platformTypes: FormControl<PlatformType[]>;
  sortBy: FormControl<SortByFilter>;
  order: FormControl<SortDirection>;
}>;

@Component({
  selector: 'app-dashboard-posts',
  imports: [NgClass, ReactiveFormsModule, DisplayDatetimePipe, RouterLink, DashboardAlert, DashboardPageHeader, DashboardPaginationPanel, DashboardPlatformLogo, PageLoading, PageRevealDirective, DashboardPostCreate],
  styleUrl: './dashboard-posts.scss',
  template: `
    <section class="dashboard-content-page dashboard-posts" aria-labelledby="dashboard-posts-title">
      <div appPageReveal class="dashboard-posts__top">
      <div class="dashboard-posts__intro">
        <app-dashboard-page-header
          titleId="dashboard-posts-title"
          eyebrow="Treści"
          title="Posty"
          titleMark="pod kontrolą"
          intro="Twórz, filtruj i planuj publikacje w jednym miejscu."
          scribble="Pisz, planuj, publikuj."
        />

        <div class="posts-query">
          <div class="posts-query__bar">
            <div class="posts-search">
              <span class="material-icons posts-search__icon" aria-hidden="true">search</span>
              <input
                id="posts-search"
                class="posts-search__input"
                type="text"
                inputmode="search"
                autocomplete="off"
                placeholder="Szukaj po tytule…"
                aria-label="Szukaj postów po tytule"
                [formControl]="form.controls.search"
                [attr.maxlength]="searchMaxLength"
                (keydown.enter)="searchNow($event)"
                (keydown.escape)="clearSearch($event)"
              />
              @if (form.controls.search.value) {
                <button
                  type="button"
                  class="posts-search__clear"
                  aria-label="Wyczyść wyszukiwanie"
                  (click)="clearSearch()"
                >
                  <span class="material-icons" aria-hidden="true">close</span>
                </button>
              }
            </div>

            <div class="posts-sort">
              <div class="posts-filter-menu" [class.is-open]="sortMenuOpen()">
                <button
                  type="button"
                  id="posts-sort-trigger"
                  class="posts-filter-menu__trigger posts-sort__trigger"
                  [attr.aria-expanded]="sortMenuOpen()"
                  aria-haspopup="listbox"
                  aria-controls="posts-sort-menu"
                  (click)="toggleSortMenu($event)"
                >
                  <span class="posts-sort__prefix">Sortuj:</span>
                  <span class="material-icons posts-filter-menu__icon" aria-hidden="true">{{ sortByTriggerIcon() }}</span>
                  <span class="posts-filter-menu__label">{{ sortByTriggerLabel() }}</span>
                  <span class="material-icons posts-filter-menu__chevron" aria-hidden="true">expand_more</span>
                </button>
                @if (sortMenuOpen()) {
                  <div
                    id="posts-sort-menu"
                    class="posts-filter-menu__panel"
                    role="listbox"
                    aria-labelledby="posts-sort-trigger"
                    (click)="$event.stopPropagation()"
                  >
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

              <button
                type="button"
                class="posts-sort__direction"
                [attr.aria-label]="'Kierunek sortowania: ' + sortDirectionLabel() + '. Kliknij, aby odwrócić.'"
                [attr.title]="'Odwróć kolejność'"
                (click)="toggleSortOrder()"
              >
                <span class="material-icons" aria-hidden="true">
                  {{ form.controls.order.value === 'desc' ? 'arrow_downward' : 'arrow_upward' }}
                </span>
                <span class="posts-sort__direction-label">{{ sortDirectionLabel() }}</span>
              </button>
            </div>

            <button
              #addPostButton
              type="button"
              class="dashboard-posts__add-btn"
              (click)="openCreateDrawer()"
            >
              <span class="material-icons dashboard-posts__add-icon" aria-hidden="true">add</span>
              Dodaj post
            </button>
          </div>

          <div class="posts-query__filters">
            <div class="posts-query__filter-groups">
              <div class="posts-chips" role="group" aria-label="Filtruj według statusu">
                <button
                  type="button"
                  class="posts-chip"
                  [class.is-active]="!form.controls.status.value"
                  [attr.aria-pressed]="!form.controls.status.value"
                  (click)="selectStatus('')"
                >
                  Wszystkie
                </button>
                @for (status of postStatusOptions; track status.value) {
                  <button
                    type="button"
                    class="posts-chip"
                    [class.is-active]="form.controls.status.value === status.value"
                    [attr.aria-pressed]="form.controls.status.value === status.value"
                    (click)="selectStatus(status.value)"
                  >
                    <span class="material-icons posts-chip__icon" aria-hidden="true">{{ status.icon }}</span>
                    {{ status.label }}
                  </button>
                }
              </div>

              <div
                class="posts-filter-menu posts-platform-picker"
                [class.is-open]="platformMenuOpen()"
                [class.has-selection]="form.controls.platformTypes.value.length > 0"
              >
                <button
                  type="button"
                  id="posts-platform-trigger"
                  class="posts-filter-menu__trigger posts-platform-picker__trigger"
                  [attr.aria-expanded]="platformMenuOpen()"
                  aria-haspopup="listbox"
                  aria-controls="posts-platform-menu"
                  (click)="togglePlatformMenu($event)"
                >
                  <span class="material-icons posts-filter-menu__icon" aria-hidden="true">hub</span>
                  <span class="posts-filter-menu__label">{{ platformPickerLabel() }}</span>
                  <span class="material-icons posts-filter-menu__chevron" aria-hidden="true">expand_more</span>
                </button>
                @if (platformMenuOpen()) {
                  <div
                    id="posts-platform-menu"
                    class="posts-filter-menu__panel posts-platform-picker__panel"
                    role="listbox"
                    aria-multiselectable="true"
                    aria-labelledby="posts-platform-trigger"
                    (click)="$event.stopPropagation()"
                  >
                    @for (platform of platformTypeOptions; track platform.value) {
                      <button
                        type="button"
                        class="posts-filter-menu__option"
                        role="option"
                        [class.is-active]="isPlatformTypeSelected(platform.value)"
                        [attr.aria-selected]="isPlatformTypeSelected(platform.value)"
                        (click)="togglePlatformType(platform.value)"
                      >
                        <span
                          class="posts-platform-picker__check material-icons"
                          aria-hidden="true"
                        >
                          {{ isPlatformTypeSelected(platform.value) ? 'check_box' : 'check_box_outline_blank' }}
                        </span>
                        <span class="posts-filter-menu__platform-logo">
                          <app-dashboard-platform-logo
                            [platformType]="platform.type"
                            size="xs"
                            [compact]="true"
                          />
                        </span>
                        <span>{{ platform.label }}</span>
                      </button>
                    }
                    @if (form.controls.platformTypes.value.length > 0) {
                      <button
                        type="button"
                        class="posts-platform-picker__clear"
                        (click)="clearPlatformTypes()"
                      >
                        Wyczyść platformy
                      </button>
                    }
                  </div>
                }
              </div>
            </div>

            @if (filtersActive()) {
              <button type="button" class="posts-query__reset" (click)="clearFilters()">
                <span class="material-icons" aria-hidden="true">filter_alt_off</span>
                Wyczyść filtry
              </button>
            }
          </div>
        </div>
      </div>

      <app-dashboard-alert [message]="errorMessage()" [retryable]="true" (retry)="loadPosts()" />
      </div>

      @if (isLoading() && !result()) {
        <app-page-loading label="Ładowanie postów…" />
      }

      @if (result(); as page) {
        <div appPageReveal>
        @if (page.items.length === 0) {
          <div class="posts-empty">
            <p class="posts-status">
              {{ filtersActive() ? 'Żaden post nie pasuje do wybranych filtrów.' : 'Nie masz jeszcze żadnych postów.' }}
            </p>
            @if (filtersActive()) {
              <button type="button" class="posts-empty__reset" (click)="clearFilters()">
                <span class="material-icons" aria-hidden="true">filter_alt_off</span>
                Wyczyść filtry
              </button>
            } @else {
              <button
                type="button"
                class="dashboard-posts__add-btn dashboard-posts__add-btn--empty"
                (click)="openCreateDrawer()"
              >
                <span class="material-icons dashboard-posts__add-icon" aria-hidden="true">add</span>
                Utwórz pierwszy post
              </button>
            }
          </div>
        } @else {
          <div class="dashboard-list-board" [class.dashboard-list-board--loading]="isLoading()">
            <div class="dashboard-list-board__head">
              <p class="dashboard-list-board__summary" aria-live="polite">
                Wyświetlane
                <strong>{{ showingFrom(page) }}–{{ showingTo(page) }}</strong>
                z <strong>{{ page.totalCount }}</strong>
                @if (page.totalPages > 1) {
                  · Strona <strong>{{ page.pageIndex }}</strong> z <strong>{{ page.totalPages }}</strong>
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
                    <h2 class="post-card__title">{{ post.title || 'Bez tytułu' }}</h2>
                    <div class="post-card__badges">
                      @if (post.platforms.length > 0) {
                        <div class="post-card__platforms" aria-label="Platformy">
                          @for (platform of post.platforms; track platform) {
                            <span class="post-card__platform-logo" [attr.aria-label]="platformTypeLabel(platform)">
                              <app-dashboard-platform-logo
                                [platformType]="platformTypeName(platform)"
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
                    <p class="post-card__body post-card__body--empty">Brak treści.</p>
                  }
                  @if (post.attachments.length > 0) {
                    <div class="post-card__attachments" aria-label="Załączone obrazy">
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
            ariaLabel="Paginacja postów"
            pageSizeLabel="Na stronie"
            pageSizeSelectId="posts-page-size"
            (pageChange)="goToPage($event)"
            (pageSizeChange)="onPageSizeChange($event)"
            (previous)="goToPrevious()"
            (next)="goToNext()"
          />
        }
        </div>
      }

      <app-dashboard-post-create
        [open]="createDrawerOpen()"
        [closing]="createDrawerClosing()"
        (closed)="closeCreateDrawer()"
      />
    </section>
  `,
})
export class DashboardPosts {
  private readonly postService = inject(PostService);
  private readonly fileService = inject(UserUploadedFileService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly addPostButton = viewChild<ElementRef<HTMLButtonElement>>('addPostButton');

  protected readonly pageSizeOptions = PAGE_SIZE_OPTIONS;
  protected readonly postStatusOptions = POST_STATUS_OPTIONS;
  protected readonly platformTypeOptions = PLATFORM_TYPES;
  protected readonly postStatusLabel = getPostStatusLabel;
  protected readonly postStatusClass = getPostStatusClass;
  protected readonly postStatusIcon = getPostStatusIcon;
  protected readonly platformTypeLabel = getPlatformTypeLabel;
  protected readonly platformTypeName = getPlatformTypeName;
  protected readonly sortByOptions = POST_SORT_BY_OPTIONS;
  protected readonly searchMaxLength = POSTS_SEARCH_MAX_LENGTH;
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
    search: new FormControl(DEFAULT_POSTS_LIST_QUERY.search, { nonNullable: true }),
    status: new FormControl<StatusFilter>(DEFAULT_POSTS_LIST_QUERY.status, { nonNullable: true }),
    platformTypes: new FormControl<PlatformType[]>([...DEFAULT_POSTS_LIST_QUERY.platformTypes], {
      nonNullable: true,
    }),
    sortBy: new FormControl<SortByFilter>(DEFAULT_POSTS_LIST_QUERY.sortBy, { nonNullable: true }),
    order: new FormControl<SortDirection>(DEFAULT_POSTS_LIST_QUERY.order, { nonNullable: true }),
  });

  protected readonly isLoading = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly result = signal<PagedPostsResponse | null>(null);
  protected readonly sortMenuOpen = signal(false);
  protected readonly platformMenuOpen = signal(false);
  protected readonly createDrawerOpen = signal(false);
  protected readonly createDrawerClosing = signal(false);
  private readonly attachmentPreviewUrls = signal<Record<string, string>>({});
  private createDrawerCloseTimer: ReturnType<typeof setTimeout> | null = null;
  private loadSubscription: Subscription | null = null;
  /** Search text of the last request, so a debounced value identical to it is not re-sent. */
  private appliedSearch = '';

  constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const shouldOpen = params.get('create') === 'true';
      if (shouldOpen) {
        this.setCreateDrawerState(true);
      } else if (this.createDrawerOpen()) {
        this.startCreateDrawerClose(false);
      }
    });

    this.route.queryParamMap.pipe(take(1)).subscribe((params) => {
      const query = parsePostsListQuery(params);
      this.applyListQuery(query);
      this.loadPosts();
    });

    // Typing in the search box filters the list live (debounced), always from the first page.
    this.form.controls.search.valueChanges
      .pipe(
        debounceTime(SEARCH_DEBOUNCE_MS),
        map((value) => value.trim()),
        filter((value) => value !== this.appliedSearch),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => {
        this.form.patchValue({ pageNumber: 1 });
        this.loadPosts();
      });

    this.destroyRef.onDestroy(() => {
      this.clearCreateDrawerCloseTimer();
      this.loadSubscription?.unsubscribe();
      document.body.classList.remove('post-create-open');
      this.revokeAttachmentPreviewUrls();
    });
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    if (this.createDrawerOpen() || this.createDrawerClosing()) {
      return;
    }
    this.closeSortMenu();
    this.closePlatformMenu();
  }

  @HostListener('document:click')
  protected onDocumentClick(): void {
    this.closeSortMenu();
    this.closePlatformMenu();
  }

  protected toggleSortMenu(event: MouseEvent): void {
    event.stopPropagation();
    this.closePlatformMenu();
    this.sortMenuOpen.update((open) => !open);
  }

  protected closeSortMenu(): void {
    this.sortMenuOpen.set(false);
  }

  protected togglePlatformMenu(event: MouseEvent): void {
    event.stopPropagation();
    this.closeSortMenu();
    this.platformMenuOpen.update((open) => !open);
  }

  protected closePlatformMenu(): void {
    this.platformMenuOpen.set(false);
  }

  protected platformPickerLabel(): string {
    const selected = this.form.controls.platformTypes.value;
    if (selected.length === 0) {
      return 'Platformy';
    }
    if (selected.length === 1) {
      return this.platformTypeLabel(selected[0]);
    }
    return `${this.platformTypeLabel(selected[0])} +${selected.length - 1}`;
  }

  protected isPlatformTypeSelected(value: PlatformType): boolean {
    return this.form.controls.platformTypes.value.includes(value);
  }

  protected togglePlatformType(value: PlatformType): void {
    const current = this.form.controls.platformTypes.value;
    const next = current.includes(value)
      ? current.filter((item) => item !== value)
      : normalizePostPlatforms([...current, value]);

    if (arePlatformTypeFiltersEqual(current, next)) {
      return;
    }

    this.form.patchValue({ platformTypes: next, pageNumber: 1 });
    this.loadPosts();
  }

  protected clearPlatformTypes(): void {
    if (this.form.controls.platformTypes.value.length === 0) {
      return;
    }
    this.form.patchValue({ platformTypes: [], pageNumber: 1 });
    this.loadPosts();
  }

  protected sortByTriggerLabel(): string {
    const value = this.form.controls.sortBy.value;
    return POST_SORT_BY_OPTIONS.find((option) => option.value === value)?.label ?? '';
  }

  protected sortByTriggerIcon(): string {
    const value = this.form.controls.sortBy.value;
    return POST_SORT_BY_OPTIONS.find((option) => option.value === value)?.icon ?? 'swap_vert';
  }

  /** Human readable meaning of the current direction, which depends on the sorted field. */
  protected sortDirectionLabel(): string {
    const descending = this.form.controls.order.value === 'desc';
    if (this.form.controls.sortBy.value === 'Title') {
      return descending ? 'Z → A' : 'A → Z';
    }
    return descending ? 'Najnowsze' : 'Najstarsze';
  }

  protected selectSortBy(value: SortByFilter): void {
    this.closeSortMenu();
    if (value === this.form.controls.sortBy.value) {
      return;
    }
    this.form.patchValue({ sortBy: value, pageNumber: 1 });
    this.loadPosts();
  }

  protected toggleSortOrder(): void {
    this.form.patchValue({
      order: this.form.controls.order.value === 'desc' ? 'asc' : 'desc',
      pageNumber: 1,
    });
    this.loadPosts();
  }

  protected selectStatus(value: StatusFilter): void {
    if (value === this.form.controls.status.value) {
      return;
    }
    this.form.patchValue({ status: value, pageNumber: 1 });
    this.loadPosts();
  }

  /** Enter in the search box skips the debounce. */
  protected searchNow(event: Event): void {
    event.preventDefault();
    if (this.form.controls.search.value.trim() === this.appliedSearch) {
      return;
    }
    this.form.patchValue({ pageNumber: 1 });
    this.loadPosts();
  }

  protected clearSearch(event?: Event): void {
    if (!this.form.controls.search.value) {
      return;
    }
    event?.preventDefault();
    this.form.patchValue({ search: '', pageNumber: 1 }, { emitEvent: false });
    this.loadPosts();
  }

  protected clearFilters(): void {
    this.form.patchValue(
      {
        pageNumber: 1,
        search: DEFAULT_POSTS_LIST_QUERY.search,
        status: DEFAULT_POSTS_LIST_QUERY.status,
        platformTypes: [...DEFAULT_POSTS_LIST_QUERY.platformTypes],
        sortBy: DEFAULT_POSTS_LIST_QUERY.sortBy,
        order: DEFAULT_POSTS_LIST_QUERY.order,
      },
      { emitEvent: false }
    );
    this.loadPosts();
  }

  protected filtersActive(): boolean {
    return hasActiveFilters(this.currentListQuery());
  }

  protected openCreateDrawer(): void {
    this.closeSortMenu();
    this.closePlatformMenu();
    this.setCreateDrawerState(true);
    this.syncQueryParams();
  }

  protected closeCreateDrawer(): void {
    this.startCreateDrawerClose(true);
  }

  protected postsReturnState(): { postsReturn: PostsListQuery } {
    return { postsReturn: this.currentListQuery() };
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

    // Only the latest request may update the list (fast typing / clicking must not show stale data).
    this.loadSubscription?.unsubscribe();

    const query = this.currentListQuery();
    this.appliedSearch = query.search.trim();
    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.loadSubscription = this.postService
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
          this.errorMessage.set(toApplicationError(error, 'Nie udało się wczytać postów.').description);
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
        .getPreviewUrl(id)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (url) => {
            this.attachmentPreviewUrls.update((current) => ({ ...current, [id]: url }));
          },
          error: () => {
            // placeholder stays
          },
        });
    }
  }

  private revokeAttachmentPreviewUrls(): void {
    this.attachmentPreviewUrls.set({});
  }

  private currentListQuery(): PostsListQuery {
    const { pageNumber, pageSize, search, status, platformTypes, sortBy, order } = this.form.getRawValue();

    return {
      page: pageNumber,
      pageSize,
      search,
      status,
      platformTypes: normalizePostPlatforms(platformTypes),
      sortBy,
      order,
    };
  }

  private applyListQuery(query: PostsListQuery): void {
    this.form.patchValue(
      {
        pageNumber: query.page,
        pageSize: query.pageSize,
        search: query.search,
        status: query.status,
        platformTypes: [...query.platformTypes],
        sortBy: query.sortBy,
        order: query.order,
      },
      { emitEvent: false }
    );
    this.appliedSearch = query.search.trim();
  }

  private syncQueryParams(): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        // Unused keys must be cleared, otherwise they stay in the URL after "Wyczyść filtry".
        search: null,
        status: null,
        platforms: null,
        platformType: null,
        sortBy: null,
        order: null,
        ...postsListQueryToParams(this.currentListQuery()),
        create: this.createDrawerOpen() ? 'true' : null,
      },
      replaceUrl: true,
    });
  }

  private setCreateDrawerState(open: boolean): void {
    if (open) {
      this.clearCreateDrawerCloseTimer();
      this.createDrawerClosing.set(false);
    }
    this.createDrawerOpen.set(open);
    document.body.classList.toggle('post-create-open', open);
  }

  private startCreateDrawerClose(syncQuery: boolean): void {
    if (!this.createDrawerOpen() || this.createDrawerClosing()) {
      return;
    }

    this.createDrawerOpen.set(false);
    this.createDrawerClosing.set(true);
    this.createDrawerCloseTimer = setTimeout(() => {
      this.createDrawerClosing.set(false);
      document.body.classList.remove('post-create-open');
      this.createDrawerCloseTimer = null;
      if (syncQuery) {
        this.syncQueryParams();
      }
      requestAnimationFrame(() => this.addPostButton()?.nativeElement.focus());
    }, drawerMotionDelay());
  }

  private clearCreateDrawerCloseTimer(): void {
    if (this.createDrawerCloseTimer === null) {
      return;
    }
    clearTimeout(this.createDrawerCloseTimer);
    this.createDrawerCloseTimer = null;
  }
}
