import { NgClass } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { filter, finalize, switchMap, take } from 'rxjs';
import { PageLoading } from '../../../components/page-loading/page-loading';
import { PageRevealDirective } from '../../../directives/page-reveal';
import { drawerMotionDelay } from '../../../layout/shared/drawer-motion';
import { toApplicationError } from '../../../models/application-error';
import {
  CALENDAR_ENTRY_STATUS_OPTIONS,
  CALENDAR_NAME_MAX_LENGTH,
  DEFAULT_CALENDAR_NAME,
  getCalendarEntryStatusClass,
  getCalendarEntryStatusIcon,
  getCalendarEntryStatusLabel,
  isCalendarEntryReschedulable,
  type CalendarEntry,
  type ContentCalendar,
} from '../../../models/calendar';
import type { PostItem } from '../../../models/post';
import { CalendarService } from '../../../services/calendar';
import { PostService } from '../../../services/post';
import { DashboardDeleteConfirmService } from '../shared/dashboard-delete-confirm-sheet/dashboard-delete-confirm.service';
import { DashboardAlert } from '../shared/dashboard-alert/dashboard-alert';
import { DashboardPageHeader } from '../shared/dashboard-page-header/dashboard-page-header';
import {
  CALENDAR_LOCALE,
  addMonths,
  buildMonthWeeks,
  capitalize,
  dayKey,
  isSameDay,
  isSameMonth,
  moveToDay,
  startOfDay,
  startOfMonth,
  type CalendarDay,
} from './calendar-dates';
import { DashboardCalendarSchedule, type CalendarScheduleSaved } from './dashboard-calendar-schedule';

type CalendarEntryView = {
  entry: CalendarEntry;
  date: Date;
  time: string;
  title: string;
  statusClass: string;
  statusLabel: string;
  statusIcon: string;
  reschedulable: boolean;
};

type CalendarCell = CalendarDay & {
  entries: CalendarEntryView[];
  isToday: boolean;
  isPast: boolean;
};

type Notice = {
  kind: 'success' | 'error';
  text: string;
};

/** Polish plural of "wpis" (1 wpis, 2–4 wpisy, 5+ wpisów). */
function entriesLabel(count: number): string {
  const lastDigit = count % 10;
  const lastTwo = count % 100;

  if (count === 1) {
    return 'zaplanowany wpis';
  }

  return lastDigit >= 2 && lastDigit <= 4 && !(lastTwo >= 12 && lastTwo <= 14)
    ? 'zaplanowane wpisy'
    : 'zaplanowanych wpisów';
}

/** Entries rendered inside one day cell before collapsing into "+N więcej". */
const MAX_CHIPS_PER_DAY = 3;
const NOTICE_MS = 5000;
const EXCERPT_LENGTH = 150;

