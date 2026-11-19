import { NgClass } from '@angular/common';
import {
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
  untracked,
  viewChild,
} from '@angular/core';
import { Subscription, finalize } from 'rxjs';
import { toApplicationError } from '../../../models/application-error';
import type { CalendarEntry } from '../../../models/calendar';
import { getPostStatusClass, getPostStatusIcon, getPostStatusLabel, type PostItem } from '../../../models/post';
import { DrawerMotionDirective } from '../../../layout/shared/drawer-motion';
import { DashboardAlert } from '../shared/dashboard-alert/dashboard-alert';
import { CalendarService } from '../../../services/calendar';
import { PostService } from '../../../services/post';
import {
  CALENDAR_LOCALE,
  capitalize,
  fromInputValues,
  nextMondayAt,
  roundUpToQuarter,
  toDateInputValue,
  toTimeInputValue,
  tomorrowAt,
} from './calendar-dates';

export type CalendarScheduleSaved = {
  mode: 'create' | 'edit';
  entry: CalendarEntry;
};

type QuickPick = {
  id: string;
  label: string;
  icon: string;
  date: Date;
};

/** Max rows rendered in the post picker; the search box narrows the rest down. */
const PICKER_LIMIT = 80;
const GUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Component({
  selector: 'app-dashboard-calendar-schedule',
  imports: [NgClass, DrawerMotionDirective, DashboardAlert],
  styleUrl: './dashboard-calendar-schedule.scss',
  template: `
    <button
      type="button"
      class="schedule-drawer__backdrop"
      appDrawerMotion="backdrop"
      [drawerMotionState]="open() ? 'open' : closing() ? 'closing' : 'closed'"
      [attr.aria-hidden]="!open()"
      aria-label="Zamknij panel planowania"
      (click)="cancel()"
    ></button>

    <aside
      #drawer
      class="schedule-drawer"
      appDrawerMotion="panel"
      [drawerMotionState]="open() ? 'open' : closing() ? 'closing' : 'closed'"
      [attr.aria-hidden]="!open()"
      role="dialog"
      aria-modal="true"
      aria-labelledby="schedule-drawer-title"
    >
      <header class="schedule-drawer__head">
        <div>
          <p class="schedule-drawer__eyebrow">
            {{ mode() === 'edit' ? 'Zmiana terminu' : 'Nowa publikacja' }}
          </p>
          <h1 id="schedule-drawer-title" class="schedule-drawer__title">
            {{ mode() === 'edit' ? 'Zmień termin posta' : 'Zaplanuj post' }}
          </h1>
        </div>
        <button
          type="button"
          class="schedule-drawer__close"
          aria-label="Zamknij panel planowania"
          [disabled]="isSaving()"
          (click)="cancel()"
        >
          <span class="schedule-drawer__close-icon" aria-hidden="true"></span>
        </button>
      </header>

      <form class="schedule-drawer__form" (submit)="submit($event)">
        <div class="schedule-drawer__body">
          <app-dashboard-alert [compact]="true" [message]="errorMessage()" />

          <section class="schedule-section" aria-labelledby="schedule-post-label">
            <h2 id="schedule-post-label" class="schedule-section__label">
              <span class="schedule-section__step" aria-hidden="true">1</span>
              Post
            </h2>

            @if (mode() === 'create') {
              @if (!postsError()) {
                <div class="schedule-search">
                  <span class="material-icons schedule-search__icon" aria-hidden="true">search</span>
                  <input
                    #searchInput
                    type="search"
                    class="schedule-search__input"
                    placeholder="Szukaj w swoich postach"
                    autocomplete="off"
                    aria-label="Szukaj postów"
                    [value]="search()"
                    (input)="search.set(inputValue($event))"
                  />
                </div>
              }

              @if (postsLoading()) {
                <p class="schedule-picker__note" role="status">Ładowanie postów…</p>
              } @else if (postsError()) {
                <app-dashboard-alert [compact]="true" [message]="postsError()" />
                <label class="schedule-field">
                  <span class="schedule-field__label">Identyfikator posta</span>
                  <input
                    #manualInput
                    type="text"
                    class="schedule-field__input"
                    placeholder="np. 3f2b8c1e-9d4a-4b7e-8a1c-5d6e7f8a9b0c"
                    spellcheck="false"
                    autocomplete="off"
                    [value]="manualPostId()"
                    (input)="onManualPostId(inputValue($event))"
                  />
                </label>
                @if (manualPostId() && !selectedPostId()) {
                  <p class="schedule-picker__note schedule-picker__note--error" role="alert">
                    To nie wygląda na identyfikator posta.
                  </p>
                }
              } @else if (posts().length === 0) {
                <p class="schedule-picker__note">
                  Nie masz jeszcze żadnych postów. Najpierw utwórz post, a potem wróć, aby go zaplanować.
                </p>
              } @else if (filteredPosts().length === 0) {
                <p class="schedule-picker__note">Brak postów pasujących do „{{ search() }}”.</p>
              } @else {
                <ul class="schedule-picker" aria-label="Wybierz post">
                  @for (post of filteredPosts(); track post.id) {
                    <li>
                      <button
                        type="button"
                        class="schedule-picker__item"
                        [class.is-selected]="post.id === selectedPostId()"
                        [attr.aria-pressed]="post.id === selectedPostId()"
                        (click)="selectPost(post.id)"
                      >
                        <span class="schedule-picker__check material-icons" aria-hidden="true">
                          {{ post.id === selectedPostId() ? 'check_circle' : 'radio_button_unchecked' }}
                        </span>
                        <span class="schedule-picker__copy">
                          <span class="schedule-picker__title">{{ post.title || 'Bez tytułu' }}</span>
                          @if (scheduledPostIds().has(post.id)) {
                            <span class="schedule-picker__tag">
                              <span class="material-icons" aria-hidden="true">event_available</span>
                              Już zaplanowany
                            </span>
                          }
                        </span>
                      </button>
                    </li>
                  }
                </ul>
                @if (hiddenPostCount() > 0) {
                  <p class="schedule-picker__note">
                    +{{ hiddenPostCount() }} więcej — zawęź wyszukiwanie, aby je znaleźć.
                  </p>
                }
              }
            }

            @if (selectedPostId()) {
              <article class="schedule-preview" aria-live="polite" [attr.aria-busy]="previewLoading()">
                <div class="schedule-preview__head">
                  <h3 class="schedule-preview__title">{{ previewTitle() }}</h3>
                  @if (preview(); as post) {
                    <span class="schedule-preview__status" [ngClass]="postStatusClass(post.status)">
                      <span class="material-icons" aria-hidden="true">{{ postStatusIcon(post.status) }}</span>
                      {{ postStatusLabel(post.status) }}
                    </span>
                  }
                </div>
                @if (previewLoading()) {
                  <p class="schedule-preview__body schedule-preview__body--muted">Ładowanie podglądu…</p>
                } @else if (previewFailed()) {
                  <p class="schedule-preview__body schedule-preview__body--error">
                    Nie znaleziono tego posta. Sprawdź identyfikator i spróbuj ponownie.
                  </p>
                } @else if (preview()?.body; as body) {
                  <p class="schedule-preview__body">{{ body }}</p>
                } @else {
                  <p class="schedule-preview__body schedule-preview__body--muted">Ten post nie ma jeszcze treści.</p>
                }
              </article>
            }
          </section>

          <section class="schedule-section" aria-labelledby="schedule-when-label">
            <h2 id="schedule-when-label" class="schedule-section__label">
              <span class="schedule-section__step" aria-hidden="true">2</span>
              Kiedy
            </h2>

            <div class="schedule-quick" role="group" aria-label="Szybki wybór">
              @for (pick of quickPicks(); track pick.id) {
                <button
                  type="button"
                  class="schedule-quick__chip"
                  [class.is-active]="isQuickPickActive(pick)"
                  (click)="applyQuickPick(pick)"
                >
                  <span class="material-icons" aria-hidden="true">{{ pick.icon }}</span>
                  {{ pick.label }}
                </button>
              }
            </div>

            <div class="schedule-when">
              <label class="schedule-field">
                <span class="schedule-field__label">Data</span>
                <input
                  #dateInput
                  type="date"
                  class="schedule-field__input"
                  required
                  [attr.min]="minDate()"
                  [value]="dateValue()"
                  (input)="dateValue.set(inputValue($event))"
                />
              </label>
              <label class="schedule-field">
                <span class="schedule-field__label">Godzina</span>
                <input
                  type="time"
                  class="schedule-field__input"
                  required
                  step="60"
                  [value]="timeValue()"
                  (input)="timeValue.set(inputValue($event))"
                />
              </label>
            </div>

            <div aria-live="polite">
              @if (validationMessage(); as message) {
                <p class="schedule-when__message schedule-when__message--error" role="alert">
                  <span class="material-icons" aria-hidden="true">error_outline</span>
                  {{ message }}
                </p>
              } @else if (summary(); as text) {
                <p class="schedule-when__message">
                  <span class="material-icons" aria-hidden="true">event</span>
                  <span>{{ text }}</span>
                </p>
              }
            </div>
            <p class="schedule-when__zone">Godziny podane w Twojej strefie czasowej: {{ timeZone }}.</p>
          </section>
        </div>

        <footer class="schedule-drawer__actions">
          <button type="button" class="btn btn--secondary" [disabled]="isSaving()" (click)="cancel()">Anuluj</button>
          <button type="submit" class="btn btn--primary" [disabled]="!canSubmit() || isSaving()">
            <span class="material-icons" aria-hidden="true">{{ mode() === 'edit' ? 'check' : 'event_available' }}</span>
            {{ submitLabel() }}
          </button>
        </footer>
      </form>
    </aside>
  `,
})
export class DashboardCalendarSchedule {
  private readonly calendarService = inject(CalendarService);
  private readonly postService = inject(PostService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly drawer = viewChild<ElementRef<HTMLElement>>('drawer');
  private readonly searchInput = viewChild<ElementRef<HTMLInputElement>>('searchInput');
  private readonly manualInput = viewChild<ElementRef<HTMLInputElement>>('manualInput');
  private readonly dateInput = viewChild<ElementRef<HTMLInputElement>>('dateInput');
  private previewSubscription: Subscription | null = null;

  readonly open = input(false);
  readonly closing = input(false);
  readonly mode = input<'create' | 'edit'>('create');
  readonly calendarId = input.required<string>();
  /** Lightweight post list (`id`, `title`) for the picker. */
  readonly posts = input<readonly PostItem[]>([]);
  readonly postsLoading = input(false);
  readonly postsError = input<string | null>(null);
  readonly scheduledPostIds = input<ReadonlySet<string>>(new Set());
  /** Entry being rescheduled (edit mode). */
  readonly entry = input<CalendarEntry | null>(null);
  /** Day the user clicked in the grid (create mode). */
  readonly initialDate = input<Date | null>(null);

  readonly closed = output<void>();
  readonly saved = output<CalendarScheduleSaved>();

  protected postStatusLabel(status: PostItem['status']): string {
    const labels: Record<string, string> = { Generated: 'Wygenerowany', Draft: 'Szkic', Done: 'Gotowy' };
    const label = getPostStatusLabel(status);
    return labels[label] ?? label;
  }

  protected readonly postStatusClass = getPostStatusClass;
  protected readonly postStatusIcon = getPostStatusIcon;
  protected readonly timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  protected readonly search = signal('');
  protected readonly selectedPostId = signal<string | null>(null);
  protected readonly dateValue = signal('');
  protected readonly timeValue = signal('');
  protected readonly minDate = signal(toDateInputValue(new Date()));
  protected readonly quickPicks = signal<QuickPick[]>([]);
  protected readonly manualPostId = signal('');
  protected readonly preview = signal<PostItem | null>(null);
  protected readonly previewLoading = signal(false);
  protected readonly previewFailed = signal(false);
  protected readonly isSaving = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  private readonly matchingPosts = computed(() => {
    const needle = this.search().trim().toLowerCase();
    const sorted = [...this.posts()].sort(
      (left, right) => Date.parse(right.createdAt || '') - Date.parse(left.createdAt || '') || 0,
    );

    return needle ? sorted.filter((post) => (post.title ?? '').toLowerCase().includes(needle)) : sorted;
  });

  protected readonly filteredPosts = computed(() => this.matchingPosts().slice(0, PICKER_LIMIT));
  protected readonly hiddenPostCount = computed(() => Math.max(0, this.matchingPosts().length - PICKER_LIMIT));

  protected readonly previewTitle = computed(() => {
    const id = this.selectedPostId();
    const title = this.preview()?.title ?? this.posts().find((post) => post.id === id)?.title;
    return title || 'Bez tytułu';
  });

  private readonly scheduledDate = computed(() => fromInputValues(this.dateValue(), this.timeValue()));

  protected readonly validationMessage = computed(() => {
    const date = this.scheduledDate();
    if (!date) {
      return 'Wybierz datę i godzinę.';
    }

    return date.getTime() <= Date.now() ? 'Wybierz moment w przyszłości.' : null;
  });

  protected readonly summary = computed(() => {
    const date = this.scheduledDate();
    if (!date) {
      return null;
    }

    const day = new Intl.DateTimeFormat(CALENDAR_LOCALE, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(date);
    const time = new Intl.DateTimeFormat(CALENDAR_LOCALE, { hour: '2-digit', minute: '2-digit' }).format(date);

    return `${capitalize(day)}, godz. ${time}`;
  });

  protected readonly canSubmit = computed(
    () =>
      !!this.selectedPostId() &&
      !!this.scheduledDate() &&
      this.validationMessage() === null &&
      // A typed-in ID is only trusted once the API confirmed that the post exists.
      (!this.postsError() || this.preview() !== null),
  );

  protected readonly submitLabel = computed(() => {
    if (this.isSaving()) {
      return this.mode() === 'edit' ? 'Zapisywanie…' : 'Planowanie…';
    }

    return this.mode() === 'edit' ? 'Zapisz zmiany' : 'Zaplanuj post';
  });

  private readonly initialiseOnOpen = effect((onCleanup) => {
    if (!this.open()) {
      return;
    }

    untracked(() => this.initialise());
    const frame = requestAnimationFrame(() => {
      const target =
        this.mode() === 'create' ? (this.searchInput() ?? this.manualInput()) : this.dateInput();
      target?.nativeElement.focus();
    });
    onCleanup(() => cancelAnimationFrame(frame));
  });

  constructor() {
    this.destroyRef.onDestroy(() => this.previewSubscription?.unsubscribe());
  }

  @HostListener('document:keydown', ['$event'])
  protected onDocumentKeydown(event: KeyboardEvent): void {
    if (!this.open()) {
      return;
    }

    if (event.key === 'Escape') {
      this.cancel();
      return;
    }

    if (event.key === 'Tab') {
      this.keepFocusInDrawer(event);
    }
  }

  protected inputValue(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  protected selectPost(id: string): void {
    if (this.selectedPostId() === id) {
      return;
    }

    this.selectedPostId.set(id);
    this.loadPreview(id);
  }

  protected onManualPostId(value: string): void {
    const id = value.trim();
    this.manualPostId.set(id);

    if (GUID_PATTERN.test(id)) {
      this.selectedPostId.set(null);
      this.selectPost(id);
      return;
    }

    this.previewSubscription?.unsubscribe();
    this.selectedPostId.set(null);
    this.preview.set(null);
    this.previewLoading.set(false);
    this.previewFailed.set(false);
  }

  protected applyQuickPick(pick: QuickPick): void {
    this.dateValue.set(toDateInputValue(pick.date));
    this.timeValue.set(toTimeInputValue(pick.date));
  }

  protected isQuickPickActive(pick: QuickPick): boolean {
    return (
      this.dateValue() === toDateInputValue(pick.date) && this.timeValue() === toTimeInputValue(pick.date)
    );
  }

  protected cancel(): void {
    if (this.open() && !this.isSaving() && !this.closing()) {
      this.closed.emit();
    }
  }

  protected submit(event: Event): void {
    event.preventDefault();

    const postId = this.selectedPostId();
    const date = this.scheduledDate();
    if (!postId || !date || this.isSaving()) {
      return;
    }

    if (date.getTime() <= Date.now()) {
      this.errorMessage.set('Wybierz moment w przyszłości.');
      return;
    }

    const scheduledAt = date.toISOString();
    this.isSaving.set(true);
    this.errorMessage.set(null);

    if (this.mode() === 'edit') {
      const current = this.entry();
      if (!current) {
        this.isSaving.set(false);
        return;
      }

      this.calendarService
        .updateEntry(current.id, scheduledAt)
        .pipe(finalize(() => this.isSaving.set(false)))
        .subscribe({
          next: () => this.saved.emit({ mode: 'edit', entry: { ...current, scheduledAt } }),
          error: (error) =>
            this.errorMessage.set(toApplicationError(error, 'Nie udało się zmienić terminu publikacji.').description),
        });
      return;
    }

    this.calendarService
      .addEntry({ calendarId: this.calendarId(), postId, scheduledAt })
      .pipe(finalize(() => this.isSaving.set(false)))
      .subscribe({
        next: (id) =>
          this.saved.emit({ mode: 'create', entry: { id, postId, scheduledAt, status: 'Scheduled' } }),
        error: (error) =>
          this.errorMessage.set(toApplicationError(error, 'Nie udało się zaplanować posta.').description),
      });
  }

  private initialise(): void {
    const now = new Date();
    const entry = this.entry();
    const editing = this.mode() === 'edit' && entry !== null;

    this.errorMessage.set(null);
    this.isSaving.set(false);
    this.search.set('');
    this.minDate.set(toDateInputValue(now));
    this.quickPicks.set([
      { id: 'hour', label: 'Za godzinę', icon: 'update', date: roundUpToQuarter(new Date(now.getTime() + 45 * 60_000)) },
      { id: 'tomorrow', label: 'Jutro, 9:00', icon: 'wb_sunny', date: tomorrowAt(now, 9) },
      { id: 'monday', label: 'W poniedziałek, 9:00', icon: 'next_week', date: nextMondayAt(now, 9) },
    ]);

    let target: Date;
    if (editing) {
      target = new Date(entry.scheduledAt);
      this.selectedPostId.set(entry.postId);
      this.loadPreview(entry.postId);
    } else {
      const base = this.initialDate();
      const proposed = base ? new Date(base.getFullYear(), base.getMonth(), base.getDate(), 9, 0) : null;
      target =
        proposed && proposed.getTime() > now.getTime() + 5 * 60_000
          ? proposed
          : roundUpToQuarter(new Date(now.getTime() + 30 * 60_000));
      this.selectedPostId.set(null);
      this.previewSubscription?.unsubscribe();
      this.preview.set(null);
      this.previewLoading.set(false);
      this.previewFailed.set(false);
    }

    this.manualPostId.set('');

    this.dateValue.set(toDateInputValue(target));
    this.timeValue.set(toTimeInputValue(target));
  }

  private loadPreview(postId: string): void {
    this.previewSubscription?.unsubscribe();
    this.preview.set(null);
    this.previewFailed.set(false);
    this.previewLoading.set(true);

    this.previewSubscription = this.postService
      .getPost(postId)
      .pipe(finalize(() => this.previewLoading.set(false)))
      .subscribe({
        next: (post) => this.preview.set(post),
        error: () => {
          this.preview.set(null);
          this.previewFailed.set(true);
        },
      });
  }

  private keepFocusInDrawer(event: KeyboardEvent): void {
    const focusable = Array.from(
      this.drawer()?.nativeElement.querySelectorAll<HTMLElement>(
        'button:not(:disabled), input:not(:disabled), [href], [tabindex]:not([tabindex="-1"])',
      ) ?? [],
    );

    if (focusable.length === 0) {
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
}