@Component({
  selector: 'app-dashboard-calendar',
  imports: [
    NgClass,
    RouterLink,
    PageLoading,
    PageRevealDirective,
    DashboardAlert,
    DashboardPageHeader,
    DashboardCalendarSchedule,
  ],
  styleUrl: './dashboard-calendar.scss',
  template: `
    <section class="dashboard-content-page dashboard-calendar" aria-labelledby="dashboard-calendar-title">
      <div appPageReveal>
        <app-dashboard-page-header
          titleId="dashboard-calendar-title"
          eyebrow="Plan publikacji"
          title="Kalendarz"
          titleMark="pod ręką"
          intro="Rozplanuj posty na właściwe dni i godziny. Przeciągnij wpis na inny dzień, aby zmienić termin."
          scribble="Zaplanuj. Opublikuj."
        >
          @if (calendar()) {
            <button #addButton type="button" class="dashboard-calendar__add-btn" (click)="openCreate()">
              <span class="material-icons dashboard-calendar__add-icon" aria-hidden="true">add</span>
              Zaplanuj post
            </button>
          }
        </app-dashboard-page-header>
      </div>

      @if (isLoading()) {
        <app-page-loading label="Ładowanie kalendarza…" />
      }

      <app-dashboard-alert [message]="loadError()" [retryable]="true" (retry)="reload()" />

      @if (!isLoading() && !loadError()) {
        @if (notice(); as current) {
          <app-dashboard-alert
            [tone]="current.kind === 'error' ? 'error' : 'success'"
            [message]="current.text"
            [dismissible]="true"
            (dismissed)="notice.set(null)"
          />
        }

        @if (calendar(); as active) {
          <div class="dashboard-calendar__body" appPageReveal>
            <ul class="cal-stats" aria-label="Podsumowanie kalendarza">
              <li class="cal-stat">
                <span class="cal-stat__icon material-icons" aria-hidden="true">event_available</span>
                <span class="cal-stat__copy">
                  <strong class="cal-stat__value">{{ stats().scheduled }}</strong>
                  <span class="cal-stat__label">Zaplanowane</span>
                </span>
              </li>
              <li class="cal-stat cal-stat--wide">
                <span class="cal-stat__icon material-icons" aria-hidden="true">alarm</span>
                <span class="cal-stat__copy">
                  @if (stats().next; as next) {
                    <strong class="cal-stat__value cal-stat__value--text">{{ whenLabel(next.date) }}</strong>
                    <span class="cal-stat__label cal-stat__label--ellipsis">Najbliższa · {{ next.title }}</span>
                  } @else {
                    <strong class="cal-stat__value cal-stat__value--text">Brak zaplanowanych</strong>
                    <span class="cal-stat__label">Najbliższa publikacja</span>
                  }
                </span>
              </li>
              <li class="cal-stat">
                <span class="cal-stat__icon material-icons" aria-hidden="true">check_circle</span>
                <span class="cal-stat__copy">
                  <strong class="cal-stat__value">{{ stats().published }}</strong>
                  <span class="cal-stat__label">Opublikowane</span>
                </span>
              </li>
              <li class="cal-stat" [class.cal-stat--alert]="stats().failed > 0">
                <span class="cal-stat__icon material-icons" aria-hidden="true">error_outline</span>
                <span class="cal-stat__copy">
                  <strong class="cal-stat__value">{{ stats().failed }}</strong>
                  <span class="cal-stat__label">Nieudane</span>
                </span>
              </li>
            </ul>

            <div class="cal-layout">
              <article class="cal-panel" [attr.aria-label]="active.name">
                <header class="cal-panel__head">
                  <div class="cal-panel__identity">
                    <span class="cal-panel__icon" aria-hidden="true">
                      <span class="material-icons">calendar_month</span>
                    </span>

                    @if (renaming()) {
                      <form class="cal-rename" (submit)="saveRename($event)">
                        <input
                          #renameInput
                          class="cal-rename__input"
                          type="text"
                          aria-label="Nazwa kalendarza"
                          autocomplete="off"
                          [attr.maxlength]="nameMaxLength"
                          [value]="nameDraft()"
                          (input)="nameDraft.set(inputValue($event))"
                          (keydown.escape)="cancelRename()"
                        />
                        <button
                          type="submit"
                          class="cal-action cal-action--primary"
                          [disabled]="isRenaming() || !nameDraft().trim()"
                        >
                          <span class="material-icons" aria-hidden="true">check</span>
                          Zapisz
                        </button>
                        <button
                          type="button"
                          class="cal-action"
                          [disabled]="isRenaming()"
                          (click)="cancelRename()"
                        >
                          Anuluj
                        </button>
                      </form>
                    } @else {
                      <h2 id="cal-name" class="cal-panel__name">{{ active.name }}</h2>
                    }
                  </div>

                  @if (!renaming()) {
                    <div class="cal-panel__tools">
                      <button type="button" class="cal-action" (click)="startRename(active)">
                        <span class="material-icons" aria-hidden="true">edit</span>
                        Zmień nazwę
                      </button>
                      <button
                        type="button"
                        class="cal-action cal-action--icon cal-action--danger"
                        aria-label="Usuń kalendarz"
                        title="Usuń kalendarz"
                        (click)="deleteCalendar(active)"
                      >
                        <span class="material-icons" aria-hidden="true">delete</span>
                      </button>
                    </div>
                  }
                </header>

                <div class="cal-toolbar">
                  <nav class="cal-nav" aria-label="Nawigacja po miesiącach">
                    <button type="button" class="cal-icon-btn" aria-label="Poprzedni miesiąc" (click)="shiftMonth(-1)">
                      <span class="material-icons" aria-hidden="true">chevron_left</span>
                    </button>
                    <h3 class="cal-nav__label" aria-live="polite">{{ monthLabel() }}</h3>
                    <button type="button" class="cal-icon-btn" aria-label="Następny miesiąc" (click)="shiftMonth(1)">
                      <span class="material-icons" aria-hidden="true">chevron_right</span>
                    </button>
                  </nav>

                  <button
                    type="button"
                    class="cal-nav__today"
                    [disabled]="isViewingToday()"
                    (click)="goToToday()"
                  >
                    <span class="material-icons" aria-hidden="true">today</span>
                    Dziś
                  </button>
                </div>

                <div class="cal-grid" role="grid" [attr.aria-label]="monthLabel()">
                  <div class="cal-grid__weekdays" role="row">
                    @for (label of weekdayLabels; track label) {
                      <span class="cal-grid__weekday" role="columnheader">{{ label }}</span>
                    }
                  </div>

                  @for (week of weeks(); track week[0].key) {
                    <div class="cal-grid__week" role="row">
                      @for (cell of week; track cell.key) {
                        <div
                          class="cal-day"
                          role="gridcell"
                          [class.is-outside]="!cell.inMonth"
                          [class.is-today]="cell.isToday"
                          [class.is-past]="cell.isPast"
                          [class.is-selected]="cell.key === selectedKey()"
                          [class.is-drop-target]="cell.key === dropTargetKey()"
                          [attr.aria-selected]="cell.key === selectedKey()"
                          [attr.aria-disabled]="cell.isPast ? 'true' : null"
                          (click)="selectDay(cell.date)"
                          (dragover)="onDragOver($event, cell)"
                          (dragleave)="onDragLeave($event, cell)"
                          (drop)="onDrop($event, cell)"
                        >
                          <div class="cal-day__top">
                            <button
                              type="button"
                              class="cal-day__num"
                              [attr.aria-label]="dayLabel(cell.date)"
                              [attr.aria-current]="cell.isToday ? 'date' : null"
                              [disabled]="cell.isPast"
                              (click)="selectDay(cell.date); $event.stopPropagation()"
                            >
                              {{ cell.date.getDate() }}
                            </button>
                            @if (!cell.isPast) {
                              <button
                                type="button"
                                class="cal-day__add"
                                [attr.aria-label]="'Zaplanuj post na ' + dayLabel(cell.date)"
                                title="Zaplanuj post"
                                (click)="openCreate(cell.date); $event.stopPropagation()"
                              >
                                <span class="material-icons" aria-hidden="true">add</span>
                              </button>
                            }
                          </div>

                          @if (cell.entries.length > 0) {
                            <ul class="cal-day__entries">
                              @for (view of cell.entries.slice(0, maxChips); track view.entry.id) {
                                <li>
                                  <div
                                    class="cal-chip"
                                    role="button"
                                    [attr.tabindex]="cell.isPast ? -1 : 0"
                                    [ngClass]="view.statusClass"
                                    [class.is-active]="view.entry.id === activeEntryId()"
                                    [class.is-dragging]="view.entry.id === draggedEntryId()"
                                    [class.is-busy]="isBusy(view.entry.id)"
                                    [class.is-draggable]="view.reschedulable"
                                    [attr.draggable]="view.reschedulable && !isBusy(view.entry.id) ? 'true' : null"
                                    [attr.aria-label]="chipLabel(view)"
                                    [attr.title]="chipLabel(view)"
                                    (click)="onChipClick(view, $event)"
                                    (keydown.enter)="onChipClick(view, $event)"
                                    (keydown.space)="$event.preventDefault(); onChipClick(view, $event)"
                                    (dragstart)="onDragStart($event, view)"
                                    (dragend)="endDrag()"
                                  >
                                    <span class="material-icons cal-chip__icon" aria-hidden="true">{{ view.statusIcon }}</span>
                                    <span class="cal-chip__time">{{ view.time }}</span>
                                    <span class="cal-chip__title">{{ view.title }}</span>
                                  </div>
                                </li>
                              }
                              @if (cell.entries.length > maxChips) {
                                <li>
                                  <button
                                    type="button"
                                    class="cal-day__more"
                                    [disabled]="cell.isPast"
                                    (click)="selectDay(cell.date); $event.stopPropagation()"
                                  >
                                    +{{ cell.entries.length - maxChips }} więcej
                                  </button>
                                </li>
                              }
                            </ul>
                          }
                        </div>
                      }
                    </div>
                  }
                </div>

                <ul class="cal-legend" aria-label="Legenda statusów">
                  @for (option of statusOptions; track option.value) {
                    <li class="cal-legend__item" [ngClass]="statusClass(option.value)">
                      <span class="cal-legend__dot" aria-hidden="true"></span>
                      {{ option.label }}
                    </li>
                  }
                </ul>
              </article>

              <aside class="cal-day-panel" aria-labelledby="cal-day-panel-title">
                <header class="cal-day-panel__head">
                  <div>
                    <p class="cal-day-panel__eyebrow">{{ selectedDayEyebrow() }}</p>
                    <h2 id="cal-day-panel-title" class="cal-day-panel__title">{{ selectedDayTitle() }}</h2>
                  </div>
                  @if (canScheduleOnSelectedDay()) {
                    <button
                      type="button"
                      class="cal-day-panel__add"
                      title="Zaplanuj post na ten dzień"
                      (click)="openCreate(selectedDay())"
                    >
                      <span class="material-icons" aria-hidden="true">add</span>
                      Dodaj
                    </button>
                  }
                </header>

                @if (selectedEntries().length === 0) {
                  <div class="cal-day-panel__empty">
                    <span class="cal-day-panel__empty-icon material-icons" aria-hidden="true">event_busy</span>
                    <h3>Nic nie zaplanowano</h3>
                    <p>
                      {{
                        canScheduleOnSelectedDay()
                          ? 'Ten dzień jest wolny. Wybierz post i ustal godzinę publikacji.'
                          : 'Na ten dzień nie zaplanowano żadnych postów.'
                      }}
                    </p>
                  </div>
                } @else {
                  <ul class="cal-agenda">
                    @for (view of selectedEntries(); track view.entry.id) {
                      <li
                        class="cal-agenda__item"
                        [ngClass]="view.statusClass"
                        [class.is-active]="view.entry.id === activeEntryId()"
                        [class.is-busy]="isBusy(view.entry.id)"
                      >
                        <time class="cal-agenda__time" [attr.datetime]="view.entry.scheduledAt">{{ view.time }}</time>
                        <div class="cal-agenda__main">
                          <span class="cal-status">
                            <span class="material-icons" aria-hidden="true">{{ view.statusIcon }}</span>
                            {{ view.statusLabel }}
                          </span>
                          <a class="cal-agenda__title" [routerLink]="['/dashboard/posts', view.entry.postId]">
                            {{ view.title }}
                          </a>
                          @if (excerpt(view.entry.postId); as text) {
                            <p class="cal-agenda__excerpt">{{ text }}</p>
                          }
                          <div class="cal-agenda__actions">
                            @if (view.reschedulable) {
                              <button
                                type="button"
                                class="cal-action cal-action--primary"
                                [disabled]="isBusy(view.entry.id)"
                                (click)="openEdit(view)"
                              >
                                <span class="material-icons" aria-hidden="true">edit_calendar</span>
                                Zmień termin
                              </button>
                            }
                            <a class="cal-action" [routerLink]="['/dashboard/posts', view.entry.postId]">
                              <span class="material-icons" aria-hidden="true">open_in_new</span>
                              Otwórz post
                            </a>
                          </div>
                        </div>
                        <button
                          type="button"
                          class="cal-action cal-action--icon cal-action--danger cal-agenda__remove"
                          aria-label="Usuń z kalendarza"
                          title="Usuń z kalendarza"
                          [disabled]="isBusy(view.entry.id)"
                          (click)="removeEntry(view)"
                        >
                          <span class="material-icons" aria-hidden="true">delete</span>
                        </button>
                      </li>
                    }
                  </ul>
                }
              </aside>
            </div>
          </div>
        } @else {
          <div class="cal-onboarding" appPageReveal>
            <div class="cal-onboarding__art" aria-hidden="true">
              <div class="cal-onboarding__sheet">
                <span class="cal-onboarding__sheet-top"></span>
                <span class="cal-onboarding__sheet-grid">
                  @for (dot of onboardingDots; track $index) {
                    <i [class.is-lit]="dot"></i>
                  }
                </span>
              </div>
              <span class="cal-onboarding__badge material-icons">event_available</span>
            </div>

            <div class="cal-onboarding__copy">
              <p class="cal-onboarding__eyebrow">Zacznij tutaj</p>
              <h2 class="cal-onboarding__title">Stwórz swój kalendarz treści</h2>
              <p class="cal-onboarding__lead">
                Nadaj mu nazwę, a potem wybieraj posty i ustalaj, kiedy mają zostać opublikowane.
              </p>

              <ul class="cal-onboarding__points">
                <li><span class="material-icons" aria-hidden="true">touch_app</span>Klikaj dni, aby planować publikacje</li>
                <li><span class="material-icons" aria-hidden="true">drag_indicator</span>Przeciągaj wpisy, aby zmieniać terminy</li>
                <li><span class="material-icons" aria-hidden="true">monitoring</span>Śledź statusy: zaplanowane, opublikowane, nieudane</li>
              </ul>

              @if (createError(); as message) {
                <app-dashboard-alert [compact]="true" [message]="message" />
              }

              <form class="cal-onboarding__form" (submit)="createCalendar($event)">
                <label class="cal-field">
                  <span class="cal-field__label">Nazwa kalendarza</span>
                  <input
                    class="cal-field__input"
                    type="text"
                    autocomplete="off"
                    [attr.maxlength]="nameMaxLength"
                    [value]="newCalendarName()"
                    (input)="newCalendarName.set(inputValue($event))"
                  />
                </label>
                <button
                  type="submit"
                  class="btn btn--primary cal-onboarding__submit"
                  [disabled]="isCreatingCalendar() || !newCalendarName().trim()"
                >
                  <span class="material-icons" aria-hidden="true">add</span>
                  {{ isCreatingCalendar() ? 'Tworzenie…' : 'Utwórz kalendarz' }}
                </button>
              </form>
            </div>
          </div>
        }
      }

      @if (calendar(); as active) {
        <app-dashboard-calendar-schedule
          [open]="drawerOpen()"
          [closing]="drawerClosing()"
          [mode]="drawerMode()"
          [calendarId]="active.id"
          [posts]="posts()"
          [postsLoading]="postsLoading()"
          [postsError]="postsError()"
          [scheduledPostIds]="scheduledPostIds()"
          [entry]="drawerEntry()"
          [initialDate]="drawerInitialDate()"
          (closed)="closeDrawer()"
          (saved)="onSaved($event)"
        />
      }
    </section>
  `,
})
export class DashboardCalendar {
  private readonly calendarService = inject(CalendarService);
  private readonly postService = inject(PostService);
  private readonly deleteConfirm = inject(DashboardDeleteConfirmService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly addButton = viewChild<ElementRef<HTMLButtonElement>>('addButton');
  private readonly renameInput = viewChild<ElementRef<HTMLInputElement>>('renameInput');

  protected readonly maxChips = MAX_CHIPS_PER_DAY;
  protected readonly nameMaxLength = CALENDAR_NAME_MAX_LENGTH;
  protected readonly statusOptions = CALENDAR_ENTRY_STATUS_OPTIONS;
  protected readonly statusClass = getCalendarEntryStatusClass;
  protected readonly onboardingDots = Array.from({ length: 21 }, (_, index) => [2, 4, 9, 13, 16].includes(index));

  private readonly dayFormat = new Intl.DateTimeFormat(CALENDAR_LOCALE, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  private readonly shortDayFormat = new Intl.DateTimeFormat(CALENDAR_LOCALE, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
  private readonly timeFormat = new Intl.DateTimeFormat(CALENDAR_LOCALE, {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  private readonly monthFormat = new Intl.DateTimeFormat(CALENDAR_LOCALE, { month: 'long', year: 'numeric' });
  private readonly weekdayFormat = new Intl.DateTimeFormat(CALENDAR_LOCALE, { weekday: 'long' });

  /** Mon–Sun short names (2024-01-01 is a Monday). */
  protected readonly weekdayLabels = Array.from({ length: 7 }, (_, index) =>
    new Intl.DateTimeFormat(CALENDAR_LOCALE, { weekday: 'short' })
      .format(new Date(2024, 0, 1 + index))
      .replace('.', ''),
  );

  protected readonly isLoading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly calendar = signal<ContentCalendar | null>(null);
  protected readonly notice = signal<Notice | null>(null);

  protected readonly posts = signal<PostItem[]>([]);
  protected readonly postsLoading = signal(true);
  protected readonly postsError = signal<string | null>(null);
  private readonly postDetails = signal<Record<string, PostItem>>({});
  private readonly failedDetails = signal<ReadonlySet<string>>(new Set());
  private readonly requestedDetails = new Set<string>();

  protected readonly viewMonth = signal(startOfMonth(new Date()));
  protected readonly selectedDay = signal(startOfDay(new Date()));
  protected readonly activeEntryId = signal<string | null>(null);

  protected readonly newCalendarName = signal(DEFAULT_CALENDAR_NAME);
  protected readonly isCreatingCalendar = signal(false);
  protected readonly createError = signal<string | null>(null);

  protected readonly renaming = signal(false);
  protected readonly nameDraft = signal('');
  protected readonly isRenaming = signal(false);

  protected readonly drawerOpen = signal(false);
  protected readonly drawerClosing = signal(false);
  protected readonly drawerMode = signal<'create' | 'edit'>('create');
  protected readonly drawerEntry = signal<CalendarEntry | null>(null);
  protected readonly drawerInitialDate = signal<Date | null>(null);

  protected readonly draggedEntryId = signal<string | null>(null);
  protected readonly dropTargetKey = signal<string | null>(null);
  private readonly busyEntryIds = signal<ReadonlySet<string>>(new Set());

  private noticeTimer: ReturnType<typeof setTimeout> | null = null;
  private drawerCloseTimer: ReturnType<typeof setTimeout> | null = null;

  private readonly postTitles = computed(() => new Map(this.posts().map((post) => [post.id, post.title])));

  private readonly entryViews = computed<CalendarEntryView[]>(() => {
    const titles = this.postTitles();
    const details = this.postDetails();
    const failed = this.failedDetails();
    const loadingPosts = this.postsLoading();

    return (this.calendar()?.entries ?? [])
      .map((entry) => {
        const date = new Date(entry.scheduledAt);
        const known = titles.has(entry.postId) || entry.postId in details;
        const title = (details[entry.postId]?.title ?? titles.get(entry.postId))?.trim();
        // Not in the list and not (yet) fetched by id: still resolving, unless the fetch failed.
        const unresolved = !loadingPosts && failed.has(entry.postId) ? 'Post niedostępny' : 'Ładowanie…';

        return {
          entry,
          date,
          time: this.timeFormat.format(date),
          title: title || (known ? 'Post bez tytułu' : unresolved),
          statusClass: getCalendarEntryStatusClass(entry.status),
          statusLabel: getCalendarEntryStatusLabel(entry.status),
          statusIcon: getCalendarEntryStatusIcon(entry.status),
          reschedulable: isCalendarEntryReschedulable(entry),
        };
      })
      .sort((left, right) => left.date.getTime() - right.date.getTime());
  });

  private readonly entriesByDay = computed(() => {
    const byDay = new Map<string, CalendarEntryView[]>();
    for (const view of this.entryViews()) {
      const key = dayKey(view.date);
      byDay.set(key, [...(byDay.get(key) ?? []), view]);
    }

    return byDay;
  });

  protected readonly weeks = computed<CalendarCell[][]>(() => {
    const byDay = this.entriesByDay();
    const today = startOfDay(new Date());
    const todayKey = dayKey(today);

    return buildMonthWeeks(this.viewMonth()).map((week) =>
      week.map((day) => ({
        ...day,
        entries: byDay.get(day.key) ?? [],
        isToday: day.key === todayKey,
        isPast: day.date.getTime() < today.getTime(),
      })),
    );
  });

  protected readonly monthLabel = computed(() => capitalize(this.monthFormat.format(this.viewMonth())));
  protected readonly selectedKey = computed(() => dayKey(this.selectedDay()));
  protected readonly selectedEntries = computed(() => this.entriesByDay().get(this.selectedKey()) ?? []);
  protected readonly isViewingToday = computed(() => {
    const today = new Date();
    return isSameMonth(this.viewMonth(), today) && isSameDay(this.selectedDay(), today);
  });

  protected readonly canScheduleOnSelectedDay = computed(
    () => this.selectedDay().getTime() >= startOfDay(new Date()).getTime(),
  );

  protected readonly selectedDayEyebrow = computed(() => {
    const day = this.selectedDay();
    return isSameDay(day, new Date()) ? 'Dziś' : capitalize(this.weekdayFormat.format(day));
  });

  protected readonly selectedDayTitle = computed(() =>
    new Intl.DateTimeFormat(CALENDAR_LOCALE, { day: 'numeric', month: 'long', year: 'numeric' }).format(
      this.selectedDay(),
    ),
  );

  protected readonly scheduledPostIds = computed<ReadonlySet<string>>(
    () =>
      new Set(
        (this.calendar()?.entries ?? [])
          .filter((entry) => entry.status === 'Scheduled')
          .map((entry) => entry.postId),
      ),
  );

  protected readonly stats = computed(() => {
    const now = Date.now();
    const views = this.entryViews();
    const scheduled = views.filter((view) => view.entry.status === 'Scheduled');

    return {
      scheduled: scheduled.length,
      next: scheduled.find((view) => view.date.getTime() > now) ?? null,
      published: views.filter((view) => view.entry.status === 'Published').length,
      failed: views.filter((view) => view.entry.status === 'Failed').length,
    };
  });

  /**
   * Posts to fetch individually (`GET /posts/{id}`): every post of the selected day (for the body
   * excerpt) plus any post visible in the grid that the summary list does not know — which is
   * all of them when the list endpoint is unavailable (it is admin-only on the backend).
   */
  private readonly postIdsToResolve = computed(() => {
    const ids = new Set(this.selectedEntries().map((view) => view.entry.postId));

    if (!this.postsLoading()) {
      const titles = this.postTitles();
      for (const week of this.weeks()) {
        for (const cell of week) {
          for (const view of cell.entries) {
            if (!titles.has(view.entry.postId)) {
              ids.add(view.entry.postId);
            }
          }
        }
      }
    }

    return [...ids].sort().join(',');
  });

  private readonly resolvePosts = effect(() => {
    const ids = this.postIdsToResolve();
    untracked(() => this.ensureDetails(ids ? ids.split(',') : []));
  });

  constructor() {
    this.load();

    this.destroyRef.onDestroy(() => {
      this.clearNoticeTimer();
      this.clearDrawerCloseTimer();
      document.body.classList.remove('post-create-open');
    });
  }

  protected reload(): void {
    this.load();
  }

  protected inputValue(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  // —— Navigation ————————————————————————————————————————————

  protected shiftMonth(delta: number): void {
    const next = addMonths(this.viewMonth(), delta);
    const today = startOfDay(new Date());
    this.viewMonth.set(next);
    if (isSameMonth(next, today)) {
      this.selectedDay.set(today);
    } else if (next.getTime() > today.getTime()) {
      this.selectedDay.set(next);
    }
    // Past months are browse-only: the selection stays on the current/last valid day.
    this.activeEntryId.set(null);
  }

  protected goToToday(): void {
    const today = startOfDay(new Date());
    this.viewMonth.set(startOfMonth(today));
    this.selectedDay.set(today);
    this.activeEntryId.set(null);
  }

  protected selectDay(date: Date): void {
    const day = startOfDay(date);

    // Days that are already over cannot be picked.
    if (day.getTime() < startOfDay(new Date()).getTime()) {
      return;
    }

    this.selectedDay.set(day);
    this.activeEntryId.set(null);

    if (!isSameMonth(day, this.viewMonth())) {
      this.viewMonth.set(startOfMonth(day));
    }
  }

  protected onChipClick(view: CalendarEntryView, event: Event): void {
    event.stopPropagation();
    if (view.date.getTime() < startOfDay(new Date()).getTime()) {
      return;
    }

    this.selectDay(view.date);
    this.activeEntryId.set(view.entry.id);
  }

  // —— Labels ————————————————————————————————————————————————

  protected dayLabel(date: Date): string {
    return this.dayFormat.format(date);
  }

  protected whenLabel(date: Date): string {
    return `${capitalize(this.shortDayFormat.format(date))} · ${this.timeFormat.format(date)}`;
  }

  protected chipLabel(view: CalendarEntryView): string {
    return `${view.time} — ${view.title} (${view.statusLabel})`;
  }

  protected excerpt(postId: string): string | null {
    const body = this.postDetails()[postId]?.body?.replace(/\s+/g, ' ').trim();
    if (!body) {
      return null;
    }

    return body.length > EXCERPT_LENGTH ? `${body.slice(0, EXCERPT_LENGTH).trimEnd()}…` : body;
  }

  protected isBusy(entryId: string): boolean {
    return this.busyEntryIds().has(entryId);
  }

  // —— Calendar lifecycle ————————————————————————————————————

  protected createCalendar(event: Event): void {
    event.preventDefault();

    const name = this.newCalendarName().trim();
    if (!name || this.isCreatingCalendar()) {
      return;
    }

    this.isCreatingCalendar.set(true);
    this.createError.set(null);

    this.calendarService
      .createCalendar(name)
      .pipe(
        finalize(() => this.isCreatingCalendar.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (calendar) => {
          this.calendar.set(calendar);
          this.goToToday();
        },
        error: (error) =>
          this.createError.set(toApplicationError(error, 'Nie udało się utworzyć kalendarza.').description),
      });
  }

  protected startRename(calendar: ContentCalendar): void {
    this.nameDraft.set(calendar.name);
    this.renaming.set(true);
    afterNextRender(() => this.renameInput()?.nativeElement.select(), { injector: this.injector });
  }

  protected cancelRename(): void {
    if (!this.isRenaming()) {
      this.renaming.set(false);
    }
  }

  protected saveRename(event: Event): void {
    event.preventDefault();

    const calendar = this.calendar();
    const name = this.nameDraft().trim();
    if (!calendar || !name || this.isRenaming()) {
      return;
    }

    if (name === calendar.name) {
      this.renaming.set(false);
      return;
    }

    this.isRenaming.set(true);
    this.calendarService
      .renameCalendar(calendar.id, name)
      .pipe(
        finalize(() => this.isRenaming.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.calendar.update((current) => (current ? { ...current, name } : current));
          this.renaming.set(false);
          this.showNotice('success', 'Zmieniono nazwę kalendarza.');
        },
        error: (error) =>
          this.showNotice('error', toApplicationError(error, 'Nie udało się zmienić nazwy kalendarza.').description),
      });
  }

  protected deleteCalendar(calendar: ContentCalendar): void {
    const count = calendar.entries.length;

    this.deleteConfirm
      .open({
        eyebrow: 'Potwierdź usunięcie',
        title: 'Usunąć ten kalendarz?',
        description:
          count > 0
            ? `Kalendarz „${calendar.name}” oraz ${count} ${entriesLabel(count)} zostaną usunięte. Same posty pozostaną nietknięte.`
            : `Kalendarz „${calendar.name}” zostanie usunięty. Same posty pozostaną nietknięte.`,
        keepLabel: 'Zostaw',
        deleteLabel: 'Usuń kalendarz',
      })
      .pipe(
        take(1),
        filter(Boolean),
        switchMap(() => this.calendarService.deleteCalendar(calendar.id)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.calendar.set(null);
          this.notice.set(null);
          this.newCalendarName.set(DEFAULT_CALENDAR_NAME);
          this.createError.set(null);
          this.renaming.set(false);
        },
        error: (error) =>
          this.showNotice('error', toApplicationError(error, 'Nie udało się usunąć kalendarza.').description),
      });
  }

  // —— Entries ———————————————————————————————————————————————

  protected openCreate(date?: Date): void {
    const day = date ?? this.selectedDay();
    this.drawerMode.set('create');
    this.drawerEntry.set(null);
    this.drawerInitialDate.set(day.getTime() >= startOfDay(new Date()).getTime() ? day : null);
    this.setDrawerState(true);
  }

  protected openEdit(view: CalendarEntryView): void {
    if (!view.reschedulable) {
      return;
    }

    this.drawerMode.set('edit');
    this.drawerEntry.set(view.entry);
    this.drawerInitialDate.set(null);
    this.setDrawerState(true);
  }

  protected closeDrawer(): void {
    if (!this.drawerOpen() || this.drawerClosing()) {
      return;
    }

    this.drawerOpen.set(false);
    this.drawerClosing.set(true);
    this.drawerCloseTimer = setTimeout(() => {
      this.drawerClosing.set(false);
      this.drawerCloseTimer = null;
      document.body.classList.remove('post-create-open');
      requestAnimationFrame(() => this.addButton()?.nativeElement.focus());
    }, drawerMotionDelay());
  }

  protected onSaved(result: CalendarScheduleSaved): void {
    const { entry } = result;

    this.calendar.update((current) => {
      if (!current) {
        return current;
      }

      const entries =
        result.mode === 'create'
          ? [...current.entries, entry]
          : current.entries.map((item) => (item.id === entry.id ? entry : item));

      return { ...current, entries };
    });

    this.revealEntry(entry);
    this.closeDrawer();

    const title = this.entryViews().find((view) => view.entry.id === entry.id)?.title;
    const when = this.whenLabel(new Date(entry.scheduledAt));
    this.showNotice(
      'success',
      result.mode === 'create'
        ? `${title ? `Post „${title}”` : 'Post'} zaplanowano na ${when}.`
        : `Przeniesiono publikację na ${when}.`,
    );
  }

  protected removeEntry(view: CalendarEntryView): void {
    this.deleteConfirm
      .open({
        eyebrow: 'Potwierdź usunięcie',
        title: 'Usunąć z kalendarza?',
        description: `Post „${view.title}” nie będzie już zaplanowany na ${this.whenLabel(view.date)}. Sam post zostanie zachowany.`,
        keepLabel: 'Zostaw',
        deleteLabel: 'Usuń',
      })
      .pipe(
        take(1),
        filter(Boolean),
        switchMap(() => {
          this.setBusy(view.entry.id, true);
          return this.calendarService
            .removeEntry(view.entry.id)
            .pipe(finalize(() => this.setBusy(view.entry.id, false)));
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.calendar.update((current) =>
            current
              ? { ...current, entries: current.entries.filter((item) => item.id !== view.entry.id) }
              : current,
          );
          this.activeEntryId.set(null);
          this.showNotice('success', 'Usunięto z kalendarza.');
        },
        error: (error) =>
          this.showNotice('error', toApplicationError(error, 'Nie udało się usunąć wpisu.').description),
      });
  }

  // —— Drag & drop (moves an entry to another day, keeping its hour) ——————————

  protected onDragStart(event: DragEvent, view: CalendarEntryView): void {
    if (!view.reschedulable || this.isBusy(view.entry.id)) {
      event.preventDefault();
      return;
    }

    event.stopPropagation();
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', view.entry.id);
    }

    this.draggedEntryId.set(view.entry.id);
  }

  protected onDragOver(event: DragEvent, cell: CalendarCell): void {
    if (!this.draggedEntryId() || cell.isPast) {
      return;
    }

    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }

    if (this.dropTargetKey() !== cell.key) {
      this.dropTargetKey.set(cell.key);
    }
  }

  protected onDragLeave(event: DragEvent, cell: CalendarCell): void {
    const next = event.relatedTarget as Node | null;
    if (this.dropTargetKey() === cell.key && !(next && (event.currentTarget as HTMLElement).contains(next))) {
      this.dropTargetKey.set(null);
    }
  }

  protected onDrop(event: DragEvent, cell: CalendarCell): void {
    event.preventDefault();

    const id = this.draggedEntryId() ?? event.dataTransfer?.getData('text/plain') ?? null;
    this.endDrag();

    const view = id ? this.entryViews().find((item) => item.entry.id === id) : undefined;
    if (!view || !view.reschedulable || cell.isPast || isSameDay(view.date, cell.date)) {
      return;
    }

    const next = moveToDay(view.date, cell.date);
    if (next.getTime() <= Date.now()) {
      this.showNotice(
        'error',
        'Ta godzina już minęła. Użyj „Zmień termin”, aby wybrać późniejszy czas.',
      );
      return;
    }

    this.moveEntry(view.entry, next);
  }

  protected endDrag(): void {
    this.draggedEntryId.set(null);
    this.dropTargetKey.set(null);
  }

  // —— Internals —————————————————————————————————————————————

  private moveEntry(entry: CalendarEntry, next: Date): void {
    const scheduledAt = next.toISOString();
    const patch = (value: string): void =>
      this.calendar.update((current) =>
        current
          ? {
              ...current,
              entries: current.entries.map((item) =>
                item.id === entry.id ? { ...item, scheduledAt: value } : item,
              ),
            }
          : current,
      );

    // Optimistic: the entry jumps to the new day immediately and snaps back if the API refuses.
    patch(scheduledAt);
    this.revealEntry({ ...entry, scheduledAt });
    this.setBusy(entry.id, true);

    this.calendarService
      .updateEntry(entry.id, scheduledAt)
      .pipe(
        finalize(() => this.setBusy(entry.id, false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => this.showNotice('success', `Przeniesiono publikację na ${this.whenLabel(next)}.`),
        error: (error) => {
          patch(entry.scheduledAt);
          this.showNotice(
            'error',
            toApplicationError(error, 'Nie udało się zmienić terminu publikacji.').description,
          );
        },
      });
  }

  /** Jumps to the month/day of `entry` and highlights it. */
  private revealEntry(entry: CalendarEntry): void {
    const date = new Date(entry.scheduledAt);
    this.viewMonth.set(startOfMonth(date));
    this.selectedDay.set(startOfDay(date));
    this.activeEntryId.set(entry.id);
  }

  private setBusy(entryId: string, busy: boolean): void {
    this.busyEntryIds.update((current) => {
      const next = new Set(current);
      if (busy) {
        next.add(entryId);
      } else {
        next.delete(entryId);
      }

      return next;
    });
  }

  private setDrawerState(open: boolean): void {
    if (open) {
      this.clearDrawerCloseTimer();
      this.drawerClosing.set(false);
    }

    this.drawerOpen.set(open);
    document.body.classList.toggle('post-create-open', open);
  }

  private showNotice(kind: Notice['kind'], text: string): void {
    this.clearNoticeTimer();
    this.notice.set({ kind, text });
    this.noticeTimer = setTimeout(() => {
      this.notice.set(null);
      this.noticeTimer = null;
    }, NOTICE_MS);
  }

  private clearNoticeTimer(): void {
    if (this.noticeTimer !== null) {
      clearTimeout(this.noticeTimer);
      this.noticeTimer = null;
    }
  }

  private clearDrawerCloseTimer(): void {
    if (this.drawerCloseTimer !== null) {
      clearTimeout(this.drawerCloseTimer);
      this.drawerCloseTimer = null;
    }
  }

  private load(): void {
    this.isLoading.set(true);
    this.loadError.set(null);

    this.calendarService
      .getMyCalendar()
      .pipe(
        finalize(() => this.isLoading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (calendar) => this.calendar.set(calendar),
        error: (error) =>
          this.loadError.set(toApplicationError(error, 'Nie udało się wczytać kalendarza.').description),
      });

    this.loadPosts();
  }

  /** Titles for the grid chips and the post picker (a single lightweight request). */
  private loadPosts(): void {
    this.postsLoading.set(true);
    this.postsError.set(null);

    this.postService
      .getAllPostSummaries()
      .pipe(
        finalize(() => this.postsLoading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (posts) => this.posts.set(posts),
        error: (error) =>
          this.postsError.set(
            // `GET /posts` is admin-only on the backend: regular users get an empty 403.
            error instanceof HttpErrorResponse && error.status === 403
              ? 'Lista Twoich postów nie jest jeszcze dostępna dla tego konta. Wklej zamiast tego identyfikator posta, który chcesz zaplanować.'
              : toApplicationError(error, 'Nie udało się wczytać postów.').description,
          ),
      });
  }

  private ensureDetails(postIds: readonly string[]): void {
    for (const id of postIds) {
      if (this.requestedDetails.has(id)) {
        continue;
      }

      this.requestedDetails.add(id);
      this.postService
        .getPost(id)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (post) => this.postDetails.update((current) => ({ ...current, [id]: post })),
          // Deleted or foreign post: keep the placeholder title and do not retry.
          error: () => this.failedDetails.update((current) => new Set(current).add(id)),
        });
    }
  }
}
